'use strict';
// Merge (spec 8.6) and the Report: statistics, charts and the HTML report.
const test = require('node:test');
const assert = require('node:assert/strict');
const HUSS = require('./_load.js');

const csv = HUSS.io.csv, tables = HUSS.io.tables;
const S = HUSS.report.stats, C = HUSS.report.charts, B = HUSS.report.build;

function near(a, b, tol, what) {
  assert.ok(a != null && Math.abs(a - b) <= tol, `${what}: got ${a}, expected ${b}`);
}

/** Valid sheet codes, deterministic. */
function codes(n) {
  const out = [];
  let s = 7;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  while (out.length < n) { const c = HUSS.sheet.code.generate(rnd); if (!out.includes(c)) out.push(c); }
  return out;
}

const CODES = codes(12);
const KEY_TEXT = 'sheet_code,participant_code,structure_code,group\r\n' +
  CODES.map((c, i) => `${c},P${String(i + 1).padStart(2, '0')},${i < 6 ? 'HALL' : 'ROOM'},${i % 2 ? 'b' : 'a'}`).join('\r\n') + '\r\n';
const STRUCT_TEXT = 'structure_code,structure_name,true_vertical_m,true_horizontal_m\r\nHALL,Exhibition hall,8,20\r\nROOM,Seminar room,3,7\r\n';

/** A measured record of rater r for sheet i, with estimates est (m). */
function record(i, rater, estV, estH, extra) {
  return Object.assign({
    project_code: 'VR3005', sheet_code: CODES[i], rater_code: rater, mode: 'blind', status: 'measured',
    measured_at: '2026-10-05T10:' + String(i).padStart(2, '0') + ':00+03:00', duration_s: 20 + i,
    code_source: i === 3 ? 'ocr' : 'qr', align_method: i === 4 ? 'auto_three_corners' : 'auto',
    est_vertical_m: estV, est_horizontal_m: estH, est_vertical_at_axis_m: estV * 0.98, est_horizontal_at_floor_m: estH * 1.01,
    est_vertical_red_m: estV * 1.05, est_horizontal_red_m: estH * 1.05,
    head_placement: 'suggested', foot_placement: 'suggested', ceiling_placement: i % 3 ? 'suggested' : 'snapped', wall_placement: i === 5 ? 'manual' : 'suggested',
    head_suggested_y_mm: 150, foot_suggested_y_mm: 180, ceiling_suggested_y_mm: 100, wall_suggested_x_mm: 160,
    flag_foot_off_floor: i === 2, flag_ceiling_uneven: i === 7
  }, extra || {});
}

/** CSV text of records, as the Score screen writes it, read back like a loaded file. */
function asFile(name, records) {
  const r = csv.readMeasurements(csv.toCSV(records));
  assert.equal(r.ok, true, r.error);
  return { name, records: r.records, exclusionIds: r.exclusionIds };
}

function sample() {
  const r1 = [], r2 = [];
  for (let i = 0; i < 12; i++) {
    const tv = i < 6 ? 8 : 3, th = i < 6 ? 20 : 7;
    r1.push(record(i, 'AB', tv * (1 + (i - 5) * 0.04), th * (1 - (i - 6) * 0.03)));
    if (i < 5) r2.push(record(i, 'CD', tv * (1 + (i - 5) * 0.04) * 1.02, th * (1 - (i - 6) * 0.03) * 0.99));
  }
  r1[10] = record(10, 'AB', null, null, { status: 'excluded', excl_no_figure: true });
  return { r1, r2 };
}

