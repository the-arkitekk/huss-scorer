/* HuSS Scorer — js/image/decode.js
 * Opens an image file as RGBA pixels with its EXIF orientation applied (spec 7.1).
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.image = HUSS.image || {};

  /** Resolves to { width, height, data: Uint8ClampedArray RGBA }. */
  function decodeFile(file) {
    var open = function () {
      return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () {
        return createImageBitmap(file);
      });
    };
    return open().then(function (bmp) {
      var c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      var ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0);
      if (bmp.close) bmp.close();
      var id = ctx.getImageData(0, 0, c.width, c.height);
      c.width = 0; c.height = 0;
      return { width: id.width, height: id.height, data: id.data };
    });
  }

  HUSS.image.decode = { decodeFile: decodeFile };
})(typeof globalThis !== 'undefined' ? globalThis : this);
