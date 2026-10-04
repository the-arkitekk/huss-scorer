/* HuSS Scorer — js/measure/record.js
 * Turns a scoring session into the derived values shown on screen and the CSV record
 * of spec 5.2. DOM-free.
 *
 * session = {
 *   analysis,                          // HUSS.detect.pipeline.analyze result
 *   params: { ref_height_m, min_figure_mm, foot_tolerance_mm, snap_radius_mm },
 *   meta: { project_code, rater_code, sheet_code, mode, file_name, color_noncompliant, note },
 *   handles: { axis: { x, placement }, head: { y, placement }, foot: { y, placement },
 *              ceiling: { y, placement }, wall: { x, placement } },   // y/x null = not placed
 *   suggested: { head_y, foot_y, ceiling_y, wall_x },
 *   status, startedAt, confirmedAt     // ms since epoch
 * }
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.measure = HUSS.measure || {};

  /** Computed values and tool flags for the current handle positions. */
  function derive(s) {
    var a = s.analysis, h = s.handles;
    var floorAxis = HUSS.detect.floorline.yAt(a.floor, h.axis.x);
    var comp = HUSS.measure.compute.compute({
      head_y: h.head.y, foot_y: h.foot.y, ceiling_y: h.ceiling.y, wall_x: h.wall.x,
      axis_x: h.axis.x, floor_y_axis: floorAxis,
      red_bottom_y: a.red.found ? a.red.raw_foot_y : null
    }, s.params);
    var flags = HUSS.measure.flags.toolFlags(a, {
      axis_x: h.axis.x, axis_placement: h.axis.placement, foot_y: h.foot.y, figure_mm: comp.figure_mm
    }, s.params, a.config);
    return { floor_y_axis: floorAxis, comp: comp, flags: flags };
  }

  /** Phase 1 confirmation rule: head, foot, ceiling and wall placed, rater code given. */
  function missingForConfirm(s) {
    var miss = [];
    ['head', 'foot', 'ceiling'].forEach(function (k) { if (s.handles[k].y == null) miss.push(k); });
    if (s.handles.wall.x == null) miss.push('wall');
    if (!s.meta.rater_code) miss.push('rater_code');
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
    var a = s.analysis, h = s.handles, m = s.meta, cfg = a.config;
    var d = derive(s), comp = d.comp, flags = d.flags;
    var toPx = function (x, y) {
      return x == null || y == null ? [null, null] : HUSS.image.homography.apply(a.H, x, y);
    };
    var head = toPx(h.axis.x, h.head.y), foot = toPx(h.axis.x, h.foot.y), floor = toPx(h.axis.x, d.floor_y_axis);
    var ceil = toPx(h.axis.x, h.ceiling.y);
    var wall = toPx(h.wall.x, h.wall.x == null ? null : HUSS.detect.floorline.yAt(a.floor, h.wall.x));
    var c = a.align.corners;
    var dur = s.startedAt && s.confirmedAt ? Math.round((s.confirmedAt - s.startedAt) / 1000) : null;

    var rec = {
      project_code: m.project_code || '', sheet_code: m.sheet_code || '', rater_code: m.rater_code || '',
      mode: m.mode, status: s.status || null,
      measured_at: s.confirmedAt ? isoLocal(new Date(s.confirmedAt)) : null,
      duration_s: dur,
      tool_version: cfg.TOOL_VERSION, rules_version: cfg.RULES_VERSION, template: a.template.id,
      file_name: m.file_name || '', image_width_px: a.image.width, image_height_px: a.image.height,
      code_source: m.sheet_code ? 'manual' : null,
      align_method: a.align.method,
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
      head_suggested_y_mm: s.suggested.head_y, foot_suggested_y_mm: s.suggested.foot_y,
      ceiling_suggested_y_mm: s.suggested.ceiling_y, wall_suggested_x_mm: s.suggested.wall_x,
      flag_color_noncompliant: !!m.color_noncompliant,
      vertical_not_measurable: false, horizontal_not_measurable: false,
      excluded: false,
      note: m.note || ''
    };
    ['figure_mm', 'figure_from_floor_mm', 'foot_floor_gap_mm', 'ceiling_mm', 'distance_mm', 'ref_height_m',
      'scale_mm_per_m', 'est_vertical_m', 'est_horizontal_m', 'est_vertical_alt_m', 'est_horizontal_alt_m',
      'red_bottom_y_mm', 'figure_red_mm', 'est_vertical_red_m', 'est_horizontal_red_m'
    ].forEach(function (k) { rec[k] = comp[k]; });
    HUSS.measure.flags.TOOL_FLAGS.forEach(function (k) { rec[k] = flags[k]; });
    cfg.EXCLUSION_IDS.forEach(function (k) { rec[k] = false; });
    return rec;
  }

  var api = { derive: derive, missingForConfirm: missingForConfirm, isoLocal: isoLocal, fileName: fileName, buildRecord: buildRecord };
  HUSS.measure.record = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
