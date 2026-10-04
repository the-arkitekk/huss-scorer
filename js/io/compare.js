/* HuSS Scorer — js/io/compare.js
 * Compare (spec 8.7): the records of two raters side by side, read only. Differences, agreement of
 * the exclusion and "not measurable" decisions, and the wide CSV (_r1 / _r2) for r/icc_kappa.R.
 * Only description: ICC and kappa are computed in R. DOM-free.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.io = HUSS.io || {};

  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  // Per-rater columns of the wide CSV: [name, type]
  var PER_RATER = [
    ['status', 'str'], ['excluded', 'bool'], ['vertical_not_measurable', 'bool'], ['horizontal_not_measurable', 'bool'],
    ['figure_mm', 'mm'], ['ceiling_mm', 'mm'], ['distance_mm', 'mm'],
    ['est_vertical_m', 'm'], ['est_horizontal_m', 'm'], ['E_vertical', 'E'], ['E_horizontal', 'E'],
    ['ceiling_placement', 'str'], ['wall_placement', 'str'], ['duration_s', 'int'], ['note', 'str']
  ];

  /** Relative difference of two estimates: (b - a) / mean(a, b). */
  function relDiff(a, b) {
    return isNum(a) && isNum(b) && a + b !== 0 ? (b - a) / ((a + b) / 2) : null;
  }

  /** 'excluded', 'measured', or which axes were not measurable ('nm_v', 'nm_h', 'nm_v nm_h'). */
  function decision(r) {
    if (r.status === 'excluded') return 'excluded';
    var nm = [];
    if (r.vertical_not_measurable) nm.push('nm_v');
    if (r.horizontal_not_measurable) nm.push('nm_h');
    return nm.length ? nm.join(' ') : 'measured';
  }

  /** rows: merged rows (io.merge) holding both raters; r1, r2: rater codes. */
  function compare(rows, r1, r2) {
    var S = HUSS.report.stats, a = {}, b = {};
    rows.forEach(function (r) {
      if (r.rater_code === r1) a[r.sheet_code] = r;
      else if (r.rater_code === r2) b[r.sheet_code] = r;
    });
    var codes = Object.keys(a).filter(function (c) { return b[c]; }).sort();
    var pairs = codes.map(function (c) {
      var x = a[c], y = b[c];
      return {
        sheet_code: c, a: x, b: y,
        participant_code: x.participant_code || y.participant_code || null,
        structure_code: x.structure_code || y.structure_code || null,
        structure_name: x.structure_name || y.structure_name || null,
        d_est_v: relDiff(x.est_vertical_m, y.est_vertical_m), d_est_h: relDiff(x.est_horizontal_m, y.est_horizontal_m),
        d_E_v: isNum(x.E_vertical) && isNum(y.E_vertical) ? y.E_vertical - x.E_vertical : null,
        d_E_h: isNum(x.E_horizontal) && isNum(y.E_horizontal) ? y.E_horizontal - x.E_horizontal : null,
        decision_a: decision(x), decision_b: decision(y)
      };
    });
    var agree = function (f) {
      var n = pairs.length;
      return { n: n, agree: pairs.filter(function (p) { return !!p.a[f] === !!p.b[f]; }).length };
    };
    var col = function (f) { return pairs.map(function (p) { return p[f]; }); };
    return {
      r1: r1, r2: r2, pairs: pairs,
      onlyA: Object.keys(a).filter(function (c) { return !b[c]; }).sort(),
      onlyB: Object.keys(b).filter(function (c) { return !a[c]; }).sort(),
      summary: {
        matched: pairs.length,
        d_est_v: S.summary(col('d_est_v')), d_est_h: S.summary(col('d_est_h')),
        d_E_v: S.summary(col('d_E_v')), d_E_h: S.summary(col('d_E_h')),
        excluded: agree('excluded'), nm_v: agree('vertical_not_measurable'), nm_h: agree('horizontal_not_measurable'),
        decisions_agree: pairs.filter(function (p) { return p.decision_a === p.decision_b; }).length
      }
    };
  }

  /** Wide CSV: one row per drawing, the raters' values with _r1 / _r2, then the differences. */
  function wideCSV(cmp) {
    var cols = [{ name: 'sheet_code', type: 'str' }, { name: 'project_code', type: 'str' }, { name: 'participant_code', type: 'str' },
      { name: 'structure_code', type: 'str' }, { name: 'rater_r1', type: 'str' }, { name: 'rater_r2', type: 'str' }];
    PER_RATER.forEach(function (c) { cols.push({ name: c[0] + '_r1', type: c[1] }, { name: c[0] + '_r2', type: c[1] }); });
    cols.push({ name: 'reldiff_est_vertical', type: 'E' }, { name: 'reldiff_est_horizontal', type: 'E' },
      { name: 'diff_E_vertical', type: 'E' }, { name: 'diff_E_horizontal', type: 'E' });
    var recs = cmp.pairs.map(function (p) {
      var r = {
        sheet_code: p.sheet_code, project_code: p.a.project_code, participant_code: p.participant_code, structure_code: p.structure_code,
        rater_r1: cmp.r1, rater_r2: cmp.r2,
        reldiff_est_vertical: p.d_est_v, reldiff_est_horizontal: p.d_est_h, diff_E_vertical: p.d_E_v, diff_E_horizontal: p.d_E_h
      };
      PER_RATER.forEach(function (c) { r[c[0] + '_r1'] = p.a[c[0]]; r[c[0] + '_r2'] = p.b[c[0]]; });
      return r;
    });
    return HUSS.io.csv.toCSV(recs, cols);
  }

  var api = { compare: compare, wideCSV: wideCSV, relDiff: relDiff, PER_RATER: PER_RATER };
  HUSS.io.compare = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
