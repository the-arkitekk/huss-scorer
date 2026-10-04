/* HuSS Scorer — js/ui/tablesForm.js
 * Tables screen (spec 5.4 "or the form in the tool"): structures (true dimensions) and the key
 * table (sheet -> participant, structure) entered by the desk coordinator. Sheet codes are
 * checked while typing. Kept in the browser as a convenience; the downloaded CSV is the record.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.ui = HUSS.ui || {};

  var els = {}, data = { structures: [], key: [] };

  function $(id) { return document.getElementById(id); }

  function storeKey() {
    var p = HUSS.app.state.project;
    return 'huss:v1:tables:' + (p ? p.project_code : 'NOPROJECT');
  }

  function persist() {
    HUSS.io.autosave.save(storeKey(), data);
  }

  function projectBase() {
    var p = HUSS.app.state.project;
    return p ? p.project_code : HUSS.config.DEFAULTS.file_project_fallback;
  }

  function input(value, cls, onInput) {
    var i = document.createElement('input');
    i.type = 'text';
    i.value = value == null ? '' : value;
    if (cls) i.className = cls;
    i.addEventListener('input', function () { onInput(i.value, i); });
    return i;
  }

  function cell(child) {
    var td = document.createElement('td');
    if (child) td.appendChild(child);
    return td;
  }

  function removeButton(onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-xs';
    b.textContent = HUSS.t('tb_remove');
    b.addEventListener('click', onClick);
    return b;
  }

  function structureCodes() {
    return data.structures.map(function (r) { return r.structure_code; }).filter(Boolean);
  }

  // ------------------------------------------------------------ structures

  function renderStructures() {
    var tb = els.stBody;
    tb.textContent = '';
    data.structures.forEach(function (r, idx) {
      var tr = document.createElement('tr');
      var nums = {};
      tr.appendChild(cell(input(r.structure_code, 'upper', function (v) { r.structure_code = v.trim().toUpperCase(); afterStructures(); })));
      tr.appendChild(cell(input(r.structure_name, '', function (v) { r.structure_name = v; persist(); })));
      ['true_vertical_m', 'true_horizontal_m'].forEach(function (k) {
        var i = input(r[k] == null ? '' : String(r[k]), '', function (v, el) {
          var n = HUSS.io.tables.num(v);
          r[k] = n;
          el.classList.toggle('invalid', v.trim() !== '' && !(n > 0));
          persist();
          updateStatus();
        });
        i.inputMode = 'decimal';
        nums[k] = i;
        tr.appendChild(cell(i));
      });
      tr.appendChild(cell(removeButton(function () { data.structures.splice(idx, 1); afterStructures(); renderStructures(); })));
      tb.appendChild(tr);
    });
    updateDatalist();
    updateStatus();
  }

  function afterStructures() {
    updateDatalist();
    renderKeyProblems();
    persist();
    updateStatus();
  }

  function updateDatalist() {
    els.datalist.textContent = '';
    structureCodes().forEach(function (c) {
      var o = document.createElement('option');
      o.value = c;
      els.datalist.appendChild(o);
    });
  }

  // ------------------------------------------------------------ key table

  function renderKey() {
    var tb = els.keyBody;
    tb.textContent = '';
    data.key.forEach(function (r, idx) {
      var tr = document.createElement('tr');
      tr.appendChild(cell(input(r.sheet_code, 'upper', function (v) { r.sheet_code = HUSS.sheet.code.normalize(v); changedKey(); })));
      tr.appendChild(cell(input(r.participant_code, 'upper', function (v) { r.participant_code = v.trim().toUpperCase(); changedKey(); })));
      var st = input(r.structure_code, 'upper', function (v) { r.structure_code = v.trim().toUpperCase(); changedKey(); });
      st.setAttribute('list', 'tb-structure-codes');
      st.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && idx === data.key.length - 1) { e.preventDefault(); addKeyRow(); }
      });
      tr.appendChild(cell(st));
      var prob = document.createElement('td');
      prob.className = 'problem';
      tr.appendChild(prob);
      tr.appendChild(cell(removeButton(function () { data.key.splice(idx, 1); persist(); renderKey(); })));
      tb.appendChild(tr);
    });
    renderKeyProblems();
  }

  function changedKey() {
    renderKeyProblems();
    persist();
  }

  var PROBLEM_TEXT = { bad_sheet_code: 'tbl_bad_sheet_code', duplicate: 'tb_duplicate_code', empty: 'tbl_empty', unknown_structure: 'tbl_unknown_structure' };

  function renderKeyProblems() {
    var codes = structureCodes();
    Array.prototype.forEach.call(els.keyBody.children, function (tr, idx) {
      var r = data.key[idx];
      var probs = HUSS.io.tables.keyRowProblems(r, data.key, codes);
      var inputs = tr.querySelectorAll('input');
      inputs[0].classList.toggle('invalid', probs.indexOf('bad_sheet_code') >= 0 || probs.indexOf('duplicate') >= 0);
      inputs[2].classList.toggle('invalid', probs.indexOf('unknown_structure') >= 0);
      var td = tr.children[3];
      var shown = probs.filter(function (p) { return p !== 'empty' || (r.sheet_code || r.participant_code || r.structure_code); });
      td.className = shown.length ? 'problem' : 'ok-mark';
      td.textContent = shown.length ? shown.map(function (p) { return HUSS.t(PROBLEM_TEXT[p]); }).join(', ') : (r.sheet_code ? '✓' : '');
    });
    updateStatus();
  }

  function addKeyRow() {
    data.key.push({ sheet_code: '', participant_code: '', structure_code: '' });
    persist();
    renderKey();
    var last = els.keyBody.lastChild;
    if (last) last.querySelector('input').focus();
  }

  // ------------------------------------------------------------ status, import, export

  function updateStatus() {
    els.stStatus.textContent = HUSS.t('tb_st_count', { n: data.structures.filter(function (r) { return r.structure_code; }).length });
    var codes = structureCodes();
    var filled = data.key.filter(function (r) { return r.sheet_code || r.participant_code || r.structure_code; });
    var bad = filled.filter(function (r) { return HUSS.io.tables.keyRowProblems(r, data.key, codes).length; }).length;
    els.keyStatus.textContent = HUSS.t('tb_key_count', { n: filled.length, bad: bad });
  }

  function structuresRows() {
    return data.structures.filter(function (r) { return r.structure_code; });
  }

  function keyRows() {
    return data.key.filter(function (r) { return r.sheet_code || r.participant_code || r.structure_code; });
  }

  function importStructures(text) {
    var r = HUSS.io.tables.parseStructures(text);
    data.structures = Object.keys(r.rows).map(function (c) {
      var x = r.rows[c];
      return { structure_code: c, structure_name: x.structure_name, true_vertical_m: x.true_vertical_m, true_horizontal_m: x.true_horizontal_m };
    });
    persist();
    renderStructures();
    renderKeyProblems();
    els.stStatus.textContent += ' ' + HUSS.t('tb_imported', { n: data.structures.length });
  }

  function importKey(text) {
    // Keep every row, also problematic ones, so they can be corrected here.
    var t = HUSS.io.csv.parse(String(text).replace(/^﻿/, ''), String(text).split(/\r?\n/, 1)[0].indexOf(';') >= 0 ? ';' : ',');
    var head = (t[0] || []).map(function (h) { return h.trim().toLowerCase(); });
    var col = function (n) { return head.indexOf(n); };
    data.key = t.slice(1).filter(function (r) { return r.some(function (c) { return c.trim(); }); }).map(function (r) {
      return {
        sheet_code: HUSS.sheet.code.normalize(r[col('sheet_code')] || ''),
        participant_code: (r[col('participant_code')] || '').trim().toUpperCase(),
        structure_code: (r[col('structure_code')] || '').trim().toUpperCase()
      };
    });
    persist();
    renderKey();
    els.keyStatus.textContent += ' ' + HUSS.t('tb_imported', { n: data.key.length });
  }

  function use() {
    HUSS.ui.queue.setTable('structures', HUSS.io.tables.structuresToCSV(structuresRows()));
    HUSS.ui.queue.setTable('key', HUSS.io.tables.keyToCSV(keyRows()));
    els.useStatus.textContent = HUSS.t('tb_used');
  }

  function onShow() {
    var saved = HUSS.io.autosave.load(storeKey());
    if (saved && (saved.structures || saved.key)) {
      data = { structures: saved.structures || [], key: saved.key || [] };
    }
    if (!data.key.length) data.key.push({ sheet_code: '', participant_code: '', structure_code: '' });
    renderStructures();
    renderKey();
  }

  function init() {
    els = {
      stBody: $('tb-structures').querySelector('tbody'), keyBody: $('tb-key').querySelector('tbody'), datalist: $('tb-structure-codes'),
      stStatus: $('tb-st-status'), keyStatus: $('tb-key-status'), useStatus: $('tb-use-status'),
      stInput: $('tb-st-input'), keyInput: $('tb-key-input')
    };
    $('tb-st-add').addEventListener('click', function () {
      data.structures.push({ structure_code: '', structure_name: '', true_vertical_m: null, true_horizontal_m: null });
      persist();
      renderStructures();
      els.stBody.lastChild.querySelector('input').focus();
    });
    $('tb-key-add').addEventListener('click', addKeyRow);
    $('tb-st-import').addEventListener('click', function () { els.stInput.value = ''; els.stInput.click(); });
    $('tb-key-import').addEventListener('click', function () { els.keyInput.value = ''; els.keyInput.click(); });
    els.stInput.addEventListener('change', function () {
      if (els.stInput.files[0]) HUSS.io.files.readText(els.stInput.files[0]).then(importStructures);
    });
    els.keyInput.addEventListener('change', function () {
      if (els.keyInput.files[0]) HUSS.io.files.readText(els.keyInput.files[0]).then(importKey);
    });
    $('tb-st-download').addEventListener('click', function () {
      HUSS.io.files.downloadText(projectBase() + '_structures.csv', HUSS.io.tables.structuresToCSV(structuresRows()));
    });
    $('tb-key-download').addEventListener('click', function () {
      HUSS.io.files.downloadText(projectBase() + '_key.csv', HUSS.io.tables.keyToCSV(keyRows()));
    });
    $('tb-use').addEventListener('click', use);
  }

  HUSS.ui.tablesForm = { init: init, onShow: onShow, importStructures: importStructures, importKey: importKey, get data() { return data; } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
