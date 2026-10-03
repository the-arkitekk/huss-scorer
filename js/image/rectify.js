/* HuSS Scorer — js/image/rectify.js
 * Rebuilds the page at a fixed resolution R px/mm with bilinear sampling (spec 7.3).
 * Pixel convention: pixel i covers [i, i+1), its centre is i + 0.5.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.image = HUSS.image || {};

  /** R from the source scale: rounded, clamped to [R_MIN, R_MAX], lowered to stay under MAX_MEGAPIXELS. */
  function chooseR(pxPerMm, template, cfg) {
    var R = Math.round(pxPerMm);
    R = Math.max(cfg.R_MIN, Math.min(cfg.R_MAX, R));
    while (R > 1 && template.width_mm * R * template.height_mm * R > cfg.MAX_MEGAPIXELS * 1e6) R--;
    return R;
  }

  /**
   * src: RGBA { width, height, data }; H: page mm -> source px; R: px per mm.
   * Returns RGBA { width, height, data: Uint8ClampedArray, R }.
   */
  function rectify(src, H, template, R, outsideValue) {
    var W = Math.round(template.width_mm * R), Hh = Math.round(template.height_mm * R);
    var out = new Uint8ClampedArray(W * Hh * 4);
    var sw = src.width, sh = src.height, sd = src.data;
    var bg = outsideValue == null ? 255 : outsideValue;
    var h0 = H[0], h1 = H[1], h2 = H[2], h3 = H[3], h4 = H[4], h5 = H[5], h6 = H[6], h7 = H[7], h8 = H[8];
    var inv = 1 / R;
    for (var v = 0; v < Hh; v++) {
      var y = (v + 0.5) * inv;
      var bx = h1 * y + h2, by = h4 * y + h5, bw = h7 * y + h8;
      var o = v * W * 4;
      for (var u = 0; u < W; u++, o += 4) {
        var x = (u + 0.5) * inv;
        var w = h6 * x + bw;
        // continuous source coordinates -> index space (centre at +0.5)
        var sx = (h0 * x + bx) / w - 0.5, sy = (h3 * x + by) / w - 0.5;
        var ix = Math.floor(sx), iy = Math.floor(sy);
        if (ix < 0 || iy < 0 || ix >= sw - 1 || iy >= sh - 1) {
          if (sx < -0.5 || sy < -0.5 || sx > sw - 0.5 || sy > sh - 0.5) {
            out[o] = bg; out[o + 1] = bg; out[o + 2] = bg; out[o + 3] = 255;
            continue;
          }
          // edge: clamp
          ix = Math.max(0, Math.min(sw - 2, ix)); iy = Math.max(0, Math.min(sh - 2, iy));
          sx = Math.max(ix, Math.min(ix + 1, sx)); sy = Math.max(iy, Math.min(iy + 1, sy));
        }
        var fx = sx - ix, fy = sy - iy;
        var w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        var p = (iy * sw + ix) * 4, q = p + sw * 4;
        out[o] = w00 * sd[p] + w10 * sd[p + 4] + w01 * sd[q] + w11 * sd[q + 4];
        out[o + 1] = w00 * sd[p + 1] + w10 * sd[p + 5] + w01 * sd[q + 1] + w11 * sd[q + 5];
        out[o + 2] = w00 * sd[p + 2] + w10 * sd[p + 6] + w01 * sd[q + 2] + w11 * sd[q + 6];
        out[o + 3] = 255;
      }
    }
    return { width: W, height: Hh, data: out, R: R };
  }

  var api = { chooseR: chooseR, rectify: rectify };
  HUSS.image.rectify = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
