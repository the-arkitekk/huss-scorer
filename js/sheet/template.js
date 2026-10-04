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
      label: { x: 40, anchor: 'middle', baseline: 187.4, size_pt: 8 },   // centred under the start mark
      qr: { x: 262, y: 185, size: 15 },
      code_text: { right: 257, baseline: 196, size_pt: 12 },
      template_id: { x: 18, baseline: 201, size_pt: 6 },
      ground: { gap_mm: 0.7, stroke_mm: 0.25, depth_mm: [2.2, 2.8], lean_deg: [48, 58], spacing_mm: [2.2, 3.6], start_x: 9, end_x: 288, skip: [[37, 43]], seed: 3005 }
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
      label: { x: 57, anchor: 'middle', baseline: 262.4, size_pt: 8 },
      qr: { x: 385, y: 262, size: 15 },
      code_text: { right: 380, baseline: 273, size_pt: 12 },
      template_id: { x: 18, baseline: 288, size_pt: 6 },
      ground: { gap_mm: 0.7, stroke_mm: 0.25, depth_mm: [2.2, 2.8], lean_deg: [48, 58], spacing_mm: [2.2, 3.6], start_x: 9, end_x: 411, skip: [[54, 60]], seed: 3005 }
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

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Ground hatching below the floor line: short "/" strokes with slightly irregular spacing,
   * lean and depth (so they cannot be counted like a ruler, rule 4.3), starting gap_mm below
   * the line so they never touch it. Fixed seed: every sheet of a template is identical.
   * Returns [[[xBottom, yBottom], [xTop, yTop]], ...] in mm (stroke centre lines).
   */
  function groundHatch(t) {
    var g = t.ground;
    if (!g) return [];
    var rnd = mulberry32(g.seed);
    var lerp = function (r) { return r[0] + (r[1] - r[0]) * rnd(); };
    var yTop = t.floor.y + t.floor.width / 2 + g.gap_mm + g.stroke_mm / 2;
    var out = [], x = g.start_x + g.spacing_mm[0] * rnd();
    while (x <= g.end_x) {
      var lean = lerp(g.lean_deg) * Math.PI / 180, depth = lerp(g.depth_mm);
      var xb = x - depth / Math.tan(lean);
      var blocked = g.skip.some(function (s) { return xb < s[1] && x > s[0]; });
      if (!blocked && xb >= g.start_x) out.push([[xb, yTop + depth], [x, yTop]]);
      x += lerp(g.spacing_mm);
    }
    return out;
  }

  var api = { TEMPLATES: TEMPLATES, get: get, markX: markX, markCentroid: markCentroid, groundHatch: groundHatch };
  HUSS.sheet.template = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
