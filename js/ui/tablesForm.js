/* HuSS Scorer — js/ui/tablesForm.js
 * Tables screen: the key table (sheet -> participant, structure).
 * Every scored sheet (this session and the measurement files on Results) is listed by itself with
 * the structure its marked box gives (grey rows, not stored). Editing such a row makes it the
 * coordinator's own row, which then wins over the box; rows can also be typed or imported.
 * The structures and their true dimensions belong to the project (New project / Edit project).
 * Sheet codes are checked while typing. Own rows are kept in the browser as a convenience; the
 * downloaded CSV is the record.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.ui = HUSS.ui || {};

  var els = {}, data = { key: [] };

  function $(id) { return document.getElementById(id); }

  function storeKey() {
    var p = HUSS.app.state.project;
    return 'huss:v1:tables:' + (p ? p.project_code : 'NOPROJECT');
  }

  /** Only the coordinator's own rows are stored; the rows from the boxes are made again each time. */
  function persist() {
    var saved = HUSS.io.autosave.load(storeKey()) || {};
    saved.key = data.key.filter(function (r) { return !r.auto; }).map(function (r) {
      return { sheet_code: r.sheet_code, participant_code: r.participant_code, structure_code: r.structure_code };
    });
    HUSS.io.autosave.save(storeKey(), saved);
  }

  /** A grey row from a box becomes the coordinator's own row when it is changed. */
  function own(r) { r.auto = false; }

  /**
   * Scored sheets (this session and the files added on Results) with the structure of their box:
   * { CODE: structure code or null }.
   */
  function boxStructures() {
    var R = HUSS.ui.results, st = HUSS.io.project.structuresTable(HUSS.app.state.project), out = {};
    (R && R.sources ? R.sources() : []).forEach(function (src) {
      src.records.forEach(function (rec) {
        if (!rec.sheet_code) return;
        var c = HUSS.io.tables.markCode(rec, st);
        if (!(rec.sheet_code in out) || c) out[rec.sheet_code] = c || null;
      });
    });
    return out;
  }

  /** The grey rows: scored sheets without an own row. Own rows learn what their box says. */
  function addBoxRows() {
    var box = boxStructures(), have = {};
    data.key.forEach(function (r) {
      if (r.sheet_code) have[r.sheet_code] = true;
      r.box = r.sheet_code in box ? box[r.sheet_code] : undefined;
    });
    Object.keys(box).sort().forEach(function (code) {
      if (!have[code]) data.key.push({ sheet_code: code, participant_code: '', structure_code: box[code] || '', auto: true, box: box[code] });
    });
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
      if (r.auto) tr.className = 'from-box';
      tr.appendChild(cell(input(r.sheet_code, 'upper', function (v) { own(r); r.sheet_code = HUSS.sheet.code.normalize(v); changedKey(); })));
      tr.appendChild(cell(input(r.participant_code, 'upper', function (v) { own(r); r.participant_code = v.trim().toUpperCase(); changedKey(); })));
      var st = structureField(r, idx);
      tr.appendChild(cell(st));
      var prob = document.createElement('td');
      prob.className = 'problem';
      tr.appendChild(prob);
      // a scored sheet stays listed; only own rows can be removed (the box then counts again)
      tr.appendChild(cell(r.auto ? null : removeButton(function () { data.key.splice(idx, 1); persist(); onShow(); })));
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
      f.addEventListener('change', function () { own(r); r.structure_code = f.value; changedKey(); });
    } else {
      f = input(r.structure_code, 'upper', function (v) { own(r); r.structure_code = v.trim().toUpperCase(); changedKey(); });
      f.setAttribute('list', 'tb-structure-codes');
    }
    f.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && idx === data.key.length - 1) { e.preventDefault(); addKeyRow(); }
    });
    return f;
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
      tr.classList.toggle('from-box', !!r.auto);
      var inputs = tr.querySelectorAll('input, select'), td = tr.children[3];
      if (r.auto) {
        // a scored sheet as its box says: fine with a structure, to be chosen without one
        inputs[0].classList.remove('invalid'); inputs[2].classList.remove('invalid');
        td.className = r.structure_code ? 'ok-mark' : 'problem';
        td.textContent = HUSS.t(r.structure_code ? 'tb_from_box' : 'tb_no_box');
        return;
      }
      var probs = HUSS.io.tables.keyRowProblems(r, data.key, codes);
      inputs[0].classList.toggle('invalid', probs.indexOf('bad_sheet_code') >= 0 || probs.indexOf('duplicate') >= 0);
      inputs[2].classList.toggle('invalid', probs.indexOf('unknown_structure') >= 0);
      var shown = isFilled(r) ? probs.map(function (p) { return HUSS.t(PROBLEM_TEXT[p]); }) : []; // a row with only the preset structure is still empty
      var note = r.box && r.structure_code && r.box !== r.structure_code ? HUSS.t('tb_box_differs', { box: r.box }) : '';
      td.className = shown.length ? 'problem' : 'ok-mark';
      td.textContent = shown.length ? shown.concat(note ? [note] : []).join(', ') : (r.sheet_code ? '✓' + (note ? ' ' + note : '') : '');
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

  /** The coordinator's own rows (the key table proper: it wins over the boxes). */
  function keyRows() {
    return data.key.filter(function (r) { return !r.auto && isFilled(r); });
  }

  function updateStatus() {
    var codes = structureCodes(), filled = keyRows(), auto = data.key.filter(function (r) { return r.auto; });
    var bad = filled.filter(function (r) { return HUSS.io.tables.keyRowProblems(r, data.key, codes).length; }).length;
    var open = auto.filter(function (r) { return !r.structure_code; }).length;
    els.keyStatus.textContent = HUSS.t('tb_key_count2', { own: filled.length, box: auto.length - open, open: open, bad: bad });
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
    var n = data.key.length;
    persist();
    onShow();
    els.keyStatus.textContent += ' ' + HUSS.t('tb_imported', { n: n });
  }

  /**
   * The key table as io.tables.parseKey reads it (rows with problems left out), or null when
   * empty: the coordinator's own rows, read from the browser store (the rows from the boxes are
   * not needed here, Merge reads the boxes itself).
   */
  function keyTable() {
    var saved = HUSS.io.autosave.load(storeKey());
    var rows = (saved && saved.key ? saved.key : []).filter(isFilled);
    return rows.length ? HUSS.io.tables.parseKey(HUSS.io.tables.keyToCSV(rows)) : null;
  }

  function load() {
    var saved = HUSS.io.autosave.load(storeKey());
    data = { key: saved && saved.key ? saved.key : [] };
  }

  function onShow() {
    load();
    addBoxRows();
    if (!data.key.length) data.key.push({ sheet_code: '', participant_code: '', structure_code: structures().length === 1 ? structures()[0].code : '' });
    renderStructures();
    renderKey();
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
      // the whole picture: own rows and the scored sheets with the structure of their box
      HUSS.io.files.downloadText(projectBase() + '_key.csv', HUSS.io.tables.keyToCSV(data.key.filter(function (r) { return isFilled(r) && (!r.auto || r.structure_code); })));
    });
    load();
  }

  HUSS.ui.tablesForm = { init: init, onShow: onShow, importKey: importKey, keyTable: keyTable, get data() { return data; } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
