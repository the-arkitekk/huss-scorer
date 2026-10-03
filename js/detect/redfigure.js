/* HuSS Scorer — js/detect/redfigure.js
 * Red figure detection on the rectified page (spec 7.7).
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.detect = HUSS.detect || {};

  var RAD = 180 / Math.PI;

  function isRedLab(lab, Ta, cfg) {
    var a = lab[1], b = lab[2];
    if (a < Ta) return false;
    if (Math.sqrt(a * a + b * b) < cfg.T_C) return false;
    var h = Math.atan2(b, a) * RAD;
    return h >= cfg.HUE_MIN_DEG && h <= cfg.HUE_MAX_DEG;
  }

  /** a* threshold: Otsu over a* of pixels with a* > A_PRESELECT, at least T_A_MIN. */
  function thresholdA(aValues, cfg) {
    if (aValues.length < cfg.MIN_PRESELECT_PIXELS) return cfg.T_A_MIN;
    var lo = cfg.A_PRESELECT, binsPerUnit = 2, nb = Math.ceil((128 - lo) * binsPerUnit) + 1;
    var hist = new Array(nb).fill(0);
    for (var i = 0; i < aValues.length; i++) {
      var b = Math.min(nb - 1, Math.max(0, Math.floor((aValues[i] - lo) * binsPerUnit)));
      hist[b]++;
    }
    var t = HUSS.image.components.otsu(hist);
    return Math.max(cfg.T_A_MIN, lo + (t + 1) / binsPerUnit);
  }

  /** Raw red mask over the whole page with a given a* threshold (fast reject on R - G). */
  function pageMask(rect, Ta, cfg) {
    var n = rect.width * rect.height, d = rect.data, out = new Uint8Array(n), lab = [0, 0, 0];
    var rej = cfg.FAST_REJECT_RG;
    for (var k = 0, o = 0; k < n; k++, o += 4) {
      if (d[o] - d[o + 1] < rej) continue;
      HUSS.image.lab.rgbToLab(d[o], d[o + 1], d[o + 2], lab);
      if (isRedLab(lab, Ta, cfg)) out[k] = 1;
    }
    return out;
  }

  /**
   * rect: rectified RGBA (with .R); floorY: floor_y at the start mark (mm).
   * Returns {
   *   found, multiple, head_y, raw_foot_y, axis_x (mm, null when not found),
   *   Ta, region: { x0, y0, w, h } (px), regionMask (closed, small parts removed),
   *   clusterMask (figure only), pageMask (raw, whole page)
   * }
   */
  function detect(rect, template, floorY, config) {
    var cfg = config.RED, R = rect.R, C = HUSS.image.components;
    var mx = HUSS.sheet.template.markX(template);
    var x0 = Math.max(0, Math.floor((mx - cfg.SEARCH_HALF_WIDTH_MM) * R));
    var x1 = Math.min(rect.width - 1, Math.ceil((mx + cfg.SEARCH_HALF_WIDTH_MM) * R));
    var y0 = Math.max(0, Math.floor(cfg.SEARCH_TOP_MM * R));
    var y1 = Math.min(rect.height - 1, Math.ceil((floorY + cfg.SEARCH_BELOW_FLOOR_MM) * R));
    var w = x1 - x0 + 1, h = y1 - y0 + 1, d = rect.data;

    // Lab of the search region
    var A = new Float32Array(w * h), B = new Float32Array(w * h), lab = [0, 0, 0], aSel = [];
    var x, y, k;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var o = ((y0 + y) * rect.width + x0 + x) * 4;
        HUSS.image.lab.rgbToLab(d[o], d[o + 1], d[o + 2], lab);
        k = y * w + x;
        A[k] = lab[1]; B[k] = lab[2];
        if (lab[1] > cfg.A_PRESELECT) aSel.push(lab[1]);
      }
    }
    var Ta = thresholdA(aSel, cfg);
    var mask = new Uint8Array(w * h);
    for (k = 0; k < w * h; k++) {
      lab[1] = A[k]; lab[2] = B[k];
      if (isRedLab(lab, Ta, cfg)) mask[k] = 1;
    }

    var closed = C.close(mask, w, h, cfg.CLOSE_RADIUS_MM * R);
    var cc = C.label(closed, w, h);
    var minArea = cfg.MIN_AREA_MM2 * R * R;
    var keep = new Uint8Array(cc.count + 1);
    cc.stats.forEach(function (s) { if (s.area >= minArea) keep[s.label] = 1; });
    var regionMask = new Uint8Array(w * h);
    for (k = 0; k < w * h; k++) if (keep[cc.labels[k]]) regionMask[k] = 1;

    var result = {
      found: false, multiple: false, head_y: null, raw_foot_y: null, axis_x: null, Ta: Ta,
      region: { x0: x0, y0: y0, w: w, h: h }, regionMask: regionMask, clusterMask: new Uint8Array(w * h),
      pageMask: pageMask(rect, Ta, cfg)
    };

    // Clusters: components linked by a LINK_RADIUS dilation.
    var linked = C.label(C.dilate(regionMask, w, h, cfg.LINK_RADIUS_MM * R), w, h);
    var counts = new Float64Array(linked.count + 1);
    for (k = 0; k < w * h; k++) if (regionMask[k]) counts[linked.labels[k]]++;
    var order = [];
    for (var l = 1; l <= linked.count; l++) if (counts[l] > 0) order.push(l);
    order.sort(function (a, b) { return counts[b] - counts[a]; });
    if (!order.length) return result;

    var fig = order[0], cm = result.clusterMask;
    var top = -1, bottom = -1, sx = 0, n = 0;
    for (y = 0; y < h; y++) {
      var rowCount = 0;
      for (x = 0; x < w; x++) {
        k = y * w + x;
        if (regionMask[k] && linked.labels[k] === fig) { cm[k] = 1; rowCount++; sx += x + 0.5; n++; }
      }
      if (rowCount >= cfg.HEAD_MIN_PIXELS && top < 0) top = y;
      if (rowCount > 0) bottom = y;
    }
    if (top < 0 || (bottom + 1 - top) / R < cfg.MIN_HEIGHT_MM) return result;

    result.found = true;
    result.multiple = order.length > 1 && counts[order[1]] >= cfg.MULTIPLE_RATIO * counts[fig];
    result.head_y = (y0 + top) / R;
    result.raw_foot_y = (y0 + bottom + 1) / R;
    result.axis_x = (x0 + sx / n) / R;
    return result;
  }

  /**
   * Top and bottom edges (mm) of the red mask rows inside the search region, used by
   * head and foot snapping. A top edge is a row with >= minTop pixels below a row with fewer;
   * a bottom edge is a row with >= minBottom pixels above a row with fewer (same rules as 7.7).
   */
  function edges(red, R, minTop, minBottom) {
    var reg = red.region, m = red.regionMask, counts = new Int32Array(reg.h);
    for (var y = 0; y < reg.h; y++) {
      var c = 0;
      for (var x = 0; x < reg.w; x++) c += m[y * reg.w + x];
      counts[y] = c;
    }
    var tops = [], bottoms = [];
    for (y = 0; y < reg.h; y++) {
      if (counts[y] >= minTop && (y === 0 || counts[y - 1] < minTop)) tops.push((reg.y0 + y) / R);
      if (counts[y] >= minBottom && (y === reg.h - 1 || counts[y + 1] < minBottom)) bottoms.push((reg.y0 + y + 1) / R);
    }
    return { tops: tops, bottoms: bottoms };
  }

  var api = { detect: detect, edges: edges, thresholdA: thresholdA, isRedLab: isRedLab, pageMask: pageMask };
  HUSS.detect.redfigure = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
