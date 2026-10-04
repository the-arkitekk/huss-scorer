/* HuSS Scorer — js/ui/projectForm.js
 * New project screen (spec 8.2): a form for the fields of 5.1, download of the project file,
 * and "use this project now".
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.ui = HUSS.ui || {};

  var els = {};
  var FIELD_LABELS = {
    project_code: 'pf_code', title: 'pf_title_field', template: 'pf_template', sheet_label: 'pf_label',
    ref_height_m: 'pf_ref', min_figure_mm: 'pf_min_fig', foot_tolerance_mm: 'pf_foot_tol', snap_radius_mm: 'pf_snap'
  };

  function $(id) { return document.getElementById(id); }

  function addExclusionRow(id, label) {
    var row = document.createElement('div');
    row.className = 'excl-row';
    row.dataset.id = id || '';
    var input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 120;
    input.value = label || '';
    input.placeholder = HUSS.t('pf_excl_placeholder');
    var rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'btn btn-xs';
    rm.textContent = HUSS.t('pf_excl_remove');
    rm.addEventListener('click', function () { row.remove(); });
    row.appendChild(input);
    row.appendChild(rm);
    els.exclList.appendChild(row);
    return input;
  }

  function fill(p) {
    els.code.value = p.project_code;
    els.title.value = p.title;
    els.template.value = p.template;
    els.label.value = p.sheet_label;
    els.ref.value = p.ref_height_m;
    els.min.value = p.min_figure_mm;
    els.foot.value = p.foot_tolerance_mm;
    els.snap.value = p.snap_radius_mm;
    els.sugFigure.checked = p.suggestions.figure;
    els.sugCeiling.checked = p.suggestions.ceiling;
    els.sugWall.checked = p.suggestions.wall;
    els.exclList.textContent = '';
    p.exclusion_criteria.forEach(function (e) { addExclusionRow(e.id, e.label); });
    els.rules.textContent = HUSS.t('pf_rules', { v: HUSS.config.RULES_VERSION });
  }

  function numberOf(input) {
    var v = input.value.trim();
    return v === '' ? NaN : Number(v.replace(',', '.'));
  }

  /** Project object from the form (not yet validated). */
  function read() {
    var rows = Array.prototype.slice.call(els.exclList.querySelectorAll('.excl-row'));
    var taken = [], excl = [];
    rows.forEach(function (row) {
      var label = row.querySelector('input').value.trim();
      if (!label) return;
      var id = row.dataset.id;
      if (!id || taken.indexOf(id) >= 0) id = HUSS.io.project.exclusionId(label, taken);
      taken.push(id);
      excl.push({ id: id, label: label });
    });
    return HUSS.io.project.create({
      project_code: els.code.value.trim().toUpperCase(),
      title: els.title.value.trim(),
      template: els.template.value,
      sheet_label: els.label.value.trim(),
      ref_height_m: numberOf(els.ref),
      min_figure_mm: numberOf(els.min),
      foot_tolerance_mm: numberOf(els.foot),
      snap_radius_mm: numberOf(els.snap),
      suggestions: { figure: els.sugFigure.checked, ceiling: els.sugCeiling.checked, wall: els.sugWall.checked },
      exclusion_criteria: excl
    });
  }

  /** Readable list of validation errors. */
  function describe(errors) {
    return errors.map(function (e) {
      var base = e.field.replace(/\[\d+\]$/, '');
      var field = FIELD_LABELS[base] ? HUSS.t(FIELD_LABELS[base]).replace(/\s*\*$/, '') : base;
      return HUSS.t('pf_err_' + e.code, { field: field });
    }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join('; ');
  }

  function check() {
    els.saved.hidden = true;
    var v = HUSS.io.project.validate(read());
    if (!v.ok) {
      els.errors.textContent = HUSS.t('pf_errors', { list: describe(v.errors) });
      els.errors.hidden = false;
      return null;
    }
    els.errors.hidden = true;
    return v.project;
  }

  function download() {
    var p = check();
    if (!p) return;
    var name = HUSS.io.project.fileName(p);
    HUSS.io.files.downloadText(name, HUSS.io.project.serialize(p), 'application/json');
    els.saved.textContent = HUSS.t('pf_saved', { name: name });
    els.saved.hidden = false;
  }

  function use() {
    var p = check();
    if (!p) return;
    HUSS.app.setProject(p);
    HUSS.app.show('score');
  }

  function init() {
    els = {
      code: $('pf-code'), title: $('pf-title'), template: $('pf-template'), label: $('pf-label'),
      ref: $('pf-ref'), min: $('pf-min'), foot: $('pf-foot'), snap: $('pf-snap'),
      sugFigure: $('pf-sug-figure'), sugCeiling: $('pf-sug-ceiling'), sugWall: $('pf-sug-wall'),
      exclList: $('pf-excl-list'), exclAdd: $('pf-excl-add'), rules: $('pf-rules'),
      errors: $('pf-errors'), saved: $('pf-saved'), download: $('pf-download'), use: $('pf-use')
    };
    fill(HUSS.io.project.create({}));
    els.exclAdd.addEventListener('click', function () { addExclusionRow('', '').focus(); });
    els.download.addEventListener('click', download);
    els.use.addEventListener('click', use);
  }

  HUSS.ui.projectForm = { init: init, read: read, describe: describe };
})(typeof globalThis !== 'undefined' ? globalThis : this);
