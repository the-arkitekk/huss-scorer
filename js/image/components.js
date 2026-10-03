/* HuSS Scorer — js/image/components.js
 * Binary image tools on typed arrays: Otsu threshold, connected components,
 * exact Euclidean distance transform and disk morphology.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.image = HUSS.image || {};

  /**
   * Otsu threshold of a histogram (array of counts). Returns the bin index t that
   * maximises between-class variance with class 0 = bins [0..t].
   */
  function otsu(hist) {
    var n = hist.length, total = 0, sum = 0, i;
    for (i = 0; i < n; i++) { total += hist[i]; sum += i * hist[i]; }
    if (total === 0) return 0;
    var w0 = 0, sum0 = 0, best = -1, bestT = 0;
    for (i = 0; i < n; i++) {
      w0 += hist[i];
      if (w0 === 0) continue;
      var w1 = total - w0;
      if (w1 === 0) break;
      sum0 += i * hist[i];
      var m0 = sum0 / w0, m1 = (sum - sum0) / w1;
      var v = w0 * w1 * (m0 - m1) * (m0 - m1);
      if (v > best) { best = v; bestT = i; }
    }
    return bestT;
  }

  /**
   * 8-connected components of a binary mask (non-zero = foreground).
   * Returns { labels: Int32Array (0 = background, 1..count), count, stats[] }
   * where stats[k-1] = { label, area, x0, y0, x1, y1, sx, sy } (bbox inclusive, sums of x and y).
   */
  function label(mask, w, h) {
    var labels = new Int32Array(w * h);
    var parent = [0];
    function find(a) {
      while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; }
      return a;
    }
    function union(a, b) {
      a = find(a); b = find(b);
      if (a !== b) { if (a < b) parent[b] = a; else parent[a] = b; }
    }
    var next = 1, x, y, k;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        k = y * w + x;
        if (!mask[k]) continue;
        var l = 0;
        // neighbours already visited: W, NW, N, NE
        if (x > 0 && labels[k - 1]) l = labels[k - 1];
        if (y > 0) {
          if (x > 0 && labels[k - w - 1]) { if (l) union(l, labels[k - w - 1]); else l = labels[k - w - 1]; }
          if (labels[k - w]) { if (l) union(l, labels[k - w]); else l = labels[k - w]; }
          if (x < w - 1 && labels[k - w + 1]) { if (l) union(l, labels[k - w + 1]); else l = labels[k - w + 1]; }
        }
        if (!l) { l = next++; parent.push(l); }
        labels[k] = l;
      }
    }
    var remap = new Int32Array(next), count = 0, stats = [];
    for (var a = 1; a < next; a++) {
      var r = find(a);
      if (!remap[r]) { remap[r] = ++count; stats.push({ label: count, area: 0, x0: w, y0: h, x1: -1, y1: -1, sx: 0, sy: 0 }); }
      remap[a] = remap[r];
    }
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        k = y * w + x;
        if (!labels[k]) continue;
        var nl = remap[labels[k]];
        labels[k] = nl;
        var s = stats[nl - 1];
        s.area++; s.sx += x; s.sy += y;
        if (x < s.x0) s.x0 = x;
        if (x > s.x1) s.x1 = x;
        if (y < s.y0) s.y0 = y;
        if (y > s.y1) s.y1 = y;
      }
    }
    return { labels: labels, count: count, stats: stats };
  }

  var FAR = 1e20; // "no foreground" in the distance transform

  // 1-D squared distance transform (Felzenszwalb & Huttenlocher, lower envelope of parabolas).
  function dt1d(f, n, d, v, z) {
    var k = 0, q, s;
    v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
    for (q = 1; q < n; q++) {
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
    }
    k = 0;
    for (q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }
  }

  /** Squared Euclidean distance from every pixel to the nearest foreground pixel. */
  function edt(mask, w, h) {
    var out = new Float64Array(w * h);
    var n = Math.max(w, h);
    var f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    var x, y;
    for (x = 0; x < w; x++) {
      for (y = 0; y < h; y++) f[y] = mask[y * w + x] ? 0 : FAR;
      dt1d(f, h, d, v, z);
      for (y = 0; y < h; y++) out[y * w + x] = d[y];
    }
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) f[x] = out[y * w + x];
      dt1d(f, w, d, v, z);
      for (x = 0; x < w; x++) out[y * w + x] = d[x];
    }
    return out;
  }

  /** Dilation by a disk of radius r (px). */
  function dilate(mask, w, h, r) {
    var d = edt(mask, w, h), out = new Uint8Array(w * h), r2 = r * r;
    for (var k = 0; k < w * h; k++) out[k] = d[k] <= r2 ? 1 : 0;
    return out;
  }

  /** Erosion by a disk of radius r (px); pixels outside the image count as foreground. */
  function erode(mask, w, h, r) {
    var inv = new Uint8Array(w * h), k;
    for (k = 0; k < w * h; k++) inv[k] = mask[k] ? 0 : 1;
    var d = edt(inv, w, h), out = new Uint8Array(w * h), r2 = r * r;
    for (k = 0; k < w * h; k++) out[k] = d[k] > r2 ? 1 : 0;
    return out;
  }

  /** Morphological closing (dilate then erode) with a disk of radius r (px). */
  function close(mask, w, h, r) {
    return erode(dilate(mask, w, h, r), w, h, r);
  }

  var api = { otsu: otsu, label: label, edt: edt, dilate: dilate, erode: erode, close: close };
  HUSS.image.components = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
