/* HuSS Scorer — js/io/merge.js
 * Merge (spec 8.6): one or more measurement CSVs, the key table and the structures table become
 * one table with participant, structure, true dimensions and E for every drawing. DOM-free.
 *
 * E = (est - true) / true, for the main estimates (rules 1.3) and for the backup estimates
 * (ceiling at the axis / wall at the floor; figure to the lowest red point).
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.io = HUSS.io || {};

  var FINAL = { measured: true, excluded: true };

  var E_PAIRS = [
    ['E_vertical', 'est_vertical_m', 'true_vertical_m'],
    ['E_horizontal', 'est_horizontal_m', 'true_horizontal_m'],
    ['E_vertical_at_axis', 'est_vertical_at_axis_m', 'true_vertical_m'],
    ['E_horizontal_at_floor', 'est_horizontal_at_floor_m', 'true_horizontal_m'],
    ['E_vertical_red', 'est_vertical_red_m', 'true_vertical_m'],
    ['E_horizontal_red', 'est_horizontal_red_m', 'true_horizontal_m']
  ];

  function time(rec) {
    var t = rec.measured_at ? Date.parse(rec.measured_at) : NaN;
    return isFinite(t) ? t : -Infinity;
  }

  /**
   * sets: [{ name, records, exclusionIds }] (from csv.readMeasurements); key, structures: the
   * results of tables.parseKey / parseStructures, or null.
   * Returns { rows, columns, raters, projects, problems: { not_in_key, missing_structure,
   * duplicates, unfinished, not_measured, mixed_projects }, counts }.
   */
  function merge(sets, key, structures) {
    var csv = HUSS.io.csv, E = HUSS.measure.compute.errorRatio;
    var problems = { not_in_key: [], missing_structure: [], duplicates: [], unfinished: [], not_measured: [], mixed_projects: false };
    var exclIds = [], keyExtra = [], byKey = {}, order = [];

    sets.forEach(function (set) {
      (set.exclusionIds || []).forEach(function (id) { if (exclIds.indexOf(id) < 0) exclIds.push(id); });
      set.records.forEach(function (rec) {
        if (!FINAL[rec.status]) {
          problems.unfinished.push({ sheet_code: rec.sheet_code, rater_code: rec.rater_code, status: rec.status, file: set.name });
          return;
        }
        // One record per sheet and rater: a repeated one (two files, or scored twice) keeps the latest.
        var id = rec.sheet_code + '|' + rec.rater_code, prev = byKey[id];
        var row = Object.assign({}, rec, { source_file: set.name });
        if (!prev) { byKey[id] = row; order.push(id); return; }
        if (prev.measured_at === rec.measured_at && prev.status === rec.status) return; // the same record twice (e.g. the session and its CSV)
        var dup = problems.duplicates.filter(function (d) { return d.sheet_code === rec.sheet_code && d.rater_code === rec.rater_code; })[0];
        if (!dup) { dup = { sheet_code: rec.sheet_code, rater_code: rec.rater_code, files: [prev.source_file] }; problems.duplicates.push(dup); }
        dup.files.push(set.name);
        if (time(row) >= time(prev)) byKey[id] = row;
      });
    });

    var rows = order.map(function (id) { return byKey[id]; });
    var measuredCodes = {};
    rows.forEach(function (row) {
      measuredCodes[row.sheet_code] = true;
      var k = key && key.rows ? key.rows[row.sheet_code] : null;
      if (!(key && key.rows) && row.true_vertical_m !== undefined && (row.structure_code || row.true_vertical_m != null)) {
        // An already merged CSV and no key table: its participant, structure and true values stay.
        E_PAIRS.forEach(function (p) { row[p[0]] = row.status === 'measured' ? E(row[p[1]], row[p[2]]) : null; });
        return;
      }
      if (k) {
        row.participant_code = k.participant_code;
        row.structure_code = k.structure_code;
        Object.keys(k.extra || {}).forEach(function (x) {
          row[x] = k.extra[x];
          if (keyExtra.indexOf(x) < 0) keyExtra.push(x);
        });
      } else {
        row.participant_code = null;
        row.structure_code = null;
        if (key && problems.not_in_key.indexOf(row.sheet_code) < 0) problems.not_in_key.push(row.sheet_code);
      }
      var st = row.structure_code && structures && structures.rows ? structures.rows[row.structure_code] : null;
      if (row.structure_code && !st) problems.missing_structure.push({ sheet_code: row.sheet_code, structure_code: row.structure_code });
      row.structure_name = st ? st.structure_name : null;
      row.true_vertical_m = st ? st.true_vertical_m : null;
      row.true_horizontal_m = st ? st.true_horizontal_m : null;
      E_PAIRS.forEach(function (p) { row[p[0]] = row.status === 'measured' ? E(row[p[1]], row[p[2]]) : null; });
    });
    if (key && key.rows) {
      Object.keys(key.rows).sort().forEach(function (code) { if (!measuredCodes[code]) problems.not_measured.push(code); });
    }

    rows.sort(function (a, b) {
      return a.sheet_code < b.sheet_code ? -1 : a.sheet_code > b.sheet_code ? 1 : a.rater_code < b.rater_code ? -1 : a.rater_code > b.rater_code ? 1 : 0;
    });
    var raters = [], projects = [];
    rows.forEach(function (r) {
      if (raters.indexOf(r.rater_code) < 0) raters.push(r.rater_code);
      if (projects.indexOf(r.project_code) < 0) projects.push(r.project_code);
    });
    problems.mixed_projects = projects.length > 1;
    var carried = rows.some(function (r) { return r.structure_code; }); // read from an already merged CSV
    problems.no_key = !(key && key.rows) && !carried;
    problems.no_structures = !(structures && structures.rows) && !rows.some(function (r) { return r.true_vertical_m != null || r.true_horizontal_m != null; });
    var columns = csv.columnsFor(exclIds.length ? exclIds : null).concat(csv.MERGED_COLUMNS,
      keyExtra.map(function (x) { return { name: x, type: 'str' }; }));
    return {
      rows: rows, columns: columns, raters: raters.sort(), projects: projects, problems: problems,
      counts: {
        rows: rows.length,
        measured: rows.filter(function (r) { return r.status === 'measured'; }).length,
        excluded: rows.filter(function (r) { return r.status === 'excluded'; }).length
      }
    };
  }

  var api = { merge: merge, E_PAIRS: E_PAIRS };
  HUSS.io.merge = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
