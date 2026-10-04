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
  assert.equal(a.qr.found, true, `${id}: QR not read`);
  assert.equal(a.qr.sheet_code, t.sheet_code, `${id}: sheet code from QR`);
  assert.equal(a.qr.template, g.template, `${id}: template from QR`);
  assert.equal(a.qr.template_mismatch, false);
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

for (const id of ['S12', 'S15']) {
  test(`${id}: suggestions, snap, estimates and QR (${id === 'S12' ? '600 dpi' : 'A3L'})`, () => {
    const r = run(id);
    checkCommon(id, r);
    checkRedFigure(id, r.a, r.t);
    const m = measure(r.a, r.t);
    checkSnapAndEstimates(id, r.t, m);
    for (const f of HUSS.measure.flags.TOOL_FLAGS) assert.equal(m.flags[f], false, `${id}: unexpected ${f}`);
  });
}

test('S13: 6 mm figure -> flag_figure_small, estimates still within 1 %', () => {
  const r = run('S13');
  checkCommon('S13', r);
  checkRedFigure('S13', r.a, r.t);
  const m = measure(r.a, r.t);
  assert.equal(m.flags.flag_figure_small, true);
  checkSnapAndEstimates('S13', r.t, m);
});

test('T1: floor line and start mark ambiguous after a 180 degree turn -> the QR code decides', () => {
  const r = run('T1');
  checkCommon('T1', r);
  assert.equal(r.a.align.orientation_tie, true, 'tie expected');
  assert.equal(r.a.align.tie_break, 'qr');
  const tl = r.a.align.corners.tl, t = r.g.map(10, 10);
  assert.ok(Math.hypot(tl[0] - t[0], tl[1] - t[1]) / r.g.pxPerMm < TOL.align_mm, 'TL corner');
  checkRedFigure('T1', r.a, r.t);
});

test('QR is still read with a stray pencil stroke on it, and when printed 3 mm off its place', () => {
  const { a, t } = run('S1');
  const R = a.R, T = a.template;
  const dark = HUSS.image.lab.darkness(a.rect);
  // a 4 mm pencil stroke (0.6 mm, dark grey) through the data area of the code
  const x1 = T.qr.x + 7, y1 = T.qr.y + 8, x2 = T.qr.x + 10, y2 = T.qr.y + 11;
  for (let s = 0; s <= 1; s += 0.0005) {
    const cx = (x1 + s * (x2 - x1)) * R, cy = (y1 + s * (y2 - y1)) * R;
    for (let dy = -0.3 * R; dy <= 0.3 * R; dy++) for (let dx = -0.3 * R; dx <= 0.3 * R; dx++) {
      dark.data[Math.round(cy + dy) * dark.width + Math.round(cx + dx)] = 200;
    }
  }
  const damaged = HUSS.detect.qr.read(HUSS.detect.qr.rectSampler(dark, R), T);
  assert.equal(damaged.found, true, 'read through the pencil stroke');
  assert.equal(damaged.sheet_code, t.sheet_code);
  assert.ok(damaged.corrected >= 1, 'errors were corrected');

  const base = HUSS.detect.qr.rectSampler(HUSS.image.lab.darkness(a.rect), R);
  for (const [dx, dy] of [[3, -2.5], [-4.2, 1.1], [0.8, 6.3]]) {
    const moved = HUSS.detect.qr.read((x, y) => base(x - dx, y - dy), T); // code appears shifted by (dx, dy)
    assert.equal(moved.found, true, `found by the search around the expected place (${dx}, ${dy})`);
    assert.equal(moved.sheet_code, t.sheet_code);
  }
});

// ---------------------------------------------------------------- Phase 2c

test('7.9 suggestions: ceiling and wall within 0.3 mm (S1-S5, S9, S11, S12, S15, S16, S17)', () => {
  for (const id of ['S1', 'S2', 'S3', 'S4', 'S5', 'S9', 'S11', 'S12', 'S15', 'S16', 'S17']) {
    const { a, t } = run(id);
    assert.equal(a.ok, true, id);
    near(a.suggestions.ceiling_y, t.ceiling_y, 0.3, `${id} ceiling suggestion`);
    near(a.suggestions.wall_x, t.wall_x, 0.3, `${id} wall suggestion`);
  }
});

