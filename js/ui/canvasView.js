/* HuSS Scorer — js/ui/canvasView.js
 * The drawing area: rectified page on a canvas, zoom and pan in page mm, overlays,
 * contrast boost, red mask and the drag magnifier (spec 8.4).
 * Screen coordinates are CSS px relative to the canvas; page coordinates are mm.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.ui = HUSS.ui || {};

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function imageCanvas(rgba, w, h) {
    var c = makeCanvas(w, h);
    c.getContext('2d').putImageData(new ImageData(rgba, w, h), 0, 0);
    return c;
  }

  /** Levels + gamma: paper goes to white, faint pencil gets darker. */
  function contrastCanvas(rect, paperDarkness, gamma) {
    var hi = Math.max(32, 255 - paperDarkness), lut = new Uint8ClampedArray(256);
    for (var v = 0; v < 256; v++) lut[v] = 255 * Math.pow(Math.min(1, v / hi), gamma);
    var src = rect.data, out = new Uint8ClampedArray(src.length);
    for (var i = 0; i < src.length; i += 4) {
      out[i] = lut[src[i]]; out[i + 1] = lut[src[i + 1]]; out[i + 2] = lut[src[i + 2]]; out[i + 3] = 255;
    }
    return imageCanvas(out, rect.width, rect.height);
  }

  /** Cyan overlay: all red pixels faint, the figure cluster strong. */
  function maskCanvas(rect, red) {
    var W = rect.width, H = rect.height, out = new Uint8ClampedArray(W * H * 4), k;
    for (k = 0; k < W * H; k++) {
      if (red.pageMask[k]) { out[k * 4] = 0; out[k * 4 + 1] = 190; out[k * 4 + 2] = 255; out[k * 4 + 3] = 110; }
    }
    var reg = red.region;
    for (var y = 0; y < reg.h; y++) {
      for (var x = 0; x < reg.w; x++) {
        if (!red.clusterMask[y * reg.w + x]) continue;
        k = ((reg.y0 + y) * W + reg.x0 + x) * 4;
        out[k] = 0; out[k + 1] = 170; out[k + 2] = 255; out[k + 3] = 210;
      }
    }
    return imageCanvas(out, W, H);
  }

  function create(canvas, magnifier, config) {
    var ui = config.UI;
    var ctx = canvas.getContext('2d');
    var mctx = magnifier.getContext('2d');
    var state = {
      R: 1, pageW: 1, pageH: 1,
      base: null, contrast: null, mask: null,
      showContrast: false, showMask: false,
      scale: 1, x0: 0, y0: 0, fitScale: 1,
      cssW: 0, cssH: 0, dpr: 1,
      overlay: null, rect: null, paper: 0
    };

    function resize() {
      var r = canvas.getBoundingClientRect();
      state.dpr = window.devicePixelRatio || 1;
      state.cssW = Math.max(1, r.width); state.cssH = Math.max(1, r.height);
      canvas.width = Math.round(state.cssW * state.dpr);
      canvas.height = Math.round(state.cssH * state.dpr);
    }

    function setPage(rect, red, paperDarkness, pageW, pageH) {
      state.rect = rect; state.R = rect.R; state.pageW = pageW; state.pageH = pageH;
      state.paper = paperDarkness;
      state.base = imageCanvas(rect.data, rect.width, rect.height);
      state.contrast = null;
      state.mask = red ? maskCanvas(rect, red) : null;
      resize();
      fit();
    }

    function clear() {
      state.base = state.contrast = state.mask = state.rect = null;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function fit() {
      var pad = 16;
      var s = Math.min((state.cssW - 2 * pad) / state.pageW, (state.cssH - 2 * pad) / state.pageH);
      state.fitScale = state.scale = Math.max(0.05, s);
      state.x0 = state.pageW / 2 - state.cssW / (2 * s);
      state.y0 = state.pageH / 2 - state.cssH / (2 * s);
      render();
    }

    function clampScale(s) {
      return Math.max(state.fitScale * ui.ZOOM_MIN_FACTOR, Math.min(ui.ZOOM_MAX_PX_PER_MM, s));
    }

    function zoomAt(factor, sx, sy) {
      var p = toPage(sx, sy);
      state.scale = clampScale(state.scale * factor);
      state.x0 = p[0] - sx / state.scale;
      state.y0 = p[1] - sy / state.scale;
      render();
    }

    function zoomCentre(factor) {
      zoomAt(factor, state.cssW / 2, state.cssH / 2);
    }

    function panBy(dx, dy) {
      state.x0 -= dx / state.scale;
      state.y0 -= dy / state.scale;
      render();
    }

    function toScreen(x, y) { return [(x - state.x0) * state.scale, (y - state.y0) * state.scale]; }
    function toPage(sx, sy) { return [sx / state.scale + state.x0, sy / state.scale + state.y0]; }

    function source() {
      if (state.showContrast) {
        if (!state.contrast) state.contrast = contrastCanvas(state.rect, state.paper, ui.CONTRAST_GAMMA);
        return state.contrast;
      }
      return state.base;
    }

    function render() {
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      ctx.clearRect(0, 0, state.cssW, state.cssH);
      if (!state.base) return;
      var img = source(), k = state.scale / state.R;
      ctx.imageSmoothingEnabled = k < ui.SMOOTH_BELOW_SCREEN_PX_PER_SOURCE_PX;
      ctx.imageSmoothingQuality = 'high';
      var dx = -state.x0 * state.scale, dy = -state.y0 * state.scale;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(dx, dy, state.pageW * state.scale, state.pageH * state.scale);
      ctx.drawImage(img, dx, dy, img.width * k, img.height * k);
      if (state.showMask && state.mask) ctx.drawImage(state.mask, dx, dy, img.width * k, img.height * k);
      if (state.overlay) state.overlay(ctx, api);
    }

    /** Shows the magnifier near (sx, sy), centred on page point (px, py); drawExtra(ctx, toLocal). */
    function showMagnifier(sx, sy, px, py, drawExtra) {
      if (!state.base) return;
      var size = ui.MAGNIFIER_SIZE_PX, dpr = state.dpr;
      magnifier.width = Math.round(size * dpr); magnifier.height = Math.round(size * dpr);
      magnifier.style.width = size + 'px'; magnifier.style.height = size + 'px';
      var left = sx + 24, top = sy - size - 24;
      if (left + size > state.cssW) left = sx - size - 24;
      if (top < 0) top = sy + 24;
      magnifier.style.left = left + 'px'; magnifier.style.top = top + 'px';
      magnifier.hidden = false;

      var mscale = state.scale * ui.MAGNIFIER_ZOOM;          // CSS px per mm in the magnifier
      var mx0 = px - size / (2 * mscale), my0 = py - size / (2 * mscale);
      var img = source(), R = state.R;
      mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mctx.fillStyle = '#ffffff';
      mctx.fillRect(0, 0, size, size);
      mctx.imageSmoothingEnabled = mscale / R < ui.SMOOTH_BELOW_SCREEN_PX_PER_SOURCE_PX;
      mctx.drawImage(img, -mx0 * mscale, -my0 * mscale, img.width * mscale / R, img.height * mscale / R);
      if (state.showMask && state.mask) mctx.drawImage(state.mask, -mx0 * mscale, -my0 * mscale, img.width * mscale / R, img.height * mscale / R);
      var toLocal = function (x, y) { return [(x - mx0) * mscale, (y - my0) * mscale]; };
      if (drawExtra) drawExtra(mctx, toLocal, mscale);
    }

    function hideMagnifier() {
      magnifier.hidden = true;
    }

    var api = {
      state: state, resize: resize, setPage: setPage, clear: clear, fit: fit, zoomAt: zoomAt, zoomCentre: zoomCentre,
      panBy: panBy, toScreen: toScreen, toPage: toPage, render: render,
      showMagnifier: showMagnifier, hideMagnifier: hideMagnifier,
      setOverlay: function (fn) { state.overlay = fn; },
      setContrast: function (on) { state.showContrast = !!on; render(); },
      setShowMask: function (on) { state.showMask = !!on; render(); },
      get scale() { return state.scale; }
    };
    return api;
  }

  HUSS.ui.canvasView = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
