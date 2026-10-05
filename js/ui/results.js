/* HuSS Scorer — js/ui/results.js
 * Results screen: Merge (spec 8.6) and the Report with charts. Measurement CSVs, the key table
 * and the structures table are merged in the browser; nothing leaves the computer.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.ui = HUSS.ui || {};

  var els = {};
  var files = [];                                   // [{ name, records, exclusionIds }]
  var tables = { key: null, structures: null };     // loaded on this screen from files (override the study's)
  var merged = null, model = null;
  var raterPick = null;                            // the rater chosen in the report bar ('' = all), null = default

  function $(id) { return document.getElementById(id); }

  function projectBase() {
    var ps = merged && merged.projects.length ? merged.projects : [];
    return ps.length === 1 ? ps[0] : HUSS.config.DEFAULTS.file_project_fallback;
  }

  // ------------------------------------------------------------ inputs

  function readFiles(list) {
    var errors = [];
    var jobs = Array.prototype.map.call(list, function (f) {
      return HUSS.io.files.readText(f).then(function (text) {
        var r = HUSS.io.csv.readMeasurements(text);
        if (!r.ok) {
          var why = r.error === 'excel_view' ? HUSS.t('res_err_excel') : r.error === 'parse_error' ? HUSS.t('res_err_parse', { detail: r.detail }) : HUSS.t('res_err_not');
          errors.push(HUSS.t('res_bad_file', { name: f.name, why: why }));
          return;
        }
        files = files.filter(function (x) { return x.name !== f.name; }); // the same file again replaces it
        files.push({ name: f.name, records: r.records, exclusionIds: r.exclusionIds });
      });
    });
    Promise.all(jobs).then(function () {
      els.fileErrors.hidden = !errors.length;
      els.fileErrors.textContent = errors.join(' ');
      update();
    });
  }

  /**
   * The drawings scored in this browser tab (Score screen): used without downloading and adding
   * the CSV first. null when nothing has been scored yet.
   */
  function liveSource() {
    var Q = HUSS.ui.queue, sess = Q && Q.session;
    if (!sess) return null;
    var recs = HUSS.io.session.records(sess);
    if (!recs.length) return null;
    return { name: HUSS.t('res_session_name', { rater: sess.rater_code, n: recs.length }), records: recs, exclusionIds: sess.exclusionIds, live: true };
  }

  function sources() {
    var live = liveSource();
    return live ? [live].concat(files) : files.slice();
  }

  /**
   * Key, structures and default structure used for E: files loaded on this screen first, then the
   * study's own (the Tables screen's key, the project's structures), then the tables loaded for
   * Open mode on the Score screen. A one-structure project needs no key.
   */
  function currentTables() {
    var s = HUSS.app.studyTables(), q = HUSS.ui.queue && HUSS.ui.queue.tables;
    return {
      key: tables.key || s.key || (q && q.key) || null,
      structures: tables.structures || s.structures || (q && q.structures) || null,
      defaultStructure: tables.key ? null : s.defaultStructure,
      from: { key: tables.key ? 'file' : s.key ? 'tables' : q && q.key ? 'score' : null, structures: tables.structures ? 'file' : s.structures ? 'project' : q && q.structures ? 'score' : null }
    };
  }

  function loadTable(kind, file) {
    HUSS.io.files.readText(file).then(function (text) {
      var r = kind === 'key' ? HUSS.io.tables.parseKey(text) : HUSS.io.tables.parseStructures(text);
      tables[kind] = r;
      els.tableErrors.hidden = r.ok;
      els.tableErrors.textContent = r.ok ? '' : HUSS.t('res_table_errors', { name: file.name, n: r.errors.length });
      update();
    });
  }

  // ------------------------------------------------------------ rendering

  function count(t) { return t && t.rows ? Object.keys(t.rows).length : 0; }

  function renderInputs() {
    els.files.textContent = '';
    var live = liveSource();
    if (live) {
      var lli = document.createElement('li'), ls = document.createElement('span');
      ls.textContent = live.name;
      lli.appendChild(ls);
      els.files.appendChild(lli);
    }
    if (!files.length && !live) {
      var li = document.createElement('li');
      li.className = 'muted';
      li.textContent = HUSS.t('res_none');
      els.files.appendChild(li);
    }
    files.forEach(function (f, idx) {
      var li = document.createElement('li'), span = document.createElement('span'), b = document.createElement('button');
      var uniq = function (k) { var o = {}; f.records.forEach(function (r) { if (r[k]) o[r[k]] = true; }); return Object.keys(o).join(', ') || '–'; };
      span.textContent = HUSS.t('res_file_line', { name: f.name, n: f.records.length, raters: uniq('rater_code'), projects: uniq('project_code') });
      b.type = 'button'; b.className = 'btn btn-xs'; b.textContent = HUSS.t('res_remove');
      b.addEventListener('click', function () { files.splice(idx, 1); update(); });
      li.appendChild(span); li.appendChild(b);
      els.files.appendChild(li);
    });
    var t = currentTables(), parts = [];
    // Several structures and no key: the report cannot show any error yet; say so where it is seen.
    var unknown = merged && count(t.structures) > 1 ? merged.problems.no_structure : [];
    var needKey = unknown.length > 0;
    parts.push(t.structures ? HUSS.t('res_st_from_' + t.from.structures, { n: count(t.structures) }) : HUSS.t('res_st_none'));
    if (t.key) parts.push(HUSS.t('res_key_from_' + t.from.key, { n: count(t.key) }));
    else if (!needKey) parts.push(HUSS.t(t.defaultStructure ? 'res_key_single' : 'res_key_none', { code: t.defaultStructure }));
    els.tablesStatus.textContent = parts.join(' ');
    els.keyNeeded.hidden = !needKey;
    if (needKey) els.keyNeededText.textContent = HUSS.t('res_key_needed', { k: unknown.length, n: count(t.structures), list: unknown.slice(0, 20).join(', ') + (unknown.length > 20 ? ', …' : '') });
    els.useScreen.hidden = !tables.key && !tables.structures;
  }

  function renderRaters() {
    var raters = merged ? merged.raters : [];
    els.rater.textContent = '';
    var add = function (value, label) {
      var o = document.createElement('option');
      o.value = value; o.textContent = label;
      els.rater.appendChild(o);
    };
    if (raters.length !== 1) add('', HUSS.t('res_all_raters'));
    raters.forEach(function (r) { add(r, r); });
    // Several raters: one rater's records by default (each drawing once), the one with the most.
    if (raterPick !== null && (raters.indexOf(raterPick) >= 0 || (raterPick === '' && raters.length !== 1))) els.rater.value = raterPick;
    else if (raters.length) {
      var most = raters.slice().sort(function (a, b) {
        var n = function (x) { return merged.rows.filter(function (r) { return r.rater_code === x; }).length; };
        return n(b) - n(a);
      })[0];
      els.rater.value = most;
    }
  }

  function renderReport() {
    if (!merged || !merged.rows.length) {
      model = null;
      els.report.innerHTML = '<p class="small muted">' + HUSS.report.charts.esc(HUSS.t('res_empty')) + '</p>';
      els.print.disabled = els.dlHtml.disabled = true;
      return;
    }
    model = HUSS.report.build.model(merged, { rater: els.rater.value || null, method: els.method.value, show: els.show.value, generatedAt: new Date() });
    els.report.innerHTML = HUSS.report.build.fragment(model); // all text in it is escaped by the builder
    Array.prototype.forEach.call(els.report.querySelectorAll('.rp-fig'), addChartTools);
    els.print.disabled = els.dlHtml.disabled = false;
  }

  function update() {
    var t = currentTables();
    var src = sources();
    merged = src.length ? HUSS.io.merge.merge(src, t.key, t.structures, { defaultStructure: t.defaultStructure }) : null;
    renderInputs();
    els.merged.textContent = merged ? HUSS.t('res_merged', { n: merged.counts.rows, m: merged.counts.measured, e: merged.counts.excluded }) : '';
    els.dlMerged.disabled = els.dlExcel.disabled = !merged;
    renderRaters();
    renderReport();
  }

  // ------------------------------------------------------------ exports

  function chartName(fig, ext) {
    return projectBase() + '_' + fig.getAttribute('data-chart') + '.' + ext;
  }

  function svgOf(fig) {
    var svg = fig.querySelector('svg');
    return svg ? svg.outerHTML : '';
  }

  /** PNG at twice the chart size, drawn from the chart's own SVG (white background included). */
  function downloadPng(fig) {
    var svg = svgOf(fig), el = fig.querySelector('svg');
    var w = Number(el.getAttribute('width')), h = Number(el.getAttribute('height')), scale = 2;
    var url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    var img = new Image();
    img.onload = function () {
      var c = document.createElement('canvas');
      c.width = w * scale; c.height = h * scale;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(function (blob) {
        blob.arrayBuffer().then(function (buf) { HUSS.io.files.downloadBytes(chartName(fig, 'png'), new Uint8Array(buf), 'image/png'); });
      }, 'image/png');
    };
    img.src = url;
  }

  function addChartTools(fig) {
    var bar = document.createElement('div');
    bar.className = 'rp-tools';
    [['res_svg', function () { HUSS.io.files.downloadText(chartName(fig, 'svg'), svgOf(fig), 'image/svg+xml;charset=utf-8'); }],
      ['res_png', function () { downloadPng(fig); }]].forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'btn btn-xs'; b.textContent = HUSS.t(t[0]);
      b.addEventListener('click', t[1]);
      bar.appendChild(b);
    });
    fig.appendChild(bar);
  }

  function printReport() {
    if (!model) return;
    var rootEl = $('print-root'), style = $('print-page-style');
    rootEl.innerHTML = '<div class="rp-print">' + HUSS.report.build.headerHtml(model) + HUSS.report.build.fragment(model) + '</div>';
    style.textContent = '@page { size: A4 portrait; margin: 12mm; }' +
      '#print-root .rp-print svg { break-after: auto !important; page-break-after: auto !important; box-shadow: none !important; }' +
      '#print-root .rp-print { font: 11px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1f2430; }';
    var done = function () { rootEl.innerHTML = ''; style.textContent = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  }

  function onShow() { update(); }

  function init() {
    els = {
      files: $('res-files'), input: $('res-input'), fileErrors: $('res-file-errors'), tablesStatus: $('res-tables-status'),
      tableErrors: $('res-table-errors'), useScreen: $('res-use-screen'), keyInput: $('res-key-input'), structuresInput: $('res-structures-input'),
      merged: $('res-merged'), dlMerged: $('res-dl-merged'), dlExcel: $('res-dl-excel'),
      rater: $('res-rater'), method: $('res-method'), show: $('res-show'), print: $('res-print'), dlHtml: $('res-dl-html'), report: $('res-report'),
      keyNeeded: $('res-key-needed'), keyNeededText: $('res-key-needed-text')
    };
    $('res-go-tables').addEventListener('click', function () {
      if (merged) HUSS.ui.tablesForm.addSheets(merged.problems.no_structure);
      HUSS.app.show('tables');
    });
    var style = document.createElement('style');
    style.id = 'rp-style';
    style.textContent = HUSS.report.build.CSS;
    document.head.appendChild(style);

    $('res-add').addEventListener('click', function () { els.input.value = ''; els.input.click(); });
    els.input.addEventListener('change', function () { if (els.input.files.length) readFiles(els.input.files); });
    HUSS.io.files.onDrop($('screen-results'), 'dragging', function (list) {
      readFiles(Array.prototype.filter.call(list, function (f) { return /\.csv$/i.test(f.name); }));
    });
    $('res-clear').addEventListener('click', function () { files = []; els.fileErrors.hidden = true; update(); });
    els.useScreen.addEventListener('click', function () { tables = { key: null, structures: null }; els.tableErrors.hidden = true; update(); });
    $('res-load-key').addEventListener('click', function () { els.keyInput.value = ''; els.keyInput.click(); });
    $('res-load-structures').addEventListener('click', function () { els.structuresInput.value = ''; els.structuresInput.click(); });
    els.keyInput.addEventListener('change', function () { if (els.keyInput.files[0]) loadTable('key', els.keyInput.files[0]); });
    els.structuresInput.addEventListener('change', function () { if (els.structuresInput.files[0]) loadTable('structures', els.structuresInput.files[0]); });
    els.dlMerged.addEventListener('click', function () {
      if (merged) HUSS.io.files.downloadText(projectBase() + '_merged.csv', HUSS.io.csv.toCSV(merged.rows, merged.columns));
    });
    els.dlExcel.addEventListener('click', function () {
      if (merged) HUSS.io.files.downloadText(projectBase() + '_merged_excel-view.csv', HUSS.io.csv.toExcelView(merged.rows, merged.columns));
    });
    els.rater.addEventListener('change', function () { raterPick = els.rater.value; renderReport(); });
    els.method.addEventListener('change', renderReport);
    els.show.addEventListener('change', renderReport); // display only: the merged CSV stays as it is
    els.print.addEventListener('click', printReport);
    els.dlHtml.addEventListener('click', function () {
      if (model) HUSS.io.files.downloadText(projectBase() + '_report.html', HUSS.report.build.documentHtml(model), 'text/html;charset=utf-8');
    });
  }

  HUSS.ui.results = { init: init, onShow: onShow, currentTables: currentTables, liveSource: liveSource, get merged() { return merged; }, get files() { return files; } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
