'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const HUSS = require('./_load.js');
const { generate } = require('../synthetic/generate.js');

const S = HUSS.io.session;
const P = HUSS.detect.pipeline;

function scan(name, code, i) {
  return { name, size: 1000 + i, lastModified: 1700000000000 + i, sheet_code: code, template: code ? 'A4L' : null };
}

test('queue: ascending sheet codes, unreadable scans last by file name', () => {
  const sess = S.create({ rater_code: 'EY', mode: 'blind' });
  S.addItems(sess, [scan('b.jpg', 'CV94Y', 1), scan('z.jpg', null, 2), scan('a.jpg', '6QHJ4', 3), scan('y.jpg', null, 4), scan('c.jpg', '66J34', 5)]);
  const order = sess.order.map((k) => S.byKey(sess, k));
  assert.deepEqual(order.map((i) => i.sheet_code || i.name), ['66J34', '6QHJ4', 'CV94Y', 'y.jpg', 'z.jpg']);
  assert.equal(S.unreadNumber(sess, order[3]), 1);
  assert.equal(S.unreadNumber(sess, order[4]), 2);
  assert.deepEqual(S.progress(sess), { done: 0, deferred: 0, total: 5, position: 1 });
});

test('duplicates are found and one scan is kept; the other is set aside', () => {
  const sess = S.create({ rater_code: 'EY', mode: 'blind' });
  S.addItems(sess, [scan('a.jpg', 'CV94Y', 1), scan('b.jpg', 'CV94Y', 2), scan('c.jpg', '6QHJ4', 3)]);
  const d = S.duplicates(sess);
  assert.equal(d.length, 1);
  assert.equal(d[0].items.length, 2);
  S.keepDuplicate(sess, 'CV94Y', d[0].items[1].key);
  assert.equal(sess.items.length, 2);
  assert.deepEqual(sess.setAside, [{ name: 'a.jpg', sheet_code: 'CV94Y' }]);
  assert.equal(S.duplicates(sess).length, 0);
});

test('navigation: next unscored, wrap around, then "review later" items, then done', () => {
  const sess = S.create({ rater_code: 'EY', mode: 'blind' });
  S.addItems(sess, [scan('a', 'CV94Y', 1), scan('b', '6QHJ4', 2), scan('c', '66J34', 3)]);
  const rec = (code, status) => ({ sheet_code: code, status, rater_code: 'EY', mode: 'blind' });
  // order: 66J34, 6QHJ4, CV94Y
  S.setRecord(sess, S.current(sess), rec('66J34', 'deferred'));
  S.goTo(sess, S.nextIndex(sess));
  assert.equal(S.current(sess).sheet_code, '6QHJ4');
  S.setRecord(sess, S.current(sess), rec('6QHJ4', 'measured'));
  S.goTo(sess, S.nextIndex(sess));
  assert.equal(S.current(sess).sheet_code, 'CV94Y');
  S.setRecord(sess, S.current(sess), rec('CV94Y', 'excluded'));
  S.goTo(sess, S.nextIndex(sess));
  assert.equal(S.current(sess).sheet_code, '66J34', 'review-later item comes back');
  S.setRecord(sess, S.current(sess), rec('66J34', 'measured'));
  assert.equal(S.nextIndex(sess), -1, 'all done');
  assert.deepEqual(S.progress(sess), { done: 3, deferred: 0, total: 3, position: 1 });
  assert.equal(sess.confirmsSinceDownload, 3);
  assert.equal(S.records(sess).length, 3);
});

function analysedSession(id, meta) {
  const g = generate(id);
  const a = P.analyze(g.img, { template: g.template });
  const t = g.truth, ax = a.suggestions.axis_x;
  return {
    analysis: a,
    params: HUSS.io.project.paramsOf(HUSS.io.project.create({ project_code: 'VR3005' })),
    meta: Object.assign({
      project_code: 'VR3005', rater_code: 'EY', sheet_code: t.sheet_code, code_source: 'qr', mode: 'blind', file_name: id + '.png',
      color_noncompliant: true, note: 'pencil, "light"\nsecond line', exclusions: {}, vertical_not_measurable: false, horizontal_not_measurable: false
    }, meta || {}),
    handles: {
      axis: { x: ax + 0.4, placement: 'manual' },
      head: { y: a.suggestions.head_y, placement: 'suggested' },
      foot: { y: a.suggestions.foot_y, placement: 'suggested' },
      ceiling: { y: P.snapCeiling(a, ax, t.ceiling_y + 0.6, 1.5).pos, placement: 'snapped' },
      wall: { x: t.wall_x - 0.33, placement: 'manual' }
    },
    suggested: { head_y: a.suggestions.head_y, foot_y: a.suggestions.foot_y, ceiling_y: null, wall_x: null },
    status: 'measured', confirmedAt: Date.UTC(2026, 9, 4, 11, 0, 0), duration_s: 57
  };
}

