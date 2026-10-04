/* HuSS Scorer — js/app.js
 * Start-up: fills interface texts from strings.en.js, switches screens, holds the loaded project.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};

  var state = { project: null, screen: 'score' };
  var SCREENS = { score: 'screen-score', sheets: 'screen-sheets', project: 'screen-project' };

  function applyStrings(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll('[data-s]'), function (el) {
      el.textContent = HUSS.t(el.getAttribute('data-s'));
    });
    Array.prototype.forEach.call(scope.querySelectorAll('[data-s-placeholder]'), function (el) {
      el.placeholder = HUSS.t(el.getAttribute('data-s-placeholder'));
    });
    Array.prototype.forEach.call(scope.querySelectorAll('[data-s-title]'), function (el) {
      el.title = HUSS.t(el.getAttribute('data-s-title'));
      el.setAttribute('aria-label', el.title);
    });
  }

  /** Scoring parameters: from the loaded project, otherwise the tool defaults. */
  function params() {
    return state.project ? HUSS.io.project.paramsOf(state.project) : Object.assign({}, HUSS.config.DEFAULTS,
      { suggestions: { figure: true, ceiling: true, wall: true } });
  }

  function show(name) {
    state.screen = name;
    Object.keys(SCREENS).forEach(function (k) {
      document.getElementById(SCREENS[k]).hidden = k !== name;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-screen') === name);
    });
    document.getElementById('btn-open').hidden = name !== 'score';
    if (name === 'sheets') HUSS.ui.sheetgen.onShow();
    if (name === 'score') HUSS.ui.scorer.onShow();
  }

  function setProject(p) {
    state.project = p;
    HUSS.ui.scorer.projectChanged();
  }

  function init() {
    applyStrings(document);
    document.title = HUSS.t('app_title');
    document.getElementById('version').textContent = 'v' + HUSS.config.TOOL_VERSION + ' · rules ' + HUSS.config.RULES_VERSION;
    HUSS.ui.scorer.init(HUSS.config);
    HUSS.ui.start.init();
    HUSS.ui.sheetgen.init();
    HUSS.ui.projectForm.init();
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
      b.addEventListener('click', function () { show(b.getAttribute('data-screen')); });
    });
  }

  HUSS.app = { init: init, applyStrings: applyStrings, params: params, show: show, setProject: setProject, state: state };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof globalThis !== 'undefined' ? globalThis : this);
