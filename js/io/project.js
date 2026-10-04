/* HuSS Scorer — js/io/project.js
 * Project file <project_code>.huss.json (spec 5.1): create, validate, read, write. DOM-free.
 * The project file holds no personal data.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.io = HUSS.io || {};

  var FORMAT = 'huss-project', FORMAT_VERSION = 1;
  var CODE_RE = /^[A-Z0-9-]{1,32}$/;
  var EXCL_RE = /^excl_[a-z0-9_]{1,40}$/;

  var DEFAULT_EXCLUSIONS = [
    { id: 'excl_no_figure', label: 'Figure not drawn' },
    { id: 'excl_not_standing_full', label: 'Figure not standing or not full height' },
    { id: 'excl_not_along_axis', label: 'Section not drawn along the viewing axis' }
  ];

  // Numeric fields with their accepted ranges
  var RANGES = {
    ref_height_m: [0.5, 3],
    min_figure_mm: [0, 100],
    foot_tolerance_mm: [0, 5],
    snap_radius_mm: [0.1, 5]
  };

  /** A new project with the tool defaults; `fields` override them. */
  function create(fields, now) {
    var d = HUSS.config.DEFAULTS;
    var p = {
      format: FORMAT,
      format_version: FORMAT_VERSION,
      project_code: '',
      title: '',
      template: d.template,
      sheet_label: d.sheet_label,
      ref_height_m: d.ref_height_m,
      min_figure_mm: d.min_figure_mm,
      foot_tolerance_mm: d.foot_tolerance_mm,
      snap_radius_mm: d.snap_radius_mm,
      suggestions: { figure: true, ceiling: true, wall: true },
      exclusion_criteria: DEFAULT_EXCLUSIONS.map(function (e) { return { id: e.id, label: e.label }; }),
      rules_version: HUSS.config.RULES_VERSION,
      created_at: HUSS.measure.record.isoLocal(now || new Date())
    };
    Object.keys(fields || {}).forEach(function (k) { p[k] = fields[k]; });
    return p;
  }

  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  /**
   * Checks a project object. Returns { ok, errors: [{ field, code }], project } where project is
   * a normalised copy (missing optional fields filled with defaults).
   * Error codes: not_project, format_version, required, pattern, range, template, type, exclusion.
   */
  function validate(obj) {
    var errors = [];
    var err = function (field, code) { errors.push({ field: field, code: code }); };
    if (!obj || typeof obj !== 'object' || obj.format !== FORMAT) {
      err('format', 'not_project');
      return { ok: false, errors: errors, project: null };
    }
    if (obj.format_version !== FORMAT_VERSION) err('format_version', 'format_version');
    var p = create({}, null);
    Object.keys(obj).forEach(function (k) { p[k] = obj[k]; });

    if (typeof p.project_code !== 'string' || !p.project_code) err('project_code', 'required');
    else if (!CODE_RE.test(p.project_code)) err('project_code', 'pattern');
    if (typeof p.title !== 'string' || p.title.length > 200) err('title', 'type');
    if (p.template !== 'A4L' && p.template !== 'A3L') err('template', 'template');
    if (typeof p.sheet_label !== 'string' || !p.sheet_label.trim() || p.sheet_label.length > 20) err('sheet_label', 'type');
    Object.keys(RANGES).forEach(function (k) {
      if (!isNum(p[k])) err(k, 'type');
      else if (p[k] < RANGES[k][0] || p[k] > RANGES[k][1]) err(k, 'range');
    });
    var sg = p.suggestions;
    if (!sg || typeof sg !== 'object') err('suggestions', 'type');
    else {
      p.suggestions = {
        figure: sg.figure !== false, ceiling: sg.ceiling !== false, wall: sg.wall !== false
      };
    }
    var ex = p.exclusion_criteria;
    if (!Array.isArray(ex) || ex.length > 20) err('exclusion_criteria', 'type');
    else {
      var seen = {};
      ex.forEach(function (e, i) {
        var bad = !e || typeof e !== 'object' || typeof e.id !== 'string' || !EXCL_RE.test(e.id) ||
          e.id === 'excl_other' || seen[e.id] || typeof e.label !== 'string' || !e.label.trim() || e.label.length > 120;
        if (bad) err('exclusion_criteria[' + i + ']', 'exclusion');
        else seen[e.id] = true;
      });
    }
    if (typeof p.rules_version !== 'string') err('rules_version', 'type');
    return { ok: errors.length === 0, errors: errors, project: p };
  }

  function serialize(p) {
    return JSON.stringify(p, null, 2) + '\n';
  }

  /** Reads project file text. Returns validate()'s result, or a 'json' error. */
  function parse(text) {
    var obj;
    try { obj = JSON.parse(String(text).replace(/^﻿/, '')); } catch (e) {
      return { ok: false, errors: [{ field: 'file', code: 'json' }], project: null };
    }
    return validate(obj);
  }

  function fileName(p) {
    return p.project_code + '.huss.json';
  }

  /** Scoring parameters taken from a project (same shape as HUSS.config.DEFAULTS plus extras). */
  function paramsOf(p) {
    var d = HUSS.config.DEFAULTS;
    return {
      project_code: p.project_code, template: p.template, sheet_label: p.sheet_label,
      ref_height_m: p.ref_height_m, min_figure_mm: p.min_figure_mm,
      foot_tolerance_mm: p.foot_tolerance_mm, snap_radius_mm: p.snap_radius_mm,
      suggestions: p.suggestions, exclusion_criteria: p.exclusion_criteria,
      mode: d.mode, file_project_fallback: d.file_project_fallback
    };
  }

  /** A valid criterion id from a label: excl_ + lowercase ASCII letters, digits and underscores. */
  function exclusionId(label, taken) {
    var map = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u' };
    var slug = String(label || '').toLowerCase().replace(/[çğıİöşü]/g, function (ch) { return map[ch] || ch; })
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'criterion';
    var id = 'excl_' + slug, n = 2;
    if (id === 'excl_other') id = 'excl_other_reason';
    while (taken && taken.indexOf(id) >= 0) id = 'excl_' + slug + '_' + (n++);
    return id;
  }

  var api = {
    FORMAT: FORMAT, FORMAT_VERSION: FORMAT_VERSION, DEFAULT_EXCLUSIONS: DEFAULT_EXCLUSIONS, RANGES: RANGES,
    create: create, validate: validate, serialize: serialize, parse: parse, fileName: fileName,
    paramsOf: paramsOf, exclusionId: exclusionId
  };
  HUSS.io.project = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
