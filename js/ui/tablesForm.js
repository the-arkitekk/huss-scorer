/* HuSS Scorer — js/ui/tablesForm.js
 * Tables screen: the key table (sheet -> participant, structure) entered by the desk coordinator.
 * The structures and their true dimensions belong to the project (New project / Edit project).
 * Sheet codes are checked while typing. Kept in the browser as a convenience; the downloaded CSV
 * is the record.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.ui = HUSS.ui || {};

  var els = {}, data = { key: [] }, pendingNote = '';

  function $(id) { return document.getElementById(id); }

  function storeKey() {
    var p = HUSS.app.state.project;
    return 'huss:v1:tables:' + (p ? p.project_code : 'NOPROJECT');
  }

  function persist() {
    var saved = HUSS.io.autosave.load(storeKey()) || {};
    saved.key = data.key;
    HUSS.io.autosave.save(storeKey(), saved);
  }

  function projectBase() {
    var p = HUSS.app.state.project;
    return p ? p.project_code : HUSS.config.DEFAULTS.file_project_fallback;
  }

  function structures() {
    var p = HUSS.app.state.project;
    return p && p.structures ? p.structures : [];
  }

  function structureCodes() {
    return structures().map(function (s) { return s.code; });
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

  function renderStructures() {
    var st = structures();
    els.datalist.textContent = '';
    st.forEach(function (s) {
      var o = document.createElement('option');
      o.value = s.code;
      o.label = s.name || s.code;
      els.datalist.appendChild(o);
    });
    els.structures.textContent = st.length
      ? HUSS.t('tb_project_structures', { list: st.map(function (s) { return s.code + (s.name ? ' (' + s.name + ')' : ''); }).join(', ') })
      : HUSS.t('tb_no_structures');
    els.single.hidden = st.length !== 1;
    if (st.length === 1) els.single.textContent = HUSS.t('tb_single_structure', { code: st[0].code });
  }

  function renderKey() {
    var tb = els.keyBody;
    tb.textContent = '';
    data.key.forEach(function (r, idx) {
      var tr = document.createElement('tr');
      tr.appendChild(cell(input(r.sheet_code, 'upper', function (v) { r.sheet_code = HUSS.sheet.code.normalize(v); changedKey(); })));
      tr.appendChild(cell(input(r.participant_code, 'upper', function (v) { r.participant_code = v.trim().toUpperCase(); changedKey(); })));
      var st = structureField(r, idx);
      tr.appendChild(cell(st));
      var prob = document.createElement('td');
      prob.className = 'problem';
      tr.appendChild(prob);
      tr.appendChild(cell(removeButton(function () { data.key.splice(idx, 1); persist(); renderKey(); })));
      tb.appendChild(tr);
    });
    renderKeyProblems();
  }

  /** The structure of a key row: a list of the project's structures, or free text without them. */
  function structureField(r, idx) {
    var codes = structureCodes(), f;
    if (codes.length) {
      f = document.createElement('select');
      var opts = [''].concat(codes);
      if (r.structure_code && codes.indexOf(r.structure_code) < 0) opts.push(r.structure_code); // imported, not in the project
      opts.forEach(function (c) {
        var o = document.createElement('option'), st = structures().filter(function (x) { return x.code === c; })[0];
        o.value = c;
        o.textContent = c ? c + (st && st.name ? ' — ' + st.name : '') : '–';
        f.appendChild(o);
      });
      f.value = r.structure_code || '';
      f.addEventListener('change', function () { r.structure_code = f.value; changedKey(); });
    } else {
      f = input(r.structure_code, 'upper', function (v) { r.structure_code = v.trim().toUpperCase(); changedKey(); });
      f.setAttribute('list', 'tb-structure-codes');
    }
    f.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && idx === data.key.length - 1) { e.preventDefault(); addKeyRow(); }
    });
    return f;
  }

  /** Rows for sheets whose structure is not known yet (from Results): only the structure is left to choose. */
  function addSheets(codes) {
    load();
    var have = {};
    data.key.forEach(function (r) { if (r.sheet_code) have[r.sheet_code] = true; });
    data.key = data.key.filter(isFilled);
    var added = 0;
    (codes || []).forEach(function (c) {
      if (have[c]) return;
      have[c] = true;
      data.key.push({ sheet_code: c, participant_code: '', structure_code: '' });
      added++;
    });
    persist();
    pendingNote = added ? HUSS.t('tb_added', { n: added }) : '';
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
      var inputs = tr.querySelectorAll('input, select');
      inputs[0].classList.toggle('invalid', probs.indexOf('bad_sheet_code') >= 0 || probs.indexOf('duplicate') >= 0);
      inputs[2].classList.toggle('invalid', probs.indexOf('unknown_structure') >= 0);
      var td = tr.children[3];
      var shown = isFilled(r) ? probs : []; // a row with only the preset structure is still empty
      td.className = shown.length ? 'problem' : 'ok-mark';
      td.textContent = shown.length ? shown.map(function (p) { return HUSS.t(PROBLEM_TEXT[p]); }).join(', ') : (r.sheet_code ? '✓' : '');
    });
    updateStatus();
  }

  function addKeyRow() {
    data.key.push({ sheet_code: '', participant_code: '', structure_code: structures().length === 1 ? structures()[0].code : '' });
    persist();
    renderKey();
    var last = els.keyBody.lastChild;
    if (last) last.querySelector('input').focus();
  }

  function isFilled(r) {
    return !!(r.sheet_code || r.participant_code);
  }

  function keyRows() {
    return data.key.filter(isFilled);
  }

  function updateStatus() {
    var codes = structureCodes(), filled = keyRows();
    var bad = filled.filter(function (r) { return HUSS.io.tables.keyRowProblems(r, data.key, codes).length; }).length;
    els.keyStatus.textContent = HUSS.t('tb_key_count', { n: filled.length, bad: bad });
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

  /** The key table as io.tables.parseKey reads it (rows with problems left out), or null when empty. */
  function keyTable() {
    var rows = keyRows();
    return rows.length ? HUSS.io.tables.parseKey(HUSS.io.tables.keyToCSV(rows)) : null;
  }

  function load() {
    var saved = HUSS.io.autosave.load(storeKey());
    data = { key: saved && saved.key ? saved.key : [] };
  }

  function onShow() {
    load();
    if (!data.key.length) data.key.push({ sheet_code: '', participant_code: '', structure_code: structures().length === 1 ? structures()[0].code : '' });
    renderStructures();
    renderKey();
    if (pendingNote) { els.keyStatus.textContent += ' ' + pendingNote; pendingNote = ''; }
  }

  function init() {
    els = {
      keyBody: $('tb-key').querySelector('tbody'), datalist: $('tb-structure-codes'), keyStatus: $('tb-key-status'),
      keyInput: $('tb-key-input'), structures: $('tb-structures-info'), single: $('tb-single')
    };
    $('tb-key-add').addEventListener('click', addKeyRow);
    $('tb-key-import').addEventListener('click', function () { els.keyInput.value = ''; els.keyInput.click(); });
    els.keyInput.addEventListener('change', function () {
      if (els.keyInput.files[0]) HUSS.io.files.readText(els.keyInput.files[0]).then(importKey);
    });
    $('tb-key-download').addEventListener('click', function () {
      HUSS.io.files.downloadText(projectBase() + '_key.csv', HUSS.io.tables.keyToCSV(keyRows()));
    });
    load();
  }

  HUSS.ui.tablesForm = { init: init, onShow: onShow, importKey: importKey, addSheets: addSheets, keyTable: function () { load(); return keyTable(); }, get data() { return data; } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
