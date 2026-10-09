/* HuSS Scorer — js/measure/record.js
 * Turns a scoring session into the derived values shown on screen and the CSV record
 * of spec 5.2. DOM-free.
 *
 * session = {
 *   analysis,                          // HUSS.detect.pipeline.analyze result
 *   params: { ref_height_m, min_figure_mm, foot_tolerance_mm, snap_radius_mm },
 *   meta: { project_code, rater_code, sheet_code, code_source, mode, file_name, color_noncompliant, note,
 *           structure_mark (structure code from the sheet's boxes or chosen in Open mode), structure_mark_source,
 *           exclusions: { excl_id: bool }, vertical_not_measurable, horizontal_not_measurable },
 *   handles: { axis: { x, placement }, head: { y, placement }, foot: { y, placement },
 *              ceiling: { y, placement }, wall: { x, placement } },   // y/x null = not placed
 *   suggested: { head_y, foot_y, ceiling_y, wall_x },
 *   status, startedAt, confirmedAt,    // ms since epoch
 *   duration_s                         // optional; time spent on the drawing over all visits
 * }
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.measure = HUSS.measure || {};

  function q2(v) {
    return v == null ? v : Math.round(v * 100) / 100;
  }

  /**
   * Handle positions at CSV precision (0.01 mm). Everything is computed from these, so a
   * record loaded back gives exactly the same values (spec 10.1).
   */
  function quantized(handles) {
    var h = handles;
    return {
      axis: { x: q2(h.axis.x), placement: h.axis.placement },
      head: { y: q2(h.head.y), placement: h.head.placement },
      foot: { y: q2(h.foot.y), placement: h.foot.placement },
      ceiling: { y: q2(h.ceiling.y), placement: h.ceiling.placement },
      wall: { x: q2(h.wall.x), placement: h.wall.placement }
    };
  }

  /**
   * The drawn lines under the ceiling and wall handles (rules 1.3, 1.4): the line whose measured
   * position (its average, or its point when slanted) lies within the snap radius of the handle, or null. Gives the backup points, the spread and the
   * stretch drawn on screen.
   */
  function lines(s) {
    var a = s.analysis, h = quantized(s.handles), r = s.params.snap_radius_mm, L = HUSS.detect.line;
    return {
      ceiling: h.ceiling.y == null || h.axis.x == null ? null : L.ceilingNear(a, h.axis.x, h.ceiling.y, r, h.wall.x),
      wall: h.wall.x == null ? null : L.wallNear(a, h.wall.x, r, h.ceiling.y)
    };
  }

  /** Computed values and tool flags for the current handle positions. */
  function derive(s) {
    var a = s.analysis, h = quantized(s.handles), ln = lines(s);
    var floorAxis = HUSS.detect.floorline.yAt(a.floor, h.axis.x);
    var comp = HUSS.measure.compute.compute({
      head_y: h.head.y, foot_y: h.foot.y, ceiling_y: h.ceiling.y, wall_x: h.wall.x,
      axis_x: h.axis.x, floor_y_axis: floorAxis,
      red_bottom_y: a.red.found ? a.red.raw_foot_y : null,
      ceiling_at_axis_y: ln.ceiling ? ln.ceiling.at_axis : null,
      wall_at_floor_x: ln.wall ? ln.wall.at_floor : null,
      ceiling_avg_y: ln.ceiling ? ln.ceiling.average : null,
      wall_avg_x: ln.wall ? ln.wall.average : null
    }, s.params);
    var spread = {
      ceiling: ln.ceiling && !s.meta.vertical_not_measurable ? ln.ceiling.spread : null,
      wall: ln.wall && !s.meta.horizontal_not_measurable ? ln.wall.spread : null
    };
    var flags = HUSS.measure.flags.toolFlags(a, {
      axis_x: h.axis.x, axis_placement: h.axis.placement, foot_y: h.foot.y, figure_mm: comp.figure_mm,
      ceiling_spread: spread.ceiling, wall_spread: spread.wall
    }, s.params, a.config);
    return { floor_y_axis: floorAxis, comp: comp, flags: flags, lines: ln, spread: spread };
  }

  /** Exclusion ids of the session's project (spec defaults without a project), plus excl_other. */
  function exclusionIds(params) {
    var list = params && params.exclusion_criteria ? params.exclusion_criteria.map(function (e) { return e.id; })
      : HUSS.io.csv.DEFAULT_EXCLUSIONS.slice();
    return list.filter(function (id) { return id !== 'excl_other'; }).concat(['excl_other']);
  }

  function isExcluded(s) {
    var ex = s.meta.exclusions || {};
    return exclusionIds(s.params).some(function (id) { return !!ex[id]; });
  }

  /**
   * Confirmation rule (spec 8.4): measured needs head and foot, and per axis a handle or
   * "not measurable"; any exclusion criterion makes the drawing excluded and handles optional.
   * The rater code and the sheet code (the record key) are always needed.
   */
  function missingForConfirm(s) {
    var miss = [], m = s.meta;
    if (!isExcluded(s)) {
      if (s.handles.head.y == null) miss.push('head');
      if (s.handles.foot.y == null) miss.push('foot');
      if (!m.vertical_not_measurable && s.handles.ceiling.y == null) miss.push('ceiling');
      if (!m.horizontal_not_measurable && s.handles.wall.x == null) miss.push('wall');
    }
    if (!m.rater_code) miss.push('rater_code');
    if (!m.sheet_code) miss.push('sheet_code');
    return miss;
  }

  function pad(n, w) {
    var s = String(Math.abs(Math.trunc(n)));
    while (s.length < (w || 2)) s = '0' + s;
    return s;
  }

  /** ISO 8601 local time with offset, e.g. 2026-10-04T14:03:22+03:00. */
  function isoLocal(date) {
    var off = -date.getTimezoneOffset();
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
      'T' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds()) +
      (off >= 0 ? '+' : '-') + pad(off / 60) + ':' + pad(off % 60);
  }

  function safe(code) {
    return String(code || '').trim().replace(/[^A-Za-z0-9-]+/g, '-');
  }

  /** <project_code>_<rater_code>_<mode>_<YYYYMMDD-HHMM>.csv */
  function fileName(meta, date, fallbackProject) {
    var stamp = date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()) + '-' + pad(date.getHours()) + pad(date.getMinutes());
    return [safe(meta.project_code) || fallbackProject, safe(meta.rater_code), meta.mode, stamp].join('_') + '.csv';
  }

  function buildRecord(s) {
    var a = s.analysis, h = quantized(s.handles), m = s.meta, cfg = a.config;
    var d = derive(s), comp = d.comp, flags = d.flags;
    var toPx = function (x, y) {
      return x == null || y == null ? [null, null] : HUSS.image.homography.apply(a.H, x, y);
    };
    var head = toPx(h.axis.x, h.head.y), foot = toPx(h.axis.x, h.foot.y), floor = toPx(h.axis.x, d.floor_y_axis);
    var ceil = toPx(h.axis.x, h.ceiling.y);
    var wall = toPx(h.wall.x, h.wall.x == null ? null : HUSS.detect.floorline.yAt(a.floor, h.wall.x));
    var c = a.align.corners;
    var dur = s.duration_s != null ? Math.round(s.duration_s)
      : s.startedAt && s.confirmedAt ? Math.round((s.confirmedAt - s.startedAt) / 1000) : null;

    var rec = {
      project_code: m.project_code || '', sheet_code: m.sheet_code || '', rater_code: m.rater_code || '',
      mode: m.mode, status: s.status || null,
      measured_at: s.confirmedAt ? isoLocal(new Date(s.confirmedAt)) : null,
      duration_s: dur,
      tool_version: cfg.TOOL_VERSION, rules_version: cfg.RULES_VERSION, template: a.template.id,
      file_name: m.file_name || '', image_width_px: a.image.width, image_height_px: a.image.height,
      code_source: m.sheet_code ? (m.code_source || 'manual') : null,
      align_method: a.align.method,
      structure_mark: m.structure_mark || null, structure_mark_source: m.structure_mark ? (m.structure_mark_source || 'mark') : null,
      structure_mark_box: a.boxes && a.boxes.printed >= 2 && a.boxes.status === 'one' ? a.boxes.index + 1 : null,
      px_per_mm_x: a.align.px_per_mm_x, px_per_mm_y: a.align.px_per_mm_y,
      rotation_deg: a.align.rotation_deg, align_residual_mm: a.align.residual_mm,
      corner_tl_x_px: c.tl[0], corner_tl_y_px: c.tl[1], corner_tr_x_px: c.tr[0], corner_tr_y_px: c.tr[1],
      corner_bl_x_px: c.bl[0], corner_bl_y_px: c.bl[1], corner_br_x_px: c.br[0], corner_br_y_px: c.br[1],
      floor_y_mm: d.floor_y_axis, floor_slope: a.floor.b,
      axis_x_mm: h.axis.x, head_y_mm: h.head.y, foot_y_mm: h.foot.y, ceiling_y_mm: h.ceiling.y, wall_x_mm: h.wall.x,
      head_x_px: head[0], head_y_px: head[1], foot_x_px: foot[0], foot_y_px: foot[1],
      floor_x_px: floor[0], floor_y_px: floor[1], ceiling_x_px: ceil[0], ceiling_y_px: ceil[1],
      wall_x_px: wall[0], wall_y_px: wall[1],
      head_placement: h.head.y == null ? null : h.head.placement,
      foot_placement: h.foot.y == null ? null : h.foot.placement,
      ceiling_placement: h.ceiling.y == null ? null : h.ceiling.placement,
      wall_placement: h.wall.x == null ? null : h.wall.placement,
      axis_placement: h.axis.placement,
      // at the same precision as the handles, so "accepted unchanged" is an exact comparison
      head_suggested_y_mm: q2(s.suggested.head_y), foot_suggested_y_mm: q2(s.suggested.foot_y),
      ceiling_suggested_y_mm: q2(s.suggested.ceiling_y), wall_suggested_x_mm: q2(s.suggested.wall_x),
      flag_color_noncompliant: !!m.color_noncompliant,
      vertical_not_measurable: !!m.vertical_not_measurable, horizontal_not_measurable: !!m.horizontal_not_measurable,
      excluded: isExcluded(s),
      note: m.note || ''
    };
    ['figure_mm', 'figure_from_floor_mm', 'foot_floor_gap_mm', 'ceiling_mm', 'distance_mm', 'ref_height_m',
      'scale_mm_per_m', 'est_vertical_m', 'est_horizontal_m', 'est_vertical_alt_m', 'est_horizontal_alt_m',
      'red_bottom_y_mm', 'figure_red_mm', 'est_vertical_red_m', 'est_horizontal_red_m',
      'ceiling_at_axis_y_mm', 'wall_at_floor_x_mm', 'est_vertical_at_axis_m', 'est_horizontal_at_floor_m',
      'ceiling_avg_y_mm', 'wall_avg_x_mm', 'est_vertical_avg_m', 'est_horizontal_avg_m'
    ].forEach(function (k) { rec[k] = comp[k]; });
    rec.ceiling_spread_mm = d.spread.ceiling;
    rec.wall_spread_mm = d.spread.wall;
    // rules 1.4: how each handle's value was taken: the line's average, its point (slanted line), or by hand
    var basis = function (line, placement) { return placement == null ? null : placement === 'manual' || !line || !line.basis ? 'manual' : line.basis; };
    rec.ceiling_slant_deg = d.lines.ceiling && d.lines.ceiling.followed ? d.lines.ceiling.slant_deg : null;
    rec.wall_slant_deg = d.lines.wall && d.lines.wall.followed ? d.lines.wall.slant_deg : null;
    rec.ceiling_basis = basis(d.lines.ceiling, rec.ceiling_placement);
    rec.wall_basis = basis(d.lines.wall, rec.wall_placement);
    // rules 1.5: drawn with its thickness, so measured at the face towards the figure
    var thick = function (line) { return line && line.followed ? !!line.thick : null; };
    rec.ceiling_thick = thick(d.lines.ceiling);
    rec.wall_thick = thick(d.lines.wall);
    rec.ceiling_thickness_mm = rec.ceiling_thick ? d.lines.ceiling.thickness : null;
    rec.wall_thickness_mm = rec.wall_thick ? d.lines.wall.thickness : null;
    HUSS.measure.flags.TOOL_FLAGS.forEach(function (k) { rec[k] = flags[k]; });
    var ex = m.exclusions || {};
    exclusionIds(s.params).forEach(function (k) { rec[k] = !!ex[k]; });
    // An axis marked "not measurable" carries no values (its handle may still be on screen).
    if (m.vertical_not_measurable) {
      ['ceiling_y_mm', 'ceiling_x_px', 'ceiling_y_px', 'ceiling_mm', 'est_vertical_m', 'est_vertical_alt_m', 'est_vertical_red_m', 'ceiling_placement',
        'ceiling_at_axis_y_mm', 'est_vertical_at_axis_m', 'ceiling_spread_mm', 'ceiling_avg_y_mm', 'est_vertical_avg_m', 'ceiling_slant_deg', 'ceiling_basis', 'ceiling_thick', 'ceiling_thickness_mm']
        .forEach(function (k) { rec[k] = null; });
    }
    if (m.horizontal_not_measurable) {
      ['wall_x_mm', 'wall_x_px', 'wall_y_px', 'distance_mm', 'est_horizontal_m', 'est_horizontal_alt_m', 'est_horizontal_red_m', 'wall_placement',
        'wall_at_floor_x_mm', 'est_horizontal_at_floor_m', 'wall_spread_mm', 'wall_avg_x_mm', 'est_horizontal_avg_m', 'wall_slant_deg', 'wall_basis', 'wall_thick', 'wall_thickness_mm']
        .forEach(function (k) { rec[k] = null; });
    }
    return rec;
  }

  var api = {
    derive: derive, lines: lines, missingForConfirm: missingForConfirm, isoLocal: isoLocal, fileName: fileName, buildRecord: buildRecord,
    exclusionIds: exclusionIds, isExcluded: isExcluded
  };
  HUSS.measure.record = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
