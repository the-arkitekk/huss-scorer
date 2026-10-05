/* HuSS Scorer — js/ui/guide.js
 * Guide and About screen (spec 8.8), built from the texts in strings.en.js.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.ui = HUSS.ui || {};

  function el(tag, text, cls) {
    var e = document.createElement(tag);
    if (text != null) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }

  function list(tag, key, params) {
    var l = el(tag);
    HUSS.t(key, params).split('\n').forEach(function (line) { l.appendChild(el('li', line)); });
    return l;
  }

  function init() {
    var g = document.getElementById('guide'), C = HUSS.config;
    var v = { version: C.TOOL_VERSION, rules: C.RULES_VERSION, v: C.RULES_VERSION, year: new Date().getFullYear() };
    g.appendChild(el('h1', HUSS.t('gd_title')));
    g.appendChild(el('p', HUSS.t('gd_intro')));
    g.appendChild(el('h2', HUSS.t('gd_quick_title')));
    g.appendChild(list('ol', 'gd_quick'));
    g.appendChild(el('h2', HUSS.t('gd_rules_title', v)));
    g.appendChild(list('ol', 'gd_rules'));
    g.appendChild(el('p', HUSS.t('gd_estimates')));
    g.appendChild(el('h2', HUSS.t('gd_report_title')));
    g.appendChild(list('ul', 'gd_report'));
    g.appendChild(el('h2', HUSS.t('gd_keys_title')));
    g.appendChild(list('ul', 'gd_keys'));
    g.appendChild(el('h2', HUSS.t('gd_files_title')));
    g.appendChild(list('ul', 'gd_files'));
    g.appendChild(el('h2', HUSS.t('gd_cite_title')));
    g.appendChild(el('p', HUSS.t('gd_cite', v), 'cite'));
    g.appendChild(el('p', HUSS.t('gd_cite_note'), 'small muted'));
    g.appendChild(el('h2', HUSS.t('gd_about_title')));
    g.appendChild(list('ul', 'gd_about', v));
  }

  HUSS.ui.guide = { init: init };
})(typeof globalThis !== 'undefined' ? globalThis : this);
