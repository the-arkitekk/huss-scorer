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

test('foot rule: 1.2 mm gap -> foot at red bottom, flag', () => {
  const r = footRule(180 - 1.2, 180, 0.5);
  near(r.foot_y, 178.8, 1e-12, 'foot_y');
  assert.equal(r.off_floor, true);
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
