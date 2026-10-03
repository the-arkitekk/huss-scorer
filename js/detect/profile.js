/* HuSS Scorer — js/detect/profile.js
 * Darkness profiles and peak finding (spec 7.8).
 * Profile sample i covers pixel i of the rectified page; its centre is at (i + 0.5) / R mm.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.detect = HUSS.detect || {};

  /**
   * Darkness with red pixels replaced by the paper level (median darkness of the page).
   * redMask is grown by `dilatePx` first so the anti-aliased rim of red strokes goes too.
   */
  function maskedDarkness(dark, redMask, dilatePx) {
    var n = dark.width * dark.height, src = dark.data, out = new Uint8Array(src);
    var hist = new Int32Array(256), k;
    for (k = 0; k < n; k++) hist[src[k]]++;
    var half = n / 2, acc = 0, paper = 0;
    for (k = 0; k < 256; k++) { acc += hist[k]; if (acc >= half) { paper = k; break; } }
    var W = dark.width, H = dark.height, r = Math.max(0, Math.round(dilatePx || 0));
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        if (!redMask[y * W + x]) continue;
        for (var j = Math.max(0, y - r); j <= Math.min(H - 1, y + r); j++) {
          for (var i = Math.max(0, x - r); i <= Math.min(W - 1, x + r); i++) out[j * W + i] = paper;
        }
      }
    }
    return { width: W, height: H, data: out, paper: paper };
  }

  /** Mean darkness of the band axisX +- half (mm), for every row. */
  function ceilingProfile(dm, R, axisX, cfg) {
    var W = dm.width, H = dm.height, d = dm.data;
    var c0 = Math.max(0, Math.round((axisX - cfg.CEILING_BAND_HALF_MM) * R));
    var c1 = Math.min(W - 1, Math.round((axisX + cfg.CEILING_BAND_HALF_MM) * R) - 1);
    var out = new Float64Array(H), n = c1 - c0 + 1;
    if (n <= 0) return out;
    for (var y = 0; y < H; y++) {
      var s = 0, o = y * W;
      for (var x = c0; x <= c1; x++) s += d[o + x];
      out[y] = s / n;
    }
    return out;
  }

  /** Mean darkness of the band WALL_BAND_MIN..MAX mm above the floor line, for every column. */
  function wallProfile(dm, R, floor, cfg) {
    var W = dm.width, H = dm.height, d = dm.data, out = new Float64Array(W);
    for (var x = 0; x < W; x++) {
      var fy = floor.a + floor.b * ((x + 0.5) / R);
      var r0 = Math.max(0, Math.round((fy - cfg.WALL_BAND_MAX_MM) * R));
      var r1 = Math.min(H - 1, Math.round((fy - cfg.WALL_BAND_MIN_MM) * R) - 1);
      var s = 0, n = 0;
      for (var y = r0; y <= r1; y++) { s += d[y * W + x]; n++; }
      out[x] = n ? s / n : 0;
    }
    return out;
  }

  /** Gaussian smoothing with sigma in samples (edges clamped). */
  function smooth(p, sigma) {
    var n = p.length, out = new Float64Array(n);
    if (!(sigma > 0)) { out.set(p); return out; }
    var rad = Math.max(1, Math.ceil(3 * sigma)), ker = [], sum = 0, i, j;
    for (i = -rad; i <= rad; i++) { var w = Math.exp(-(i * i) / (2 * sigma * sigma)); ker.push(w); sum += w; }
    for (i = 0; i < ker.length; i++) ker[i] /= sum;
    for (i = 0; i < n; i++) {
      var s = 0;
      for (j = -rad; j <= rad; j++) {
        var q = i + j;
        if (q < 0) q = 0; else if (q >= n) q = n - 1;
        s += ker[j + rad] * p[q];
      }
      out[i] = s;
    }
    return out;
  }

  /** Topographic prominence of the local maximum at i. */
  function prominence(p, i) {
    var n = p.length, v = p[i], j, leftMin = v, rightMin = v;
    for (j = i - 1; j >= 0 && p[j] <= v; j--) if (p[j] < leftMin) leftMin = p[j];
    for (j = i + 1; j < n && p[j] <= v; j++) if (p[j] < rightMin) rightMin = p[j];
    return v - Math.max(leftMin, rightMin);
  }

  /** Centre (in samples, +0.5 convention) of the part of the peak above half prominence. */
  function lineCentre(p, i, prom) {
    var level = p[i] - prom / 2, lo = i, hi = i, n = p.length;
    while (lo > 0 && p[lo - 1] > level) lo--;
    while (hi < n - 1 && p[hi + 1] > level) hi++;
    var sw = 0, s = 0;
    for (var j = lo; j <= hi; j++) { var w = p[j] - level; sw += w; s += w * (j + 0.5); }
    return sw > 0 ? s / sw : i + 0.5;
  }

  /**
   * Peaks with maximum inside [lo, hi] (sample indices) that pass both prominence rules.
   * Returns [{ index, prominence, centre }] with centre in samples.
   */
  function findPeaks(p, lo, hi, cfg) {
    var n = p.length, cands = [], maxProm = 0;
    lo = Math.max(1, lo); hi = Math.min(n - 2, hi);
    for (var i = lo; i <= hi; i++) {
      if (!(p[i] > p[i - 1] && p[i] >= p[i + 1])) continue;
      var pr = prominence(p, i);
      cands.push({ index: i, prominence: pr });
      if (pr > maxProm) maxProm = pr;
    }
    return cands.filter(function (c) {
      return c.prominence >= cfg.PEAK_MIN_PROMINENCE && c.prominence >= cfg.PEAK_REL_PROMINENCE * maxProm;
    }).map(function (c) {
      c.centre = lineCentre(p, c.index, c.prominence);
      return c;
    });
  }

  var api = {
    maskedDarkness: maskedDarkness, ceilingProfile: ceilingProfile, wallProfile: wallProfile,
    smooth: smooth, prominence: prominence, lineCentre: lineCentre, findPeaks: findPeaks
  };
  HUSS.detect.profile = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
