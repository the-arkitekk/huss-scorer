/* HuSS Scorer — js/app.js
 * Start-up: fills interface texts from strings.en.js and starts the screens.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};

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

  function init() {
    applyStrings(document);
    document.title = HUSS.t('app_title');
    document.getElementById('version').textContent = 'v' + HUSS.config.TOOL_VERSION + ' · rules ' + HUSS.config.RULES_VERSION;
    HUSS.ui.scorer.init(HUSS.config);
    HUSS.ui.start.init();
  }

  HUSS.app = { init: init, applyStrings: applyStrings };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof globalThis !== 'undefined' ? globalThis : this);
