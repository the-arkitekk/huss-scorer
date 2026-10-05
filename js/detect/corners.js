/* HuSS Scorer — js/detect/corners.js
 * Corner marks and page orientation (spec 7.2).
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.detect = HUSS.detect || {};

  /** Box-averaged luma copy, downscaled by integer factor k. */
  function downscaleGray(img, k) {
    var W = Math.floor(img.width / k), H = Math.floor(img.height / k), d = img.data, sw = img.width;
    var out = new Uint8Array(W * H), norm = 1 / (k * k);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var s = 0;
        for (var j = 0; j < k; j++) {
          var o = ((y * k + j) * sw + x * k) * 4;
          for (var i = 0; i < k; i++, o += 4) s += 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2];
        }
        out[y * W + x] = Math.round(s * norm);
      }
    }
    return { width: W, height: H, data: out };
  }

  function lumaAt(img, x, y) {
    var o = (y * img.width + x) * 4, d = img.data;
    return 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2];
  }

  /** Bilinear luma at continuous coordinates (pixel centres at +0.5); null outside. */
  function sampleLuma(img, X, Y) {
    var sx = X - 0.5, sy = Y - 0.5;
    var ix = Math.floor(sx), iy = Math.floor(sy);
    if (ix < 0 || iy < 0 || ix >= img.width - 1 || iy >= img.height - 1) return null;
    var fx = sx - ix, fy = sy - iy;
    return (1 - fx) * (1 - fy) * lumaAt(img, ix, iy) + fx * (1 - fy) * lumaAt(img, ix + 1, iy) +
      (1 - fx) * fy * lumaAt(img, ix, iy + 1) + fx * fy * lumaAt(img, ix + 1, iy + 1);
  }

  function percentile(sorted, p) {
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
  }

  /** Sub-pixel centre of a dark mark: contrast-weighted centroid inside a window (full resolution). */
  function refineCentre(img, x0, y0, x1, y1, cfg) {
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(img.width - 1, Math.ceil(x1)); y1 = Math.min(img.height - 1, Math.ceil(y1));
    var vals = [], x, y;
    for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) vals.push(lumaAt(img, x, y));
    var sorted = vals.slice().sort(function (a, b) { return a - b; });
    var bg = percentile(sorted, 0.9), fg = percentile(sorted, 0.05);
    if (bg - fg < 30) return null;
    var sw = 0, sx = 0, sy = 0, k = 0, range = bg - fg;
    for (y = y0; y <= y1; y++) {
      for (x = x0; x <= x1; x++, k++) {
        var wgt = (bg - vals[k]) / range;
        if (wgt < cfg.CENTROID_DEAD_ZONE) continue;
        if (wgt > 1) wgt = 1;
        sw += wgt; sx += wgt * (x + 0.5); sy += wgt * (y + 0.5);
      }
    }
    return sw > 0 ? [sx / sw, sy / sw] : null;
  }

  /**
   * One corner mark missing: its centre is where the other three put it (a flatbed scan maps the
   * sheet's rectangle to a parallelogram). Only when the three make a right angle and the sheet's
   * side ratio; returns the point or null.
   */
  function completeCorner(points, q, template, cfg) {
    var a = points[(q + 1) % 4], o = points[(q + 2) % 4], b = points[(q + 3) % 4];
    var ux = a[0] - o[0], uy = a[1] - o[1], vx = b[0] - o[0], vy = b[1] - o[1];
    var lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
    if (!(lu > 0 && lv > 0)) return null;
    var angle = Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (lu * lv)))) * 180 / Math.PI;
    if (Math.abs(angle - 90) > cfg.THREE_ANGLE_TOL_DEG) return null;
    var c = template.corners, W = c[1][0] - c[0][0], H = c[3][1] - c[0][1], want = W / H, ratio = lu / lv;
    var fits = function (r) { return Math.abs(r / want - 1) <= cfg.THREE_RATIO_TOL; };
    if (!fits(ratio) && !fits(1 / ratio)) return null;
    return [a[0] + b[0] - o[0], a[1] + b[1] - o[1]];
  }

  /**
   * Finds one corner mark per image quadrant; a single missing one is completed from the others.
   * Returns { ok, points: [TL, TR, BR, BL] in image px (image quadrants), threshold, completed
   * (quadrant index or null), error }.
   */
  function findCorners(img, template, config) {
    var cfg = config.CORNERS, C = HUSS.image.components;
    var longSide = Math.max(img.width, img.height);
    var k = Math.max(1, Math.round(longSide / cfg.DOWNSCALE_LONG_SIDE));
    var g = downscaleGray(img, k);
    var hist = new Array(256).fill(0), n = g.width * g.height, i;
    for (i = 0; i < n; i++) hist[g.data[i]]++;
    var T = C.otsu(hist);
    var mask = new Uint8Array(n);
    for (i = 0; i < n; i++) mask[i] = g.data[i] <= T ? 1 : 0;
    var cc = C.label(mask, g.width, g.height);

    var estPxPerMm = longSide / Math.max(template.width_mm, template.height_mm);
    var expSide = template.corner_size_mm * estPxPerMm / k;
    var cands = cc.stats.filter(function (s) {
      var w = s.x1 - s.x0 + 1, h = s.y1 - s.y0 + 1;
      var aspect = w / h, fill = s.area / (w * h), side = Math.sqrt(s.area);
      return aspect >= cfg.ASPECT_MIN && aspect <= cfg.ASPECT_MAX && fill >= cfg.FILL_MIN &&
        side >= cfg.SIZE_TOL_MIN * expSide && side <= cfg.SIZE_TOL_MAX * expSide;
    });

    var inset = template.corners[0][0] * estPxPerMm / k;
    var gw = g.width, gh = g.height;
    var targets = [[inset, inset], [gw - inset, inset], [gw - inset, gh - inset], [inset, gh - inset]];
    var inQuadrant = [
      function (x, y) { return x < gw / 2 && y < gh / 2; },
      function (x, y) { return x >= gw / 2 && y < gh / 2; },
      function (x, y) { return x >= gw / 2 && y >= gh / 2; },
      function (x, y) { return x < gw / 2 && y >= gh / 2; }
    ];
    var points = [], missing = [];
    for (var q = 0; q < 4; q++) {
      var best = null, bestD = Infinity;
      for (var c = 0; c < cands.length; c++) {
        var s = cands[c], cx = s.sx / s.area + 0.5, cy = s.sy / s.area + 0.5;
        if (!inQuadrant[q](cx, cy)) continue;
        var d = Math.hypot(cx - targets[q][0], cy - targets[q][1]);
        if (d < bestD) { bestD = d; best = s; }
      }
      if (!best) { missing.push(q); points.push(null); continue; }
      var side = (best.x1 - best.x0 + 1) * k, pad = side * cfg.CENTROID_PAD_FRAC;
      var p = refineCentre(img, best.x0 * k - pad, best.y0 * k - pad, (best.x1 + 1) * k + pad, (best.y1 + 1) * k + pad, cfg);
      points.push(p || [(best.sx / best.area + 0.5) * k, (best.sy / best.area + 0.5) * k]);
    }
    if (missing.length === 1) {
      var done = completeCorner(points, missing[0], template, cfg);
      if (done) { points[missing[0]] = done; return { ok: true, points: points, threshold: T, completed: missing[0] }; }
    }
    if (missing.length) return { ok: false, error: 'corners_not_found', missing: missing, points: points, threshold: T };
    return { ok: true, points: points, threshold: T, completed: null };
  }

  /** The dark/paper threshold used by findCorners (Otsu on the downscaled grey copy). */
  function darkThreshold(img, config) {
    var cfg = config.CORNERS, longSide = Math.max(img.width, img.height);
    var g = downscaleGray(img, Math.max(1, Math.round(longSide / cfg.DOWNSCALE_LONG_SIDE)));
    var hist = new Array(256).fill(0);
    for (var i = 0; i < g.data.length; i++) hist[g.data[i]]++;
    return HUSS.image.components.otsu(hist);
  }

  /** Dark-sample ratio along a page-space polyline sample set. */
  /**
   * Share of the page points that are dark in the image. slackY (mm): a point also counts when
   * it is dark that far above or below (a thin printed line a little off its expected place on
   * a sheet printed or scanned slightly askew).
   */
  function darkRatio(img, H, pts, threshold, slackY) {
    var dark = 0, total = 0, Hm = HUSS.image.homography, sl = slackY || 0;
    for (var i = 0; i < pts.length; i++) {
      total++;
      for (var dy = -sl; dy <= sl + 1e-9; dy += sl ? 0.15 : 1) {
        var p = Hm.apply(H, pts[i][0], pts[i][1] + dy);
        var v = sampleLuma(img, p[0], p[1]);
        if (v !== null && v <= threshold) { dark++; break; }
      }
    }
    return total ? dark / total : 0;
  }

  /**
   * Tries the four cyclic assignments of page corners to image quadrants and picks the one
   * whose expected floor line is darkest (ties: QR code, then start mark). Returns
   * { ok, H (page mm -> image px), corners: [TL, TR, BR, BL] page order in image px, quarter, floorRatio, markRatio }.
   */
  function chooseOrientation(img, quadPoints, template, threshold, config) {
    var cfg = config.ORIENTATION, Hm = HUSS.image.homography;
    var floorPts = [];
    for (var x = template.floor.x0 + cfg.FLOOR_END_MARGIN_MM; x <= template.floor.x1 - cfg.FLOOR_END_MARGIN_MM; x += cfg.SAMPLE_STEP_MM) {
      floorPts.push([x, template.floor.y]);
    }
    var cen = HUSS.sheet.template.markCentroid(template);
    var tri = [template.mark.apex, template.mark.base[0], template.mark.base[1]];
    var markPts = [cen].concat(tri.map(function (v) { return [(v[0] + 2 * cen[0]) / 3, (v[1] + 2 * cen[1]) / 3]; }));

    var results = [];
    for (var k = 0; k < 4; k++) {
      var dst = [0, 1, 2, 3].map(function (i) { return quadPoints[(i + k) % 4]; });
      var H = Hm.fromPoints(template.corners, dst);
      if (!H) continue;
      results.push({
        quarter: k, H: H, corners: dst,
        floorRatio: darkRatio(img, H, floorPts, threshold, cfg.FLOOR_SLACK_MM),
        markRatio: darkRatio(img, H, markPts, threshold)
      });
    }
    if (!results.length) return { ok: false, error: 'orientation_failed' };
    results.sort(function (a, b) { return b.floorRatio - a.floorRatio; });
    var best = results[0];
    if (best.floorRatio < cfg.FLOOR_DARK_RATIO_MIN) return { ok: false, error: 'orientation_failed', results: results };
    var tied = results.filter(function (r) {
      return r.floorRatio >= cfg.FLOOR_DARK_RATIO_MIN && best.floorRatio - r.floorRatio <= cfg.TIE_EPS;
    });
    var tieBreak = null, qr = null;
    if (tied.length > 1) {
      // Spec 7.2: the QR code read at its expected place decides; then the start mark.
      if (HUSS.detect.qr) {
        for (var t = 0; t < tied.length && !qr; t++) {
          var r = HUSS.detect.qr.read(HUSS.detect.qr.imageSampler(img, tied[t].H), template, config);
          if (r.found) { qr = r; best = tied[t]; tieBreak = 'qr'; }
        }
      }
      if (!qr) {
        tied.sort(function (a, b) { return (b.markRatio - a.markRatio) || (b.floorRatio - a.floorRatio); });
        best = tied[0];
        tieBreak = 'mark';
      }
    }
    return {
      ok: true, H: best.H, corners: best.corners, quarter: best.quarter, floorRatio: best.floorRatio,
      markRatio: best.markRatio, tie: tied.length > 1, tieBreak: tieBreak, qr: qr
    };
  }

  var api = {
    downscaleGray: downscaleGray, sampleLuma: sampleLuma, refineCentre: refineCentre, findCorners: findCorners,
    chooseOrientation: chooseOrientation, darkThreshold: darkThreshold, completeCorner: completeCorner
  };
  HUSS.detect.corners = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