test('S9: double-line wall -> the inner face is suggested and snapped to', () => {
  const r = run('S9');
  checkCommon('S9', r);
  near(r.a.suggestions.wall_x, r.t.wall_x, 0.3, 'S9 inner face');
  const m = measure(r.a, r.t);
  checkSnapAndEstimates('S9', r.t, m);
});

test('S10: no ceiling above the figure -> no ceiling suggestion; wall still suggested', () => {
  const r = run('S10');
  checkCommon('S10', r);
  assert.equal(r.a.suggestions.ceiling_y, null);
  near(r.a.suggestions.wall_x, r.t.wall_x, 0.3, 'S10 wall');
});

test('S11: JPEG quality 60 and noise -> alignment, QR, figure, snap and estimates hold', () => {
  const r = run('S11');
  checkCommon('S11', r);
  checkRedFigure('S11', r.a, r.t);
  const m = measure(r.a, r.t);
  checkSnapAndEstimates('S11', r.t, m);
});

test('S14: a corner mark is missing -> automatic alignment asks for manual alignment', () => {
  const g = generate('S14');
  const a = P.analyze(g.img, { template: g.template });
  assert.equal(a.ok, false);
  assert.equal(a.error, 'corners_not_found');
  assert.equal(P.readCode(g.img, { template: g.template }).ok, false);
});

/** Seeded click noise: a point (page mm) mapped to the image, moved by up to +-maxMm on each axis. */
function clickAt(g, x, y, maxMm, rnd) {
  const p = g.map(x, y);
  return [p[0] + (rnd() * 2 - 1) * maxMm * g.pxPerMm, p[1] + (rnd() * 2 - 1) * maxMm * g.pxPerMm];
}

function seeded(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

test('S14: manual alignment by the two floor line ends (+-0.2 mm clicks) -> QR read, estimates within 1 %', () => {
  const g = generate('S14'), T = HUSS.sheet.template.get(g.template), t = g.truth, rnd = seeded(14);
  for (let k = 0; k < 3; k++) {
    const a = P.manualFloorline(g.img, clickAt(g, T.floor.x0, T.floor.y, 0.2, rnd), clickAt(g, T.floor.x1, T.floor.y, 0.2, rnd), { template: g.template, params });
    assert.equal(a.ok, true);
    assert.equal(a.align.method, 'manual_floorline');
    assert.equal(a.align.residual_mm, null);
    assert.equal(a.qr.found, true, 'QR after manual alignment');
    assert.equal(a.qr.sheet_code, t.sheet_code);
    checkRedFigure('S14', a, t);
    const m = measure(a, t);
    near(m.comp.est_vertical_m, t.est_vertical_m, TOL.est_rel * t.est_vertical_m, 'S14 est_vertical_m');
    near(m.comp.est_horizontal_m, t.est_horizontal_m, TOL.est_rel * t.est_horizontal_m, 'S14 est_horizontal_m');
    assert.equal(m.flags.flag_manual_alignment, true);
  }
});

test('S14: four corner clicks with one square missing -> the click without a square is named', () => {
  const g = generate('S14'), t = g.truth, rnd = seeded(41);
  const clicks = t.corners_px.map(([x, y]) => [x + (rnd() * 2 - 1) * 0.8 * g.pxPerMm, y + (rnd() * 2 - 1) * 0.8 * g.pxPerMm]);
  const a = P.manualCorners(g.img, clicks, { template: g.template, params });
  assert.equal(a.ok, false);
  assert.equal(a.error, 'manual_no_square');
  assert.equal(a.index, g.params.missingCorner);
});

for (const id of ['S1', 'S3', 'S11']) {
  test(`${id}: manual alignment by four corner clicks 0.8 mm off, any order -> centred, same accuracy as automatic`, () => {
    const g = generate(id), t = g.truth, rnd = seeded(7);
    const clicks = t.corners_px.map(([x, y]) => [x + (rnd() < 0.5 ? -0.8 : 0.8) * g.pxPerMm, y + (rnd() < 0.5 ? -0.8 : 0.8) * g.pxPerMm]);
    clicks.reverse().push(clicks.shift()); // a different order than the page corners
    const a = P.manualCorners(g.img, clicks, { template: g.template, params });
    assert.equal(a.ok, true, `${id}: ${a.error}`);
    assert.equal(a.align.method, 'manual_corners');
    assert.ok(alignmentError(a, g) <= TOL.align_mm, `${id}: alignment error ${alignmentError(a, g).toFixed(3)} mm`);
    assert.equal(a.qr.found, true);
    assert.equal(a.qr.sheet_code, t.sheet_code);
    checkRedFigure(id, a, t);
    assert.equal(HUSS.measure.flags.toolFlags(a, { axis_x: a.suggestions.axis_x, axis_placement: 'auto', foot_y: a.suggestions.foot_y, figure_mm: 20 }, params, HUSS.config).flag_manual_alignment, true);
  });
}

test('S14: floor line ends clicked the other way round -> the QR code puts the page the right way up', () => {
  const g = generate('S14'), T = HUSS.sheet.template.get(g.template), t = g.truth;
  const a = P.manualFloorline(g.img, g.map(T.floor.x1, T.floor.y), g.map(T.floor.x0, T.floor.y), { template: g.template, params });
  assert.equal(a.qr.found, true);
  checkRedFigure('S14', a, t);
});

test('a manual alignment is repeated from the corners kept in the record', () => {
  for (const [id, how] of [['S1', 'corners'], ['S14', 'floorline']]) {
    const g = generate(id), T = HUSS.sheet.template.get(g.template), opts = { template: g.template, params };
    const a = how === 'corners' ? P.manualCorners(g.img, g.truth.corners_px, opts)
      : P.manualFloorline(g.img, g.map(T.floor.x0, T.floor.y), g.map(T.floor.x1, T.floor.y), opts);
    const c = a.align.corners;
    const b = P.alignFromCorners(g.img, a.align.method, [c.tl, c.tr, c.br, c.bl], opts);
    assert.equal(b.align.method, a.align.method);
    for (const [x, y] of [[20, 20], [150, 100], [270, 190]]) {
      const p = P.toImagePx(a, x, y), q = P.toImagePx(b, x, y);
      assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.01, `${id}: repeated alignment differs`);
    }
    near(b.suggestions.head_y, a.suggestions.head_y, 1e-6, `${id} head`);
  }
});

