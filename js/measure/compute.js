/* HuSS Scorer — js/measure/compute.js
 * Scoring arithmetic (spec 1, 6 and 7.10). All lengths in page mm, y grows downward.
 * Missing inputs are null and propagate to null outputs.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.measure = HUSS.measure || {};

  function isNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  /**
   * Foot rule (rule 3, rules_version 1.2): the foot is always the floor line, so the figure is
   * measured from the head top to the floor. When the lowest red point is more than
   * `toleranceMm` away from the line it is flagged; `side` says where it ended
   * ('above': figure floating, 'below': feet drawn through the line, null: on the line).
   */
  function footRule(rawFootY, floorY, toleranceMm) {
    var gap = floorY - rawFootY; // positive: red ends above the line (y grows downward)
    var side = gap > toleranceMm ? 'above' : gap < -toleranceMm ? 'below' : null;
    return { foot_y: floorY, off_floor: side !== null, side: side };
  }

  /** est_m = length_mm / (figure_mm / ref_height_m); null when the scale is unusable. */
  function estimate(lengthMm, figureMm, refHeightM) {
    if (!isNum(lengthMm) || !isNum(figureMm) || !isNum(refHeightM)) return null;
    if (figureMm <= 0 || refHeightM <= 0) return null;
    return lengthMm / (figureMm / refHeightM);
  }

  /** E = (est - true) / true. */
  function errorRatio(est, trueValue) {
    if (!isNum(est) || !isNum(trueValue) || trueValue === 0) return null;
    return (est - trueValue) / trueValue;
  }

  /**
   * Derived values of section 7.10, plus backup values:
   * - measured to the lowest red point (figure_red_mm, est_*_red_m; rules 1.0 for a floating figure);
   * - with the ceiling where its line crosses the axis and the wall where its line stands on the
   *   floor (est_vertical_at_axis_m, est_horizontal_at_floor_m; rules 1.0-1.2 instead of averages);
   * - with the averages of the lines also where rules 1.4 takes a point for a slanted line
   *   (est_vertical_avg_m, est_horizontal_avg_m; rules 1.3).
   * h: { head_y, foot_y, ceiling_y, wall_x, axis_x, floor_y_axis, red_bottom_y,
   *      ceiling_at_axis_y, wall_at_floor_x, ceiling_avg_y, wall_avg_x } (mm, nullable)
   * p: { ref_height_m, min_figure_mm }
   */
  function compute(h, p) {
    var has = function (k) { return isNum(h[k]); };
    var out = {
      figure_mm: null,
      figure_from_floor_mm: null,
      foot_floor_gap_mm: null,
      ceiling_mm: null,
      distance_mm: null,
      ref_height_m: p.ref_height_m,
      scale_mm_per_m: null,
      est_vertical_m: null,
      est_horizontal_m: null,
      est_vertical_alt_m: null,
      est_horizontal_alt_m: null,
      red_bottom_y_mm: has('red_bottom_y') ? h.red_bottom_y : null,
      figure_red_mm: null,
      est_vertical_red_m: null,
      est_horizontal_red_m: null,
      ceiling_at_axis_y_mm: has('ceiling_at_axis_y') ? h.ceiling_at_axis_y : null,
      wall_at_floor_x_mm: has('wall_at_floor_x') ? h.wall_at_floor_x : null,
      est_vertical_at_axis_m: null,
      est_horizontal_at_floor_m: null,
      ceiling_avg_y_mm: has('ceiling_avg_y') ? h.ceiling_avg_y : null,
      wall_avg_x_mm: has('wall_avg_x') ? h.wall_avg_x : null,
      est_vertical_avg_m: null,
      est_horizontal_avg_m: null,
      flag_figure_small: null
    };
    if (has('head_y') && has('foot_y')) out.figure_mm = h.foot_y - h.head_y;
    if (has('head_y') && has('floor_y_axis')) out.figure_from_floor_mm = h.floor_y_axis - h.head_y;
    if (has('foot_y') && has('floor_y_axis')) out.foot_floor_gap_mm = h.floor_y_axis - h.foot_y;
    if (has('ceiling_y') && has('floor_y_axis')) out.ceiling_mm = h.floor_y_axis - h.ceiling_y;
    if (has('wall_x') && has('axis_x')) out.distance_mm = h.wall_x - h.axis_x;

    if (isNum(out.figure_mm) && out.figure_mm > 0 && isNum(p.ref_height_m) && p.ref_height_m > 0) {
      out.scale_mm_per_m = out.figure_mm / p.ref_height_m;
    }
    out.est_vertical_m = estimate(out.ceiling_mm, out.figure_mm, p.ref_height_m);
    out.est_horizontal_m = estimate(out.distance_mm, out.figure_mm, p.ref_height_m);
    out.est_vertical_alt_m = estimate(out.ceiling_mm, out.figure_from_floor_mm, p.ref_height_m);
    out.est_horizontal_alt_m = estimate(out.distance_mm, out.figure_from_floor_mm, p.ref_height_m);
    if (has('head_y') && has('red_bottom_y')) out.figure_red_mm = h.red_bottom_y - h.head_y;
    out.est_vertical_red_m = estimate(out.ceiling_mm, out.figure_red_mm, p.ref_height_m);
    out.est_horizontal_red_m = estimate(out.distance_mm, out.figure_red_mm, p.ref_height_m);
    if (has('ceiling_at_axis_y') && has('floor_y_axis')) {
      out.est_vertical_at_axis_m = estimate(h.floor_y_axis - h.ceiling_at_axis_y, out.figure_mm, p.ref_height_m);
    }
    if (has('wall_at_floor_x') && has('axis_x')) {
      out.est_horizontal_at_floor_m = estimate(h.wall_at_floor_x - h.axis_x, out.figure_mm, p.ref_height_m);
    }
    if (has('ceiling_avg_y') && has('floor_y_axis')) {
      out.est_vertical_avg_m = estimate(h.floor_y_axis - h.ceiling_avg_y, out.figure_mm, p.ref_height_m);
    }
    if (has('wall_avg_x') && has('axis_x')) {
      out.est_horizontal_avg_m = estimate(h.wall_avg_x - h.axis_x, out.figure_mm, p.ref_height_m);
    }
    if (isNum(out.figure_mm) && isNum(p.min_figure_mm)) out.flag_figure_small = out.figure_mm < p.min_figure_mm;
    return out;
  }

  var api = { footRule: footRule, estimate: estimate, errorRatio: errorRatio, compute: compute, isNum: isNum };
  HUSS.measure.compute = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
