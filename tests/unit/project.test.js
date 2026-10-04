'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const HUSS = require('./_load.js');

const P = HUSS.io.project;

test('a new project has the spec 5.1 fields and the tool defaults', () => {
  const p = P.create({ project_code: 'VR3005', title: 'Pilot' }, new Date(2026, 9, 4, 10, 0));
  assert.equal(p.format, 'huss-project');
  assert.equal(p.format_version, 1);
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
