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

  function fmtNum(v) {
    return v == null || !isFinite(v) ? '' : String(Math.round(v * 1000) / 1000);
  }

  /** Structures table text from rows [{ structure_code, structure_name, true_vertical_m, true_horizontal_m }]. */
  function structuresToCSV(rows) {
    return HUSS.io.csv.toText([['structure_code', 'structure_name', 'true_vertical_m', 'true_horizontal_m']].concat(rows.map(function (r) {
      return [r.structure_code, r.structure_name, fmtNum(r.true_vertical_m), fmtNum(r.true_horizontal_m)];
    })));
  }

  /** Key table text from rows [{ sheet_code, participant_code, structure_code }]. */
  function keyToCSV(rows) {
    return HUSS.io.csv.toText([['sheet_code', 'participant_code', 'structure_code']].concat(rows.map(function (r) {
      return [r.sheet_code, r.participant_code, r.structure_code];
    })));
  }

  /** Problems of one key row: [] or codes bad_sheet_code, duplicate, empty, unknown_structure. */
  function keyRowProblems(row, allRows, structureCodes) {
    var out = [], code = HUSS.sheet.code.normalize(row.sheet_code);
    if (code && !HUSS.sheet.code.isValid(code)) out.push('bad_sheet_code');
    if (code && allRows.filter(function (r) { return HUSS.sheet.code.normalize(r.sheet_code) === code; }).length > 1) out.push('duplicate');
    if (!code || !row.participant_code || !row.structure_code) out.push('empty');
    if (row.structure_code && structureCodes && structureCodes.length && structureCodes.indexOf(row.structure_code) < 0) out.push('unknown_structure');
    return out;
  }

  var api = {
    parseKey: parseKey, parseStructures: parseStructures, lookup: lookup,
    structuresToCSV: structuresToCSV, keyToCSV: keyToCSV, keyRowProblems: keyRowProblems, num: num
  };
  HUSS.io.tables = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
