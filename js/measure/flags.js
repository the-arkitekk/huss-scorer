/* HuSS Scorer — js/measure/flags.js
 * Tool-set flags (spec 5.2, rules 3, 6, 9, 10; 7.2; 7.7). Computed from the final state.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.measure = HUSS.measure || {};

  var TOOL_FLAGS = [
    'flag_red_not_found', 'flag_figure_small', 'flag_figure_off_mark', 'flag_foot_off_floor',
    'flag_multiple_red', 'flag_axis_moved', 'flag_manual_alignment', 'flag_alignment_warning'
  ];

  /**
   * a: analysis (pipeline result); s: { axis_x, axis_placement, foot_y, figure_mm };
   * p: { min_figure_mm, foot_tolerance_mm }; config: HUSS.config.
   * flag_foot_off_floor is set when the red trace ends off the line (either side, rule 3)
   * or when the final foot handle is off the line.
   */
  function toolFlags(a, s, p, config) {
    var markX = HUSS.sheet.template.markX(a.template);
    var floorAxis = HUSS.detect.floorline.yAt(a.floor, s.axis_x);
    var isNum = HUSS.measure.compute.isNum;
    var tol = p.foot_tolerance_mm + 1e-9;
    var redOff = a.red.found && isNum(a.red.raw_foot_y) && Math.abs(a.red.raw_foot_y - floorAxis) > tol;
    var handleOff = isNum(s.foot_y) && Math.abs(s.foot_y - floorAxis) > tol;
    return {
      flag_red_not_found: !a.red.found,
      flag_figure_small: isNum(s.figure_mm) && s.figure_mm < p.min_figure_mm,
      flag_figure_off_mark: Math.abs(s.axis_x - markX) > config.MARK.OFF_MARK_MM,
      flag_foot_off_floor: redOff || handleOff,
      flag_multiple_red: !!a.red.multiple,
      flag_axis_moved: s.axis_placement === 'manual',
      flag_manual_alignment: a.align.method !== 'auto',
      flag_alignment_warning: !!a.align.warning
    };
  }

  var api = { TOOL_FLAGS: TOOL_FLAGS, toolFlags: toolFlags };
  HUSS.measure.flags = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
