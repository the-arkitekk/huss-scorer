'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const HUSS = require('./_load.js');

const P = HUSS.io.project;

test('a new project has the spec 5.1 fields and the tool defaults', () => {
  const p = P.create({ project_code: 'VR3005', title: 'Pilot' }, new Date(2026, 9, 4, 10, 0));
  assert.equal(p.format, 'huss-project');
  assert.equal(p.format_version, 2);
  assert.deepEqual(p.structures, []);
  assert.equal(p.template, 'A4L');
  assert.equal(p.ref_height_m, 1.70);
  assert.equal(p.snap_radius_mm, 1.5);
  assert.deepEqual(p.suggestions, { figure: true, ceiling: true, wall: true });
  assert.deepEqual(p.exclusion_criteria.map((e) => e.id), ['excl_no_figure', 'excl_not_standing_full', 'excl_not_along_axis']);
  assert.equal(p.rules_version, HUSS.config.RULES_VERSION);
  assert.match(p.created_at, /^2026-10-04T10:00:00[+-]\d\d:\d\d$/);
  assert.equal(P.validate(p).ok, true);
  assert.equal(P.fileName(p), 'VR3005.huss.json');
});

test('write -> read gives the same project', () => {
  const p = P.create({ project_code: 'VR3005', title: 'Çalışma "1"', sheet_label: 'figür', template: 'A3L' });
  const back = P.parse(P.serialize(p));
  assert.equal(back.ok, true);
  assert.deepEqual(back.project, p);
});

test('the example in the specification is accepted', () => {
  const spec = {
    format: 'huss-project', format_version: 1, project_code: 'VR3005', title: '…', template: 'A4L',
    sheet_label: 'figür', ref_height_m: 1.70, min_figure_mm: 10, foot_tolerance_mm: 0.5, snap_radius_mm: 1.5,
    suggestions: { figure: true, ceiling: true, wall: true },
    exclusion_criteria: [
      { id: 'excl_no_figure', label: 'Figure not drawn' },
      { id: 'excl_not_standing_full', label: 'Figure not standing or not full height' },
      { id: 'excl_not_along_axis', label: 'Section not drawn along the viewing axis' }
    ],
    rules_version: '1.0', created_at: '2026-10-04T00:00:00+03:00'
  };
  const r = P.parse(JSON.stringify(spec));
  assert.equal(r.ok, true);
  assert.equal(r.project.rules_version, '1.0');
});

test('bad files are refused with field-level reasons', () => {
  assert.deepEqual(P.parse('{oops').errors, [{ field: 'file', code: 'json' }]);
  assert.equal(P.parse('{"a":1}').errors[0].code, 'not_project');
  const bad = P.create({ project_code: 'vr 3005', template: 'A5L', ref_height_m: 17, snap_radius_mm: 'x' });
  bad.exclusion_criteria.push({ id: 'excl_no_figure', label: 'duplicate' }, { id: 'excl_other', label: 'reserved' });
  const r = P.validate(bad);
  assert.equal(r.ok, false);
  const got = r.errors.map((e) => e.field + ':' + e.code).sort();
  assert.deepEqual(got, [
    'exclusion_criteria[3]:exclusion', 'exclusion_criteria[4]:exclusion', 'project_code:pattern',
    'ref_height_m:range', 'snap_radius_mm:type', 'template:template'
  ]);
  assert.equal(P.validate(P.create({})).errors[0].code, 'required');
});

test('missing suggestion switches default to on; parameters come from the project', () => {
  const p = P.create({ project_code: 'X1', ref_height_m: 1.6, suggestions: { figure: false } });
  const v = P.validate(p);
  assert.deepEqual(v.project.suggestions, { figure: false, ceiling: true, wall: true });
  const prm = P.paramsOf(v.project);
  assert.equal(prm.ref_height_m, 1.6);
  assert.equal(prm.project_code, 'X1');
  assert.equal(prm.template, 'A4L');
});

test('criterion ids are made from labels', () => {
  assert.equal(P.exclusionId('Kesit çizilmemiş'), 'excl_kesit_cizilmemis');
  assert.equal(P.exclusionId('Other'), 'excl_other_reason');
  assert.equal(P.exclusionId('Figure not drawn', ['excl_figure_not_drawn']), 'excl_figure_not_drawn_2');
});

test('structures in the project (format 2): validated, read back, version 1 files still open', () => {
  const p = P.create({ project_code: 'VR3005', structures: [
    { code: 'room', name: 'Seminar room', true_vertical_m: 4, true_horizontal_m: 7 },
    { code: 'HALL', name: 'Hall', true_vertical_m: 8, true_horizontal_m: null }
  ] });
  const v = P.validate(p);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  assert.equal(v.project.structures[0].code, 'ROOM', 'codes in capitals');
  const t = P.structuresTable(v.project);
  assert.deepEqual(t.rows.ROOM, { structure_name: 'Seminar room', true_vertical_m: 4, true_horizontal_m: 7 });
  assert.equal(P.singleStructure(v.project), null);
  assert.equal(P.singleStructure(P.validate(P.create({ project_code: 'X', structures: [{ code: 'A', name: '', true_vertical_m: 3, true_horizontal_m: 6 }] })).project), 'A');
  for (const bad of [
    [{ code: 'A', name: '', true_vertical_m: -1, true_horizontal_m: 6 }],
    [{ code: 'A', name: '', true_vertical_m: null, true_horizontal_m: null }],
    [{ code: 'A', name: '', true_vertical_m: 3, true_horizontal_m: 6 }, { code: 'a', name: '', true_vertical_m: 3, true_horizontal_m: 6 }],
    [{ code: 'A B', name: '', true_vertical_m: 3, true_horizontal_m: 6 }]
  ]) {
    const r = P.validate(P.create({ project_code: 'X', structures: bad }));
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.ok(r.errors.some((e) => e.code === 'structure'));
  }
  const old = JSON.parse(P.serialize(P.create({ project_code: 'OLD' })));
  old.format_version = 1; delete old.structures;
  const r1 = P.parse(JSON.stringify(old));
  assert.equal(r1.ok, true);
  assert.equal(r1.project.format_version, 2);
  assert.deepEqual(r1.project.structures, []);
});

test('merge with the structure of a one-structure project: every sheet belongs to it', () => {
  const C = HUSS.io.csv, rec = { project_code: 'X', sheet_code: '22222', rater_code: 'AB', mode: 'blind', status: 'measured', est_vertical_m: 4.4, est_horizontal_m: 6.3 };
  const r = C.readMeasurements(C.toCSV([rec]));
  const p = P.validate(P.create({ project_code: 'X', structures: [{ code: 'ROOM', name: 'Room', true_vertical_m: 4, true_horizontal_m: 7 }] })).project;
  const m = HUSS.io.merge.merge([{ name: 'a', records: r.records, exclusionIds: [] }], null, P.structuresTable(p), { defaultStructure: P.singleStructure(p) });
  assert.equal(m.rows[0].structure_code, 'ROOM');
  assert.ok(Math.abs(m.rows[0].E_vertical - 0.1) < 1e-9);
  assert.ok(Math.abs(m.rows[0].E_horizontal + 0.1) < 1e-9);
  assert.equal(m.problems.no_key, false);
  assert.deepEqual(m.problems.not_in_key, []);
});
