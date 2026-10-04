'use strict';
// Compare (spec 8.7), subsample lists (spec 5.4, 8.1) and the queue restricted to a subsample.
const test = require('node:test');
const assert = require('node:assert/strict');
const HUSS = require('./_load.js');

const csv = HUSS.io.csv;

function near(a, b, tol, what) {
  assert.ok(a != null && Math.abs(a - b) <= tol, `${what}: got ${a}, expected ${b}`);
}

function codes(n, seed) {
  const out = [];
  let s = seed || 3;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  while (out.length < n) { const c = HUSS.sheet.code.generate(rnd); if (!out.includes(c)) out.push(c); }
  return out;
}

const C = codes(6);

function rec(i, rater, v, h, extra) {
  return Object.assign({
    project_code: 'VR3005', sheet_code: C[i], rater_code: rater, mode: 'blind', status: 'measured',
    est_vertical_m: v, est_horizontal_m: h, figure_mm: 20, ceiling_mm: 40, distance_mm: 80, duration_s: 30
  }, extra || {});
}

function mergedOf(records) {
  const r = csv.readMeasurements(csv.toCSV(records));
  const key = HUSS.io.tables.parseKey('sheet_code,participant_code,structure_code\r\n' + C.map((c, i) => `${c},P${i},ROOM`).join('\r\n'));
  const st = HUSS.io.tables.parseStructures('structure_code,structure_name,true_vertical_m,true_horizontal_m\r\nROOM,Room,4,8\r\n');
  return HUSS.io.merge.merge([{ name: 'all.csv', records: r.records, exclusionIds: r.exclusionIds }], key, st);
}

test('compare: pairs, relative differences, E differences, decision agreement, only-one-rater lists', () => {
  const m = mergedOf([
    rec(0, 'AB', 4, 8), rec(0, 'CD', 4.4, 7.2),
    rec(1, 'AB', 5, 9), rec(1, 'CD', 5, 9),
    rec(2, 'AB', 3, 6, { vertical_not_measurable: true, est_vertical_m: null }), rec(2, 'CD', 3.1, 6),
    rec(3, 'AB', null, null, { status: 'excluded', excl_no_figure: true }), rec(3, 'CD', null, null, { status: 'excluded', excl_no_figure: true }),
    rec(4, 'AB', 4, 8),
    rec(5, 'CD', 4, 8)
  ]);
  const cmp = HUSS.io.compare.compare(m.rows, 'AB', 'CD');
  assert.equal(cmp.summary.matched, 4);
  assert.deepEqual(cmp.onlyA, [C[4]]);
  assert.deepEqual(cmp.onlyB, [C[5]]);
  const p0 = cmp.pairs.find((p) => p.sheet_code === C[0]);
  near(p0.d_est_v, (4.4 - 4) / 4.2, 1e-12, 'relative difference, height');
  near(p0.d_est_h, (7.2 - 8) / 7.6, 1e-12, 'relative difference, distance');
  near(p0.d_E_v, 0.1, 1e-4, 'E difference');
  const p2 = cmp.pairs.find((p) => p.sheet_code === C[2]);
  assert.equal(p2.decision_a, 'nm_v');
  assert.equal(p2.decision_b, 'measured');
  assert.deepEqual(cmp.summary.excluded, { n: 4, agree: 4 });
  assert.deepEqual(cmp.summary.nm_v, { n: 4, agree: 3 });
  assert.equal(cmp.summary.decisions_agree, 3);
  // the wide CSV holds both raters' values and reads as plain CSV
  const wide = HUSS.io.compare.wideCSV(cmp);
  const rows = csv.parse(wide, ',');
  const head = rows[0];
  for (const c of ['sheet_code', 'rater_r1', 'rater_r2', 'E_vertical_r1', 'E_vertical_r2', 'E_horizontal_r1', 'excluded_r1', 'excluded_r2', 'reldiff_est_vertical', 'diff_E_horizontal']) {
    assert.ok(head.includes(c), c);
  }
  assert.equal(rows.length - 1 - (rows[rows.length - 1].length === 1 ? 1 : 0), 4);
  const r0 = rows.find((r) => r[0] === C[0]);
  assert.equal(r0[head.indexOf('E_vertical_r1')], '0.0000');
  assert.equal(r0[head.indexOf('E_vertical_r2')], '0.1000');
  // the compare view renders without NaN
  const frag = HUSS.report.build.compareFragment(cmp);
  assert.ok(frag.includes('data-chart="ba-v"') && frag.includes('rp-mismatch'));
  assert.ok(!/NaN|undefined/.test(frag));
});

test('subsample lists: parse (TXT or CSV), random choice, the same share per group', () => {
  const p = HUSS.io.subsample.parse('﻿' + C[0] + '\r\n' + C[1].toLowerCase() + '\r\n\r\nNOTACODE\r\n' + C[0] + '\r\n');
  assert.deepEqual(p.codes, [C[0], C[1]]);
  assert.equal(p.invalid.length, 1);
  const pc = HUSS.io.subsample.parse('sheet_code,participant_code\r\n' + C[2] + ',P1\r\n' + C[3] + ',P2\r\n');
  assert.deepEqual(pc.codes, [C[2], C[3]]);
  let s = 5;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const many = codes(40, 9);
  const pick = HUSS.io.subsample.make(many, 10, rnd);
  assert.equal(pick.length, 10);
  assert.equal(new Set(pick).size, 10);
  assert.ok(pick.every((c) => many.includes(c)));
  const groups = {};
  many.forEach((c, i) => { groups[c] = i < 30 ? 'A' : 'B'; });   // 30 and 10
  const strat = HUSS.io.subsample.make(many, 8, rnd, groups);
  assert.equal(strat.filter((c) => groups[c] === 'A').length, 6);
  assert.equal(strat.filter((c) => groups[c] === 'B').length, 2);
  assert.equal(HUSS.io.subsample.make(many.slice(0, 3), 10, rnd).length, 3);
  assert.equal(HUSS.io.subsample.toText([C[0], C[1]]), C[0] + '\r\n' + C[1] + '\r\n');
});

test('queue restricted to a subsample: listed codes stay, others and unreadable scans leave, missing codes reported', () => {
  const S = HUSS.io.session, sess = S.create({ project_code: 'VR3005', rater_code: 'CD', mode: 'blind', exclusionIds: [] });
  S.addItems(sess, [
    { name: 'a.jpg', size: 1, lastModified: 1, sheet_code: C[0] },
    { name: 'b.jpg', size: 1, lastModified: 1, sheet_code: C[1], code_source: 'ocr' },
    { name: 'c.jpg', size: 1, lastModified: 1, sheet_code: C[2] },
    { name: 'd.jpg', size: 1, lastModified: 1, sheet_code: null }
  ]);
  const r = S.restrictTo(sess, [C[1], C[2], C[5]]);
  assert.deepEqual(sess.items.map((it) => it.sheet_code).sort(), [C[1], C[2]].sort());
  assert.equal(r.found, 2);
  assert.deepEqual(r.missing, [C[5]]);
  assert.equal(r.left, 2);
  assert.equal(sess.order.length, 2);
});
