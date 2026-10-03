'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const HUSS = require('./_load.js');
const { generate } = require('../synthetic/generate.js');

const P = HUSS.detect.pipeline;

function sessionFor(id) {
  const g = generate(id);
  const a = P.analyze(g.img, { template: g.template });
  const t = g.truth, r = HUSS.config.DEFAULTS.snap_radius_mm;
  const ax = a.suggestions.axis_x;
  return {
    g,
    s: {
      analysis: a,
      params: HUSS.config.DEFAULTS,
      meta: { project_code: 'VR3005', rater_code: 'AB', sheet_code: '2222' + '2', mode: 'open', file_name: id + '.png', color_noncompliant: false, note: '' },
      handles: {
        axis: { x: ax, placement: 'auto' },
        head: { y: a.suggestions.head_y, placement: 'suggested' },
        foot: { y: a.suggestions.foot_y, placement: 'suggested' },
        ceiling: { y: P.snapCeiling(a, ax, t.ceiling_y + 0.7, r).pos, placement: 'snapped' },
        wall: { x: P.snapWall(a, t.wall_x + 0.7, r).pos, placement: 'snapped' }
      },
      suggested: { head_y: a.suggestions.head_y, foot_y: a.suggestions.foot_y, ceiling_y: null, wall_x: null },
      status: 'measured',
      startedAt: Date.UTC(2026, 9, 4, 10, 0, 0),
      confirmedAt: Date.UTC(2026, 9, 4, 10, 0, 41)
    }
  };
}

test('record of a measured page: values, original-image pixels, CSV round trip', () => {
  const { g, s } = sessionFor('S2');
  assert.deepEqual(HUSS.measure.record.missingForConfirm(s), []);
  const rec = HUSS.measure.record.buildRecord(s);
  assert.equal(rec.status, 'measured');
  assert.equal(rec.duration_s, 41);
  assert.equal(rec.rules_version, HUSS.config.RULES_VERSION);
  assert.equal(rec.code_source, 'manual');
  assert.ok(Math.abs(rec.est_vertical_m - g.truth.est_vertical_m) < 0.01 * g.truth.est_vertical_m);
  // head point in original image px agrees with the true page -> scan mapping
  const t = g.map(rec.axis_x_mm, rec.head_y_mm);
  assert.ok(Math.hypot(rec.head_x_px - t[0], rec.head_y_px - t[1]) / g.pxPerMm < 0.15);
  // export -> import -> export is stable and the CSV reads back the same values (rounded)
  const csv = HUSS.io.csv;
  const text = csv.toCSV([rec]);
  const back = csv.readMeasurements(text);
  assert.equal(back.ok, true);
  assert.equal(csv.toCSV(back.records), text);
  assert.equal(back.records[0].ceiling_placement, 'snapped');
  assert.equal(back.records[0].flag_red_not_found, false);
  assert.equal(back.records[0].excl_no_figure, false);
});

test('confirmation needs every handle and a rater code', () => {
  const { s } = sessionFor('S6');
  s.meta.rater_code = '';
  const miss = HUSS.measure.record.missingForConfirm(s);
  assert.deepEqual(miss.sort(), ['foot', 'head', 'rater_code']);
});

test('file name follows <project>_<rater>_<mode>_<YYYYMMDD-HHMM>.csv', () => {
  const d = new Date(2026, 9, 4, 9, 5);
  const name = HUSS.measure.record.fileName({ project_code: 'VR3005', rater_code: 'A B', mode: 'open' }, d, 'HUSS');
  assert.equal(name, 'VR3005_A-B_open_20261004-0905.csv');
  assert.equal(HUSS.measure.record.fileName({ project_code: '', rater_code: 'AB', mode: 'open' }, d, 'HUSS'), 'HUSS_AB_open_20261004-0905.csv');
  assert.match(HUSS.measure.record.isoLocal(d), /^2026-10-04T09:05:00[+-]\d\d:\d\d$/);
});