test('10.1: export, load back, state is the same (handles, boxes, note, times)', () => {
  const s = analysedSession('S2');
  const cols = HUSS.io.csv.columnsFor(HUSS.measure.record.exclusionIds(s.params).slice(0, -1));
  const text1 = HUSS.io.csv.toCSV([HUSS.measure.record.buildRecord(s)], cols);
  const back = HUSS.io.csv.readMeasurements(text1);
  assert.equal(back.ok, true);
  const st = S.stateFromRecord(back.records[0]);
  // rebuild the session from the saved state on the same analysis
  const s2 = Object.assign({}, s, {
    handles: st.handles, suggested: st.suggested,
    meta: Object.assign({}, s.meta, st.meta), duration_s: st.seconds
  });
  const text2 = HUSS.io.csv.toCSV([HUSS.measure.record.buildRecord(s2)], cols);
  assert.equal(text2, text1);
  assert.equal(st.meta.note, 'pencil, "light"\nsecond line');
  assert.equal(st.handles.axis.placement, 'manual');
  assert.equal(st.handles.wall.placement, 'manual');
  assert.equal(st.meta.color_noncompliant, true);
});

test('confirmation rule: exclusions make handles optional; not measurable axes are blank', () => {
  const s = analysedSession('S6'); // no red figure: head and foot not suggested
  s.handles.head = { y: null, placement: null };
  s.handles.foot = { y: null, placement: null };
  assert.deepEqual(HUSS.measure.record.missingForConfirm(s).sort(), ['foot', 'head']);
  s.meta.exclusions = { excl_no_figure: true };
  assert.deepEqual(HUSS.measure.record.missingForConfirm(s), []);
  const rec = HUSS.measure.record.buildRecord(Object.assign({}, s, { status: 'excluded' }));
  assert.equal(rec.excluded, true);
  assert.equal(rec.excl_no_figure, true);
  assert.equal(rec.excl_other, false);

  const v = analysedSession('S1', { vertical_not_measurable: true });
  v.handles.ceiling = { y: null, placement: null };
  assert.deepEqual(HUSS.measure.record.missingForConfirm(v), []);
  const r2 = HUSS.measure.record.buildRecord(analysedSession('S1', { vertical_not_measurable: true }));
  assert.equal(r2.vertical_not_measurable, true);
  assert.equal(r2.ceiling_mm, null);
  assert.equal(r2.est_vertical_m, null);
  assert.ok(r2.est_horizontal_m > 0);

  const noCode = analysedSession('S1', { sheet_code: '' });
  assert.deepEqual(HUSS.measure.record.missingForConfirm(noCode), ['sheet_code']);
});

test('CSV columns follow the project exclusion criteria', () => {
  const cols = HUSS.io.csv.columnsFor(['excl_no_figure', 'excl_kesit_cizilmemis']).map((c) => c.name);
  assert.ok(cols.includes('excl_kesit_cizilmemis'));
  assert.ok(!cols.includes('excl_not_along_axis'));
  assert.deepEqual(cols.slice(-4), ['excl_kesit_cizilmemis', 'excl_other', 'excluded', 'note']);
  const text = HUSS.io.csv.toCSV([{ sheet_code: '6QHJ4', excl_kesit_cizilmemis: true, excl_other: false }], HUSS.io.csv.columnsFor(['excl_kesit_cizilmemis']));
  const r = HUSS.io.csv.readMeasurements('project_code,rater_code,mode,status,' + text);
  assert.equal(r.ok, true);
  assert.deepEqual(r.exclusionIds, ['excl_kesit_cizilmemis']);
});

test('records go back to their scans (by code, or by file name when the code was typed)', () => {
  const sess = S.create({ rater_code: 'EY', mode: 'blind' });
  S.addItems(sess, [scan('a.jpg', 'CV94Y', 1), scan('nocode.jpg', null, 2)]);
  const res = S.applyRecords(sess, [
    { sheet_code: 'CV94Y', status: 'measured', rater_code: 'EY', mode: 'blind', duration_s: 40 },
    { sheet_code: '66J34', status: 'deferred', rater_code: 'EY', mode: 'blind', file_name: 'nocode.jpg', code_source: 'manual' },
    { sheet_code: '6QHJ4', status: 'measured', rater_code: 'EY', mode: 'blind', file_name: 'elsewhere.jpg' },
    { sheet_code: '22222', status: 'measured', rater_code: 'AB', mode: 'blind' }
  ]);
  assert.deepEqual(res, { matched: 2, orphans: 1, conflicts: 1 });
  const typed = sess.items.find((i) => i.name === 'nocode.jpg');
  assert.equal(typed.sheet_code, '66J34');
  assert.equal(typed.code_source, 'manual');
  assert.equal(sess.items.find((i) => i.name === 'a.jpg').seconds, 40);
  assert.equal(S.records(sess).length, 3, 'orphan records are kept for the next download');
});

