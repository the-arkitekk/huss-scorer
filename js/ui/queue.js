/* HuSS Scorer — js/ui/queue.js
 * Runs a scoring session over a folder (spec 8.1, 8.4, 8.5, 5.5): reads the sheet codes,
 * resolves repeated codes, resumes from CSV or autosave, moves through the queue, keeps the
 * time per drawing, autosaves, downloads the CSV and the Excel view, reminds to download.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.ui = HUSS.ui || {};

  var S = function () { return HUSS.io.session; };
  var A = function () { return HUSS.io.autosave; };
  var sess = null, files = {}, tables = { key: null, structures: null }, pendingCsv = null, subsample = null;
  var openedAt = null, saveTimer = null, running = false, els = {}, setup = null;

  function $(id) { return document.getElementById(id); }

  function isImage(f) {
    return !/^\./.test(f.name) && (/^image\/(jpeg|png)$/.test(f.type) || /\.(jpe?g|png)$/i.test(f.name));
  }

  /** Current values of the session fields. */
  function setupValues() {
    var p = HUSS.app.state.project;
    var mode = els.modeBlind.checked ? 'blind' : els.modeOpen.checked ? 'open' : null;
    return {
      project_code: p ? p.project_code : els.inProject.value.trim().toUpperCase(),
      rater_code: els.inRater.value.trim().toUpperCase(),
      mode: mode
    };
  }

  function showSetupError(text) {
    els.setupError.textContent = text || '';
    els.setupError.hidden = !text;
  }

  function timeOf(iso) {
    var m = /T(\d\d:\d\d)/.exec(iso || '');
    return m ? m[1] : '';
  }

  /** Session fields changed before the start: Open-mode tables, autosave notice. */
  function setupChanged() {
    if (running) return;
    var v = setupValues();
    els.openTables.hidden = v.mode !== 'open';
    if (v.rater_code) els.inRater.classList.remove('invalid');
    var saved = v.rater_code && v.mode ? A().load(A().key(v.project_code, v.rater_code, v.mode)) : null;
    if (saved && saved.records && (saved.records.length || (saved.drafts && saved.drafts.length))) {
      els.autosaveText.textContent = HUSS.t('autosave_found', { done: saved.done || 0, total: saved.total || 0, time: timeOf(saved.saved_at) });
      els.autosaveRow.hidden = false;
    } else {
      els.autosaveRow.hidden = true;
    }
    showSetupError('');
  }

  function setPendingCsv(text, fileName) {
    var r = HUSS.io.csv.readMeasurements(text);
    pendingCsv = null;
    var msg, cls = 'bad';
    if (r.ok) {
      pendingCsv = r;
      msg = HUSS.t('resume_loaded', { file: fileName, n: r.records.length });
      cls = 'ok';
    } else if (r.error === 'excel_view') msg = HUSS.t('resume_excel');
    else if (r.error === 'not_measurement_csv') msg = HUSS.t('resume_other');
    else msg = HUSS.t('resume_bad', { msg: r.detail || r.error });
    els.resumeStatus.textContent = msg;
    els.resumeStatus.className = 'small ' + cls;
    els.resumeStatus.hidden = false;
  }

  /** A subsample list for this session (spec 8.1): only its codes are scored. */
  function setSubsample(text, fileName) {
    var r = HUSS.io.subsample.parse(text);
    subsample = r.codes.length ? r.codes : null;
    var parts = [HUSS.t('subsample_loaded', { file: fileName, n: r.codes.length })];
    if (r.invalid.length) parts.push(HUSS.t('subsample_bad', { file: fileName, n: r.invalid.length }));
    els.resumeStatus.textContent = parts.join(' ');
    els.resumeStatus.className = 'small ' + (r.codes.length ? 'ok' : 'bad');
    els.resumeStatus.hidden = false;
  }

  function setTable(kind, text) {
    var r = kind === 'key' ? HUSS.io.tables.parseKey(text) : HUSS.io.tables.parseStructures(text);
    tables[kind] = r;
    var parts = [];
    if (tables.key) parts.push(HUSS.t('key_loaded', { n: Object.keys(tables.key.rows).length }));
    if (tables.structures) parts.push(HUSS.t('structures_loaded', { n: Object.keys(tables.structures.rows).length }));
    [tables.key, tables.structures].forEach(function (t) {
      if (t && t.errors.length) {
        parts.push(HUSS.t('table_errors', { n: t.errors.length, line: t.errors[0].line, what: HUSS.t('tbl_' + t.errors[0].code) }));
      }
    });
    els.tablesStatus.textContent = parts.join(' ');
    if (running && sess && HUSS.ui.scorer.context) openCurrent(); // show the new information
  }

  // ------------------------------------------------------------ start

  function readCodes(list, params) {
    var results = [], i = 0;
    return new Promise(function (resolve) {
      var step = function () {
        if (i >= list.length) { HUSS.ui.scorer.setBusy(null); resolve(results); return; }
        var f = list[i];
        HUSS.ui.scorer.setBusy(HUSS.t('reading_codes', { i: i + 1, n: list.length }));
        HUSS.image.decode.decodeFile(f).then(function (img) {
          var r = HUSS.detect.pipeline.readCode(img, { template: params.template, params: params });
          return r.ok ? r : null;
        }).catch(function () { return null; }).then(function (r) {
          results.push({ name: f.name, size: f.size, lastModified: f.lastModified, sheet_code: r ? r.sheet_code : null, code_source: r ? r.source : null, template: r ? r.template : null });
          files[S().itemKey(f.name, f.size, f.lastModified)] = f;
          i++;
          setTimeout(step, 0);
        });
      };
      step();
    });
  }

  function thumbnail(file) {
    return createImageBitmap(file, { resizeWidth: 440, resizeQuality: 'medium' }).catch(function () {
      return createImageBitmap(file);
    }).then(function (bmp) {
      var c = document.createElement('canvas');
      var w = Math.min(440, bmp.width), h = Math.round(bmp.height * w / bmp.width);
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(bmp, 0, 0, w, h);
      if (bmp.close) bmp.close();
      return c.toDataURL('image/jpeg', 0.7);
    });
  }

  /** Lets the rater pick one scan per repeated sheet code (spec 7.6). */
  function resolveDuplicates(dups) {
    return new Promise(function (resolve) {
      var choice = {};
      els.dupList.textContent = '';
      dups.forEach(function (d) {
        choice[d.sheet_code] = d.items[0].key;
        var g = document.createElement('div');
        g.className = 'dup-group';
        var h = document.createElement('h3');
        h.textContent = d.sheet_code;
        g.appendChild(h);
        var opts = document.createElement('div');
        opts.className = 'dup-options';
        d.items.forEach(function (it, idx) {
          var o = document.createElement('div');
          o.className = 'dup-option' + (idx === 0 ? ' chosen' : '');
          var img = document.createElement('img');
          img.alt = '';
          thumbnail(files[it.key]).then(function (url) { img.src = url; });
          var cap = document.createElement('div');
          cap.textContent = sess.mode === 'open' ? it.name : '#' + (idx + 1);
          o.appendChild(img);
          o.appendChild(cap);
          o.addEventListener('click', function () {
            choice[d.sheet_code] = it.key;
            Array.prototype.forEach.call(opts.children, function (x) { x.classList.remove('chosen'); });
            o.classList.add('chosen');
          });
          opts.appendChild(o);
        });
        g.appendChild(opts);
        els.dupList.appendChild(g);
      });
      els.dupDialog.hidden = false;
      els.dupContinue.onclick = function () {
        els.dupDialog.hidden = true;
        Object.keys(choice).forEach(function (code) { S().keepDuplicate(sess, code, choice[code]); });
        resolve();
      };
    });
  }

  /** Starts the session with the given files (folder, file selection or drop). */
  function begin(fileList) {
    if (running) return;
    var v = setupValues();
    if (!v.rater_code || !v.mode) {
      showSetupError(HUSS.t('need_rater_and_mode'));
      if (!v.rater_code) { els.inRater.classList.add('invalid'); els.inRater.focus(); }
      HUSS.ui.scorer.clear(HUSS.t('need_rater_and_mode'));
      return;
    }
    var list = Array.prototype.filter.call(fileList, isImage);
    var ignored = fileList.length - list.length;
    if (!list.length) { HUSS.ui.scorer.clear(HUSS.t('no_scans')); return; }
    list.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    showSetupError('');
    setup = v;
    running = true;
    els.cardSession.classList.add('running');
    els.setupBox.hidden = true;
    HUSS.ui.scorer.setProjectLocked(true);
    var params = HUSS.app.params();
    sess = S().create({
      project_code: v.project_code, rater_code: v.rater_code, mode: v.mode,
      exclusionIds: HUSS.measure.record.exclusionIds(params).slice(0, -1)
    });
    readCodes(list, params).then(function (results) {
      S().addItems(sess, results);
      if (subsample) sess.subsampleResult = S().restrictTo(sess, subsample);
      var dups = S().duplicates(sess);
      return dups.length ? resolveDuplicates(dups) : null;
    }).then(function () {
      var notes = [HUSS.t('files_found', { n: list.length })];
      if (ignored > 0) notes.push(HUSS.t('files_ignored', { n: ignored }));
      if (sess.subsampleResult) {
        var sr = sess.subsampleResult;
        notes.push(HUSS.t('subsample_applied', { found: sr.found, n: subsample.length, left: sr.left }));
        if (sr.missing.length) notes.push(HUSS.t('subsample_missing', { list: sr.missing.join(', ') }));
      }
      if (pendingCsv) {
        var res = S().applyRecords(sess, pendingCsv.records);
        notes.push(HUSS.t('resume_applied', { n: res.matched }));
        if (res.conflicts) notes.push(HUSS.t('resume_conflicts', { n: res.conflicts }));
      } else if (!els.autosaveRow.hidden && els.chkAutosave.checked) {
        var saved = A().load(autosaveKey());
        if (saved) {
          var r2 = S().applyRecords(sess, saved.records || []);
          S().applyDrafts(sess, saved.drafts || []);
          notes.push(HUSS.t('resume_applied', { n: r2.matched }));
        }
      }
      if (sess.setAside.length) notes.push(HUSS.t('session_set_aside', { n: sess.setAside.length }));
      if (sess.orphans.length) notes.push(HUSS.t('session_orphans', { n: sess.orphans.length }));
      els.sessionNotes.textContent = notes.join(' ');
      els.sessionNotes.hidden = !notes.length;
      els.running.hidden = false;
      S().goTo(sess, 0);
      var first = S().current(sess);
      if (first && first.status) { var n = S().nextIndex(sess); if (n >= 0) S().goTo(sess, n); }
      saveAutosave();
      openCurrent();
    });
  }

  function autosaveKey() {
    return A().key(setup.project_code, setup.rater_code, setup.mode);
  }

  // ------------------------------------------------------------ queue

  function itemContext(item) {
    var saved = item.record ? S().stateFromRecord(item.record) : item.draft ? S().stateFromRecord(item.draft) : null;
    var p = S().progress(sess);
    var title = S().isRead(item)
      ? HUSS.t('sheet_title', { code: item.sheet_code, pos: sess.index + 1, total: p.total })
      : HUSS.t('sheet_title_unread', { n: S().unreadNumber(sess, item), pos: sess.index + 1, total: p.total });
    var code = item.sheet_code || (saved && saved.meta.sheet_code) || '';
    return {
      mode: sess.mode, rater_code: sess.rater_code, project_code: sess.project_code,
      title: title, chip: item.status, sheetCode: code, codeSource: item.code_source, saved: saved,
      lookup: sess.mode === 'open' && tables.key ? HUSS.io.tables.lookup(tables.key, tables.structures, code) : null,
      tablesLoaded: !!tables.key, fileName: item.name, onChange: scheduleAutosave,
      onAligned: function (code, source) { return adoptCode(item, code, source); },
      finished: isComplete() && (item.status === 'measured' || item.status === 'excluded')
    };
  }

  /**
   * The code was read only after manual alignment (spec 7.5), from the QR code or the printed
   * characters: the scan gets it, unless another scan of this session already has it.
   * Returns the changed context fields.
   */
  function adoptCode(item, code, source) {
    if (!code || S().isRead(item)) return null;
    var taken = sess.items.some(function (o) { return o !== item && S().isRead(o) && o.sheet_code === code; });
    if (taken) return { qrTaken: code };
    item.sheet_code = code;
    item.code_source = source || 'qr';
    sess.dirty = true;
    updateSummary();
    var c = itemContext(item);
    return { title: c.title, sheetCode: c.sheetCode, codeSource: c.codeSource, lookup: c.lookup, qrAfterManual: true };
  }

  function openCurrent() {
    var item = S().current(sess);
    if (!item) return;
    openedAt = Date.now();
    updateSummary();
    HUSS.ui.scorer.openItem(files[item.key], itemContext(item));
  }

  /** Adds the time spent on the current drawing since it was opened. */
  function clock() {
    var item = S().current(sess);
    if (item && openedAt) { item.seconds += (Date.now() - openedAt) / 1000; openedAt = Date.now(); }
    return item;
  }

  /** Keeps the unconfirmed state of the current drawing (when leaving it or for autosave). */
  function keepDraft(item) {
    if (!HUSS.ui.scorer.session || item.record) return;
    var r = HUSS.ui.scorer.recordFor('draft', item.seconds);
    if (r.record) item.draft = r.record;
  }

  function isComplete() {
    var p = S().progress(sess);
    return p.total > 0 && p.done === p.total;
  }

  function confirm() {
    if (!running) return;
    if (HUSS.ui.scorer.finishMode) { downloadCsv(); return; }
    var item = clock();
    var r = HUSS.ui.scorer.recordFor('confirm', item.seconds);
    if (!r.record) return;
    S().setRecord(sess, item, r.record);
    item.draft = null;
    afterSave();
    advance();
  }

  function later() {
    if (!running) return;
    var item = clock();
    var r = HUSS.ui.scorer.recordFor('later', item.seconds);
    if (r.record) S().setRecord(sess, item, r.record);
    else { keepDraft(item); item.status = 'deferred'; sess.dirty = true; }
    afterSave();
    advance();
  }

  function previous() {
    if (!running || sess.index === 0) return;
    var item = clock();
    if (HUSS.ui.scorer.session && !item.record) keepDraft(item);
    S().goTo(sess, sess.index - 1);
    saveAutosave();
    openCurrent();
  }

  function advance() {
    var i = S().nextIndex(sess);
    if (i < 0) {
      updateSummary();
      reminders();
      // Everything scored: stay on this drawing; the main button now downloads the CSV.
      if (isComplete()) HUSS.ui.scorer.setFinishMode(true);
      return;
    }
    S().goTo(sess, i);
    openCurrent();
  }

  function afterSave() {
    saveAutosave();
    updateSummary();
    reminders();
  }

  function scheduleAutosave() {
    if (!running) return;
    sess.dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      var item = S().current(sess);
      if (item && !item.record) {
        var r = HUSS.ui.scorer.recordFor('draft', item.seconds + (openedAt ? (Date.now() - openedAt) / 1000 : 0));
        if (r.record) item.draft = r.record;
      }
      saveAutosave();
    }, 800);
  }

  function saveAutosave() {
    if (!sess) return;
    A().save(autosaveKey(), S().toSaved(sess));
  }

  function updateSummary() {
    if (!sess) return;
    var p = S().progress(sess);
    var text = HUSS.t('session_summary', {
      rater: sess.rater_code, mode: HUSS.t(sess.mode === 'open' ? 'mode_open' : 'mode_blind'), done: p.done, total: p.total
    });
    if (p.deferred) text += ' · ' + HUSS.t('session_later', { n: p.deferred });
    els.summary.textContent = text;
  }

  function reminders() {
    var p = S().progress(sess);
    var msg = null;
    if (p.done === p.total && sess.dirty) msg = HUSS.t('reminder_done', { n: p.total });
    else if (sess.confirmsSinceDownload >= 20) msg = HUSS.t('reminder_20', { n: sess.confirmsSinceDownload });
    els.reminder.textContent = msg || '';
    els.reminder.hidden = !msg;
  }

  // ------------------------------------------------------------ downloads

  function baseName() {
    return HUSS.measure.record.fileName({ project_code: setup.project_code, rater_code: setup.rater_code, mode: setup.mode },
      new Date(), HUSS.config.DEFAULTS.file_project_fallback);
  }

  function downloadCsv() {
    if (!sess) return;
    var name = baseName();
    HUSS.io.files.downloadText(name, HUSS.io.csv.toCSV(S().records(sess), S().columns(sess)));
    S().markDownloaded(sess);
    els.downloadStatus.textContent = HUSS.t('downloaded', { file: name });
    els.downloadStatus.hidden = false;
    reminders();
  }

  function downloadExcel() {
    if (!sess) return;
    var name = baseName().replace(/\.csv$/, '_excel-view.csv');
    HUSS.io.files.downloadText(name, HUSS.io.csv.toExcelView(S().records(sess), S().columns(sess)));
  }

  function newSession() {
    if (sess && sess.dirty && !window.confirm(HUSS.t('new_session_confirm'))) return;
    if (sess) sess.dirty = false;
    window.location.reload();
  }

  function init() {
    els = {
      inProject: $('in-project'), inRater: $('in-rater'), modeBlind: $('mode-blind'), modeOpen: $('mode-open'),
      cardSession: $('card-session'), setupBox: $('session-setup'), running: $('session-running'),
      setupError: $('setup-error'), resumeStatus: $('resume-status'), autosaveRow: $('autosave-row'),
      autosaveText: $('autosave-text'), chkAutosave: $('chk-autosave'), openTables: $('open-tables'), tablesStatus: $('tables-status'),
      summary: $('session-summary'), sessionNotes: $('session-notes'), reminder: $('reminder'), downloadStatus: $('download-status'),
      btnCsv: $('btn-download-csv'), btnExcel: $('btn-download-excel'), btnNew: $('btn-new-session'),
      dupDialog: $('dup-dialog'), dupList: $('dup-list'), dupContinue: $('dup-continue')
    };
    HUSS.ui.scorer.setActions({ confirm: confirm, previous: previous, later: later });
    els.btnCsv.addEventListener('click', downloadCsv);
    els.btnExcel.addEventListener('click', downloadExcel);
    els.btnNew.addEventListener('click', newSession);
    [els.inRater, els.inProject].forEach(function (i) { i.addEventListener('input', setupChanged); });
    [els.modeBlind, els.modeOpen].forEach(function (r) { r.addEventListener('change', setupChanged); });
    window.addEventListener('beforeunload', function (e) {
      if (sess && sess.dirty) { e.preventDefault(); e.returnValue = HUSS.t('unload_warning'); return e.returnValue; }
    });
    setupChanged();
  }

  HUSS.ui.queue = {
    init: init, begin: begin, setPendingCsv: setPendingCsv, setSubsample: setSubsample, setTable: setTable, setupChanged: setupChanged,
    confirm: confirm, previous: previous, later: later, downloadCsv: downloadCsv, downloadExcel: downloadExcel,
    get session() { return sess; }, get running() { return running; }, get tables() { return tables; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
