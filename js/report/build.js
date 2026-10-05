/* HuSS Scorer — js/report/build.js
 * The Report: from merged rows to summary cards, charts and tables, as HTML text. The same
 * fragment is shown on the Results screen and saved in the self-contained HTML report. DOM-free.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.report = HUSS.report || {};

  var T = function (k, p) { return HUSS.t(k, p); };
  var esc = function (s) { return HUSS.report.charts.esc(s); };

  function pct(v, sign, d) {
    if (v == null || !isFinite(v)) return '–';
    var s = (v * 100).toFixed(d == null ? 1 : d);
    if (/^-0(\.0+)?$/.test(s)) s = s.slice(1);
    return (sign && v > 0 && Number(s) !== 0 ? '+' : '') + s + '%';
  }
  function num(v, d) { return v == null || !isFinite(v) ? '–' : v.toFixed(d == null ? 2 : d); }

  /**
   * merged: result of io.merge.merge (or { rows, problems } read back from a merged CSV).
   * opts: { rater (null = all), method: 'main' | 'points' | 'red', generatedAt: Date }
   */
  function model(merged, opts) {
    opts = opts || {};
    var S = HUSS.report.stats, rows = merged.rows.filter(function (r) { return !opts.rater || r.rater_code === opts.rater; });
    var arows = S.analysisRows(rows, null, opts.method || 'main');
    var structures = S.byStructure(arows);
    var colorOf = {};
    structures.forEach(function (s, i) { colorOf[s.structure_code || ''] = HUSS.report.charts.PALETTE[i % HUSS.report.charts.PALETTE.length]; });
    return {
      opts: opts, rows: rows, arows: arows, structures: structures, colorOf: colorOf,
      overview: S.overview(rows, arows),
      quality: S.quality(rows, HUSS.measure.flags.TOOL_FLAGS.concat(['flag_color_noncompliant'])),
      hasTrue: arows.some(function (r) { return r.true_v != null || r.true_h != null; }),
      problems: merged.problems || null,
      projects: merged.projects || [], raters: merged.raters || []
    };
  }

  function card(big, label, sub, tone) {
    return '<div class="rp-card' + (tone ? ' ' + tone : '') + '"><div class="rp-big">' + esc(big) + '</div><div class="rp-label">' + esc(label) +
      '</div>' + (sub ? '<div class="rp-sub">' + esc(sub) + '</div>' : '') + '</div>';
  }

  function cards(m) {
    var o = m.overview;
    var axis = function (E, over, labelKey) {
      return card(pct(E.median, true), T(labelKey), E.n ? T('rp_card_e_sub', { n: E.n, over: pct(over, false, 0), iqr: pct(E.q1, true, 0) + ' … ' + pct(E.q3, true, 0) }) : T(m.hasTrue ? 'rp_no_values' : 'rp_card_no_true'),
        E.median == null ? '' : E.median > 0 ? 'over' : 'under');
    };
    return '<div class="rp-cards">' +
      card(String(o.drawings), T('rp_card_drawings'), o.records !== o.drawings ? T('rp_card_records', { n: o.records }) : '') +
      card(o.measured + ' / ' + o.excluded, T('rp_card_measured'), T('rp_card_nm', { v: o.not_measurable_v, h: o.not_measurable_h })) +
      card(String(o.participants), T('rp_card_participants'), T('rp_card_struct_raters', { s: o.structures, r: o.raters })) +
      axis(o.E_v, o.over_v, 'rp_card_ev') + axis(o.E_h, o.over_h, 'rp_card_eh') +
      '</div>';
  }

  function figure(id, svg, caption) {
    return '<figure class="rp-fig" data-chart="' + esc(id) + '">' + svg + (caption ? '<figcaption>' + esc(caption) + '</figcaption>' : '') + '</figure>';
  }

  function charts(m) {
    var C = HUSS.report.charts, out = [], structs = m.structures;
    var label = function (s) { return s.structure_name || s.structure_code || T('rp_no_structure'); };
    var groupsOf = function (field) {
      return structs.map(function (s) {
        return { label: label(s), color: m.colorOf[s.structure_code || ''], values: m.arows.filter(function (r) { return (r.structure_code || null) === s.structure_code; }).map(function (r) { return r[field]; }) };
      });
    };
    var legend = structs.length > 1 ? structs.map(function (s) { return { label: label(s), color: m.colorOf[s.structure_code || ''] }; }) : [];
    var pts = function (fx, fy) {
      return m.arows.map(function (r) { return { x: r[fx], y: r[fy], color: m.colorOf[r.structure_code || ''] }; });
    };
    out.push({ id: 'e-structure-v', svg: C.stripBox({ title: T('rp_ch_e_struct_v'), yLabel: T('rp_ax_e_v'), groups: groupsOf('E_v'), percent: true, zeroLine: true }), caption: T('rp_cap_e_struct') });
    out.push({ id: 'e-structure-h', svg: C.stripBox({ title: T('rp_ch_e_struct_h'), yLabel: T('rp_ax_e_h'), groups: groupsOf('E_h'), percent: true, zeroLine: true }), caption: T('rp_cap_e_struct') });
    out.push({ id: 'est-true-v', svg: C.scatter({ title: T('rp_ch_est_true_v'), xLabel: T('rp_ax_true_v'), yLabel: T('rp_ax_est_v'), points: pts('true_v', 'est_v'), identity: true, equal: true, legend: legend, identityLabel: T('rp_identity') }), caption: T('rp_cap_est_true') });
    out.push({ id: 'est-true-h', svg: C.scatter({ title: T('rp_ch_est_true_h'), xLabel: T('rp_ax_true_h'), yLabel: T('rp_ax_est_h'), points: pts('true_h', 'est_h'), identity: true, equal: true, legend: legend, identityLabel: T('rp_identity') }), caption: T('rp_cap_est_true') });
    out.push({ id: 'e-v-h', svg: C.scatter({ title: T('rp_ch_e_v_h'), xLabel: T('rp_ax_e_h'), yLabel: T('rp_ax_e_v'), points: pts('E_h', 'E_v'), zeroLines: true, xPercent: true, yPercent: true, legend: legend, quadrants: [T('rp_q_tl'), T('rp_q_tr'), T('rp_q_bl'), T('rp_q_br')] }), caption: T('rp_cap_e_v_h') });
    out.push({ id: 'hist-v', svg: C.histogram({ title: T('rp_ch_hist_v'), xLabel: T('rp_ax_e_v'), values: m.arows.map(function (r) { return r.E_v; }), percent: true, zeroLine: true, color: C.PALETTE[0], yLabel: T('rp_ax_drawings') }), caption: T('rp_cap_hist') });
    out.push({ id: 'hist-h', svg: C.histogram({ title: T('rp_ch_hist_h'), xLabel: T('rp_ax_e_h'), values: m.arows.map(function (r) { return r.E_h; }), percent: true, zeroLine: true, color: C.PALETTE[2], yLabel: T('rp_ax_drawings') }), caption: T('rp_cap_hist') });
    return out;
  }

  /** Without true dimensions (no key table, or no structures): the estimates themselves. */
  function estimateCharts(m) {
    var C = HUSS.report.charts;
    return [
      { id: 'est-hist-v', svg: C.histogram({ title: T('rp_ch_est_hist_v'), xLabel: T('rp_ax_est_v'), values: m.arows.map(function (r) { return r.est_v; }), color: C.PALETTE[0], yLabel: T('rp_ax_drawings') }), caption: T('rp_cap_est_hist') },
      { id: 'est-hist-h', svg: C.histogram({ title: T('rp_ch_est_hist_h'), xLabel: T('rp_ax_est_h'), values: m.arows.map(function (r) { return r.est_h; }), color: C.PALETTE[2], yLabel: T('rp_ax_drawings') }), caption: T('rp_cap_est_hist') }
    ];
  }

  function qualityCharts(m) {
    var C = HUSS.report.charts, q = m.quality, out = [];
    var keys = [
      { label: T('rp_pl_suggested'), color: C.PALETTE[2] }, { label: T('rp_pl_snapped'), color: C.PALETTE[0] },
      { label: T('rp_pl_manual'), color: C.PALETTE[1] }, { label: T('rp_pl_none'), color: '#c9ced6' }
    ];
    out.push({
      id: 'q-handles', caption: T('rp_cap_handles'),
      svg: C.stacked({
        title: T('rp_ch_handles'), keys: keys,
        rows: ['head', 'foot', 'ceiling', 'wall'].map(function (h) {
          var c = q.handles[h].counts;
          return { label: T('h_' + h), parts: [c.suggested, c.snapped, c.manual, c.none] };
        })
      })
    });
    out.push({
      id: 'q-flags', caption: T('rp_cap_flags'),
      svg: C.hbars({ title: T('rp_ch_flags'), percent: true, max: 1, color: C.PALETTE[3], items: q.flags.map(function (f) { return { label: T(f.flag), value: f.share, text: f.n + ' (' + pct(f.share, false, 0) + ')' }; }), labelWidth: 290 })
    });
    var tallyItems = function (t, prefix) {
      return Object.keys(t).sort().map(function (k) { return { label: T(prefix + k) !== prefix + k ? T(prefix + k) : k, value: t[k] / (q.n || 1), text: t[k] + ' (' + pct(t[k] / (q.n || 1), false, 0) + ')' }; });
    };
    out.push({ id: 'q-code-source', caption: T('rp_cap_sources'), svg: C.hbars({ title: T('rp_ch_code_source'), percent: true, max: 1, color: C.PALETTE[5], items: tallyItems(q.code_source, 'rp_src_') }) });
    out.push({ id: 'q-align', caption: '', svg: C.hbars({ title: T('rp_ch_align'), percent: true, max: 1, color: C.PALETTE[4], items: tallyItems(q.align_method, 'rp_al_') }) });
    out.push({ id: 'q-duration', caption: T('rp_cap_duration', { median: num(q.duration.median, 0) }), svg: C.histogram({ title: T('rp_ch_duration'), xLabel: T('rp_ax_seconds'), values: m.rows.map(function (r) { return r.duration_s; }), color: C.PALETTE[6], yLabel: T('rp_ax_drawings') }) });
    return out;
  }

  function table(head, body, cls) {
    return '<table class="rp-table' + (cls ? ' ' + cls : '') + '"><thead><tr>' + head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + body.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }

  function structureTable(m) {
    var med = function (s) { return s.n ? pct(s.median, true) + ' [' + pct(s.q1, true, 0) + ', ' + pct(s.q3, true, 0) + ']' : '–'; };
    return table(
      [T('rp_t_structure'), 'n', T('rp_t_true_v'), T('rp_t_est_v'), T('rp_t_e_v'), T('rp_t_over'), T('rp_t_true_h'), T('rp_t_est_h'), T('rp_t_e_h'), T('rp_t_over')],
      m.structures.map(function (s) {
        return [s.structure_name || s.structure_code || T('rp_no_structure'), s.n, num(s.true_v), num(s.est_v.mean) + ' (' + num(s.est_v.median) + ')', med(s.E_v), pct(s.over_v, false, 0),
          num(s.true_h), num(s.est_h.mean) + ' (' + num(s.est_h.median) + ')', med(s.E_h), pct(s.over_h, false, 0)];
      }), 'num');
  }

  function qualityTable(m) {
    var q = m.quality;
    return table([T('rp_t_handle'), T('rp_t_offered'), T('rp_pl_suggested'), T('rp_pl_snapped'), T('rp_pl_manual'), T('rp_t_accepted')],
      ['head', 'foot', 'ceiling', 'wall'].map(function (h) {
        var x = q.handles[h], c = x.counts;
        return [T('h_' + h), x.offered, c.suggested, c.snapped, c.manual, pct(x.accepted, false, 0)];
      }), 'num');
  }

  function problemsHtml(m) {
    var p = m.problems;
    if (!p) return '';
    var items = [];
    if (p.no_key) items.push(T('rp_p_no_key'));
    else if (p.no_structures) items.push(T('rp_p_no_structures'));
    if (p.mixed_projects) items.push(T('rp_p_mixed', { list: m.projects.join(', ') }));
    if (p.no_structure && p.no_structure.length && !p.no_key) items.push(T('rp_p_no_structure', { n: p.no_structure.length, list: p.no_structure.join(', ') }));
    if (p.mark_differs && p.mark_differs.length) items.push(T('rp_p_mark_differs', { n: p.mark_differs.length, list: p.mark_differs.map(function (d) { return d.sheet_code + ' (' + d.key + ' / ' + d.mark + ')'; }).join(', ') }));
    if (p.not_in_key.length) items.push(T('rp_p_not_in_key', { n: p.not_in_key.length, list: p.not_in_key.join(', ') }));
    if (p.missing_structure.length) items.push(T('rp_p_missing_structure', { n: p.missing_structure.length, list: p.missing_structure.map(function (x) { return x.sheet_code + ' → ' + x.structure_code; }).join(', ') }));
    if (p.duplicates.length) items.push(T('rp_p_duplicates', { n: p.duplicates.length, list: p.duplicates.map(function (d) { return d.sheet_code + ' (' + d.rater_code + ')'; }).join(', ') }));
    if (p.unfinished.length) items.push(T('rp_p_unfinished', { n: p.unfinished.length, list: p.unfinished.map(function (d) { return d.sheet_code + ' (' + d.rater_code + ')'; }).join(', ') }));
    if (p.not_measured.length) items.push(T('rp_p_not_measured', { n: p.not_measured.length, list: p.not_measured.join(', ') }));
    return '<section class="rp-section rp-checks"><h2>' + esc(T('rp_checks')) + '</h2>' +
      (items.length ? '<ul>' + items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' : '<p class="rp-ok">' + esc(T(p.single_structure ? 'rp_checks_ok_single' : 'rp_checks_ok')) + '</p>') +
      sourcesHtml(m) + '</section>';
  }

  /** Where the structures of the drawings came from (all records, excluded ones too). */
  function sourcesHtml(m) {
    var n = { key: 0, mark: 0, rater: 0, project: 0, none: 0 }, any = false;
    m.rows.forEach(function (r) {
      if (r.structure_source === undefined) return;
      any = true;
      n[r.structure_source && n[r.structure_source] !== undefined ? r.structure_source : 'none']++;
    });
    if (!any) return '';
    var parts = ['mark', 'key', 'rater', 'project', 'none'].filter(function (k) { return n[k]; })
      .map(function (k) { return T('rp_src_' + k + '_n', { n: n[k] }); });
    return '<p class="rp-sources">' + esc(T('rp_sources', { list: parts.join(', ') })) + '</p>';
  }

  /** The report body (cards, charts, tables) as an HTML fragment. */
  function fragment(m) {
    var figs = function (list) { return '<div class="rp-grid">' + list.map(function (c) { return figure(c.id, c.svg, c.caption); }).join('') + '</div>'; };
    var noTrue = m.problems && m.problems.no_key ? 'rp_no_true_key' : 'rp_no_true';
    return cards(m) +
      problemsHtml(m) +
      '<section class="rp-section"><h2>' + esc(T('rp_sec_results')) + '</h2>' +
      (m.hasTrue ? figs(charts(m)) : '<p class="rp-note">' + esc(T(noTrue)) + '</p>' + figs(estimateCharts(m))) + '<h3>' + esc(T('rp_sec_structures')) + '</h3>' + structureTable(m) + '</section>' +
      '<section class="rp-section"><h2>' + esc(T('rp_sec_quality')) + '</h2>' + figs(qualityCharts(m)) +
      '<h3>' + esc(T('rp_sec_acceptance')) + '</h3>' + qualityTable(m) + '</section>';
  }

  // Report styles: shared by the Results screen, the printout and the HTML report.
  var CSS = [
    '.rp-head h1{font-size:22px;margin:0 0 4px}.rp-head p{margin:0 0 16px;color:#5f6672;font-size:12px}',
    '.rp-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:0 0 18px}',
    '.rp-card{border:1px solid #e3e6ea;border-radius:8px;padding:10px 12px;background:#fafbfc}',
    '.rp-card.over{border-color:#e9b98a;background:#fff8f1}.rp-card.under{border-color:#9cc3e6;background:#f3f8fd}',
    '.rp-big{font-size:26px;font-weight:700;line-height:1.1}.rp-label{font-size:12px;font-weight:600;margin-top:2px}.rp-sub{font-size:11px;color:#5f6672;margin-top:2px}',
    '.rp-section{margin:18px 0}.rp-section h2{font-size:16px;margin:0 0 10px;border-bottom:1px solid #e3e6ea;padding-bottom:4px}.rp-section h3{font-size:13px;margin:14px 0 6px}',
    '.rp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:12px}',
    '.rp-fig{margin:0;border:1px solid #e3e6ea;border-radius:8px;padding:6px;background:#fff;break-inside:avoid}.rp-fig svg{width:100%;height:auto;display:block}',
    '.rp-fig figcaption{font-size:11px;color:#5f6672;padding:4px 6px 2px}',
    '.rp-table{border-collapse:collapse;font-size:12px;width:100%}.rp-table th,.rp-table td{border-bottom:1px solid #e9ecef;padding:4px 8px;text-align:left}',
    '.rp-table.num td:not(:first-child),.rp-table.num th:not(:first-child){text-align:right}.rp-table th{background:#f4f6f8;font-weight:600}',
    '.rp-checks ul{margin:0;padding-left:18px;color:#8a4a12}.rp-ok{color:#2b7a3d}.rp-note{color:#8a4a12}.rp-sources{font-size:12px;color:#5f6672;margin:6px 0 0}',
    '.rp-table tr.rp-mismatch td{background:#fff4e5}',
    '.rp-table.rp-cmp td:nth-child(-n+3),.rp-table.rp-cmp th:nth-child(-n+3){text-align:left}',
    '@media print{.rp-grid{grid-template-columns:1fr 1fr}.rp-fig{page-break-inside:avoid}}'
  ].join('\n');
  var DOC_CSS = 'body{font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1f2430;background:#fff;margin:0;padding:24px;}' +
    '@media print{body{padding:0}}\n' + CSS;

  /** Header line of the report: projects, rater, values, date, versions. */
  function metaLine(m) {
    var o = m.opts;
    return T('rp_meta', {
      projects: m.projects.join(', ') || '–', rater: o.rater || T('rp_all_raters'), method: T('rp_method_' + (o.method || 'main')),
      date: HUSS.measure.record.isoLocal(o.generatedAt || new Date()), tool: HUSS.config.TOOL_VERSION, rules: HUSS.config.RULES_VERSION
    });
  }

  function title(m) { return T('rp_doc_title', { projects: m.projects.join(', ') || 'HuSS' }); }

  /** The whole report as one self-contained HTML document (opens offline, prints to PDF). */
  function documentHtml(m) {
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + esc(title(m)) + '</title><style>' + DOC_CSS + '</style></head><body>' + headerHtml(m) +
      fragment(m) + '<footer class="rp-head"><p>' + esc(T('rp_footer')) + '</p></footer></body></html>';
  }

  /** Compare (spec 8.7): summary cards, agreement charts and the side-by-side table. */
  function compareFragment(cmp) {
    var C = HUSS.report.charts, s = cmp.summary;
    var pm = function (x) { return x.n ? pct(x.mean, true) + ' ± ' + pct(x.sd, false) : '–'; };
    var agreeTxt = function (a) { return a.n ? a.agree + ' / ' + a.n : '–'; };
    var head = '<div class="rp-cards">' +
      card(String(s.matched), T('cp_card_matched'), T('cp_card_only', { a: cmp.r1, na: cmp.onlyA.length, b: cmp.r2, nb: cmp.onlyB.length })) +
      card(pm(s.d_est_v), T('cp_card_d_v'), T('cp_card_d_sub', { n: s.d_est_v.n })) +
      card(pm(s.d_est_h), T('cp_card_d_h'), T('cp_card_d_sub', { n: s.d_est_h.n })) +
      card(agreeTxt(s.excluded), T('cp_card_excl'), T('cp_card_nm', { v: agreeTxt(s.nm_v), h: agreeTxt(s.nm_h) })) +
      '</div>';
    var useE = s.d_E_v.n > 0 || s.d_E_h.n > 0;
    var ba = function (axis) {
      var pts = cmp.pairs.map(function (p) {
        if (useE) {
          var e1 = axis === 'v' ? p.a.E_vertical : p.a.E_horizontal, e2 = axis === 'v' ? p.b.E_vertical : p.b.E_horizontal;
          return { x: e1 != null && e2 != null ? (e1 + e2) / 2 : null, y: axis === 'v' ? p.d_E_v : p.d_E_h };
        }
        var a = axis === 'v' ? p.a.est_vertical_m : p.a.est_horizontal_m, b = axis === 'v' ? p.b.est_vertical_m : p.b.est_horizontal_m;
        return { x: a != null && b != null ? (a + b) / 2 : null, y: axis === 'v' ? p.d_est_v : p.d_est_h };
      });
      return C.blandAltman({
        title: T(axis === 'v' ? 'cp_ch_ba_v' : 'cp_ch_ba_h'), points: pts, xPercent: useE, yPercent: true,
        xLabel: T(useE ? (axis === 'v' ? 'cp_ax_mean_e_v' : 'cp_ax_mean_e_h') : (axis === 'v' ? 'cp_ax_mean_est_v' : 'cp_ax_mean_est_h')),
        yLabel: T(useE ? 'cp_ax_diff_e' : 'cp_ax_reldiff', { r1: cmp.r1, r2: cmp.r2 })
      });
    };
    var charts = '<div class="rp-grid">' + figure('ba-v', ba('v'), T(useE ? 'cp_cap_ba_e' : 'cp_cap_ba_est', { r1: cmp.r1, r2: cmp.r2 })) +
      figure('ba-h', ba('h'), T(useE ? 'cp_cap_ba_e' : 'cp_cap_ba_est', { r1: cmp.r1, r2: cmp.r2 })) + '</div>';
    var dec = function (d) { return T('cp_dec_' + d.replace(' ', '_')); };
    var rows = cmp.pairs.map(function (p) {
      return [p.sheet_code, p.participant_code || '', p.structure_name || p.structure_code || '',
        num(p.a.est_vertical_m), num(p.b.est_vertical_m), pct(p.d_est_v, true),
        num(p.a.est_horizontal_m), num(p.b.est_horizontal_m), pct(p.d_est_h, true),
        dec(p.decision_a), dec(p.decision_b)];
    });
    var tableHtml = '<table class="rp-table num rp-cmp"><thead><tr>' +
      [T('cp_t_sheet'), T('cp_t_participant'), T('rp_t_structure'), T('cp_t_v', { r: cmp.r1 }), T('cp_t_v', { r: cmp.r2 }), T('cp_t_diff'),
        T('cp_t_h', { r: cmp.r1 }), T('cp_t_h', { r: cmp.r2 }), T('cp_t_diff'), T('cp_t_dec', { r: cmp.r1 }), T('cp_t_dec', { r: cmp.r2 })]
        .map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      cmp.pairs.map(function (p, i) {
        return '<tr' + (p.decision_a !== p.decision_b ? ' class="rp-mismatch"' : '') + '>' + rows[i].map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
    var only = cmp.onlyA.length || cmp.onlyB.length ? '<p class="rp-note">' + esc(T('cp_only_list', { a: cmp.r1, la: cmp.onlyA.join(', ') || '–', b: cmp.r2, lb: cmp.onlyB.join(', ') || '–' })) + '</p>' : '';
    return head + '<section class="rp-section"><h2>' + esc(T('cp_sec_agreement')) + '</h2>' + charts + '<p class="rp-note">' + esc(T('cp_icc_note')) + '</p></section>' +
      '<section class="rp-section"><h2>' + esc(T('cp_sec_table')) + '</h2>' + only + tableHtml + '</section>';
  }

  function headerHtml(m) {
    return '<header class="rp-head"><h1>' + esc(title(m)) + '</h1><p>' + esc(metaLine(m)) + '</p></header>';
  }

  function compareDocumentHtml(cmp, projects) {
    var t = T('cp_doc_title', { r1: cmp.r1, r2: cmp.r2 });
    var meta = T('rp_meta', { projects: (projects || []).join(', ') || '–', rater: cmp.r1 + ', ' + cmp.r2, method: T('rp_method_main'),
      date: HUSS.measure.record.isoLocal(new Date()), tool: HUSS.config.TOOL_VERSION, rules: HUSS.config.RULES_VERSION });
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + esc(t) + '</title><style>' + DOC_CSS + '</style></head><body><header class="rp-head"><h1>' + esc(t) + '</h1><p>' + esc(meta) + '</p></header>' +
      compareFragment(cmp) + '<footer class="rp-head"><p>' + esc(T('cp_icc_note')) + '</p></footer></body></html>';
  }

  var api = { model: model, fragment: fragment, compareFragment: compareFragment, compareDocumentHtml: compareDocumentHtml, headerHtml: headerHtml, documentHtml: documentHtml, CSS: CSS, pct: pct };
  HUSS.report.build = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
