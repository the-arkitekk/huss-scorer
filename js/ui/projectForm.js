/* HuSS Scorer — js/ui/projectForm.js
 * Project form (spec 8.2): a new project, or the open project edited (main menu). Fields of
 * 5.1 plus the structures with their true dimensions. Saving downloads the project file and
 * opens the project.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.ui = HUSS.ui || {};

  var els = {}, mode = 'new';
  var FIELD_LABELS = {
    project_code: 'pf_code', title: 'pf_title_field', template: 'pf_template', sheet_label: 'pf_label', structures: 'pf_structures',
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

  function addStructureRow(s) {
    s = s || {};
    var tr = document.createElement('tr');
    var mk = function (value, cls, type) {
      var td = document.createElement('td'), i = document.createElement('input');
      i.type = 'text';
      if (type === 'num') { i.inputMode = 'decimal'; i.className = 'num'; }
      if (cls) i.className = (i.className ? i.className + ' ' : '') + cls;
      i.value = value == null ? '' : String(value);
      td.appendChild(i);
      tr.appendChild(td);
      return i;
    };
    mk(s.code, 'upper');
    mk(s.name, 'keep-case');
    mk(s.true_vertical_m, '', 'num');
    mk(s.true_horizontal_m, '', 'num');
    var td = document.createElement('td'), rm = document.createElement('button');
    rm.type = 'button'; rm.className = 'btn btn-xs'; rm.textContent = HUSS.t('tb_remove');
    rm.addEventListener('click', function () { tr.remove(); });
    td.appendChild(rm);
    tr.appendChild(td);
    els.stBody.appendChild(tr);
    return tr.querySelector('input');
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
    els.stBody.textContent = '';
    (p.structures || []).forEach(addStructureRow);
    if (!(p.structures || []).length) addStructureRow();
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
    var structures = Array.prototype.slice.call(els.stBody.querySelectorAll('tr')).map(function (tr) {
      var v = Array.prototype.map.call(tr.querySelectorAll('input'), function (i) { return i.value.trim(); });
      var n = function (x) { return x === '' ? null : Number(x.replace(',', '.')); };
      return { code: v[0].toUpperCase(), name: v[1], true_vertical_m: n(v[2]), true_horizontal_m: n(v[3]) };
    }).filter(function (s) { return s.code || s.name || s.true_vertical_m != null || s.true_horizontal_m != null; });
    var base = mode === 'edit' && HUSS.app.state.project ? { created_at: HUSS.app.state.project.created_at } : {};
    return HUSS.io.project.create(Object.assign(base, {
      project_code: els.code.value.trim().toUpperCase(),
      title: els.title.value.trim(),
      template: els.template.value,
      sheet_label: els.label.value.trim(),
      ref_height_m: numberOf(els.ref),
      min_figure_mm: numberOf(els.min),
      foot_tolerance_mm: numberOf(els.foot),
      snap_radius_mm: numberOf(els.snap),
      suggestions: { figure: els.sugFigure.checked, ceiling: els.sugCeiling.checked, wall: els.sugWall.checked },
      exclusion_criteria: excl,
      structures: structures
    }));
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

  /** Saves: downloads the project file and opens the project (a new one starts with the Sheets screen). */
  function save() {
    var p = check();
    if (!p) return;
    HUSS.io.files.downloadText(HUSS.io.project.fileName(p), HUSS.io.project.serialize(p), 'application/json');
    HUSS.ui.home.enter(p, mode === 'new' ? 'sheets' : (HUSS.app.state.lastScreen || 'score'));
  }

  function openNew() {
    mode = 'new';
    fill(HUSS.io.project.create({}));
    els.heading.textContent = HUSS.t('pf_title');
    els.save.textContent = HUSS.t('pf_create');
    els.errors.hidden = true;
    els.saved.hidden = true;
    HUSS.app.show('project');
  }

  function openEdit(p) {
    if (!p) return openNew();
    mode = 'edit';
    fill(p);
    els.heading.textContent = HUSS.t('pf_edit_title', { code: p.project_code });
    els.save.textContent = HUSS.t('pf_save_changes');
    els.errors.hidden = true;
    els.saved.hidden = true;
    HUSS.app.show('project');
  }

  function init() {
    els = {
      code: $('pf-code'), title: $('pf-title'), template: $('pf-template'), label: $('pf-label'),
      ref: $('pf-ref'), min: $('pf-min'), foot: $('pf-foot'), snap: $('pf-snap'),
      sugFigure: $('pf-sug-figure'), sugCeiling: $('pf-sug-ceiling'), sugWall: $('pf-sug-wall'),
      exclList: $('pf-excl-list'), exclAdd: $('pf-excl-add'), rules: $('pf-rules'),
      errors: $('pf-errors'), saved: $('pf-saved'), save: $('pf-save'), cancel: $('pf-cancel'),
      stBody: $('pf-structures').querySelector('tbody'), stAdd: $('pf-st-add'), heading: $('pf-heading')
    };
    fill(HUSS.io.project.create({}));
    els.exclAdd.addEventListener('click', function () { addExclusionRow('', '').focus(); });
    els.stAdd.addEventListener('click', function () { addStructureRow().focus(); });
    els.save.addEventListener('click', save);
    els.cancel.addEventListener('click', function () { HUSS.ui.home.show(); });
  }

  HUSS.ui.projectForm = { init: init, read: read, describe: describe, openNew: openNew, openEdit: openEdit };
})(typeof globalThis !== 'undefined' ? globalThis : this);