test('merge: key and structures joined, E for main and backup values, problems reported', () => {
  const { r1, r2 } = sample();
  const extra = record(1, 'AB', 9, 21, { measured_at: '2026-10-05T11:30:00+03:00' }); // AB scored sheet 1 again, later
  const stray = record(0, 'AB', 3, 7, { sheet_code: '22222' });                       // not in the key (any valid code)
  const deferred = record(11, 'CD', null, null, { status: 'deferred' });
  const key = tables.parseKey(KEY_TEXT), structures = tables.parseStructures(STRUCT_TEXT.replace('ROOM,Seminar room,3,7\r\n', ''));
  const m = HUSS.io.merge.merge([asFile('ab.csv', r1), asFile('cd.csv', r2.concat([deferred])), asFile('ab2.csv', [extra, stray])], key, structures);
  assert.deepEqual(m.raters, ['AB', 'CD']);
  assert.equal(m.rows.filter((r) => r.rater_code === 'AB' && r.sheet_code === CODES[1]).length, 1, 'one record per sheet and rater');
  const s1 = m.rows.find((r) => r.rater_code === 'AB' && r.sheet_code === CODES[1]);
  assert.equal(s1.source_file, 'ab2.csv', 'the later record is kept');
  near(s1.E_vertical, (9 - 8) / 8, 1e-9, 'E_vertical');
  near(s1.E_horizontal, (21 - 20) / 20, 1e-9, 'E_horizontal');
  near(s1.E_vertical_at_axis, (9 * 0.98 - 8) / 8, 1e-9, 'E_vertical_at_axis');
  near(s1.E_horizontal_red, (21 * 1.05 - 20) / 20, 1e-9, 'E_horizontal_red');
  assert.equal(s1.participant_code, 'P02');
  assert.equal(s1.structure_name, 'Exhibition hall');
  assert.equal(s1.key_group, 'b', 'extra key columns kept as key_*');
  assert.deepEqual(m.problems.duplicates.map((d) => d.sheet_code), [CODES[1]]);
  assert.deepEqual(m.problems.not_in_key, ['22222']);
  assert.ok(m.problems.missing_structure.length >= 5, 'ROOM is missing from the structures table');
  assert.equal(m.problems.unfinished.length, 1);
  assert.deepEqual(m.problems.not_measured, []);
  const ex = m.rows.find((r) => r.sheet_code === CODES[10]);
  assert.equal(ex.E_vertical, null, 'no E for an excluded drawing');
  // written and read back: the merged CSV keeps every merged column
  const back = csv.readMeasurements(csv.toCSV(m.rows, m.columns));
  assert.equal(back.ok, true);
  const b1 = back.records.find((r) => r.rater_code === 'AB' && r.sheet_code === CODES[1]);
  near(b1.E_vertical, 0.125, 1e-4, 'E_vertical read back');
  assert.equal(b1.participant_code, 'P02');
  assert.equal(b1.key_group, 'b');
});

test('stats: quantiles (R type 7), summaries, per-structure shares', () => {
  near(S.quantile([1, 2, 3, 4], 0.25), 1.75, 1e-12, 'q1');
  const s = S.summary([3, null, 1, 2, 'x', 4]);
  assert.equal(s.n, 4);
  near(s.median, 2.5, 1e-12, 'median');
  near(s.sd, Math.sqrt(5 / 3), 1e-12, 'sd');
  const { r1 } = sample();
  const m = HUSS.io.merge.merge([asFile('ab.csv', r1)], tables.parseKey(KEY_TEXT), tables.parseStructures(STRUCT_TEXT));
  const st = S.byStructure(S.analysisRows(m.rows, 'AB', 'main'));
  assert.deepEqual(st.map((x) => x.structure_code), ['HALL', 'ROOM']);
  assert.equal(st[0].n, 6);
  assert.equal(st[1].n, 5, 'the excluded drawing is left out');
  near(st[0].E_v.median, (((1 + -2.5 * 0.04) * 8) - 8) / 8, 1e-9, 'HALL median E_v');
  near(st[0].over_v, 0, 1e-9, 'HALL: nobody over');
  near(st[1].over_v, 1, 1e-9, 'ROOM: everybody over');
  const q = S.quality(m.rows, HUSS.measure.flags.TOOL_FLAGS);
  assert.equal(q.handles.ceiling.counts.snapped, 4);
  near(q.handles.wall.accepted, 10 / 11, 1e-9, 'wall suggestions kept unchanged');
  assert.equal(q.code_source.ocr, 1);
  assert.equal(q.align_method.auto_three_corners, 1);
  assert.equal(q.flags.find((f) => f.flag === 'flag_ceiling_uneven').n, 1);
});