test('manual alignment: wrong number of corner clicks is refused', () => {
  const g = generate('S1');
  assert.equal(P.manualCorners(g.img, [[1, 1], [2, 2], [3, 3]], { template: g.template }).ok, false);
});

// ---------------------------------------------------------------- rules 1.3: line averages

/** A scoring state as the scoring screen keeps it, with all suggestions accepted. */
function acceptedState(a, extra) {
  const sug = a.suggestions;
  return Object.assign({
    analysis: a, params,
    meta: { project_code: 'VR3005', rater_code: 'AB', sheet_code: 'ABCDE', mode: 'open', file_name: 'x.png', exclusions: {} },
    handles: {
      axis: { x: sug.axis_x, placement: 'auto' },
      head: { y: sug.head_y, placement: 'suggested' }, foot: { y: sug.foot_y, placement: 'suggested' },
      ceiling: { y: sug.ceiling_y, placement: 'suggested' }, wall: { x: sug.wall_x, placement: 'suggested' }
    },
    suggested: { head_y: sug.head_y, foot_y: sug.foot_y, ceiling_y: sug.ceiling_y, wall_x: sug.wall_x },
    status: 'measured', confirmedAt: Date.UTC(2026, 9, 4, 12, 0, 0)
  }, extra || {});
}

test('S16: freehand ceiling and wall -> averages suggested and snapped to; backup points and spread kept', () => {
  const r = run('S16'), a = r.a, t = r.t, rad = params.snap_radius_mm;
  checkCommon('S16', r);
  checkRedFigure('S16', a, t);
  near(a.suggestions.ceiling_y, t.ceiling_y, TOL.snap_mm, 'S16 ceiling average');
  near(a.suggestions.wall_x, t.wall_x, TOL.snap_mm, 'S16 wall average');
  assert.ok(Math.abs(t.ceiling_y - t.ceiling_at_axis_y) > 1.5, 'the scene must make the average differ from the axis point');
  // A handle dropped near the slanted line (1 mm off its average) snaps to the average.
  const ceil = P.snapCeiling(a, a.suggestions.axis_x, t.ceiling_y + 1.0, rad, t.wall_x);
  const wall = P.snapWall(a, t.wall_x - 1.0, rad, t.ceiling_y);
  assert.equal(ceil.snapped, true); assert.equal(wall.snapped, true);
  near(ceil.pos, t.ceiling_y, TOL.snap_mm, 'S16 ceiling snap');
  near(wall.pos, t.wall_x, TOL.snap_mm, 'S16 wall snap');
  const rec = HUSS.measure.record.buildRecord(acceptedState(a));
  near(rec.est_vertical_m, t.est_vertical_m, TOL.est_rel * t.est_vertical_m, 'S16 est_vertical_m');
  near(rec.est_horizontal_m, t.est_horizontal_m, TOL.est_rel * t.est_horizontal_m, 'S16 est_horizontal_m');
  near(rec.ceiling_at_axis_y_mm, t.ceiling_at_axis_y, TOL.snap_mm, 'S16 ceiling at axis');
  near(rec.wall_at_floor_x_mm, t.wall_at_floor_x, TOL.snap_mm, 'S16 wall at floor');
  near(rec.est_vertical_at_axis_m, t.est_vertical_at_axis_m, TOL.est_rel * t.est_vertical_at_axis_m, 'S16 est_vertical_at_axis_m');
  near(rec.est_horizontal_at_floor_m, t.est_horizontal_at_floor_m, TOL.est_rel * t.est_horizontal_at_floor_m, 'S16 est_horizontal_at_floor_m');
  near(rec.ceiling_spread_mm, t.ceiling_spread, 0.2, 'S16 ceiling spread');
  near(rec.wall_spread_mm, t.wall_spread, 0.2, 'S16 wall spread');
  assert.equal(rec.flag_ceiling_uneven, false);
  assert.equal(rec.flag_wall_uneven, false);
  assert.equal(rec.rules_version, '1.3');
});

