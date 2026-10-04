/* HuSS Scorer — js/ui/scorer.js
 * Scoring screen controller (spec 8.4, Phase 1): one image, handles, panel, keyboard,
 * confirmation and the one-row CSV download.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.ui = HUSS.ui || {};

  var H = function () { return HUSS.ui.handles; };
  var cfg, view, s = null;
  var ui = { guides: true, snap: true, selected: null, dragging: null, placing: null, confirmed: false, hoverPage: null, footLocked: true };
  var els = {};
  var drag = null, pan = null, spaceDown = false, hintTimer = null;
  var last = { csv: null, name: null };

  function $(id) { return document.getElementById(id); }

  function local(e) {
    var r = els.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  // ------------------------------------------------------------ loading

  function isImageFile(file) {
    return /^image\/(jpeg|png)$/.test(file.type) || /\.(jpe?g|png)$/i.test(file.name);
  }

  function showError(text) {
    s = null;
    view.clear();
    setCardsVisible(false);
    els.dropzone.hidden = false;
    els.dropError.textContent = text;
    els.dropError.hidden = false;
    els.imageInfo.textContent = HUSS.t('no_image');
    els.imageAlign.textContent = '';
  }

  function load(file) {
    if (!file) return;
    if (!isImageFile(file)) { showError(HUSS.t('err_type')); return; }
    els.dropError.hidden = true;
    els.busy.hidden = false;
    HUSS.image.decode.decodeFile(file).then(function (img) {
      // let the browser paint the busy overlay before the synchronous analysis
      return new Promise(function (resolve) { setTimeout(function () { resolve(img); }, 30); });
    }, function () {
      throw { userMessage: HUSS.t('err_decode') };
    }).then(function (img) {
      var a = HUSS.detect.pipeline.analyze(img, { template: cfg.DEFAULTS.template, params: cfg.DEFAULTS, config: cfg });
      els.busy.hidden = true;
      if (!a.ok) { showError(HUSS.t('err_' + a.error)); return; }
      a.dark = null; // not needed after the analysis
      start(file, a);
    }).catch(function (err) {
      els.busy.hidden = true;
      showError(err && err.userMessage ? err.userMessage : HUSS.t('err_internal', { msg: err && err.message ? err.message : String(err) }));
    });
  }

  function start(file, a) {
    var sug = a.suggestions;
    s = {
      analysis: a,
      params: Object.assign({}, cfg.DEFAULTS),
      meta: { project_code: '', rater_code: '', sheet_code: '', mode: cfg.DEFAULTS.mode, file_name: file.name, color_noncompliant: false, note: '' },
      handles: {
        axis: { x: sug.axis_x, placement: 'auto' },
        head: { y: sug.head_y, placement: sug.head_y != null ? 'suggested' : null },
        foot: { y: sug.foot_y, placement: sug.foot_y != null ? 'suggested' : null },
        ceiling: { y: null, placement: null },
        wall: { x: null, placement: null }
      },
      suggested: { head_y: sug.head_y, foot_y: sug.foot_y, ceiling_y: null, wall_x: null },
      status: null, startedAt: Date.now(), confirmedAt: null
    };
    syncMeta();
    els.chkColor.checked = false;
    ui.confirmed = false; ui.footLocked = true; ui.dragging = null; ui.hoverPage = null;
    ui.confirmTried = false; ui.changedAfterConfirm = false;
    last.csv = null; last.name = null;
    var first = H().isPlaced(s, 'head') ? 'ceiling' : 'head';
    select(first);
    ui.placing = H().isPlaced(s, first) ? null : first;

    els.dropzone.hidden = true;
    setCardsVisible(true);
    view.setPage(a.rect, a.red, a.dm.paper, a.template.width_mm, a.template.height_mm);
    view.setContrast(els.chkContrast.checked);
    view.setShowMask(els.chkMask.checked);

    var al = a.align;
    els.imageInfo.textContent = file.name + ' · ' + a.image.width + ' × ' + a.image.height + ' px';
    els.imageAlign.textContent = HUSS.t('align_summary', {
      r: a.R, res: al.residual_mm.toFixed(2), rot: al.rotation_deg.toFixed(1)
    }) + ' · ' + HUSS.t('timing', { ms: Math.round(a.timings.total) });
    els.btnDownload.hidden = true;
    setConfirmStatus('', '');
    els.stage.focus({ preventScroll: true });
    refresh();
  }

  function setCardsVisible(on) {
    ['cardHandles', 'cardValues', 'cardFlags', 'cardView', 'cardActions'].forEach(function (k) { els[k].hidden = !on; });
    els.tools.hidden = !on;
    els.hint.hidden = !on;
  }

  // ------------------------------------------------------------ state changes

  function select(key) {
    ui.selected = key;
  }

  function changed() {
    if (ui.confirmed) {
      ui.confirmed = false;
      ui.changedAfterConfirm = true;
      s.status = null;
    }
    refresh();
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
    ui.placing = null;
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
    if (inField(e)) {
      if (e.key === 'Enter' && s) { e.preventDefault(); confirm(); }
      return;
    }
    if (!s) return;
    var k = e.key;
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
      case 'Enter': confirm(); break;
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
    row('v_figure', fmt(c.figure_mm, 2) + mm);
    row('v_ceiling', fmt(c.ceiling_mm, 2) + mm);
    row('v_distance', fmt(c.distance_mm, 2) + mm);
    row('v_scale', fmt(c.scale_mm_per_m, 2) + ' ' + HUSS.t('unit_mm_per_m'));
    row('v_est_v', fmt(c.est_vertical_m, 3) + m, 'est');
    row('v_est_h', fmt(c.est_horizontal_m, 3) + m, 'est');
    row('v_figure_red', fmt(c.figure_red_mm, 2) + mm, 'alt', HUSS.t('v_backup_title'));
    row({ text: HUSS.t('v_est_v') + ', ' + HUSS.t('v_backup') }, fmt(c.est_vertical_red_m, 3) + m, 'alt', HUSS.t('v_backup_title'));
    row({ text: HUSS.t('v_est_h') + ', ' + HUSS.t('v_backup') }, fmt(c.est_horizontal_red_m, 3) + m, 'alt', HUSS.t('v_backup_title'));
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
    els.sheetStatus.className = 'small' + (st === 'ok' ? ' ok' : st === 'bad' ? ' bad' : ' muted');
    els.sheetStatus.textContent = HUSS.t(st === 'ok' ? 'sheet_code_ok' : st === 'bad' ? 'sheet_code_bad' : 'sheet_code_hint');
    if (els.inRater.value.trim()) els.inRater.classList.remove('invalid');
    if (!s) return;
    s.meta.project_code = els.inProject.value.trim().toUpperCase();
    s.meta.rater_code = els.inRater.value.trim().toUpperCase();
    s.meta.sheet_code = st === 'ok' ? HUSS.sheet.code.normalize(els.inSheet.value) : '';
    s.meta.color_noncompliant = els.chkColor.checked;
  }

  function missingList() {
    var miss = HUSS.measure.record.missingForConfirm(s);
    if (sheetCodeState() === 'bad') miss.push('sheet_code');
    return miss;
  }

  function missingLabel(k) {
    if (k === 'rater_code') return HUSS.t('need_rater_code');
    if (k === 'sheet_code') return HUSS.t('sheet_code');
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
    renderValues(d);
    renderFlags(d);
    if (!ui.confirmed) {
      var miss = missingList();
      if (miss.length) setConfirmStatus(HUSS.t('missing', { list: miss.map(missingLabel).join(', ') }), ui.confirmTried ? 'bad' : '');
      else setConfirmStatus(ui.changedAfterConfirm ? HUSS.t('changed_after_confirm') : '', ui.changedAfterConfirm ? 'bad' : '');
    }
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

  // ------------------------------------------------------------ confirm and download

  function confirm() {
    if (!s) return;
    syncMeta();
    var miss = missingList();
    if (miss.length) {
      ui.confirmTried = true;
      updatePanel();
      // Point at the first thing the rater can type in.
      var field = miss.indexOf('rater_code') >= 0 ? els.inRater : miss.indexOf('sheet_code') >= 0 ? els.inSheet : null;
      if (field) {
        field.classList.add('invalid');
        field.scrollIntoView({ block: 'nearest' });
        field.focus();
      }
      return;
    }
    ui.confirmTried = false;
    ui.changedAfterConfirm = false;
    s.status = 'measured';
    s.confirmedAt = Date.now();
    var rec = HUSS.measure.record.buildRecord(s);
    last.csv = HUSS.io.csv.toCSV([rec]);
    last.name = HUSS.measure.record.fileName(s.meta, new Date(s.confirmedAt), cfg.DEFAULTS.file_project_fallback);
    HUSS.io.files.downloadText(last.name, last.csv);
    ui.confirmed = true;
    ui.placing = null;
    els.btnDownload.hidden = false;
    var t = new Date(s.confirmedAt);
    setConfirmStatus(HUSS.t('confirmed', { time: t.toLocaleTimeString() }), 'ok');
    refresh();
  }

  // ------------------------------------------------------------ init

  function init(config) {
    cfg = config;
    els = {
      stage: $('stage'), canvas: $('view'), magnifier: $('magnifier'), dropzone: $('dropzone'), dropError: $('drop-error'),
      busy: $('busy'), tools: $('stage-tools'), hint: $('hint'),
      inProject: $('in-project'), inRater: $('in-rater'), inSheet: $('in-sheet'), sheetStatus: $('sheet-status'),
      imageInfo: $('image-info'), imageAlign: $('image-align'),
      cardHandles: $('card-handles'), cardValues: $('card-values'), cardFlags: $('card-flags'), cardView: $('card-view'), cardActions: $('card-actions'),
      handleTable: $('handle-table'), valueTable: $('value-table'), flagList: $('flag-list'),
      chkColor: $('chk-color'), chkContrast: $('chk-contrast'), chkMask: $('chk-mask'), chkGuides: $('chk-guides'), chkSnap: $('chk-snap'),
      btnConfirm: $('btn-confirm'), btnDownload: $('btn-download'), confirmStatus: $('confirm-status'),
      btnFit: $('btn-fit'), btnZoomIn: $('btn-zoom-in'), btnZoomOut: $('btn-zoom-out')
    };
    view = HUSS.ui.canvasView.create(els.canvas, els.magnifier, cfg);
    view.setOverlay(function (ctx, v) { if (s) H().draw(ctx, v, s, ui, cfg); });

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
    els.chkColor.addEventListener('change', function () { if (s) { syncMeta(); changed(); } });
    [els.inProject, els.inRater, els.inSheet].forEach(function (inp) {
      inp.addEventListener('input', function () {
        syncMeta();
        if (s) {
          if (ui.confirmed) changed();
          else updatePanel();
        }
      });
    });
    els.btnConfirm.addEventListener('click', confirm);
    els.btnDownload.addEventListener('click', function () {
      if (last.csv) HUSS.io.files.downloadText(last.name, last.csv);
    });

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function () { view.resize(); view.render(); }).observe(els.stage);
    } else {
      window.addEventListener('resize', function () { view.resize(); view.render(); });
    }
    syncMeta();
  }

  HUSS.ui.scorer = { init: init, load: load, get session() { return s; } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
