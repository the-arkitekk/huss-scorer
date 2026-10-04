/* HuSS Scorer — js/ui/sheetgen.js
 * Sheet generator screen (spec 8.3): coded sheets with QR, print view (true size, one sheet
 * per page), PDF download and the code list CSV (sheet_code, template, generated_at).
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.ui = HUSS.ui || {};

  var MAX_SHEETS = 500;
  var els = {}, last = null;

  function $(id) { return document.getElementById(id); }

  function template() {
    return HUSS.sheet.template.get(els.template.value);
  }

  function excluded() {
    return HUSS.sheet.code.extract(els.exclude.value);
  }

  function updateExcludeInfo() {
    var n = excluded().length;
    els.excludeInfo.textContent = n ? HUSS.t('sg_exclude_info', { n: n }) : '';
  }

  function setStatus(text, cls) {
    els.status.textContent = text;
    els.status.className = 'small' + (cls ? ' ' + cls : '');
  }

  function stamp(d) {
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  function baseName() {
    var proj = HUSS.app.state.project;
    return (proj ? proj.project_code : HUSS.config.DEFAULTS.file_project_fallback) + (last.calibration ? '_calibration_' : '_sheets_') + stamp(last.generatedAt);
  }

  function generate() {
    var n = parseInt(els.count.value, 10);
    if (!(n >= 1 && n <= MAX_SHEETS)) { setStatus(HUSS.t('sg_bad_count', { max: MAX_SHEETS }), 'bad'); return; }
    var label = els.label.value.trim();
    if (!label || label.length > 20) { setStatus(HUSS.t('sg_bad_label'), 'bad'); return; }
    var T = template();
    var codes = HUSS.sheet.code.batch(n, excluded(), HUSS.sheet.code.secureRandom);
    var cal = els.calibration.checked;
    last = { template: T, label: label, codes: codes, generatedAt: new Date(), back: els.back.checked && !cal, calibration: cal };
    els.preview.innerHTML = front(codes[0], 0) + (last.back ? HUSS.sheet.svg.back(T, codes[0]) : '');
    els.csv.textContent = HUSS.t(cal ? 'sg_cal_key' : 'sg_csv');
    els.check.textContent = HUSS.t('sg_check', { mm: T.corners[1][0] - T.corners[0][0] });
    els.codes.textContent = HUSS.t('sg_codes', { list: codes.join(', ') });
    els.result.hidden = false;
    setStatus(HUSS.t(cal ? 'sg_cal_done' : 'sg_done', { n: n, template: T.id }), 'ok');
  }

  /** SVG of the front of sheet i: a normal sheet, or a calibration sheet (layout i). */
  function front(code, i) {
    return last.calibration ? HUSS.sheet.svg.calibration(last.template, code, last.label, i) : HUSS.sheet.svg.sheet(last.template, code, last.label);
  }

  function print() {
    if (!last) return;
    var T = last.template;
    els.printRoot.innerHTML = last.codes.map(function (c, i) {
      return front(c, i) + (last.back ? HUSS.sheet.svg.back(T, c) : '');
    }).join('');
    els.pageStyle.textContent = '@page { size: ' + T.width_mm + 'mm ' + T.height_mm + 'mm; margin: 0; }';
    window.print();
  }

  function clearPrint() {
    els.printRoot.innerHTML = '';
  }

  function downloadPdf() {
    if (!last) return;
    var opts = { back: last.back };
    if (last.calibration) opts.itemsFor = function (code, i) { return HUSS.sheet.template.calibrationItems(last.template, code, last.label, i); };
    HUSS.io.files.downloadBytes(baseName() + '.pdf', HUSS.sheet.pdf.sheets(last.template, last.codes, last.label, opts), 'application/pdf');
  }

  function downloadCsv() {
    if (!last) return;
    if (last.calibration) {
      HUSS.io.files.downloadText(baseName() + '_calibration-key.csv', HUSS.report.calibration.keyToCSV(last.template, last.codes, last.generatedAt));
      return;
    }
    var when = HUSS.measure.record.isoLocal(last.generatedAt);
    var lines = ['sheet_code,template,generated_at'].concat(last.codes.map(function (c) {
      return c + ',' + last.template.id + ',' + when;
    }));
    HUSS.io.files.downloadText(baseName() + '.csv', lines.join('\r\n') + '\r\n');
  }

  /** Called when the screen is shown: template and label follow the loaded project. */
  function onShow() {
    var p = HUSS.app.state.project;
    if (p) {
      els.template.value = p.template;
      els.template.disabled = true;
      els.templateNote.hidden = false;
      els.label.value = p.sheet_label;
    } else {
      els.template.disabled = false;
      els.templateNote.hidden = true;
      if (!els.label.value) els.label.value = HUSS.config.DEFAULTS.sheet_label;
    }
  }

  function init() {
    els = {
      template: $('sg-template'), templateNote: $('sg-template-note'), label: $('sg-label'), count: $('sg-count'),
      exclude: $('sg-exclude'), excludeInfo: $('sg-exclude-info'), loadList: $('sg-load-list'), listInput: $('sg-list-input'),
      generate: $('sg-generate'), back: $('sg-back'), calibration: $('sg-calibration'), status: $('sg-status'), result: $('sg-result'), check: $('sg-check'),
      print: $('sg-print'), pdf: $('sg-pdf'), csv: $('sg-csv'), codes: $('sg-codes'), preview: $('sg-preview'),
      printRoot: $('print-root'), pageStyle: $('print-page-style')
    };
    els.label.value = HUSS.config.DEFAULTS.sheet_label;
    els.generate.addEventListener('click', generate);
    els.print.addEventListener('click', print);
    els.pdf.addEventListener('click', downloadPdf);
    els.csv.addEventListener('click', downloadCsv);
    els.exclude.addEventListener('input', updateExcludeInfo);
    els.loadList.addEventListener('click', function () { els.listInput.value = ''; els.listInput.click(); });
    els.listInput.addEventListener('change', function () {
      var f = els.listInput.files && els.listInput.files[0];
      if (!f) return;
      HUSS.io.files.readText(f).then(function (text) {
        var have = excluded(), add = HUSS.sheet.code.extract(text).filter(function (c) { return have.indexOf(c) < 0; });
        els.exclude.value = (els.exclude.value.trim() ? els.exclude.value.trim() + '\n' : '') + add.join(' ');
        updateExcludeInfo();
      });
    });
    window.addEventListener('afterprint', clearPrint);
  }

  HUSS.ui.sheetgen = { init: init, onShow: onShow, get last() { return last; } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