test('charts: valid SVG text with what each chart needs; empty data handled', () => {
  const svgOk = (s, what) => {
    assert.ok(s.startsWith('<svg xmlns="http://www.w3.org/2000/svg"') && s.endsWith('</svg>'), what + ': svg element');
    assert.ok(!/NaN|undefined|Infinity/.test(s), what + ': no NaN/undefined in the markup');
  };
  const box = C.stripBox({ title: 'E <by> structure', groups: [{ label: 'A', values: [0.1, -0.2, 0.05, 0.3] }, { label: 'B', values: [null] }], percent: true, zeroLine: true });
  svgOk(box, 'stripBox');
  assert.ok(box.includes('E &lt;by&gt; structure'), 'text is escaped');
  assert.equal((box.match(/<circle/g) || []).length, 4, 'one dot per value');
  const sc = C.scatter({ title: 's', points: [{ x: 3, y: 3.5 }, { x: 8, y: 7 }, { x: null, y: 1 }], identity: true, equal: true });
  svgOk(sc, 'scatter');
  assert.equal((sc.match(/<circle/g) || []).length, 2);
  assert.ok(sc.includes('stroke-dasharray'), 'identity line');
  svgOk(C.histogram({ title: 'h', values: [0.1, 0.12, -0.05, 0.3, 0.2], percent: true, zeroLine: true }), 'histogram');
  svgOk(C.hbars({ title: 'b', items: [{ label: 'x', value: 0.5 }, { label: 'y', value: 0 }], max: 1, percent: true }), 'hbars');
  svgOk(C.stacked({ title: 'st', keys: [{ label: 'a', color: '#000' }, { label: 'b', color: '#111' }], rows: [{ label: 'r', parts: [3, 1] }, { label: 'z', parts: [0, 0] }] }), 'stacked');
  const ba = C.blandAltman({ title: 'ba', points: [{ x: 0.1, y: 0.02 }, { x: 0.2, y: -0.01 }, { x: 0.15, y: 0.03 }], percent: true });
  svgOk(ba, 'blandAltman');
  assert.ok(ba.includes('1.96 SD'));
  svgOk(C.stripBox({ title: 'none', groups: [] }), 'empty');
  assert.deepEqual(C.niceTicks(0.03, 0.47, 5).ticks.map((t) => +t.toFixed(3)), [0, 0.1, 0.2, 0.3, 0.4, 0.5]);
});

test('report: cards, charts and tables in the fragment; a self-contained HTML document', () => {
  const { r1, r2 } = sample();
  const m = HUSS.io.merge.merge([asFile('ab.csv', r1), asFile('cd.csv', r2)], tables.parseKey(KEY_TEXT), tables.parseStructures(STRUCT_TEXT));
  const model = B.model(m, { rater: 'AB', method: 'main', generatedAt: new Date(2026, 9, 5, 12, 0, 0) });
  assert.equal(model.overview.drawings, 12);
  assert.equal(model.overview.measured, 11);
  const frag = B.fragment(model);
  for (const id of ['e-structure-v', 'e-structure-h', 'est-true-v', 'est-true-h', 'e-v-h', 'hist-v', 'hist-h', 'q-handles', 'q-flags', 'q-code-source', 'q-align', 'q-duration']) {
    assert.ok(frag.includes('data-chart="' + id + '"'), id);
  }
  assert.ok(frag.includes('Exhibition hall') && frag.includes('Seminar room'));
  assert.ok(!/NaN|undefined/.test(frag), 'no NaN/undefined in the report');
  const doc = B.documentHtml(model);
  assert.ok(doc.startsWith('<!doctype html>') && doc.includes('<style>') && doc.includes('</html>'));
  assert.ok(!/<script|src=|href=/.test(doc), 'nothing loaded from anywhere: opens offline');
  // another method changes the numbers
  const pts = B.model(m, { rater: 'AB', method: 'points' });
  assert.notEqual(pts.overview.E_v.median, model.overview.E_v.median);
});
