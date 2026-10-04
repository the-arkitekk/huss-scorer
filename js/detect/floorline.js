/* HuSS Scorer — js/detect/floorline.js
 * Floor line refinement on the rectified page (spec 7.4): per 1 mm column, the
 * intensity-weighted centre of the dark trace near the template y; robust line fit.
 * Result: floor_y(x) = a + b * x (mm).
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.detect = HUSS.detect || {};

  function median(arr) {
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function fitLine(pts) {
    var n = pts.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (var i = 0; i < n; i++) {
      sx += pts[i][0]; sy += pts[i][1]; sxx += pts[i][0] * pts[i][0]; sxy += pts[i][0] * pts[i][1];
    }
    var den = n * sxx - sx * sx;
    if (n < 2 || Math.abs(den) < 1e-12) return null;
    var b = (n * sxy - sx * sy) / den;
    return { a: (sy - b * sx) / n, b: b };
  }

  /** Half-maximum, intensity-weighted centre of a 1-D darkness profile; null if no clear peak. */
  function peakCentre(vals, minContrast) {
    var n = vals.length, base = Infinity, maxV = -Infinity, iMax = -1, i;
    for (i = 0; i < n; i++) {
      if (vals[i] < base) base = vals[i];
      if (vals[i] > maxV) { maxV = vals[i]; iMax = i; }
    }
    if (maxV - base < minContrast) return null;
    var level = base + (maxV - base) / 2;
    var lo = iMax, hi = iMax;
    while (lo > 0 && vals[lo - 1] > level) lo--;
    while (hi < n - 1 && vals[hi + 1] > level) hi++;
    if (lo === 0 || hi === n - 1) return null; // trace not contained in the window
    var sw = 0, s = 0;
    for (i = lo; i <= hi; i++) { var w = vals[i] - level; sw += w; s += w * (i + 0.5); }
    return s / sw;
  }

  /**
   * dark: darkness image { width, height, data } of the rectified page; R: px/mm.
   * Returns { ok, a, b, inliers, samples } (a, b in mm; on failure the template line).
   */
  function refine(dark, R, template, config) {
    var cfg = config.FLOOR;
    var y0 = template.floor.y, W = dark.width, H = dark.height, d = dark.data;
    var top = Math.max(0, Math.floor((y0 - cfg.WINDOW_ABOVE_MM) * R));
    var bot = Math.min(H - 1, Math.ceil((y0 + cfg.WINDOW_BELOW_MM) * R));
    var vals = new Array(bot - top + 1);
    var pts = [], samples = 0;
    for (var x = template.floor.x0 + cfg.END_MARGIN_MM; x <= template.floor.x1 - cfg.END_MARGIN_MM; x += cfg.STEP_MM) {
      var c = Math.floor(x * R);
      if (c < 0 || c >= W) continue;
      samples++;
      for (var r = top; r <= bot; r++) vals[r - top] = d[r * W + c];
      var pc = peakCentre(vals, cfg.MIN_PEAK_CONTRAST);
      if (pc === null) continue;
      pts.push([(c + 0.5) / R, (top + pc) / R]);
    }
    var fail = { ok: false, a: y0, b: 0, inliers: 0, samples: samples };
    if (pts.length < Math.max(2, cfg.MIN_INLIER_FRACTION * samples)) return fail;
    var line = fitLine(pts), cur = pts;
    for (var it = 0; it < cfg.ITERATIONS && line; it++) {
      var res = cur.map(function (p) { return p[1] - (line.a + line.b * p[0]); });
      var med = median(res);
      var mad = median(res.map(function (v) { return Math.abs(v - med); }));
      var lim = Math.max(cfg.OUTLIER_MAD_K * 1.4826 * mad, cfg.OUTLIER_MIN_MM);
      var next = pts.filter(function (p) { return Math.abs(p[1] - (line.a + line.b * p[0])) <= lim; });
      if (next.length < 2) break;
      cur = next;
      line = fitLine(cur);
    }
    if (!line || cur.length < cfg.MIN_INLIER_FRACTION * samples) return fail;
    return { ok: true, a: line.a, b: line.b, inliers: cur.length, samples: samples };
  }

  function yAt(floor, x) {
    return floor.a + floor.b * x;
  }

  var api = { refine: refine, yAt: yAt, peakCentre: peakCentre, fitLine: fitLine };
  HUSS.detect.floorline = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
