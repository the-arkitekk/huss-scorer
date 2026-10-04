/* HuSS Scorer — js/io/csv.js
 * Measurement CSV (spec 5.2) and Excel view (spec 5.3). DOM-free.
 *
 * A "record" is a plain object keyed by column name holding typed values
 * (number, boolean, string or null). formatRow/parseRow convert between records
 * and the text cells of the file.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.io = HUSS.io || {};

  // Column types. Decimals: mm 0.01, m 0.001, E 0.0001 (spec); the others are tool choices.
  var TYPES = {
    str: { kind: 'str' },
    int: { kind: 'num', decimals: 0 },
    mm: { kind: 'num', decimals: 2 },
    m: { kind: 'num', decimals: 3 },
    E: { kind: 'num', decimals: 4 },
    px: { kind: 'num', decimals: 2 },
    pxmm: { kind: 'num', decimals: 3 },
    deg: { kind: 'num', decimals: 3 },
    slope: { kind: 'num', decimals: 6 },
    ratio: { kind: 'num', decimals: 4 },
    bool: { kind: 'bool' }
  };

  function cols(type, names) {
    return names.map(function (n) { return { name: n, type: type }; });
  }

  function cornerCols() {
    var out = [];
    ['tl', 'tr', 'bl', 'br'].forEach(function (c) {
      out.push({ name: 'corner_' + c + '_x_px', type: 'px' }, { name: 'corner_' + c + '_y_px', type: 'px' });
    });
    return out;
  }

  function pointCols(names) {
    var out = [];
    names.forEach(function (n) {
      out.push({ name: n + '_x_px', type: 'px' }, { name: n + '_y_px', type: 'px' });
    });
    return out;
  }

  var DEFAULT_EXCLUSIONS = ['excl_no_figure', 'excl_not_standing_full', 'excl_not_along_axis'];

  /**
   * Columns written by the scoring screen, in file order, for a project's exclusion criteria
   * (excl_other is always added). Post-merge columns are added by Merge.
   */
  function columnsFor(exclusionIds) {
    var ids = (exclusionIds || DEFAULT_EXCLUSIONS).filter(function (id) { return id !== 'excl_other'; }).concat(['excl_other']);
    return [].concat(
    cols('str', ['project_code', 'sheet_code', 'rater_code', 'mode', 'status', 'measured_at']),
    cols('int', ['duration_s']),
    cols('str', ['tool_version', 'rules_version', 'template', 'file_name']),
    cols('int', ['image_width_px', 'image_height_px']),
    cols('str', ['code_source', 'align_method']),
    cols('pxmm', ['px_per_mm_x', 'px_per_mm_y']),
    cols('deg', ['rotation_deg']),
    cols('mm', ['align_residual_mm']),
    cornerCols(),
    cols('mm', ['floor_y_mm']),
    cols('slope', ['floor_slope']),
    cols('mm', ['axis_x_mm', 'head_y_mm', 'foot_y_mm', 'ceiling_y_mm', 'wall_x_mm']),
    pointCols(['head', 'foot', 'floor', 'ceiling', 'wall']),
    cols('str', ['head_placement', 'foot_placement', 'ceiling_placement', 'wall_placement', 'axis_placement']),
    cols('mm', ['head_suggested_y_mm', 'foot_suggested_y_mm', 'ceiling_suggested_y_mm', 'wall_suggested_x_mm']),
    cols('mm', ['figure_mm', 'figure_from_floor_mm', 'foot_floor_gap_mm', 'ceiling_mm', 'distance_mm']),
    cols('m', ['ref_height_m']),
    cols('ratio', ['scale_mm_per_m']),
    cols('m', ['est_vertical_m', 'est_horizontal_m', 'est_vertical_alt_m', 'est_horizontal_alt_m']),
    // Backup (rules 1.2): figure measured to the lowest red point instead of the floor line
    cols('mm', ['red_bottom_y_mm', 'figure_red_mm']),
    cols('m', ['est_vertical_red_m', 'est_horizontal_red_m']),
    // Backup (rules 1.3): ceiling where its line crosses the axis, wall where it stands on the floor;
    // spread = largest deviation of the followed line from its average
    cols('mm', ['ceiling_at_axis_y_mm', 'wall_at_floor_x_mm']),
    cols('m', ['est_vertical_at_axis_m', 'est_horizontal_at_floor_m']),
    cols('mm', ['ceiling_spread_mm', 'wall_spread_mm']),
    cols('bool', [
      'flag_red_not_found', 'flag_figure_small', 'flag_figure_off_mark', 'flag_foot_off_floor',
      'flag_multiple_red', 'flag_axis_moved', 'flag_manual_alignment', 'flag_alignment_warning',
      'flag_ceiling_uneven', 'flag_wall_uneven', 'flag_color_noncompliant',
      'vertical_not_measurable', 'horizontal_not_measurable'
    ]),
    cols('bool', ids),
    cols('bool', ['excluded']),
    cols('str', ['note'])
    );
  }

  var COLUMNS = columnsFor(DEFAULT_EXCLUSIONS);

  /**
   * Columns Merge adds after the measurement columns (spec 8.6): who and what was drawn, the
   * true dimensions and E = (est - true) / true for the main values and the backup values.
   * Extra key table columns follow as key_<name> (text).
   */
  var MERGED_COLUMNS = [].concat(
    cols('str', ['participant_code', 'structure_code', 'structure_name']),
    cols('m', ['true_vertical_m', 'true_horizontal_m']),
    cols('E', ['E_vertical', 'E_horizontal']),
    cols('E', ['E_vertical_at_axis', 'E_horizontal_at_floor', 'E_vertical_red', 'E_horizontal_red']),
    cols('str', ['source_file'])
  );

  var COLUMN_TYPE = {};
  COLUMNS.concat(MERGED_COLUMNS).forEach(function (c) { COLUMN_TYPE[c.name] = c.type; });

  /** Type of a column; any excl_* column is a 0/1 exclusion criterion, any key_* column text. */
  function typeOf(name) {
    return COLUMN_TYPE[name] || (/^excl_[a-z0-9_]+$/.test(name) ? 'bool' : /^key_[a-z0-9_]+$/.test(name) ? 'str' : null);
  }

  var EOL = '\r\n';
  var BOM = '﻿';

  function formatValue(type, v) {
    var t = TYPES[type];
    if (v === null || v === undefined || v === '') return '';
    if (t.kind === 'bool') return v ? '1' : '0';
    if (t.kind === 'num') {
      if (typeof v !== 'number' || !isFinite(v)) return '';
      var s = v.toFixed(t.decimals);
      if (/^-0(\.0*)?$/.test(s)) s = s.slice(1); // no negative zero
      return s;
    }
    return String(v);
  }

  function parseValue(type, s) {
    var t = TYPES[type];
    if (s === undefined || s === null || s === '') return null;
    if (t.kind === 'bool') {
      if (s === '1') return true;
      if (s === '0') return false;
      throw new Error('Not a 0/1 value: ' + s);
    }
    if (t.kind === 'num') {
      var n = Number(s);
      if (!isFinite(n)) throw new Error('Not a number: ' + s);
      return n;
    }
    return s;
  }

  function formatRow(record, columns) {
    return (columns || COLUMNS).map(function (c) { return formatValue(c.type, record[c.name]); });
  }

  /** Typed record from a header + cells; unknown columns are ignored. */
  function parseRow(header, cells) {
    var rec = {};
    COLUMNS.forEach(function (c) { rec[c.name] = null; });
    for (var i = 0; i < header.length; i++) {
      var type = typeOf(header[i]);
      if (type) rec[header[i]] = parseValue(type, cells[i]);
    }
    return rec;
  }

  function quote(cell, sep) {
    if (cell.indexOf('"') >= 0 || cell.indexOf(sep) >= 0 || cell.indexOf('\n') >= 0 || cell.indexOf('\r') >= 0) {
      return '"' + cell.replace(/"/g, '""') + '"';
    }
    return cell;
  }

  function joinLines(rows, sep) {
    return rows.map(function (r) {
      return r.map(function (c) { return quote(c, sep); }).join(sep);
    }).join(EOL) + EOL;
  }

  /** Session/measurement file: UTF-8 without BOM, comma separator, dot decimal. */
  function toCSV(records, columns) {
    columns = columns || COLUMNS;
    var rows = [columns.map(function (c) { return c.name; })];
    records.forEach(function (r) { rows.push(formatRow(r, columns)); });
    return joinLines(rows, ',');
  }

  /** Excel view: BOM, semicolon separator, decimal comma. Cannot be loaded back. */
  function toExcelView(records, columns) {
    columns = columns || COLUMNS;
    var rows = [columns.map(function (c) { return c.name; })];
    records.forEach(function (r) {
      rows.push(columns.map(function (c) {
        var s = formatValue(c.type, r[c.name]);
        return TYPES[c.type].kind === 'num' ? s.replace('.', ',') : s;
      }));
    });
    return BOM + joinLines(rows, ';');
  }

  /** Plain table (array of string arrays) as CSV text: comma, CRLF, quoting as needed. */
  function toText(rows) {
    return joinLines(rows.map(function (r) { return r.map(function (c) { return c == null ? '' : String(c); }); }), ',');
  }

  /** RFC 4180 parser. Returns an array of rows (arrays of strings). */
  function parse(text, sep) {
    sep = sep || ',';
    var rows = [], row = [], cell = '', i = 0, n = text.length, inQuotes = false;
    while (i < n) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        cell += ch; i++; continue;
      }
      if (ch === '"' && cell === '') { inQuotes = true; i++; continue; }
      if (ch === sep) { row.push(cell); cell = ''; i++; continue; }
      if (ch === '\r' || ch === '\n') {
        row.push(cell); rows.push(row); row = []; cell = '';
        if (ch === '\r' && text[i + 1] === '\n') i++;
        i++; continue;
      }
      cell += ch; i++;
    }
    if (inQuotes) throw new Error('Unterminated quoted field');
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  /** True when the text looks like the Excel view (BOM, or a semicolon-separated header). */
  function isExcelView(text) {
    if (text.charCodeAt(0) === 0xFEFF) return true;
    var firstLine = text.split(/\r?\n/, 1)[0] || '';
    return firstLine.indexOf(';') >= 0 && firstLine.indexOf(',') < 0;
  }

  /**
   * Reads a measurement CSV back into records.
   * Returns { ok: true, records } or { ok: false, error: 'excel_view' | 'not_measurement_csv' | 'parse_error', detail }.
   */
  function readMeasurements(text) {
    if (isExcelView(text)) return { ok: false, error: 'excel_view' };
    var rows;
    try {
      rows = parse(text, ',');
    } catch (e) {
      return { ok: false, error: 'parse_error', detail: e.message };
    }
    if (!rows.length) return { ok: false, error: 'not_measurement_csv' };
    var header = rows[0];
    var required = ['project_code', 'sheet_code', 'rater_code', 'mode', 'status'];
    for (var k = 0; k < required.length; k++) {
      if (header.indexOf(required[k]) < 0) return { ok: false, error: 'not_measurement_csv' };
    }
    var records = [];
    try {
      for (var i = 1; i < rows.length; i++) {
        if (rows[i].length === 1 && rows[i][0] === '') continue;
        records.push(parseRow(header, rows[i]));
      }
    } catch (e2) {
      return { ok: false, error: 'parse_error', detail: e2.message };
    }
    var exclusionIds = header.filter(function (h) { return /^excl_[a-z0-9_]+$/.test(h) && h !== 'excl_other'; });
    return { ok: true, records: records, header: header, exclusionIds: exclusionIds };
  }

  var api = {
    TYPES: TYPES, COLUMNS: COLUMNS, MERGED_COLUMNS: MERGED_COLUMNS, COLUMN_TYPE: COLUMN_TYPE, DEFAULT_EXCLUSIONS: DEFAULT_EXCLUSIONS,
    columnsFor: columnsFor, typeOf: typeOf,
    formatValue: formatValue, parseValue: parseValue, formatRow: formatRow, parseRow: parseRow,
    toCSV: toCSV, toExcelView: toExcelView, toText: toText, parse: parse, isExcelView: isExcelView,
    readMeasurements: readMeasurements
  };
  HUSS.io.csv = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
