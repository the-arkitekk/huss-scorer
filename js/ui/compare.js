/* HuSS Scorer — js/ui/compare.js
 * Compare screen (spec 8.7, read only) and the subsample list maker for a second rater.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.ui = HUSS.ui || {};

  var els = {}, files = [], merged = null, cmp = null;

  function $(id) { return document.getElementById(id); }

  function readFiles(list) {
    var errors = [];
    Promise.all(Array.prototype.map.call(list, function (f) {
      return HUSS.io.files.readText(f).then(function (text) {
        var r = HUSS.io.csv.readMeasurements(text);
        if (!r.ok) {
          errors.push(HUSS.t('res_bad_file', { name: f.name, why: HUSS.t(r.error === 'excel_view' ? 'res_err_excel' : 'res_err_not') }));
          return;
        }
        files = files.filter(function (x) { return x.name !== f.name; });
        files.push({ name: f.name, records: r.records, exclusionIds: r.exclusionIds });
      });
    })).then(function () {
      els.fileErrors.hidden = !errors.length;
      els.fileErrors.textContent = errors.join(' ');
      update();
    });
  }

  function fillSelect(sel, raters, pick) {
    sel.textContent = '';
    raters.forEach(function (r) {
      var o = document.createElement('option');
      o.value = r; o.textContent = r;
      sel.appendChild(o);
    });
    if (raters.indexOf(pick) >= 0) sel.value = pick;
  }

  function projectBase() {
    return merged && merged.projects.length === 1 ? merged.projects[0] : HUSS.config.DEFAULTS.file_project_fallback;
  }

  function update() {
    var t = HUSS.ui.results.currentTables();
    var live = HUSS.ui.results.liveSource(), src = live ? [live].concat(files) : files;
    merged = src.length ? HUSS.io.merge.merge(src, t.key, t.structures, { defaultStructure: t.defaultStructure }) : null;
    els.files.textContent = '';
    if (live) { var lli = document.createElement('li'); lli.appendChild(document.createElement('span')).textContent = live.name; els.files.appendChild(lli); }
    files.forEach(function (f, idx) {
      var li = document.createElement('li'), span = document.createElement('span'), b = document.createElement('button');
      var uniq = function (k) { var o = {}; f.records.forEach(function (r) { if (r[k]) o[r[k]] = true; }); return Object.keys(o).join(', ') || '–'; };
      span.textContent = HUSS.t('res_file_line', { name: f.name, n: f.records.length, raters: uniq('rater_code'), projects: uniq('project_code') });
      b.type = 'button'; b.className = 'btn btn-xs'; b.textContent = HUSS.t('res_remove');
      b.addEventListener('click', function () { files.splice(idx, 1); update(); });
      li.appendChild(span); li.appendChild(b);
      els.files.appendChild(li);
    });
    var raters = merged ? merged.raters : [];
    var p1 = els.r1.value, p2 = els.r2.value;
    fillSelect(els.r1, raters, raters.indexOf(p1) >= 0 ? p1 : raters[0]);
    fillSelect(els.r2, raters, raters.indexOf(p2) >= 0 && p2 !== els.r1.value ? p2 : raters.filter(function (r) { return r !== els.r1.value; })[0]);
    render();
  }

  function render() {
    var ok = merged && merged.raters.length >= 2 && els.r1.value && els.r2.value && els.r1.value !== els.r2.value;
    cmp = ok ? HUSS.io.compare.compare(merged.rows, els.r1.value, els.r2.value) : null;
    els.report.innerHTML = cmp ? HUSS.report.build.compareFragment(cmp)
      : '<p class="small muted">' + HUSS.report.charts.esc(HUSS.t('cmp_need_two')) + '</p>';
    els.dlWide.disabled = els.dlHtml.disabled = !cmp;
    var codes = sheetsForSubsample();
    els.ssStatus.textContent = codes.length ? '' : HUSS.t('ss_none');
  }

  /** Sheets the subsample is drawn from: rater 1's measured or excluded records. */
  function sheetsForSubsample() {
    if (!merged) return [];
    var r1 = els.r1.value || merged.raters[0], seen = {};
    merged.rows.forEach(function (r) { if (r.rater_code === r1) seen[r.sheet_code] = r.structure_code || ''; });
    return Object.keys(seen).sort().map(function (c) { return { code: c, structure: seen[c] }; });
  }

  function makeSubsample() {
    var list = sheetsForSubsample();
    if (!list.length) { els.ssStatus.textContent = HUSS.t('ss_none'); return; }
    var n = Number(els.ssN.value), pct = Number(els.ssPct.value);
    if (!(n > 0) && pct > 0) n = Math.round(list.length * pct / 100);
    if (!(n > 0)) n = Math.max(1, Math.round(list.length * 0.2));
    var byGroup = null;
    if (els.ssBy.checked) { byGroup = {}; list.forEach(function (x) { byGroup[x.code] = x.structure; }); }
    var codes = HUSS.io.subsample.make(list.map(function (x) { return x.code; }), n, HUSS.sheet.code.secureRandom, byGroup);
    HUSS.io.files.downloadText(projectBase() + '_subsample.txt', HUSS.io.subsample.toText(codes), 'text/plain;charset=utf-8');
    els.ssStatus.textContent = HUSS.t('ss_made', { n: codes.length, total: list.length });
  }

  function onShow() { update(); }

  function init() {
    els = {
      files: $('cmp-files'), input: $('cmp-input'), fileErrors: $('cmp-file-errors'), r1: $('cmp-r1'), r2: $('cmp-r2'),
      report: $('cmp-report'), dlWide: $('cmp-dl-wide'), dlHtml: $('cmp-dl-html'),
      ssN: $('ss-n'), ssPct: $('ss-pct'), ssBy: $('ss-by-structure'), ssStatus: $('ss-status')
    };
    $('cmp-add').addEventListener('click', function () { els.input.value = ''; els.input.click(); });
    els.input.addEventListener('change', function () { if (els.input.files.length) readFiles(els.input.files); });
    HUSS.io.files.onDrop($('screen-compare'), 'dragging', function (list) {
      readFiles(Array.prototype.filter.call(list, function (f) { return /\.csv$/i.test(f.name); }));
    });
    $('cmp-clear').addEventListener('click', function () { files = []; els.fileErrors.hidden = true; update(); });
    els.r1.addEventListener('change', render);
    els.r2.addEventListener('change', render);
    els.ssN.addEventListener('input', function () { if (els.ssN.value) els.ssPct.value = ''; });
    els.ssPct.addEventListener('input', function () { if (els.ssPct.value) els.ssN.value = ''; });
    $('ss-make').addEventListener('click', makeSubsample);
    els.dlWide.addEventListener('click', function () {
      if (cmp) HUSS.io.files.downloadText(projectBase() + '_compare_' + cmp.r1 + '_' + cmp.r2 + '.csv', HUSS.io.compare.wideCSV(cmp));
    });
    els.dlHtml.addEventListener('click', function () {
      if (cmp) HUSS.io.files.downloadText(projectBase() + '_compare_' + cmp.r1 + '_' + cmp.r2 + '.html', HUSS.report.build.compareDocumentHtml(cmp, merged.projects), 'text/html;charset=utf-8');
    });
  }

  HUSS.ui.compare = { init: init, onShow: onShow, get comparison() { return cmp; } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
