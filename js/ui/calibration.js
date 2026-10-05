/* HuSS Scorer — js/ui/calibration.js
 * Calibration test (spec 10.3), opened from the main menu: print calibration sheets with their
 * key, score the scans, compare the measured lengths with the printed ones. Once per printer and
 * scanner, outside the normal workflow.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.ui = HUSS.ui || {};

  var LAYOUTS = 10;
  var els = {}, made = null, key = null, keyName = null, files = [];

  function $(id) { return document.getElementById(id); }

  function template() { return HUSS.sheet.template.get(els.template.value); }

  /** Ten sheet codes for this visit (made once, so the PDF and the key always match). */
  function sheets() {
    if (!made || made.template.id !== template().id) {
      made = { template: template(), codes: HUSS.sheet.code.batch(LAYOUTS, [], HUSS.sheet.code.secureRandom), at: new Date() };
      els.codes.textContent = HUSS.t('sg_codes', { list: made.codes.join(', ') });
    }
    return made;
  }

  function label() {
    var p = HUSS.app.state.project;
    return p ? p.sheet_label : HUSS.config.DEFAULTS.sheet_label;
  }

  function base() {
    var d = sheets().at, pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return 'HuSS_calibration_' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes());
  }

  function pdf() {
    var m = sheets();
    HUSS.io.files.downloadBytes(base() + '.pdf', HUSS.sheet.pdf.sheets(m.template, m.codes, label(), {
      itemsFor: function (code, i) { return HUSS.sheet.template.calibrationItems(m.template, code, label(), i); }
    }), 'application/pdf');
  }

  function print() {
    var m = sheets(), rootEl = $('print-root');
    rootEl.innerHTML = m.codes.map(function (c, i) { return HUSS.sheet.svg.calibration(m.template, c, label(), i); }).join('');
    $('print-page-style').textContent = '@page { size: ' + m.template.width_mm + 'mm ' + m.template.height_mm + 'mm; margin: 0; }';
    window.print();
  }

  function keyText() {
    var m = sheets();
    return HUSS.report.calibration.keyToCSV(m.template, m.codes, m.at);
  }

  function currentKey() {
    if (key) return { table: key, name: keyName };
    if (made) return { table: HUSS.report.calibration.parseKey(keyText()), name: null };
    return null;
  }

  function render() {
    var live = HUSS.ui.results.liveSource(), recs = [];
    if (live) recs = recs.concat(live.records);
    files.forEach(function (f) { recs = recs.concat(f.records); });
    var k = currentKey();
    els.sources.textContent = HUSS.t('cal_sources', {
      n: recs.length,
      key: !k ? HUSS.t('cal_key_none') : k.name ? HUSS.t('cal_key_file', { name: k.name, n: Object.keys(k.table.rows).length }) : HUSS.t('cal_key_this', { n: Object.keys(k.table.rows).length })
    });
    els.result.innerHTML = k && recs.length ? HUSS.report.calibration.html(HUSS.report.calibration.check(recs, k.table)) : '';
  }

  function onShow() { sheets(); render(); }

  function init() {
    els = {
      template: $('cal-template'), codes: $('cal-codes'), sources: $('cal-sources'), result: $('cal-result'),
      csvInput: $('cal-csv-input'), keyInput: $('cal-key-input')
    };
    els.template.addEventListener('change', function () { made = null; sheets(); render(); });
    $('cal-pdf').addEventListener('click', pdf);
    $('cal-print').addEventListener('click', print);
    $('cal-key').addEventListener('click', function () { HUSS.io.files.downloadText(base() + '_key.csv', keyText()); });
    $('cal-menu').addEventListener('click', function () { HUSS.ui.home.show(); });
    $('cal-add-csv').addEventListener('click', function () { els.csvInput.value = ''; els.csvInput.click(); });
    $('cal-load-key').addEventListener('click', function () { els.keyInput.value = ''; els.keyInput.click(); });
    els.csvInput.addEventListener('change', function () {
      Promise.all(Array.prototype.map.call(els.csvInput.files, function (f) {
        return HUSS.io.files.readText(f).then(function (t) {
          var r = HUSS.io.csv.readMeasurements(t);
          if (r.ok) files.push({ name: f.name, records: r.records });
        });
      })).then(render);
    });
    els.keyInput.addEventListener('change', function () {
      var f = els.keyInput.files[0];
      if (!f) return;
      HUSS.io.files.readText(f).then(function (t) {
        var k = HUSS.report.calibration.parseKey(t);
        if (k.ok) { key = k; keyName = f.name; render(); }
        else els.result.innerHTML = '<p class="rp-note">' + HUSS.report.charts.esc(HUSS.t('cal_bad', { name: f.name })) + '</p>';
      });
    });
  }

  HUSS.ui.calibration = { init: init, onShow: onShow };
})(typeof globalThis !== 'undefined' ? globalThis : this);
