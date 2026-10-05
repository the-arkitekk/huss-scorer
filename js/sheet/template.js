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
      // structure boxes (projects with 2+ structures): below the ground hatch, clear of the red
      // figure search (to 8 mm below the floor, 35 mm around the mark) and of the sheet code
      boxes: { x0: 84, y: 189.5, size: 4.5, pitch: 9.5, max: 16, line: 0.25, label_baseline: 197.4, label_size_pt: 5, title: { right: 82, baseline: 193, size_pt: 6 } },
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
      boxes: { x0: 110, y: 265, size: 4.5, pitch: 9.5, max: 16, line: 0.25, label_baseline: 272.9, label_size_pt: 5, title: { right: 108, baseline: 268.5, size_pt: 6 } },
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

  /**
   * The structure boxes of a sheet for n structures (none for fewer than two): [{ i, x, y, size }],
   * x, y the outer top left corner in mm. The coordinator marks the box of the structure drawn.
   */
  function structureBoxes(t, n) {
    var g = t.boxes, out = [];
    if (!g || !(n >= 2)) return out;
    for (var i = 0; i < Math.min(n, g.max); i++) out.push({ i: i, x: g.x0 + i * g.pitch, y: g.y, size: g.size });
    return out;
  }

  /** Box frames (filled strips, crisp in print), the codes below them and a title to the left. */
  function boxItems(t, codes) {
    var g = t.boxes, boxes = structureBoxes(t, codes ? codes.length : 0), out = [];
    if (!boxes.length) return out;
    var w = g.line, rects = [];
    boxes.forEach(function (b) {
      rects.push({ x: b.x, y: b.y, w: b.size, h: w }, { x: b.x, y: b.y + b.size - w, w: b.size, h: w },
        { x: b.x, y: b.y + w, w: w, h: b.size - 2 * w }, { x: b.x + b.size - w, y: b.y + w, w: w, h: b.size - 2 * w });
      var label = String(codes[b.i]).slice(0, 8);
      out.push({ k: 'text', x: b.x + b.size / 2, y: g.label_baseline, size_pt: label.length > 6 ? g.label_size_pt * 0.85 : g.label_size_pt, font: 'sans', anchor: 'middle', text: label });
    });
    out.unshift({ k: 'rects', rects: rects });
    out.push({ k: 'text', x: g.title.right, y: g.title.baseline, size_pt: g.title.size_pt, font: 'sans', anchor: 'end', text: HUSS.t ? HUSS.t('sheet_boxes_title') : 'structure' });
    return out;
  }

  /**
   * Everything printed on one sheet, in mm, as drawing items shared by the SVG print view, the
   * PDF and the synthetic test pages:
   *   { k: 'rect', x, y, w, h } | { k: 'rects', rects: [{ x, y, w, h }] } (filled as one shape)
   *   { k: 'line', x1, y1, x2, y2, w, cap, color? } | { k: 'ring', cx, cy, r, w, color? } | { k: 'poly', pts }
   *   { k: 'text', x, y (baseline), size_pt, font: 'sans' | 'mono', anchor: 'start' | 'middle' | 'end', text }
   * Black only (rule 4.3). QR content: HUSS1/<TEMPLATE>/<SHEETCODE>. structureCodes: the
   * project's structure codes; two or more print the structure boxes.
   */
  function items(t, code, label, structureCodes) {
    var out = [], h = t.corner_size_mm / 2, i;
    for (i = 0; i < t.corners.length; i++) out.push({ k: 'rect', x: t.corners[i][0] - h, y: t.corners[i][1] - h, w: 2 * h, h: 2 * h });
    out.push({ k: 'line', x1: t.floor.x0, y1: t.floor.y, x2: t.floor.x1, y2: t.floor.y, w: t.floor.width, cap: 'butt' });
    groundHatch(t).forEach(function (s) {
      out.push({ k: 'line', x1: s[0][0], y1: s[0][1], x2: s[1][0], y2: s[1][1], w: t.ground.stroke_mm, cap: 'round' });
    });
    out.push({ k: 'poly', pts: [t.mark.apex, t.mark.base[1], t.mark.base[0]] });
    out.push({ k: 'text', x: t.label.x, y: t.label.baseline, size_pt: t.label.size_pt, font: 'sans', anchor: t.label.anchor || 'start', text: label });
    out.push({ k: 'text', x: t.code_text.right, y: t.code_text.baseline, size_pt: t.code_text.size_pt, font: 'mono', anchor: 'end', text: code });
    out.push({ k: 'text', x: t.template_id.x, y: t.template_id.baseline, size_pt: t.template_id.size_pt, font: 'sans', anchor: 'start', text: t.name });
    var Q = HUSS.config.QR, qr = HUSS.sheet.qr.encode(HUSS.sheet.qr.sheetText(t.id, code), Q.LEVEL);
    out.push({ k: 'rects', rects: HUSS.sheet.qr.moduleRects(qr, t.qr.x, t.qr.y, t.qr.size, Q.QUIET_MODULES) });
    return out.concat(boxItems(t, structureCodes));
  }

  // Calibration pages (spec 10.3): a red figure, ceiling and walls of known size printed on the
  // sheet, in ten layouts. Lengths in mm on A4L (scaled for A3L): the figure from head top to the
  // floor line, the ceiling above the floor line, the opposite wall right of the start mark.
  var CAL = {
    figure: [12, 15, 18, 20, 22, 25, 28, 30, 35, 40],
    ceiling: [45, 60, 75, 90, 110, 130, 50, 70, 100, 120],
    wall: [80, 100, 120, 140, 160, 180, 200, 220, 110, 150],
    red: [210, 35, 45], pencil: [70, 70, 70], stroke: 0.4, line: 0.5, left: 14
  };
  var CAL_LAYOUTS = CAL.figure.length;

  /** Known geometry of calibration layout index (0-9): { figure_mm, ceiling_mm, distance_mm, axis_x, head_y, ceiling_y, wall_x }. */
  function calibration(t, index) {
    var k = t.width_mm / 297, i = ((index % CAL_LAYOUTS) + CAL_LAYOUTS) % CAL_LAYOUTS;
    var f = Math.round(CAL.figure[i] * k * 100) / 100, c = Math.round(CAL.ceiling[i] * k * 100) / 100, w = Math.round(CAL.wall[i] * k * 100) / 100;
    var ax = markX(t);
    return { layout: i + 1, figure_mm: f, ceiling_mm: c, distance_mm: w, axis_x: ax, head_y: t.floor.y - f, ceiling_y: t.floor.y - c, wall_x: ax + w };
  }

  /** The stick figure of a calibration page: head top at headY, feet on the floor line. */
  function figureItems(cx, headY, footBottom, w, color) {
    var H = footBottom - headY, r = 0.07 * H - w / 2, hc = headY + w / 2 + r;
    var sh = headY + 0.2 * H, hip = footBottom - 0.47 * H, hand = headY + 0.5 * H, foot = footBottom - w / 2;
    var ln = function (x1, y1, x2, y2) { return { k: 'line', x1: x1, y1: y1, x2: x2, y2: y2, w: w, cap: 'round', color: color }; };
    return [
      { k: 'ring', cx: cx, cy: hc, r: r, w: w, color: color },
      ln(cx, hc + r, cx, hip), ln(cx, sh, cx - 0.17 * H, hand), ln(cx, sh, cx + 0.17 * H, hand),
      ln(cx, hip, cx - 0.12 * H, foot), ln(cx, hip, cx + 0.12 * H, foot)
    ];
  }

  /** Items of a calibration sheet: the sheet itself plus the drawing of layout index. */
  function calibrationItems(t, code, label, index) {
    var g = calibration(t, index), out = items(t, code, label), pc = CAL.pencil, lw = CAL.line, L = CAL.left * t.width_mm / 297;
    var ln = function (x1, y1, x2, y2) { return { k: 'line', x1: x1, y1: y1, x2: x2, y2: y2, w: lw, cap: 'butt', color: pc }; };
    out.push(ln(L, g.ceiling_y, g.wall_x + 0.6, g.ceiling_y), ln(L, g.ceiling_y, L, t.floor.y), ln(g.wall_x, g.ceiling_y, g.wall_x, t.floor.y));
    return out.concat(figureItems(g.axis_x, g.head_y, t.floor.y + 0.1, CAL.stroke, CAL.red));
  }

  var api = {
    TEMPLATES: TEMPLATES, get: get, markX: markX, markCentroid: markCentroid, groundHatch: groundHatch, items: items, structureBoxes: structureBoxes,
    calibration: calibration, calibrationItems: calibrationItems, CAL_LAYOUTS: CAL_LAYOUTS
  };
  HUSS.sheet.template = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
