'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const HUSS = require('./_load.js');

const { compute, estimate, errorRatio, footRule } = HUSS.measure.compute;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);

test('10.1 example 1: est 16 m and 24 m, E = 0', () => {
  const ref = 1.70;
  near(estimate(94.118, 10, ref), 16.0, 0.001, 'est_vertical_m');
  near(estimate(141.176, 10, ref), 24.0, 0.001, 'est_horizontal_m');

  // Same case through the full handle-based computation.
  const floor = 150;
  const out = compute(
    { head_y: floor - 10, foot_y: floor, ceiling_y: floor - 94.118, wall_x: 40 + 141.176, axis_x: 40, floor_y_axis: floor },
    { ref_height_m: ref, min_figure_mm: 10 }
  );
  near(out.figure_mm, 10, 1e-9, 'figure_mm');
  near(out.est_vertical_m, 16.0, 0.001, 'est_vertical_m');
  near(out.est_horizontal_m, 24.0, 0.001, 'est_horizontal_m');
  assert.equal(Number(errorRatio(Number(out.est_vertical_m.toFixed(3)), 16).toFixed(4)), 0);
  assert.equal(Number(errorRatio(Number(out.est_horizontal_m.toFixed(3)), 24).toFixed(4)), 0);
  assert.equal(out.flag_figure_small, false);
});

test('10.1 example 2: est 2.550 m, E_vertical = -0.0556', () => {
  const est = estimate(30, 20, 1.70);
  near(est, 2.55, 0.001, 'est_vertical_m');
  assert.equal(errorRatio(est, 2.70).toFixed(4), '-0.0556');
});

test('foot rule: 0.3 mm gap -> foot on floor, no flag', () => {
  const r = footRule(180 - 0.3, 180, 0.5);
  assert.equal(r.foot_y, 180);
  assert.equal(r.off_floor, false);
});

// Spec 10.1 expected "foot = lowest red point" for a 1.2 mm gap (rules 1.0); rules 1.2 (owner's
// decision, 4 Oct 2026) always measures the figure to the floor line and keeps the flag.
test('foot rule 1.2: figure 1.2 mm above the line -> foot on floor, flag', () => {
  const r = footRule(180 - 1.2, 180, 0.5);
  assert.equal(r.foot_y, 180);
  assert.equal(r.off_floor, true);
  assert.equal(r.side, 'above');
});

test('foot rule 1.2: red drawn 1.2 mm below the line -> foot on floor, flag', () => {
  const r = footRule(180 + 1.2, 180, 0.5);
  assert.equal(r.foot_y, 180);
  assert.equal(r.off_floor, true);
  assert.equal(r.side, 'below');
  const inside = footRule(180 + 0.3, 180, 0.5);
  assert.equal(inside.foot_y, 180);
  assert.equal(inside.off_floor, false);
});

test('flag_foot_off_floor follows the red trace and the final foot handle', () => {
  const toolFlags = HUSS.measure.flags.toolFlags;
  const p = HUSS.config.DEFAULTS;
  const analysis = (rawFoot) => ({
    template: HUSS.sheet.template.get('A4L'),
    floor: { a: 180, b: 0 },
    red: { found: true, raw_foot_y: rawFoot, multiple: false },
    align: { method: 'auto', warning: false }
  });
  const s = { axis_x: 40, axis_placement: 'auto', foot_y: 180, figure_mm: 20 };
  assert.equal(toolFlags(analysis(180.2), s, p, HUSS.config).flag_foot_off_floor, false);
  assert.equal(toolFlags(analysis(181.3), s, p, HUSS.config).flag_foot_off_floor, true, 'drawn through the line');
  assert.equal(toolFlags(analysis(178.5), s, p, HUSS.config).flag_foot_off_floor, true, 'floating, moved to floor by rater');
  assert.equal(toolFlags(analysis(180.0), { ...s, foot_y: 178.0 }, p, HUSS.config).flag_foot_off_floor, true, 'handle moved off');
});

test('alt values use the figure measured from the floor line', () => {
  const out = compute(
    { head_y: 160, foot_y: 178.5, ceiling_y: 120, wall_x: 160, axis_x: 40, floor_y_axis: 180 },
    { ref_height_m: 1.7, min_figure_mm: 10 }
  );
  near(out.figure_mm, 18.5, 1e-9, 'figure_mm');
  near(out.figure_from_floor_mm, 20, 1e-9, 'figure_from_floor_mm');
  near(out.foot_floor_gap_mm, 1.5, 1e-9, 'foot_floor_gap_mm');
  near(out.est_vertical_alt_m, 60 / (20 / 1.7), 1e-9, 'est_vertical_alt_m');
  near(out.est_horizontal_m, 120 / (18.5 / 1.7), 1e-9, 'est_horizontal_m');
});

test('backup values measure the figure to the lowest red point', () => {
  const out = compute(
    { head_y: 160, foot_y: 180, ceiling_y: 120, wall_x: 160, axis_x: 40, floor_y_axis: 180, red_bottom_y: 178.5 },
    { ref_height_m: 1.7, min_figure_mm: 10 }
  );
  near(out.figure_mm, 20, 1e-9, 'figure_mm (to floor)');
  near(out.red_bottom_y_mm, 178.5, 1e-9, 'red_bottom_y_mm');
  near(out.figure_red_mm, 18.5, 1e-9, 'figure_red_mm');
  near(out.est_vertical_m, 60 / (20 / 1.7), 1e-9, 'est_vertical_m');
  near(out.est_vertical_red_m, 60 / (18.5 / 1.7), 1e-9, 'est_vertical_red_m');
  near(out.est_horizontal_red_m, 120 / (18.5 / 1.7), 1e-9, 'est_horizontal_red_m');
  const none = compute({ head_y: 160, foot_y: 180, ceiling_y: 120, wall_x: 160, axis_x: 40, floor_y_axis: 180 }, { ref_height_m: 1.7, min_figure_mm: 10 });
  assert.equal(none.figure_red_mm, null);
  assert.equal(none.est_vertical_red_m, null);
});

test('small figure is flagged, missing handles give nulls', () => {
  const out = compute(
    { head_y: 174, foot_y: 180, ceiling_y: null, wall_x: null, axis_x: 40, floor_y_axis: 180 },
    { ref_height_m: 1.7, min_figure_mm: 10 }
  );
  assert.equal(out.flag_figure_small, true);
  assert.equal(out.ceiling_mm, null);
  assert.equal(out.est_vertical_m, null);
  assert.equal(out.est_horizontal_m, null);
  assert.equal(errorRatio(null, 2.7), null);
});
