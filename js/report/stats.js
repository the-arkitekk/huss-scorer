/* HuSS Scorer — js/report/stats.js
 * Descriptive statistics for the Report (merged rows -> numbers). DOM-free.
 * Description: counts, means with their 95 % confidence intervals (t distribution), medians,
 * quartiles, standard deviations, shares. ICC and kappa are computed in R (r/icc_kappa.R).
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

  /** ln Gamma(x), x > 0 (Lanczos approximation, about 15 digits). */
  function lnGamma(x) {
    var g = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
      12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lnGamma(1 - x);
    x -= 1;
    var a = 0.99999999999980993, t = x + 7.5;
    for (var i = 0; i < 8; i++) a += g[i] / (x + i + 1);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }

  /** Continued fraction of the regularized incomplete beta function (modified Lentz). */
  function betacf(a, b, x) {
    var qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap, tiny = 1e-300;
    if (Math.abs(d) < tiny) d = tiny;
    d = 1 / d;
    var h = d;
    for (var m = 1; m <= 300; m++) {
      var m2 = 2 * m, aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
      c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
      c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d;
      var del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-14) break;
    }
    return h;
  }

  /** Regularized incomplete beta function I_x(a, b). */
  function ibeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }

  /** Cumulative t distribution with df degrees of freedom. */
  function tCdf(t, df) {
    var p = 0.5 * ibeta(df / (df + t * t), df / 2, 0.5);
    return t >= 0 ? 1 - p : p;
  }

  /** Quantile of the t distribution (p in (0, 1)), by bisection on the cumulative function. */
  function tQuantile(p, df) {
    var lo = -1000, hi = 1000;
    for (var i = 0; i < 200 && hi - lo > 1e-12; i++) {
      var mid = (lo + hi) / 2;
      if (tCdf(mid, df) < p) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /**
   * { n, mean, sd, median, q1, q3, min, max, ci_lo, ci_hi } of the finite numbers in values (nulls
   * when empty). ci: the 95 % confidence interval of the mean, mean +- t(0.975, n - 1) * sd / sqrt(n),
   * from 3 values on (null below).
   */
  function summary(values) {
    var v = values.filter(isNum).sort(function (a, b) { return a - b; }), n = v.length;
    if (!n) return { n: 0, mean: null, sd: null, median: null, q1: null, q3: null, min: null, max: null, ci_lo: null, ci_hi: null };
    var mean = v.reduce(function (s, x) { return s + x; }, 0) / n;
    var sd = n > 1 ? Math.sqrt(v.reduce(function (s, x) { return s + (x - mean) * (x - mean); }, 0) / (n - 1)) : null;
    var half = n >= 3 ? tQuantile(0.975, n - 1) * sd / Math.sqrt(n) : null;
    return {
      n: n, mean: mean, sd: sd, median: quantile(v, 0.5), q1: quantile(v, 0.25), q3: quantile(v, 0.75), min: v[0], max: v[n - 1],
      ci_lo: half == null ? null : mean - half, ci_hi: half == null ? null : mean + half
    };
  }

  /** Estimate and E columns of each method the Report can show. */
  var METHODS = {
    main: { est_v: 'est_vertical_m', est_h: 'est_horizontal_m', E_v: 'E_vertical', E_h: 'E_horizontal' },
    points: { est_v: 'est_vertical_at_axis_m', est_h: 'est_horizontal_at_floor_m', E_v: 'E_vertical_at_axis', E_h: 'E_horizontal_at_floor' },
    red: { est_v: 'est_vertical_red_m', est_h: 'est_horizontal_red_m', E_v: 'E_vertical_red', E_h: 'E_horizontal_red' },
    avg: { est_v: 'est_vertical_avg_m', est_h: 'est_horizontal_avg_m', E_v: 'E_vertical_avg', E_h: 'E_horizontal_avg' }
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
    METHODS: METHODS, quantile: quantile, summary: summary, analysisRows: analysisRows, tQuantile: tQuantile, tCdf: tCdf,
    byStructure: byStructure, overview: overview, quality: quality, isNum: isNum
  };
  HUSS.report.stats = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
