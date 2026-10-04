/* HuSS Scorer — js/ui/scorer.js
 * Scoring screen for the current drawing of a session (spec 8.4): canvas, handles, panel,
 * keyboard. The session (queue, CSV, autosave) is run by ui/queue.js, which opens drawings
 * here with openItem() and asks for their record with recordFor().
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.ui = HUSS.ui || {};

  var H = function () { return HUSS.ui.handles; };
  var cfg, view, s = null, ctx = null;
  var ui = { guides: true, snap: true, selected: null, dragging: null, placing: null, hoverPage: null, footLocked: true, confirmTried: false };
  var els = {};
  var drag = null, pan = null, spaceDown = false, hintTimer = null;
  var actions = { confirm: function () {}, previous: function () {}, later: function () {} };
  var loadToken = 0;

  function $(id) { return document.getElementById(id); }

  function local(e) {
    var r = els.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  // ------------------------------------------------------------ loading

  function setBusy(text) {
    els.busy.hidden = !text;
    if (text) els.busyText.textContent = text;
  }

  /** Back to the empty drop zone (optionally with an error message). */
  function clear(errorText) {
    s = null; ctx = null;
    view.clear();
    setCardsVisible(false);
    els.dropzone.hidden = false;
    els.dropError.hidden = !errorText;
    els.dropError.textContent = errorText || '';
  }

  /**
   * Opens one drawing of the session. c: {
   *   mode, rater_code, project_code, title, chip, sheetCode, codeSource, saved (session.stateFromRecord or null),
   *   lookup (Open mode tables, or null), fileName, onChange
   * }. Resolves to true when shown, false when the image could not be used.
   */
  function openItem(file, c) {
    var token = ++loadToken;
    setBusy(HUSS.t('busy'));
    els.dropError.hidden = true;
    return HUSS.image.decode.decodeFile(file).then(function (img) {
      return new Promise(function (resolve) { setTimeout(function () { resolve(img); }, 20); });
    }).then(function (img) {
      if (token !== loadToken) return false;
      var prm = HUSS.app.params();
      var a = HUSS.detect.pipeline.analyze(img, { template: prm.template, params: prm, config: cfg });
      setBusy(null);
      if (!a.ok) { showItemError(c, HUSS.t('err_' + a.error)); return false; }
      a.dark = null; // not needed after the analysis
      start(a, c, prm);
      return true;
    }).catch(function (err) {
      if (token !== loadToken) return false;
      setBusy(null);
      showItemError(c, HUSS.t('err_internal', { msg: err && err.message ? err.message : String(err) }));
      return false;
    });
  }

  function showItemError(c, text) {
    clear(text);
    ctx = c;
    els.cardSheet.hidden = false;
    els.cardActions.hidden = false;
    els.sheetTitle.textContent = c.title;
  }

  function start(a, c, prm) {
    ctx = c;
    var sug = a.suggestions;
    if (prm.suggestions && prm.suggestions.figure === false) sug = Object.assign({}, sug, { head_y: null, foot_y: null });
    var saved = c.saved;
    var handles = {
      axis: { x: sug.axis_x, placement: 'auto' },
      head: { y: sug.head_y, placement: sug.head_y != null ? 'suggested' : null },
      foot: { y: sug.foot_y, placement: sug.foot_y != null ? 'suggested' : null },
      ceiling: { y: null, placement: null },
      wall: { x: null, placement: null }
    };
    var suggested = { head_y: sug.head_y, foot_y: sug.foot_y, ceiling_y: null, wall_x: null };
    if (saved) {
      // Saved handles take precedence over the suggestions; a missing axis keeps the detected one.
      handles = JSON.parse(JSON.stringify(saved.handles));
      if (handles.axis.x == null) handles.axis = { x: sug.axis_x, placement: 'auto' };
      suggested = saved.suggested;
    }
    var m = saved ? saved.meta : {};
    s = {
      analysis: a,
      params: prm,
      meta: {
        project_code: c.project_code, rater_code: c.rater_code, mode: c.mode, file_name: c.fileName,
        sheet_code: '', code_source: null,
        color_noncompliant: !!m.color_noncompliant, note: m.note || '',
        exclusions: Object.assign({}, m.exclusions || {}),
        vertical_not_measurable: !!m.vertical_not_measurable, horizontal_not_measurable: !!m.horizontal_not_measurable
      },
      handles: handles,
      suggested: suggested,
      status: null
    };
    // Sheet code: the QR of this sheet, or what was typed for it before; never the previous drawing's.
    els.inSheet.value = c.sheetCode || '';
    els.inSheet.readOnly = c.codeSource === 'qr';
    // The sheet code must be compared with the printed code (a tick): confirmed records keep it.
    els.chkCode.checked = !!(saved && c.chip && c.chip !== 'deferred');
    els.chkColor.checked = s.meta.color_noncompliant;
    els.inNote.value = s.meta.note;
    els.chkNmV.checked = s.meta.vertical_not_measurable;
    els.chkNmH.checked = s.meta.horizontal_not_measurable;
    buildExclusions(prm);
    syncMeta();

    ui.footLocked = true; ui.dragging = null; ui.hoverPage = null; ui.confirmTried = false;
    var first = !H().isPlaced(s, 'head') ? 'head' : !H().isPlaced(s, 'ceiling') && !s.meta.vertical_not_measurable ? 'ceiling'
      : !H().isPlaced(s, 'wall') && !s.meta.horizontal_not_measurable ? 'wall' : null;
    select(first || 'head');
    ui.placing = first;

    els.dropzone.hidden = true;
    setCardsVisible(true);
    view.setPage(a.rect, a.red, a.dm.paper, a.template.width_mm, a.template.height_mm);
    view.setContrast(els.chkContrast.checked);
    view.setShowMask(els.chkMask.checked);

    els.sheetTitle.textContent = c.title;
    if (c.chip) {
      var chip = document.createElement('span');
      chip.className = 'chip ' + c.chip;
      chip.textContent = HUSS.t('st_item_' + c.chip);
      els.sheetTitle.appendChild(chip);
    }
    var open = c.mode === 'open';
    var al = a.align;
    els.imageInfo.textContent = open ? HUSS.t('open_file', { file: c.fileName }) + ' · ' + a.image.width + ' × ' + a.image.height + ' px' : '';
    els.imageInfo.hidden = !open;
    els.imageAlign.textContent = HUSS.t('align_summary', {
      r: a.R, res: al.residual_mm.toFixed(2), rot: al.rotation_deg.toFixed(1)
    }) + ' · ' + HUSS.t('timing', { ms: Math.round(a.timings.total) });
    if (a.qr && a.qr.found && a.qr.template_mismatch) {
      els.imageWarn.textContent = HUSS.t('qr_template_mismatch', { qr: a.qr.template, used: a.template.id });
      els.imageWarn.hidden = false;
    } else {
      els.imageWarn.hidden = true;
    }
    renderOpenInfo();
    drawCodePicture(a);
    setFinishMode(!!c.finished);
    setConfirmStatus('', '');
    els.stage.focus({ preventScroll: true });
    refresh();
  }

  function setCardsVisible(on) {
    var open = ctx && ctx.mode === 'open';
    ['cardSheet', 'cardHandles', 'cardFlags', 'cardExclusion', 'cardView', 'cardActions'].forEach(function (k) { els[k].hidden = !on; });
    els.cardValues.hidden = !on || !open; // Blind mode: no computed numbers (spec 8.4)
    els.tools.hidden = !on;
    els.hint.hidden = !on;
  }

  function renderOpenInfo() {
    var lk = ctx && ctx.mode === 'open' ? ctx.lookup : null;
    if (!ctx || ctx.mode !== 'open' || !ctx.tablesLoaded) { els.openInfo.hidden = true; return; }
    els.openInfo.hidden = false;
    els.openInfo.textContent = lk
      ? HUSS.t('open_structure', { name: lk.structure_name || '–', code: lk.structure_code, participant: lk.participant_code })
      : HUSS.t('open_not_in_key');
  }

  /** The printed code and QR of this sheet, cut from the aligned page, next to the code field. */
  function drawCodePicture(a) {
    var T = a.template, R = a.R, rect = a.rect;
    var x0 = T.code_text.right - 26, x1 = T.qr.x + T.qr.size + 1, y0 = T.qr.y - 1, y1 = T.qr.y + T.qr.size + 1;
    var px0 = Math.max(0, Math.floor(x0 * R)), py0 = Math.max(0, Math.floor(y0 * R));
    var w = Math.min(rect.width, Math.ceil(x1 * R)) - px0, h = Math.min(rect.height, Math.ceil(y1 * R)) - py0;
    var c = els.codePic;
    c.width = w; c.height = h;
    var img = new ImageData(w, h), d = rect.data;
    for (var y = 0; y < h; y++) {
      img.data.set(d.subarray(((py0 + y) * rect.width + px0) * 4, ((py0 + y) * rect.width + px0 + w) * 4), y * w * 4);
    }
    c.getContext('2d').putImageData(img, 0, 0);
  }

  /** After everything is scored the main button downloads the CSV instead of confirming. */
  function setFinishMode(on) {
    ui.finish = !!on;
    els.btnConfirm.textContent = HUSS.t(on ? 'finish_download' : 'confirm_next');
    els.btnConfirm.classList.toggle('btn-finish', !!on);
  }

  // ------------------------------------------------------------ exclusion card

  function buildExclusions(prm) {
    els.exclList.textContent = '';
    var criteria = (prm.exclusion_criteria || HUSS.io.project.DEFAULT_EXCLUSIONS).concat([{ id: 'excl_other', label: HUSS.t('excl_other_label') }]);
    criteria.forEach(function (c) {
      var lab = document.createElement('label');
      lab.className = 'check excl-check';
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = !!s.meta.exclusions[c.id];
      box.addEventListener('change', function () { s.meta.exclusions[c.id] = box.checked; changed(); });
      var span = document.createElement('span');
      span.textContent = c.label;
      lab.appendChild(box);
      lab.appendChild(span);
      els.exclList.appendChild(lab);
    });
  }

  // ------------------------------------------------------------ state changes

  function select(key) {
    ui.selected = key;
  }

  function changed() {
    if (ui.finish) setFinishMode(false); // a change on a scored drawing must be confirmed again
    refresh();
    if (ctx && ctx.onChange) ctx.onChange();
  }

  /** The next handle still to place (head, foot, ceiling, wall), skipping axes marked not measurable. */
  function nextToPlace() {
    var order = ['head', 'foot', 'ceiling', 'wall'];
    for (var i = 0; i < order.length; i++) {
      var k = order[i];
      if (k === 'ceiling' && s.meta.vertical_not_measurable) continue;
      if (k === 'wall' && s.meta.horizontal_not_measurable) continue;
      if (!H().isPlaced(s, k)) return k;
    }
    return null;
  }

  function startPlacing(key) {
    select(key);
    ui.placing = key;
    refresh();
    els.stage.focus({ preventScroll: true });
  }

  function placeAt(key, sx, sy, noSnap) {
    var p = view.toPage(sx, sy);
    var v = H().project(s, key, p[0], p[1]);
    finishMove(key, v, noSnap);
    // Go straight on to the next handle that is not placed yet (e.g. ceiling, then wall).
    ui.placing = nextToPlace();
    if (ui.placing) select(ui.placing);
    changed();
  }

  /** Applies snap (unless disabled) and records the placement kind. */
  function finishMove(key, v, noSnap) {
    if (key === 'axis') {
      H().setValue(s, 'axis', v, 'manual');
      return;
    }
    var r = (!noSnap && ui.snap) ? H().snap(s, key, v) : { pos: v, snapped: false };
    H().setValue(s, key, r.pos, r.snapped ? 'snapped' : 'manual');
  }

  function nudge(dir, big) {
    var key = ui.selected;
    if (!s || !key || !H().isPlaced(s, key)) return;
    if (key === 'foot' && ui.footLocked) { flashHint(HUSS.t('hint_foot_locked')); return; }
    var axisDir = H().DEF[key].dir;
    if ((axisDir === 'y') !== (dir === 'up' || dir === 'down')) return;
    var step = big ? cfg.UI.NUDGE_BIG_MM : cfg.UI.NUDGE_MM;
    var sign = (dir === 'up' || dir === 'left') ? -1 : 1;
    H().setValue(s, key, H().value(s, key) + sign * step, 'manual');
    changed();
  }

  // ------------------------------------------------------------ pointer

  function onPointerDown(e) {
    if (!s) return;
    els.stage.focus({ preventScroll: true });
    var p = local(e);
    if (e.button === 1 || (e.button === 0 && spaceDown)) { startPan(e, p); return; }
    if (e.button !== 0) return;
    if (ui.placing) { placeAt(ui.placing, p[0], p[1], e.altKey); return; }
    var hit = H().hitTest(view, s, p[0], p[1], cfg);
    if (hit) {
      select(hit);
      if (hit === 'foot' && ui.footLocked) { flashHint(HUSS.t('hint_foot_locked')); refresh(); return; }
      var pg = view.toPage(p[0], p[1]);
      drag = { key: hit, offset: H().value(s, hit) - H().project(s, hit, pg[0], pg[1]), moved: false, id: e.pointerId };
      els.canvas.setPointerCapture(e.pointerId);
      refresh();
      return;
    }
    startPan(e, p);
  }

  function startPan(e, p) {
    pan = { x: p[0], y: p[1], id: e.pointerId };
    els.canvas.setPointerCapture(e.pointerId);
    els.stage.classList.add('panning');
  }

  function onPointerMove(e) {
    if (!s) return;
    var p = local(e);
    if (pan) {
      view.panBy(p[0] - pan.x, p[1] - pan.y);
      pan.x = p[0]; pan.y = p[1];
      return;
    }
    if (drag) {
      var pg = view.toPage(p[0], p[1]);
      var v = H().project(s, drag.key, pg[0], pg[1]) + drag.offset;
      H().setValue(s, drag.key, v);
      drag.moved = true;
      ui.dragging = drag.key;
      view.render();
      var an = H().anchor(s, drag.key), key = drag.key;
      view.showMagnifier(p[0], p[1], an[0], an[1], function (mctx, toLocal) {
        H().drawInMagnifier(mctx, toLocal, s, key, cfg.UI.MAGNIFIER_SIZE_PX);
      });
      updatePanel();
      return;
    }
    if (ui.placing) {
      ui.hoverPage = view.toPage(p[0], p[1]);
      view.render();
    }
    var over = !ui.placing && H().hitTest(view, s, p[0], p[1], cfg);
    els.stage.classList.toggle('over-handle', !!over);
  }

  function onPointerUp(e) {
    if (pan) {
      pan = null;
      els.stage.classList.remove('panning');
      return;
    }
    if (drag) {
      var d = drag;
      drag = null;
      ui.dragging = null;
      view.hideMagnifier();
      if (d.moved) {
        finishMove(d.key, H().value(s, d.key), e.altKey);
        changed();
      } else {
        refresh();
      }
    }
  }

  function onWheel(e) {
    if (!s) return;
    e.preventDefault();
    var p = local(e);
    var dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    view.zoomAt(Math.pow(cfg.UI.ZOOM_STEP, -dy / 100), p[0], p[1]);
  }

  // ------------------------------------------------------------ keyboard

  function inField(e) {
    var t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }

  function onKeyDown(e) {
    if (HUSS.app.state.screen !== 'score') return;
    if (inField(e)) {
      // Enter confirms from the sheet code field; elsewhere (note, setup fields) it keeps its meaning.
      if (e.key === 'Enter' && ctx && e.target === els.inSheet) { e.preventDefault(); actions.confirm(); }
      return;
    }
    if (!ctx) return;
    var k = e.key;
    if (k === 'Enter') { e.preventDefault(); if (e.shiftKey) actions.previous(); else actions.confirm(); return; }
    if ((k === 'd' || k === 'D') && !e.metaKey && !e.ctrlKey) { e.preventDefault(); actions.later(); return; }
    if (!s) return;
    if (k === ' ') { spaceDown = true; e.preventDefault(); return; }
    if (e.metaKey || e.ctrlKey) return;
    var handled = true;
    switch (k) {
      case '1': case '2': case '3': case '4': {
        var key = ['head', 'foot', 'ceiling', 'wall'][Number(k) - 1];
        if (H().isPlaced(s, key)) { select(key); ui.placing = null; refresh(); } else startPlacing(key);
        break;
      }
      case 'Escape': ui.placing = null; ui.hoverPage = null; refresh(); break;
      case 'ArrowUp': nudge('up', e.shiftKey); break;
      case 'ArrowDown': nudge('down', e.shiftKey); break;
      case 'ArrowLeft': nudge('left', e.shiftKey); break;
      case 'ArrowRight': nudge('right', e.shiftKey); break;
      case '+': case '=': view.zoomCentre(cfg.UI.ZOOM_STEP); break;
      case '-': case '_': view.zoomCentre(1 / cfg.UI.ZOOM_STEP); break;
      case '0': view.fit(); break;
      case 'c': case 'C': toggle(els.chkContrast); break;
      case 'r': case 'R': toggle(els.chkMask); break;
      case 'h': case 'H': toggle(els.chkGuides); break;
      case 'k': case 'K': toggle(els.chkCode); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  }

  function onKeyUp(e) {
    if (e.key === ' ') spaceDown = false;
  }

  function toggle(chk) {
    chk.checked = !chk.checked;
    chk.dispatchEvent(new Event('change'));
  }

  // ------------------------------------------------------------ panel

  function fmt(v, d) {
    return v == null || !isFinite(v) ? '–' : v.toFixed(d);
  }

  function el(tag, cls, text) {
    var x = document.createElement(tag);
    if (cls) x.className = cls;
    if (text != null) x.textContent = text;
    return x;
  }

  function button(text, onClick, cls) {
    var b = el('button', 'btn btn-xs' + (cls ? ' ' + cls : ''), text);
    b.type = 'button';
    b.addEventListener('click', function (ev) { ev.stopPropagation(); onClick(); });
    return b;
  }

  function renderHandleTable() {
    var tbl = els.handleTable;
    tbl.textContent = '';
    H().KEYS.forEach(function (k) {
      var def = H().DEF[k], h = s.handles[k], placed = H().isPlaced(s, k);
      var tr = el('tr', ui.selected === k ? 'selected' : '');
      var sw = el('span', 'sw'); sw.style.background = H().color(k);
      var c0 = el('td', 'who');
      c0.appendChild(sw);
      c0.appendChild(el('span', 'key', def.num));
      c0.appendChild(el('span', 'name', HUSS.t(def.label)));
      var st = placed ? HUSS.t('st_' + h.placement) : HUSS.t('st_unplaced');
      c0.appendChild(el('div', 'st' + (placed ? '' : ' unplaced'), st));
      tr.appendChild(c0);
      tr.appendChild(el('td', 'val', placed ? (def.dir === 'y' ? 'y ' : 'x ') + fmt(H().value(s, k), 2) : ''));
      var act = el('td', 'act');
      if (k === 'foot' && placed) {
        act.appendChild(button(HUSS.t(ui.footLocked ? 'foot_locked' : 'foot_unlocked'), function () {
          ui.footLocked = !ui.footLocked; refresh();
        }));
        act.lastChild.title = HUSS.t('foot_lock_title');
      }
      if (k !== 'axis') {
        act.appendChild(button(HUSS.t(placed ? 'replace' : 'place'), function () {
          if (k === 'foot' && ui.footLocked && placed) { flashHint(HUSS.t('hint_foot_locked')); return; }
          startPlacing(k);
        }, placed ? '' : 'btn-primary'));
      }
      tr.appendChild(act);
      tr.addEventListener('click', function () { select(k); refresh(); });
      tbl.appendChild(tr);
    });
  }

  function renderValues(d) {
    var c = d.comp, tbl = els.valueTable;
    tbl.textContent = '';
    var mm = ' ' + HUSS.t('unit_mm'), m = ' ' + HUSS.t('unit_m');
    var row = function (labelKey, val, cls, title) {
      var tr = el('tr', cls || '');
      var td = el('td', null, typeof labelKey === 'string' ? HUSS.t(labelKey) : labelKey.text);
      if (title) td.title = title;
      tr.appendChild(td);
      tr.appendChild(el('td', 'num', val));
      tbl.appendChild(tr);
    };
    var nmV = s.meta.vertical_not_measurable, nmH = s.meta.horizontal_not_measurable;
    row('v_figure', fmt(c.figure_mm, 2) + mm);
    row('v_ceiling', (nmV ? '–' : fmt(c.ceiling_mm, 2)) + mm);
    row('v_distance', (nmH ? '–' : fmt(c.distance_mm, 2)) + mm);
    row('v_scale', fmt(c.scale_mm_per_m, 2) + ' ' + HUSS.t('unit_mm_per_m'));
    row('v_est_v', (nmV ? '–' : fmt(c.est_vertical_m, 3)) + m, 'est');
    row('v_est_h', (nmH ? '–' : fmt(c.est_horizontal_m, 3)) + m, 'est');
    var lk = ctx && ctx.lookup;
    if (lk) {
      var E = HUSS.measure.compute.errorRatio;
      row('v_true_v', fmt(lk.true_vertical_m, 3) + m);
      row('v_e_v', nmV ? '–' : fmt(E(c.est_vertical_m, lk.true_vertical_m), 4), 'est');
      row('v_true_h', fmt(lk.true_horizontal_m, 3) + m);
      row('v_e_h', nmH ? '–' : fmt(E(c.est_horizontal_m, lk.true_horizontal_m), 4), 'est');
    }
    row('v_figure_red', fmt(c.figure_red_mm, 2) + mm, 'alt', HUSS.t('v_backup_title'));
    row({ text: HUSS.t('v_est_v') + ', ' + HUSS.t('v_backup') }, (nmV ? '–' : fmt(c.est_vertical_red_m, 3)) + m, 'alt', HUSS.t('v_backup_title'));
    row({ text: HUSS.t('v_est_h') + ', ' + HUSS.t('v_backup') }, (nmH ? '–' : fmt(c.est_horizontal_red_m, 3)) + m, 'alt', HUSS.t('v_backup_title'));
  }

  function renderFlags(d) {
    var ul = els.flagList;
    ul.textContent = '';
    var on = HUSS.measure.flags.TOOL_FLAGS.filter(function (f) { return d.flags[f]; });
    if (!on.length) ul.appendChild(el('li', 'none', HUSS.t('flags_none')));
    on.forEach(function (f) { ul.appendChild(el('li', null, HUSS.t(f))); });
  }

  function sheetCodeState() {
    var v = HUSS.sheet.code.normalize(els.inSheet.value);
    if (!v) return 'empty';
    return HUSS.sheet.code.isValid(v) ? 'ok' : 'bad';
  }

  function syncMeta() {
    var st = sheetCodeState();
    els.inSheet.classList.toggle('invalid', st === 'bad');
    var fromQr = st === 'ok' && ctx && ctx.codeSource === 'qr';
    els.sheetStatus.className = 'small' + (st === 'ok' ? ' ok' : st === 'bad' ? ' bad' : ' muted');
    els.sheetStatus.textContent = HUSS.t(fromQr ? 'sheet_code_qr' : st === 'ok' ? 'sheet_code_ok' : st === 'bad' ? 'sheet_code_bad' : 'sheet_code_hint');
    if (!s) return;
    s.meta.sheet_code = st === 'ok' ? HUSS.sheet.code.normalize(els.inSheet.value) : '';
    s.meta.code_source = st === 'ok' ? (fromQr ? 'qr' : 'manual') : null;
    s.meta.color_noncompliant = els.chkColor.checked;
    s.meta.note = els.inNote.value;
    s.meta.vertical_not_measurable = els.chkNmV.checked;
    s.meta.horizontal_not_measurable = els.chkNmH.checked;
  }

  function missingList() {
    var miss = HUSS.measure.record.missingForConfirm(s);
    if (sheetCodeState() === 'bad' && miss.indexOf('sheet_code') < 0) miss.push('sheet_code');
    if (!els.chkCode.checked) miss.push('code_check');
    return miss;
  }

  function missingLabel(k) {
    if (k === 'rater_code') return HUSS.t('need_rater_code');
    if (k === 'sheet_code') return HUSS.t('need_sheet_code');
    if (k === 'code_check') return HUSS.t('need_code_check');
    return HUSS.t(H().DEF[k].label);
  }

  function setConfirmStatus(text, cls) {
    els.confirmStatus.textContent = text;
    els.confirmStatus.className = 'small' + (cls ? ' ' + cls : '');
  }

  function updatePanel() {
    if (!s) return;
    var d = HUSS.measure.record.derive(s);
    renderHandleTable();
    if (!els.cardValues.hidden) renderValues(d);
    renderFlags(d);
    var miss = missingList();
    if (miss.length) setConfirmStatus(HUSS.t('missing', { list: miss.map(missingLabel).join(', ') }), ui.confirmTried ? 'bad' : '');
    else if (ui.confirmTried) setConfirmStatus('', '');
  }

  function updateHint() {
    if (hintTimer) return;
    els.hint.classList.remove('attention');
    els.hint.textContent = ui.placing
      ? HUSS.t('hint_place', { name: HUSS.t(H().DEF[ui.placing].label) })
      : HUSS.t('hint_idle');
    els.stage.classList.toggle('placing', !!ui.placing);
  }

  function flashHint(text) {
    if (hintTimer) clearTimeout(hintTimer);
    els.hint.textContent = text;
    els.hint.classList.add('attention');
    hintTimer = setTimeout(function () { hintTimer = null; updateHint(); }, 2500);
  }

  function refresh() {
    if (!s) return;
    view.render();
    updatePanel();
    updateHint();
  }

  // ------------------------------------------------------------ records for the session

  /**
   * The record of the current drawing. kind 'confirm' checks the confirmation rule and gives
   * status measured or excluded; kind 'later' gives status deferred (only the sheet code is
   * needed), and kind 'draft' the in-progress state for autosave.
   * Returns { record } or { missing: [...] } (and points at what is missing).
   */
  function recordFor(kind, durationS) {
    if (!s) return { missing: ['image'] };
    syncMeta();
    if (kind === 'confirm') {
      var miss = missingList();
      if (miss.length) {
        ui.confirmTried = true;
        updatePanel();
        if (miss.indexOf('sheet_code') >= 0) { els.inSheet.classList.add('invalid'); els.inSheet.focus(); }
        return { missing: miss };
      }
    } else if (!s.meta.sheet_code) {
      return { missing: ['sheet_code'] };
    }
    var status = kind === 'confirm' ? (HUSS.measure.record.isExcluded(s) ? 'excluded' : 'measured') : kind === 'later' ? 'deferred' : null;
    var rec = HUSS.measure.record.buildRecord(Object.assign({}, s, {
      status: status, confirmedAt: Date.now(), duration_s: durationS
    }));
    ui.confirmTried = false;
    return { record: rec };
  }

  function showSaved(status) {
    setConfirmStatus(HUSS.t('saved_status', { status: HUSS.t('st_item_' + status) }), 'ok');
  }

  // ------------------------------------------------------------ project

  function updateProjectCard() {
    var p = HUSS.app.state.project;
    if (p) {
      els.projectInfo.textContent = HUSS.t('project_info', {
        code: p.project_code, title: p.title ? ' — ' + p.title : '', template: p.template, ref: p.ref_height_m.toFixed(2)
      });
      els.inProject.value = p.project_code;
      els.inProject.readOnly = true;
      if (p.rules_version !== cfg.RULES_VERSION) {
        els.projectWarn.textContent = HUSS.t('project_rules_mismatch', { file: p.rules_version, tool: cfg.RULES_VERSION });
        els.projectWarn.hidden = false;
      } else {
        els.projectWarn.hidden = true;
      }
    } else {
      els.projectInfo.textContent = HUSS.t('project_none');
      els.inProject.readOnly = false;
      els.projectWarn.hidden = true;
    }
  }

  /** The loaded project changed (only possible before a session starts). */
  function projectChanged() {
    updateProjectCard();
    if (HUSS.ui.queue) HUSS.ui.queue.setupChanged();
  }

  function loadProjectFile(file) {
    HUSS.io.files.readText(file).then(function (text) {
      var r = HUSS.io.project.parse(text);
      if (!r.ok) {
        els.projectWarn.textContent = HUSS.t('project_bad_file', { list: HUSS.ui.projectForm.describe(r.errors) });
        els.projectWarn.hidden = false;
        return;
      }
      HUSS.app.setProject(r.project);
    });
  }

  /** The scoring screen became visible again: the canvas may have changed size while hidden. */
  function onShow() {
    view.resize();
    view.render();
  }

  // ------------------------------------------------------------ init

  function init(config) {
    cfg = config;
    els = {
      stage: $('stage'), canvas: $('view'), magnifier: $('magnifier'), dropzone: $('dropzone'), dropError: $('drop-error'),
      busy: $('busy'), busyText: $('busy-text'), tools: $('stage-tools'), hint: $('hint'),
      inProject: $('in-project'), inSheet: $('in-sheet'), sheetStatus: $('sheet-status'), sheetTitle: $('sheet-title'),
      imageInfo: $('image-info'), imageAlign: $('image-align'), imageWarn: $('image-warn'), openInfo: $('open-info'),
      projectInfo: $('project-info'), projectWarn: $('project-warn'), projectInput: $('project-input'),
      btnLoadProject: $('btn-load-project'), btnNewProject: $('btn-new-project'),
      cardSheet: $('card-sheet'), cardHandles: $('card-handles'), cardValues: $('card-values'), cardFlags: $('card-flags'),
      cardExclusion: $('card-exclusion'), cardView: $('card-view'), cardActions: $('card-actions'),
      handleTable: $('handle-table'), valueTable: $('value-table'), flagList: $('flag-list'),
      exclList: $('excl-list'), chkCode: $('chk-code'), codePic: $('code-pic'), chkNmV: $('chk-nm-v'), chkNmH: $('chk-nm-h'), inNote: $('in-note'),
      chkColor: $('chk-color'), chkContrast: $('chk-contrast'), chkMask: $('chk-mask'), chkGuides: $('chk-guides'), chkSnap: $('chk-snap'),
      btnConfirm: $('btn-confirm'), btnPrev: $('btn-prev'), btnLater: $('btn-later'), confirmStatus: $('confirm-status'),
      btnFit: $('btn-fit'), btnZoomIn: $('btn-zoom-in'), btnZoomOut: $('btn-zoom-out')
    };
    view = HUSS.ui.canvasView.create(els.canvas, els.magnifier, cfg);
    view.setOverlay(function (c2d, v) { if (s) H().draw(c2d, v, s, ui, cfg); });

    els.canvas.addEventListener('pointerdown', onPointerDown);
    els.canvas.addEventListener('pointermove', onPointerMove);
    els.canvas.addEventListener('pointerup', onPointerUp);
    els.canvas.addEventListener('pointercancel', onPointerUp);
    els.canvas.addEventListener('lostpointercapture', onPointerUp); // release outside the window
    els.canvas.addEventListener('pointerleave', function () { if (ui.placing) { ui.hoverPage = null; view.render(); } });
    els.canvas.addEventListener('wheel', onWheel, { passive: false });
    els.canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', function () { spaceDown = false; });

    els.btnFit.addEventListener('click', function () { view.fit(); });
    els.btnZoomIn.addEventListener('click', function () { view.zoomCentre(cfg.UI.ZOOM_STEP); });
    els.btnZoomOut.addEventListener('click', function () { view.zoomCentre(1 / cfg.UI.ZOOM_STEP); });
    els.chkContrast.addEventListener('change', function () { view.setContrast(els.chkContrast.checked); });
    els.chkMask.addEventListener('change', function () { view.setShowMask(els.chkMask.checked); });
    els.chkGuides.addEventListener('change', function () { ui.guides = els.chkGuides.checked; view.render(); });
    els.chkSnap.addEventListener('change', function () { ui.snap = els.chkSnap.checked; });
    [els.chkColor, els.chkNmV, els.chkNmH].forEach(function (chk) {
      chk.addEventListener('change', function () { if (s) { syncMeta(); changed(); } });
    });
    els.inNote.addEventListener('input', function () { if (s) { syncMeta(); if (ctx && ctx.onChange) ctx.onChange(); } });
    els.inSheet.addEventListener('input', function () {
      els.chkCode.checked = false; // a changed code has to be compared again
      syncMeta();
      if (s) { updatePanel(); if (ctx && ctx.onChange) ctx.onChange(); }
    });
    els.chkCode.addEventListener('change', function () { if (s) changed(); });
    els.btnConfirm.addEventListener('click', function () { actions.confirm(); });
    els.btnPrev.addEventListener('click', function () { actions.previous(); });
    els.btnLater.addEventListener('click', function () { actions.later(); });
    els.btnLoadProject.addEventListener('click', function () { els.projectInput.value = ''; els.projectInput.click(); });
    els.projectInput.addEventListener('change', function () {
      if (els.projectInput.files && els.projectInput.files[0]) loadProjectFile(els.projectInput.files[0]);
    });
    els.btnNewProject.addEventListener('click', function () { HUSS.app.show('project'); });

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function () { view.resize(); view.render(); }).observe(els.stage);
    } else {
      window.addEventListener('resize', function () { view.resize(); view.render(); });
    }
    syncMeta();
  }

  HUSS.ui.scorer = {
    init: init, openItem: openItem, clear: clear, setBusy: setBusy, recordFor: recordFor, showSaved: showSaved,
    onShow: onShow, projectChanged: projectChanged, loadProjectFile: loadProjectFile, updateProjectCard: updateProjectCard,
    setActions: function (a) { actions = a; },
    setFinishMode: setFinishMode,
    get finishMode() { return !!ui.finish; },
    setProjectLocked: function (locked) {
      els.btnLoadProject.disabled = locked;
      els.btnNewProject.disabled = locked;
    },
    get session() { return s; },
    get context() { return ctx; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
