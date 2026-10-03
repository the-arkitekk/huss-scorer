/* HuSS Scorer — js/image/lab.js
 * sRGB (8-bit) -> CIELAB (D65) and luma helpers (spec 7.7, 7.8).
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.image = HUSS.image || {};

  var LIN = new Float64Array(256);
  for (var i = 0; i < 256; i++) {
    var c = i / 255;
    LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  var XN = 0.95047, ZN = 1.08883;
  var EPS = 216 / 24389, KAPPA = 24389 / 27;

  function f(t) {
    return t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116;
  }

  /** Writes [L*, a*, b*] into `out` (array of length >= 3) and returns it. */
  function rgbToLab(r, g, b, out) {
    var R = LIN[r], G = LIN[g], B = LIN[b];
    var fx = f((0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / XN);
    var fy = f(0.2126729 * R + 0.7151522 * G + 0.0721750 * B);
    var fz = f((0.0193339 * R + 0.1191920 * G + 0.9503041 * B) / ZN);
    out = out || [0, 0, 0];
    out[0] = 116 * fy - 16;
    out[1] = 500 * (fx - fy);
    out[2] = 200 * (fy - fz);
    return out;
  }

  /** Rec. 601 luma used for darkness: 0.299 R + 0.587 G + 0.114 B. */
  function luma(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  /** Darkness image (255 - luma) from RGBA: { width, height, data: Uint8Array }. */
  function darkness(img) {
    var n = img.width * img.height, d = img.data, out = new Uint8Array(n);
    for (var k = 0, o = 0; k < n; k++, o += 4) {
      out[k] = 255 - Math.round(0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]);
    }
    return { width: img.width, height: img.height, data: out };
  }

  var api = { rgbToLab: rgbToLab, luma: luma, darkness: darkness };
  HUSS.image.lab = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
