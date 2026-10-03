/* HuSS Scorer — js/sheet/template.js
 * Drawing sheet geometry (spec 4.1, 4.2). Units: mm, origin top-left, x right, y down.
 * Corners are listed clockwise: TL, TR, BR, BL.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.sheet = HUSS.sheet || {};

  var TEMPLATES = {
    A4L: {
      id: 'A4L',
      name: 'HuSS A4L v1',
      width_mm: 297,
      height_mm: 210,
      corner_size_mm: 5,
      corners: [[10, 10], [287, 10], [287, 200], [10, 200]],
      floor: { y: 180, x0: 8, x1: 289, width: 0.35 },
      mark: { apex: [40, 180.4], base: [[38, 184.4], [42, 184.4]] },
      label: { x: 45, baseline: 185.5, size_pt: 8 },
      qr: { x: 262, y: 185, size: 15 },
      code_text: { right: 257, baseline: 196, size_pt: 12 },
      template_id: { x: 18, baseline: 201, size_pt: 6 }
    },
    A3L: {
      id: 'A3L',
      name: 'HuSS A3L v1',
      width_mm: 420,
      height_mm: 297,
      corner_size_mm: 5,
      corners: [[10, 10], [410, 10], [410, 287], [10, 287]],
      floor: { y: 255, x0: 8, x1: 412, width: 0.35 },
      mark: { apex: [57, 255.4], base: [[55, 259.4], [59, 259.4]] },
      label: { x: 62, baseline: 260.5, size_pt: 8 },
      qr: { x: 385, y: 262, size: 15 },
      code_text: { right: 380, baseline: 273, size_pt: 12 },
      template_id: { x: 18, baseline: 288, size_pt: 6 }
    }
  };

  function get(id) {
    var t = TEMPLATES[id];
    if (!t) throw new Error('Unknown template: ' + id);
    return t;
  }

  /** x of the start mark (the figure is expected above it). */
  function markX(t) {
    return t.mark.apex[0];
  }

  /** Centroid of the start triangle, used as an orientation tie-breaker. */
  function markCentroid(t) {
    var a = t.mark.apex, b = t.mark.base[0], c = t.mark.base[1];
    return [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
  }

  var api = { TEMPLATES: TEMPLATES, get: get, markX: markX, markCentroid: markCentroid };
  HUSS.sheet.template = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