test('S17: clearly slanted ceiling -> flag_ceiling_uneven; not measurable clears the backup columns', () => {
  const r = run('S17'), t = r.t;
  near(r.a.suggestions.ceiling_y, t.ceiling_y, TOL.snap_mm, 'S17 ceiling average');
  const rec = HUSS.measure.record.buildRecord(acceptedState(r.a));
  assert.ok(t.ceiling_spread > HUSS.config.LINE.UNEVEN_MM);
  assert.equal(rec.flag_ceiling_uneven, true);
  assert.equal(rec.flag_wall_uneven, false);
  const st = acceptedState(r.a);
  st.meta.vertical_not_measurable = true;
  const nm = HUSS.measure.record.buildRecord(st);
  assert.equal(nm.flag_ceiling_uneven, false);
  for (const k of ['ceiling_y_mm', 'ceiling_at_axis_y_mm', 'est_vertical_at_axis_m', 'ceiling_spread_mm']) assert.equal(nm[k], null, k);
});

test('straight lines: average, axis point and floor point coincide (S1, S9 inner face, S11 JPEG)', () => {
  for (const id of ['S1', 'S9', 'S11']) {
    const { a, t } = run(id);
    const rec = HUSS.measure.record.buildRecord(acceptedState(a));
    near(rec.ceiling_at_axis_y_mm, t.ceiling_y, TOL.snap_mm, id + ' ceiling at axis');
    near(rec.wall_at_floor_x_mm, t.wall_x, TOL.snap_mm, id + ' wall at floor');
    assert.ok(rec.ceiling_spread_mm < 0.3 && rec.wall_spread_mm < 0.3, id + ' spread ' + rec.ceiling_spread_mm + ' / ' + rec.wall_spread_mm);
  }
});

test('the ceiling average depends on where the wall is: the averaged part ends 1 mm before it', () => {
  const { a, t } = run('S16');
  const ax = a.suggestions.axis_x, rad = params.snap_radius_mm, L = HUSS.detect.line;
  const full = L.ceilingNear(a, ax, t.ceiling_y, rad, t.wall_x);
  const short = L.ceilingNear(a, ax, t.ceiling_y, rad + HUSS.config.LINE.FOLLOW_UP_EXTRA_MM, ax + 40);
  assert.ok(short.pts[short.pts.length - 1][0] <= ax + 39.05, 'ends before the wall');
  assert.ok(full.pts[full.pts.length - 1][0] > t.wall_x - 1.2, 'runs up to 1 mm before the wall');
  assert.ok(short.pos > full.pos, 'the ceiling rises to the right: a shorter part averages lower');
});
