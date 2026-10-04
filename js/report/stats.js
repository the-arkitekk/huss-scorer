/* HuSS Scorer — js/report/stats.js
 * Descriptive statistics for the Report (merged rows -> numbers). DOM-free.
 * Only description: counts, means, medians, quartiles, standard deviations, shares. ICC and kappa
 * are computed in R (r/icc_kappa.R).
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.report = HUSS.report || {};

  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  /** Quantile of sorted numbers, linear between order statistics (R type 7). */
  function quantile(sorted, p) {
    if (!sorted.length) return null;
    var h = (sorted.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
    return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
  }

  /** { n, mean, sd, median, q1, q3, min, max } of the finite numbers in values (nulls when empty). */
  function summary(values) {
    var v = values.filter(isNum).sort(function (a, b) { return a - b; }), n = v.length;
    if (!n) return { n: 0, mean: null, sd: null, median: null, q1: null, q3: null, min: null, max: null };
    var mean = v.reduce(function (s, x) { return s + x; }, 0) / n;
    var sd = n > 1 ? Math.sqrt(v.reduce(function (s, x) { return s + (x - mean) * (x - mean); }, 0) / (n - 1)) : null;
    return { n: n, mean: mean, sd: sd, median: quantile(v, 0.5), q1: quantile(v, 0.25), q3: quantile(v, 0.75), min: v[0], max: v[n - 1] };
  }

  /** Estimate and E columns of each method the Report can show. */
  var METHODS = {
    main: { est_v: 'est_vertical_m', est_h: 'est_horizontal_m', E_v: 'E_vertical', E_h: 'E_horizontal' },
    points: { est_v: 'est_vertical_at_axis_m', est_h: 'est_horizontal_at_floor_m', E_v: 'E_vertical_at_axis', E_h: 'E_horizontal_at_floor' },
    red: { est_v: 'est_vertical_red_m', est_h: 'est_horizontal_red_m', E_v: 'E_vertical_red', E_h: 'E_horizontal_red' }
  };

  /** Measured (not excluded) rows of one rater (or all when rater is null), with the method's values. */
  function analysisRows(rows, rater, method) {
    var m = METHODS[method] || METHODS.main;
    return rows.filter(function (r) { return r.status === 'measured' && (!rater || r.rater_code === rater); }).map(function (r) {
      return {
        sheet_code: r.sheet_code, rater_code: r.rater_code, participant_code: r.participant_code,
        structure_code: r.structure_code, structure_name: r.structure_name,
        true_v: r.true_vertical_m, true_h: r.true_horizontal_m,
        est_v: r[m.est_v], est_h: r[m.est_h], E_v: r[m.E_v], E_h: r[m.E_h]
      };
    });
  }

  function share(values, test) {
    var v = values.filter(isNum);
    return v.length ? v.filter(test).length / v.length : null;
  }

  /** Per structure: n, true values, estimate and E summaries, share overestimating (E > 0). */
  function byStructure(arows) {
    var groups = {}, order = [];
    arows.forEach(function (r) {
      var k = r.structure_code || '';
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(r);
    });
    order.sort();
    return order.map(function (k) {
      var g = groups[k], pick = function (f) { return g.map(function (r) { return r[f]; }); };
      return {
        structure_code: k || null, structure_name: g[0].structure_name, n: g.length,
        true_v: g[0].true_v, true_h: g[0].true_h,
        est_v: summary(pick('est_v')), est_h: summary(pick('est_h')),
        E_v: summary(pick('E_v')), E_h: summary(pick('E_h')),
        over_v: share(pick('E_v'), function (x) { return x > 0; }),
        over_h: share(pick('E_h'), function (x) { return x > 0; })
      };
    });
  }

  /** Headline numbers for the summary cards. */
  function overview(rows, arows) {
    var uniq = function (f, list) {
      var seen = {};
      (list || rows).forEach(function (r) { if (r[f]) seen[r[f]] = true; });
      return Object.keys(seen).length;
    };
    var Ev = arows.map(function (r) { return r.E_v; }), Eh = arows.map(function (r) { return r.E_h; });
    return {
      drawings: uniq('sheet_code'),
      records: rows.length,
      measured: rows.filter(function (r) { return r.status === 'measured'; }).length,
      excluded: rows.filter(function (r) { return r.status === 'excluded'; }).length,
      not_measurable_v: rows.filter(function (r) { return r.status === 'measured' && r.vertical_not_measurable; }).length,
      not_measurable_h: rows.filter(function (r) { return r.status === 'measured' && r.horizontal_not_measurable; }).length,
      participants: uniq('participant_code'), structures: uniq('structure_code'), raters: uniq('rater_code'),
      E_v: summary(Ev), E_h: summary(Eh),
      over_v: share(Ev, function (x) { return x > 0; }), over_h: share(Eh, function (x) { return x > 0; })
    };
  }

  /**
   * Scoring session quality (spec 11): how each handle ended up, the share of suggestions accepted
   * unchanged, time per drawing, where sheet codes came from, alignment methods, flag rates.
   */
  function quality(rows, flagNames) {
    var handles = ['head', 'foot', 'ceiling', 'wall'], q = { handles: {}, n: rows.length };
    var measured = rows.filter(function (r) { return r.status === 'measured'; }); // handles matter only there
    handles.forEach(function (h) {
      var counts = { suggested: 0, snapped: 0, manual: 0, none: 0 }, offered = 0;
      measured.forEach(function (r) {
        var p = r[h + '_placement'];
        counts[p && counts.hasOwnProperty(p) ? p : 'none']++;
        var sug = h === 'wall' ? r.wall_suggested_x_mm : r[h + '_suggested_y_mm'];
        if (isNum(sug)) offered++;
      });
      q.handles[h] = { counts: counts, offered: offered, accepted: offered ? counts.suggested / offered : null };
    });
    var tally = function (f) {
      var out = {};
      rows.forEach(function (r) { var v = r[f] == null ? 'none' : String(r[f]); out[v] = (out[v] || 0) + 1; });
      return out;
    };
    q.duration = summary(rows.map(function (r) { return r.duration_s; }));
    q.code_source = tally('code_source');
    q.align_method = tally('align_method');
    q.status = tally('status');
    q.flags = (flagNames || []).map(function (f) {
      var n = rows.filter(function (r) { return r[f] === true; }).length;
      return { flag: f, n: n, share: rows.length ? n / rows.length : null };
    });
    return q;
  }

  var api = {
    METHODS: METHODS, quantile: quantile, summary: summary, analysisRows: analysisRows,
    byStructure: byStructure, overview: overview, quality: quality, isNum: isNum
  };
  HUSS.report.stats = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
