/* HuSS Scorer — js/report/calibration.js
 * Calibration check (spec 10.3): printed calibration sheets are scored like drawings; their
 * measured lengths are compared with the printed ones from the calibration key. Criterion: at
 * most 0.3 mm or 1 % off (whichever is larger). DOM-free.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.report = HUSS.report || {};

  var LENGTHS = ['figure_mm', 'ceiling_mm', 'distance_mm'];

  /** Calibration key text (as the Sheets screen writes it). */
  function keyToCSV(template, codes, generatedAt) {
    var when = HUSS.measure.record.isoLocal(generatedAt || new Date());
    var lines = ['sheet_code,layout,figure_mm,ceiling_mm,distance_mm,template,generated_at'];
    codes.forEach(function (c, i) {
      var g = HUSS.sheet.template.calibration(template, i);
      lines.push([c, g.layout, g.figure_mm.toFixed(2), g.ceiling_mm.toFixed(2), g.distance_mm.toFixed(2), template.id, when].join(','));
    });
    return lines.join('\r\n') + '\r\n';
  }

  /** Returns { ok, rows: { CODE: { layout, figure_mm, ceiling_mm, distance_mm } }, error }. */
  function parseKey(text) {
    var t = HUSS.io.csv.parse(String(text || '').replace(/^﻿/, ''), ',');
    if (!t.length) return { ok: false, rows: {}, error: 'empty' };
    var head = t[0].map(function (h) { return h.trim().toLowerCase(); });
    var col = function (n) { return head.indexOf(n); };
    if (['sheet_code'].concat(LENGTHS).some(function (n) { return col(n) < 0; })) return { ok: false, rows: {}, error: 'not_calibration_key' };
    var rows = {};
    t.slice(1).forEach(function (r) {
      var code = HUSS.sheet.code.normalize(r[col('sheet_code')] || '');
      if (!HUSS.sheet.code.isValid(code)) return;
      var o = { layout: r[col('layout')] || '' };
      LENGTHS.forEach(function (n) { o[n] = Number(r[col(n)]); });
      rows[code] = o;
    });
    return { ok: Object.keys(rows).length > 0, rows: rows, error: Object.keys(rows).length ? null : 'empty' };
  }

  /**
   * rows: measurement records (any raters); key: parseKey result. Returns
   * { items: [{ sheet_code, rater_code, layout, lengths: [{ name, known, measured, diff, tol, pass }], pass }],
   *   n, passed, not_scored: [codes] }.
   */
  function check(rows, key, config) {
    var cfg = (config || HUSS.config).CALIBRATION, items = [], scored = {};
    rows.forEach(function (r) {
      var k = key.rows[r.sheet_code];
      if (!k || r.status !== 'measured') return;
      scored[r.sheet_code] = true;
      var lengths = LENGTHS.map(function (n) {
        var m = r[n], tol = Math.max(cfg.TOL_MM, cfg.TOL_REL * k[n]);
        var diff = typeof m === 'number' && isFinite(m) ? m - k[n] : null;
        return { name: n, known: k[n], measured: m, diff: diff, tol: tol, pass: diff != null && Math.abs(diff) <= tol + 1e-9 };
      });
      items.push({ sheet_code: r.sheet_code, rater_code: r.rater_code, layout: k.layout, lengths: lengths, pass: lengths.every(function (l) { return l.pass; }) });
    });
    items.sort(function (a, b) { return a.sheet_code < b.sheet_code ? -1 : a.sheet_code > b.sheet_code ? 1 : 0; });
    return {
      items: items, n: items.length, passed: items.filter(function (i) { return i.pass; }).length,
      not_scored: Object.keys(key.rows).filter(function (c) { return !scored[c]; }).sort()
    };
  }

  /** The check as an HTML fragment (escaped). */
  function html(res) {
    var esc = HUSS.report.charts.esc, T = function (k, p) { return HUSS.t(k, p); };
    var f = function (v) { return typeof v === 'number' && isFinite(v) ? v.toFixed(2) : '–'; };
    var sign = function (v) { return v == null ? '–' : (v > 0 ? '+' : '') + v.toFixed(2); };
    var head = [T('cp_t_sheet'), T('cal_t_rater'), T('cal_t_layout')];
    LENGTHS.forEach(function (n) { head.push(T('cal_t_' + n), T('cal_t_diff')); });
    head.push(T('cal_t_result'));
    var body = res.items.map(function (it) {
      var cells = [it.sheet_code, it.rater_code, it.layout];
      it.lengths.forEach(function (l) { cells.push(f(l.measured) + ' / ' + f(l.known), sign(l.diff)); });
      cells.push(T(it.pass ? 'cal_pass' : 'cal_fail'));
      return '<tr' + (it.pass ? '' : ' class="rp-mismatch"') + '>' + cells.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
    }).join('');
    return '<p class="' + (res.n && res.passed === res.n ? 'rp-ok' : 'rp-note') + '">' + esc(T('cal_summary', { passed: res.passed, n: res.n })) +
      (res.not_scored.length ? ' ' + esc(T('cal_not_scored', { list: res.not_scored.join(', ') })) : '') + '</p>' +
      (res.n ? '<table class="rp-table num rp-cmp"><thead><tr>' + head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + body + '</tbody></table>' : '');
  }

  var api = { keyToCSV: keyToCSV, parseKey: parseKey, check: check, html: html, LENGTHS: LENGTHS };
  HUSS.report.calibration = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
