/* HuSS Scorer — js/io/tables.js
 * Key table and structures table (spec 5.4), read for Open mode. DOM-free.
 * Accepts comma files and Excel-style files (semicolon separator, decimal comma, BOM).
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.io = HUSS.io || {};

  /** Rows as objects keyed by lower-case header; detects ',' or ';'. */
  function rowsOf(text) {
    var t = String(text || '').replace(/^﻿/, '');
    var first = t.split(/\r?\n/, 1)[0] || '';
    var sep = first.indexOf(';') >= 0 && first.indexOf(',') < 0 ? ';' : ',';
    var rows = HUSS.io.csv.parse(t, sep).filter(function (r) { return r.some(function (c) { return c.trim() !== ''; }); });
    if (!rows.length) return { header: [], rows: [] };
    var header = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    return {
      header: header,
      rows: rows.slice(1).map(function (r, i) {
        var o = { _line: i + 2 };
        header.forEach(function (h, j) { o[h] = (r[j] || '').trim(); });
        return o;
      })
    };
  }

  function num(s) {
    if (s === undefined || s === null || s === '') return null;
    var v = Number(String(s).replace(',', '.'));
    return isFinite(v) ? v : NaN;
  }

  /**
   * Key table: sheet_code, participant_code, structure_code (+ extra columns, kept as key_*).
   * Returns { ok, rows: { SHEETCODE: { participant_code, structure_code, extra } }, errors: [{ line, code }] }.
   * Error codes: missing_columns, bad_sheet_code, duplicate, empty.
   */
  function parseKey(text) {
    var t = rowsOf(text), out = {}, errors = [];
    var need = ['sheet_code', 'participant_code', 'structure_code'];
    if (need.some(function (h) { return t.header.indexOf(h) < 0; })) return { ok: false, rows: {}, errors: [{ line: 1, code: 'missing_columns' }] };
    t.rows.forEach(function (r) {
      var code = HUSS.sheet.code.normalize(r.sheet_code);
      if (!HUSS.sheet.code.isValid(code)) { errors.push({ line: r._line, code: 'bad_sheet_code' }); return; }
      if (out[code]) { errors.push({ line: r._line, code: 'duplicate' }); return; }
      if (!r.participant_code || !r.structure_code) { errors.push({ line: r._line, code: 'empty' }); return; }
      var extra = {};
      t.header.forEach(function (h) { if (need.indexOf(h) < 0) extra['key_' + h] = r[h]; });
      out[code] = { participant_code: r.participant_code, structure_code: r.structure_code, extra: extra };
    });
    return { ok: errors.length === 0, rows: out, errors: errors };
  }

  /**
   * Structures table: structure_code, structure_name, true_vertical_m, true_horizontal_m.
   * Returns { ok, rows: { CODE: { structure_name, true_vertical_m, true_horizontal_m } }, errors }.
   */
  function parseStructures(text) {
    var t = rowsOf(text), out = {}, errors = [];
    var need = ['structure_code', 'structure_name', 'true_vertical_m', 'true_horizontal_m'];
    if (need.some(function (h) { return t.header.indexOf(h) < 0; })) return { ok: false, rows: {}, errors: [{ line: 1, code: 'missing_columns' }] };
    t.rows.forEach(function (r) {
      var v = num(r.true_vertical_m), hz = num(r.true_horizontal_m);
      if (!r.structure_code) { errors.push({ line: r._line, code: 'empty' }); return; }
      if (out[r.structure_code]) { errors.push({ line: r._line, code: 'duplicate' }); return; }
      if (Number.isNaN(v) || Number.isNaN(hz) || (v !== null && v <= 0) || (hz !== null && hz <= 0)) { errors.push({ line: r._line, code: 'bad_number' }); return; }
      out[r.structure_code] = { structure_name: r.structure_name, true_vertical_m: v, true_horizontal_m: hz };
    });
    return { ok: errors.length === 0, rows: out, errors: errors };
  }

  /** What Open mode shows for one sheet: participant, structure, true values (or nulls). */
  function lookup(key, structures, sheetCode) {
    var k = key && key.rows[sheetCode];
    if (!k) return null;
    var st = structures && structures.rows[k.structure_code];
    return {
      participant_code: k.participant_code, structure_code: k.structure_code,
      structure_name: st ? st.structure_name : null,
      true_vertical_m: st ? st.true_vertical_m : null, true_horizontal_m: st ? st.true_horizontal_m : null
    };
  }

  var api = { parseKey: parseKey, parseStructures: parseStructures, lookup: lookup };
  HUSS.io.tables = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
