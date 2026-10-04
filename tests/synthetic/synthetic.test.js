'use strict';
// Synthetic pages S1-S8 (spec 10.2) through the full detection pipeline.
const test = require('node:test');
const assert = require('node:assert/strict');
const HUSS = require('../unit/_load.js');
const { generate } = require('./generate.js');

const P = HUSS.detect.pipeline;
const params = HUSS.config.DEFAULTS;

const TOL = {
  align_mm: 0.15,
  head_foot_mm: 0.2,
  snap_mm: 0.15,
  est_rel: 0.01
};

function near(actual, expected, tol, what) {
  assert.ok(actual !== null && Math.abs(actual - expected) <= tol,
    `${what}: got ${actual === null ? 'null' : actual.toFixed(4)}, expected ${expected.toFixed(4)} (tol ${tol})`);
}

/** Largest alignment error (mm) over template points, comparing H with the true mapping. */
function alignmentError(a, g) {
  const T = a.template;
  const pts = [...T.corners, [T.floor.x0, T.floor.y], [T.floor.x1, T.floor.y], [40, 160], [148, 105], [200, 60]];
  let worst = 0;
  for (const [x, y] of pts) {
    const p = P.toImagePx(a, x, y), t = g.map(x, y);
    worst = Math.max(worst, Math.hypot(p[0] - t[0], p[1] - t[1]) / g.pxPerMm);
  }
  return worst;
}

function run(id) {
  const g = generate(id);
  const a = P.analyze(g.img, { template: g.template, params });
  return { g, a, t: g.truth };
}

/** Handles placed as a rater would: suggestions accepted, ceiling and wall dropped 1 mm off and snapped. */
function measure(a, t, headFoot) {
  const r = params.snap_radius_mm;
  const axis = a.suggestions.axis_x;
  const ceil = P.snapCeiling(a, axis, t.ceiling_y + 1.0, r);
  const wall = P.snapWall(a, t.wall_x - 1.0, r);
  const hf = headFoot || { head_y: a.suggestions.head_y, foot_y: a.suggestions.foot_y };
  const comp = HUSS.measure.compute.compute({
    head_y: hf.head_y, foot_y: hf.foot_y, ceiling_y: ceil.pos, wall_x: wall.pos,
    axis_x: axis, floor_y_axis: P.floorY(a, axis)
  }, params);
  const flags = HUSS.measure.flags.toolFlags(a, {
    axis_x: axis, axis_placement: 'auto', foot_y: hf.foot_y, figure_mm: comp.figure_mm
  }, params, HUSS.config);
  return { ceil, wall, comp, flags };
}

function checkCommon(id, { a, g, t }) {
  assert.equal(a.ok, true, `${id}: analysis failed (${a.error})`);
  assert.ok(alignmentError(a, g) <= TOL.align_mm, `${id}: alignment error ${alignmentError(a, g).toFixed(3)} mm`);
  near(P.floorY(a, t.axis_x), t.floor_y, TOL.align_mm, `${id} floor_y`);
  assert.equal(a.align.warning, false, `${id}: alignment warning`);
}

function checkSnapAndEstimates(id, t, m) {
  assert.equal(m.ceil.snapped, true, `${id}: ceiling did not snap`);
  assert.equal(m.wall.snapped, true, `${id}: wall did not snap`);
  near(m.ceil.pos, t.ceiling_y, TOL.snap_mm, `${id} ceiling snap`);
  near(m.wall.pos, t.wall_x, TOL.snap_mm, `${id} wall snap`);
  near(m.comp.est_vertical_m, t.est_vertical_m, TOL.est_rel * t.est_vertical_m, `${id} est_vertical_m`);
  near(m.comp.est_horizontal_m, t.est_horizontal_m, TOL.est_rel * t.est_horizontal_m, `${id} est_horizontal_m`);
}

function checkRedFigure(id, a, t) {
  assert.equal(a.red.found, true, `${id}: red figure not found`);
  near(a.suggestions.head_y, t.head_y, TOL.head_foot_mm, `${id} head`);
  near(a.suggestions.foot_y, t.foot_y, TOL.head_foot_mm, `${id} foot`);
  near(a.suggestions.axis_x, t.axis_x, TOL.head_foot_mm, `${id} axis`);
}

for (const id of ['S1', 'S2', 'S3', 'S4', 'S5']) {
  test(`${id}: suggestions, snap and estimates`, () => {
    const r = run(id);
    checkCommon(id, r);
    checkRedFigure(id, r.a, r.t);
    const m = measure(r.a, r.t);
    checkSnapAndEstimates(id, r.t, m);
    for (const f of HUSS.measure.flags.TOOL_FLAGS) assert.equal(m.flags[f], false, `${id}: unexpected ${f}`);
  });
}

test('S3, S4: orientation is corrected', () => {
  for (const id of ['S3', 'S4']) {
    const { a, g } = run(id);
    assert.equal(a.ok, true);
    // page TL corner must land where the true mapping puts it
    const tl = a.align.corners.tl, t = g.map(10, 10);
    assert.ok(Math.hypot(tl[0] - t[0], tl[1] - t[1]) / g.pxPerMm < TOL.align_mm, `${id}: TL corner`);
  }
});

test('S6: no red figure -> flag_red_not_found; rater places head and foot; snap still works', () => {
  const r = run('S6');
  checkCommon('S6', r);
  assert.equal(r.a.red.found, false);
  assert.equal(r.a.suggestions.head_y, null);
  near(r.a.suggestions.axis_x, HUSS.sheet.template.markX(r.a.template), 1e-9, 'S6 axis at the start mark');
  const m = measure(r.a, r.t, { head_y: r.t.head_y, foot_y: r.t.foot_y });
  assert.equal(m.flags.flag_red_not_found, true);
  checkSnapAndEstimates('S6', r.t, m);
});

test('S7: figure 8 mm off the mark -> axis follows the figure, flag_figure_off_mark', () => {
  const r = run('S7');
  checkCommon('S7', r);
  checkRedFigure('S7', r.a, r.t);
  const m = measure(r.a, r.t);
  assert.equal(m.flags.flag_figure_off_mark, true);
  assert.equal(m.flags.flag_foot_off_floor, false);
  checkSnapAndEstimates('S7', r.t, m);
});

test('S8: figure 1.5 mm above the floor -> foot on the floor line (rules 1.2), red bottom kept, flag_foot_off_floor', () => {
  const r = run('S8');
  checkCommon('S8', r);
  checkRedFigure('S8', r.a, r.t);
  near(r.a.suggestions.foot_y, r.t.floor_y, TOL.head_foot_mm, 'S8 foot = floor line');
  near(r.a.red.raw_foot_y, r.t.raw_foot_y, TOL.head_foot_mm, 'S8 red bottom');
  const m = measure(r.a, r.t);
  assert.equal(m.flags.flag_foot_off_floor, true);
  checkSnapAndEstimates('S8', r.t, m);
});

test('head and foot handles snap to the red edges and the floor line', () => {
  const { a, t } = run('S1');
  const r = params.snap_radius_mm;
  const h = P.snapHead(a, t.head_y + 0.8, r);
  assert.equal(h.snapped, true);
  near(h.pos, t.head_y, TOL.head_foot_mm, 'head snap');
  const f = P.snapFoot(a, a.suggestions.axis_x, t.floor_y - 1.0, r);
  assert.equal(f.snapped, true);
  near(f.pos, t.floor_y, TOL.head_foot_mm, 'foot snap');
  const none = P.snapCeiling(a, a.suggestions.axis_x, 40, r); // empty paper
  assert.equal(none.snapped, false);
  assert.equal(none.pos, 40);
});
