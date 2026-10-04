/* HuSS Scorer — js/detect/qr.js
 * Reads the sheet QR code (spec 7.6). The page is already aligned, so the code is looked
 * for where the template puts it: the three finder patterns are centred by iterated
 * centroids, a module grid is laid through them and each module is sampled, then the grid
 * goes to HUSS.sheet.qr.decodeGrid. If that fails, the expected position is shifted in
 * steps within SEARCH_RADIUS_MM.
 *
 * Positions are page mm; a "sampler" returns darkness (0 = paper, 255 = black) at a page point.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.detect = HUSS.detect || {};

  /** Sampler over a rectified darkness image { width, height, data } at R px/mm (bilinear). */
  function rectSampler(dark, R) {
    var W = dark.width, H = dark.height, d = dark.data;
    return function (x, y) {
      var sx = x * R - 0.5, sy = y * R - 0.5;
      var ix = Math.floor(sx), iy = Math.floor(sy);
      if (ix < 0 || iy < 0 || ix >= W - 1 || iy >= H - 1) return 0;
      var fx = sx - ix, fy = sy - iy, o = iy * W + ix;
      return (1 - fx) * (1 - fy) * d[o] + fx * (1 - fy) * d[o + 1] + (1 - fx) * fy * d[o + W] + fx * fy * d[o + W + 1];
    };
  }

  /** Sampler over the original RGBA image through a page mm -> image px homography. */
  function imageSampler(img, H) {
    var Hm = HUSS.image.homography, C = HUSS.detect.corners;
    return function (x, y) {
      var p = Hm.apply(H, x, y);
      var v = C.sampleLuma(img, p[0], p[1]);
      return v === null ? 0 : 255 - v;
    };
  }

  function otsuOf(values) {
    var hist = new Array(256).fill(0);
    for (var i = 0; i < values.length; i++) hist[Math.max(0, Math.min(255, Math.round(values[i])))]++;
    return HUSS.image.components.otsu(hist) + 0.5;
  }

  /** One read attempt with the code box shifted by (dx, dy) mm. */
  function attempt(sample, T, cfg, dx, dy) {
    var q = cfg.QR, box = T.qr, size = HUSS.sheet.qr.SIZE;
    var n = size + 2 * q.QUIET_MODULES, m = box.size / n;
    var x0 = box.x + dx + q.QUIET_MODULES * m, y0 = box.y + dy + q.QUIET_MODULES * m;

    // Threshold from the code area
    var vals = [], step = m / 2, x, y;
    for (y = y0 - m; y <= y0 + (size + 1) * m; y += step) {
      for (x = x0 - m; x <= x0 + (size + 1) * m; x += step) vals.push(sample(x, y));
    }
    var thr = otsuOf(vals);
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi - lo < q.MIN_CONTRAST) return null;

    // Finder centres (module grid coordinates 3.5 / 17.5): one coarse centroid over the whole
    // finder, then centroids of its 3 x 3 dark core only. The core is ringed by light modules,
    // so neighbouring data and format modules cannot pull the centre.
    var centroid = function (cx, cy, half) {
      var sx = 0, sy = 0, sw = 0, st = m / 6;
      for (var yy = cy - half; yy <= cy + half + 1e-9; yy += st) {
        for (var xx = cx - half; xx <= cx + half + 1e-9; xx += st) {
          if (sample(xx, yy) > thr) { sx += xx; sy += yy; sw++; }
        }
      }
      return sw ? [sx / sw, sy / sw] : null;
    };
    var expected = [[3.5, 3.5], [size - 3.5, 3.5], [3.5, size - 3.5]];
    var centres = expected.map(function (e) {
      var c = [x0 + e[0] * m, y0 + e[1] * m];
      for (var k = 0; c && k < q.COARSE_ITERATIONS; k++) c = centroid(c[0], c[1], q.FINDER_WINDOW_MODULES * m);
      for (var it = 0; c && it < q.FINDER_ITERATIONS; it++) c = centroid(c[0], c[1], q.CORE_WINDOW_MODULES * m);
      return c;
    });
    if (centres.some(function (c) { return !c; })) return null;

    // Module grid through the three centres
    var tl = centres[0], span = size - 7;
    var ex = [(centres[1][0] - tl[0]) / span, (centres[1][1] - tl[1]) / span];
    var ey = [(centres[2][0] - tl[0]) / span, (centres[2][1] - tl[1]) / span];
    var mx = Math.hypot(ex[0], ex[1]);
    if (Math.abs(mx - m) > 0.25 * m || Math.abs(Math.hypot(ey[0], ey[1]) - m) > 0.25 * m) return null;
    var grid = [], o = q.SAMPLE_OFFSET;
    for (var r = 0; r < size; r++) {
      var row = [];
      for (var c = 0; c < size; c++) {
        var u = c + 0.5 - 3.5, v = r + 0.5 - 3.5, s = 0;
        for (var a = -1; a <= 1; a++) {
          for (var b = -1; b <= 1; b++) {
            var uu = u + a * o, vv = v + b * o;
            s += sample(tl[0] + uu * ex[0] + vv * ey[0], tl[1] + uu * ex[1] + vv * ey[1]);
          }
        }
        row.push(s / 9 > thr);
      }
      grid.push(row);
    }
    var dec = HUSS.sheet.qr.decodeGrid(grid);
    if (!dec.ok) return null;
    var parsed = HUSS.sheet.qr.parseSheetText(dec.text);
    if (!parsed.ok) return null;
    return {
      found: true, text: dec.text, template: parsed.template, sheet_code: parsed.sheet_code,
      corrected: dec.corrected, offset_mm: [dx, dy]
    };
  }

  /**
   * Reads the sheet code. Returns { found: true, text, template, sheet_code, corrected,
   * offset_mm } or { found: false }.
   */
  function read(sample, T, config) {
    var cfg = config || HUSS.config, q = cfg.QR;
    var res = attempt(sample, T, cfg, 0, 0);
    if (res) return res;
    // Spiral-ish search: rings of increasing distance
    var st = q.SEARCH_STEP_MM, rad = q.SEARCH_RADIUS_MM;
    for (var ring = 1; ring * st <= rad + 1e-9; ring++) {
      for (var j = -ring; j <= ring; j++) {
        for (var i = -ring; i <= ring; i++) {
          if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
          res = attempt(sample, T, cfg, i * st, j * st);
          if (res) return res;
        }
      }
    }
    return { found: false };
  }

  var api = { read: read, rectSampler: rectSampler, imageSampler: imageSampler };
  HUSS.detect.qr = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
