/* HuSS Scorer — js/sheet/svg.js
 * One drawing sheet as an SVG document in mm (spec 8.3 print view). DOM-free (returns a string).
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.sheet = HUSS.sheet || {};

  var PT_MM = 25.4 / 72;
  var FONTS = {
    sans: 'Helvetica, Arial, sans-serif',
    mono: '"Courier New", Courier, monospace'
  };

  function num(v) {
    return String(Math.round(v * 10000) / 10000);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** SVG markup for one sheet; width and height in mm, so it prints at true size. */
  function sheet(t, code, label) {
    return draw(t, HUSS.sheet.template.items(t, code, label));
  }

  /** SVG markup for the back side of a sheet (desk coordinator record). */
  function back(t, code) {
    return draw(t, HUSS.sheet.template.backItems(t, code));
  }

  /** SVG markup for calibration layout index (spec 10.3). */
  function calibration(t, code, label, index) {
    return draw(t, HUSS.sheet.template.calibrationItems(t, code, label, index));
  }

  function rgb(c) { return c ? 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')' : null; }

  function draw(t, its) {
    var W = t.width_mm, H = t.height_mm;
    var fills = [], lines = [], texts = [];
    its.forEach(function (it) {
      if (it.k === 'rect') {
        fills.push('<rect x="' + num(it.x) + '" y="' + num(it.y) + '" width="' + num(it.w) + '" height="' + num(it.h) + '"/>');
      } else if (it.k === 'rects') {
        fills.push('<path d="' + it.rects.map(function (r) {
          return 'M' + num(r.x) + ' ' + num(r.y) + 'h' + num(r.w) + 'v' + num(r.h) + 'h' + num(-r.w) + 'z';
        }).join('') + '"/>');
      } else if (it.k === 'poly') {
        fills.push('<polygon points="' + it.pts.map(function (p) { return num(p[0]) + ',' + num(p[1]); }).join(' ') + '"/>');
      } else if (it.k === 'line') {
        lines.push('<line x1="' + num(it.x1) + '" y1="' + num(it.y1) + '" x2="' + num(it.x2) + '" y2="' + num(it.y2) +
          '" stroke-width="' + num(it.w) + '" stroke-linecap="' + it.cap + '"' + (it.color ? ' stroke="' + rgb(it.color) + '"' : '') + '/>');
      } else if (it.k === 'ring') {
        lines.push('<circle cx="' + num(it.cx) + '" cy="' + num(it.cy) + '" r="' + num(it.r) + '" stroke-width="' + num(it.w) + '"' +
          (it.color ? ' stroke="' + rgb(it.color) + '"' : '') + '/>');
      } else if (it.k === 'text') {
        texts.push('<text x="' + num(it.x) + '" y="' + num(it.y) + '" font-size="' + num(it.size_pt * PT_MM) +
          '" font-family=\'' + FONTS[it.font] + '\' text-anchor="' + it.anchor + '">' + esc(it.text) + '</text>');
      }
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + 'mm" height="' + H + 'mm" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<rect width="' + W + '" height="' + H + '" fill="#fff"/>' +
      '<g fill="#000" stroke="none" shape-rendering="crispEdges">' + fills.join('') + '</g>' +
      '<g stroke="#000" fill="none">' + lines.join('') + '</g>' +
      '<g fill="#000">' + texts.join('') + '</g>' +
      '</svg>';
  }

  var api = { sheet: sheet, back: back, calibration: calibration };
  HUSS.sheet.svg = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
