/* HuSS Scorer — js/ui/home.js
 * The main menu shown when the tool opens (and when "HuSS Scorer" at the top left is clicked):
 * new project, open a project file, continue the last project, or try without a project; links to
 * the calibration test and the guide. The last project is kept in this browser.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.ui = HUSS.ui || {};

  var LAST = 'huss:v1:project:last', ENTER = 'huss:v1:enter';
  var els = {};

  function $(id) { return document.getElementById(id); }

  function lastProject() {
    var saved = HUSS.io.autosave.load(LAST);
    if (!saved || !saved.project) return null;
    var v = HUSS.io.project.validate(saved.project);
    return v.ok ? { project: v.project, used_at: saved.used_at } : null;
  }

  function remember(p) {
    if (p) HUSS.io.autosave.save(LAST, { project: p, used_at: new Date().toISOString() });
  }

  function running() {
    return !!(HUSS.ui.queue && HUSS.ui.queue.running);
  }

  /**
   * Opens a project (null: without a project) and goes to a screen. A scoring session belongs to
   * its project: switching project during a session starts the tool afresh (after a warning when
   * there are changes not yet downloaded); the session itself stays in the autosave.
   * opts.demo: the example project (not remembered as the last project). Returns false when the
   * tool is reloaded for the switch.
   */
  function enter(p, screen, opts) {
    var demo = !!(opts && opts.demo);
    var cur = HUSS.app.state.project, same = (cur && p && cur.project_code === p.project_code) || (!cur && !p && HUSS.app.state.inProject);
    if (running() && !same) {
      var sess = HUSS.ui.queue.session;
      if (sess && sess.dirty && !window.confirm(HUSS.t('home_switch_confirm'))) return false;
      if (sess) sess.dirty = false;
      if (p && !demo) remember(p);
      HUSS.io.autosave.save(ENTER, { project: p ? p.project_code : null, screen: screen, demo: demo });
      window.location.reload();
      return false;
    }
    if (p && !demo) remember(p);
    HUSS.app.setProject(p);
    HUSS.app.state.inProject = true;
    HUSS.app.show(screen || 'score');
    return true;
  }

  /** The example scans (demo/demo-scans.js, a classic script so it also loads from disk). */
  function loadDemo() {
    if (HUSS.demoData) return Promise.resolve(HUSS.demoData);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'demo/demo-scans.js';
      s.onload = function () { if (HUSS.demoData) resolve(HUSS.demoData); else reject(new Error('demo')); };
      s.onerror = function () { reject(new Error('demo')); };
      document.head.appendChild(s);
    });
  }

  /** Main menu -> Try with example scans: the example project, ten scans, an Open mode session at once. */
  function startDemo() {
    els.error.hidden = true;
    els.demo.disabled = true;
    els.demoSub.textContent = HUSS.t('home_demo_loading');
    loadDemo().then(function (d) {
      els.demo.disabled = false;
      els.demoSub.textContent = HUSS.t('home_demo_sub');
      var p = HUSS.io.project.validate(JSON.parse(JSON.stringify(d.project))).project;
      var cur = HUSS.app.state.project, again = running() && cur && cur.project_code === p.project_code;
      if (!enter(p, 'score', { demo: true }) || again) return; // reloading for the switch, or the example is already open
      var files = d.scans.map(function (sc, i) {
        var bin = atob(sc.data), bytes = new Uint8Array(bin.length);
        for (var k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
        return new File([bytes], sc.name, { type: 'image/jpeg', lastModified: Date.UTC(2026, 9, 5, 12, 0, i) });
      });
      HUSS.ui.queue.startWith(files, { rater_code: 'DEMO', mode: 'open' });
    }).catch(function () {
      els.demo.disabled = false;
      els.demoSub.textContent = HUSS.t('home_demo_sub');
      els.error.textContent = HUSS.t('home_demo_error');
      els.error.hidden = false;
    });
  }

  function render() {
    var last = lastProject(), cur = HUSS.app.state.project, inProject = HUSS.app.state.inProject;
    els.cont.hidden = !last || (cur && last.project.project_code === cur.project_code && inProject);
    if (last) {
      els.contTitle.textContent = HUSS.t('home_continue', { code: last.project.project_code });
      els.contSub.textContent = (last.project.title ? last.project.title + ' · ' : '') + HUSS.t('home_last_used', { when: (last.used_at || '').slice(0, 10) });
    }
    els.current.hidden = !inProject;
    if (inProject) {
      els.currentText.textContent = cur ? HUSS.t('home_current', { code: cur.project_code, title: cur.title ? ' — ' + cur.title : '' }) : HUSS.t('home_current_none');
      els.edit.hidden = !cur;
    }
    els.error.hidden = true;
  }

  function openFile(file) {
    HUSS.io.files.readText(file).then(function (text) {
      var r = HUSS.io.project.parse(text);
      if (!r.ok) {
        els.error.textContent = HUSS.t('project_bad_file', { list: HUSS.ui.projectForm.describe(r.errors) });
        els.error.hidden = false;
        return;
      }
      enter(r.project, 'score');
    });
  }

  function show() {
    render();
    HUSS.app.show('home');
  }

  /** At start-up: a project switch that reloaded the tool goes straight to the chosen project. */
  function start() {
    var pending = HUSS.io.autosave.load(ENTER);
    if (pending) {
      HUSS.io.autosave.remove(ENTER);
      var last = lastProject();
      if (pending.demo) { startDemo(); return; }
      if (pending.project && last && last.project.project_code === pending.project) { enter(last.project, pending.screen); return; }
      if (!pending.project) { enter(null, pending.screen); return; }
    }
    show();
  }

  function init() {
    els = {
      cont: $('home-continue'), contTitle: $('home-continue-title'), contSub: $('home-continue-sub'),
      current: $('home-current'), currentText: $('home-current-text'), edit: $('home-edit'),
      input: $('home-project-input'), error: $('home-error'), demo: $('home-demo'), demoSub: $('home-demo').querySelector('span')
    };
    els.demo.addEventListener('click', startDemo);
    $('home-new').addEventListener('click', function () { HUSS.ui.projectForm.openNew(); });
    $('home-open').addEventListener('click', function () { els.input.value = ''; els.input.click(); });
    els.input.addEventListener('change', function () { if (els.input.files[0]) openFile(els.input.files[0]); });
    els.cont.addEventListener('click', function () { var l = lastProject(); if (l) enter(l.project, 'score'); });
    $('home-back').addEventListener('click', function () { HUSS.app.show(HUSS.app.state.lastScreen || 'score'); });
    els.edit.addEventListener('click', function () { HUSS.ui.projectForm.openEdit(HUSS.app.state.project); });
    $('home-noproject').addEventListener('click', function () { enter(null, 'score'); });
    $('home-calibration').addEventListener('click', function () { HUSS.app.state.inProject = HUSS.app.state.inProject || false; HUSS.app.show('calibration'); });
    $('home-guide').addEventListener('click', function () { HUSS.app.show('guide'); });
    $('brand').addEventListener('click', show);
  }

  HUSS.ui.home = { init: init, show: show, start: start, enter: enter, remember: remember, lastProject: lastProject };
})(typeof globalThis !== 'undefined' ? globalThis : this);