test('autosave writes and reads through a storage, and survives a broken one', () => {
  const mem = {};
  const store = { setItem: (k, v) => { mem[k] = v; }, getItem: (k) => (k in mem ? mem[k] : null), removeItem: (k) => { delete mem[k]; } };
  const A = HUSS.io.autosave;
  const k = A.key('VR3005', 'ey', 'blind');
  assert.equal(k, 'huss:v1:VR3005:EY:blind');
  const sess = S.create({ project_code: 'VR3005', rater_code: 'EY', mode: 'blind' });
  S.addItems(sess, [scan('a', 'CV94Y', 1), scan('b', '6QHJ4', 2)]);
  S.setRecord(sess, S.current(sess), { sheet_code: '6QHJ4', status: 'measured', rater_code: 'EY', mode: 'blind' });
  assert.equal(A.save(k, S.toSaved(sess), store), true);
  const saved = A.load(k, store);
  assert.deepEqual({ done: S.savedSummary(saved).done, total: S.savedSummary(saved).total }, { done: 1, total: 2 });
  assert.equal(saved.records[0].sheet_code, '6QHJ4');
  A.remove(k, store);
  assert.equal(A.load(k, store), null);
  const broken = { setItem: () => { throw new Error('quota'); }, getItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('x'); } };
  assert.equal(A.save(k, {}, broken), false);
  assert.equal(A.load(k, broken), null);
  assert.equal(A.available(broken), false);
});

test('key and structures tables (comma or Excel style)', () => {
  const T = HUSS.io.tables;
  const key = T.parseKey('sheet_code,participant_code,structure_code,group\nCV94Y,P01,ST1,A\n6qhj4,P02,ST2,B\nCV94Z,P03,ST1,A\nCV94Y,P04,ST1,A\n');
  assert.equal(key.ok, false);
  assert.deepEqual(key.errors, [{ line: 4, code: 'bad_sheet_code' }, { line: 5, code: 'duplicate' }]);
  assert.equal(key.rows['6QHJ4'].participant_code, 'P02');
  assert.deepEqual(key.rows.CV94Y.extra, { key_group: 'A' });
  const st = T.parseStructures('﻿structure_code;structure_name;true_vertical_m;true_horizontal_m\nST1;Atrium;4,00;7,00\nST2;Hall;3,2;x\n');
  assert.equal(st.rows.ST1.true_vertical_m, 4);
  assert.deepEqual(st.errors, [{ line: 3, code: 'bad_number' }]);
  assert.deepEqual(T.lookup(key, st, 'CV94Y'), {
    participant_code: 'P01', structure_code: 'ST1', structure_name: 'Atrium', true_vertical_m: 4, true_horizontal_m: 7
  });
  assert.equal(T.lookup(key, st, '22222'), null);
  assert.equal(T.parseKey('a,b\n1,2').errors[0].code, 'missing_columns');
});

test('fast sheet code reading for the queue (no rectification)', () => {
  for (const id of ['S1', 'S4']) {
    const g = generate(id);
    const r = P.readCode(g.img, { template: g.template });
    assert.equal(r.ok, true, id);
    assert.equal(r.sheet_code, g.truth.sheet_code);
    assert.equal(r.template_mismatch, false);
  }
});

test('tables screen helpers: write, read back, row problems', () => {
  const T = HUSS.io.tables;
  const st = [{ structure_code: 'ST1', structure_name: 'Atrium, "east"', true_vertical_m: 4, true_horizontal_m: 7.25 }];
  const back = T.parseStructures(T.structuresToCSV(st));
  assert.equal(back.ok, true);
  assert.deepEqual(back.rows.ST1, { structure_name: 'Atrium, "east"', true_vertical_m: 4, true_horizontal_m: 7.25 });
  const rows = [
    { sheet_code: 'CV94Y', participant_code: 'P01', structure_code: 'ST1' },
    { sheet_code: 'cv94y', participant_code: 'P02', structure_code: 'ST1' },
    { sheet_code: 'CV94Z', participant_code: 'P03', structure_code: 'ST9' },
    { sheet_code: '6QHJ4', participant_code: '', structure_code: 'ST1' },
    { sheet_code: '66J34', participant_code: '', structure_code: '' }
  ];
  assert.deepEqual(T.keyRowProblems(rows[0], rows, ['ST1']), ['duplicate']);
  assert.deepEqual(T.keyRowProblems(rows[2], rows, ['ST1']), ['bad_sheet_code', 'unknown_structure']);
  // the participant is optional (the structure may also come from the box on the sheet), but not both
  assert.deepEqual(T.keyRowProblems(rows[3], rows, ['ST1']), []);
  assert.deepEqual(T.keyRowProblems(rows[4], rows, ['ST1']), ['empty']);
  const k2 = T.parseKey(T.keyToCSV([rows[3], { sheet_code: '8DTH7', participant_code: 'P05', structure_code: '' }]));
  assert.equal(k2.ok, true);
  assert.equal(k2.rows['6QHJ4'].participant_code, null);
  assert.equal(k2.rows['8DTH7'].structure_code, null);
  const k = T.parseKey(T.keyToCSV([rows[0]]));
  assert.equal(k.ok, true);
  assert.equal(k.rows.CV94Y.participant_code, 'P01');
});
