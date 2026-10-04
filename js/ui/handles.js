/* HuSS Scorer — js/ui/handles.js
 * The five controls of the scoring screen (spec 8.4): head, foot and ceiling move only
 * vertically on the axis; the opposite wall moves only horizontally on the floor line;
 * the axis grip moves the axis sideways. Geometry, drawing, hit testing and snap.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.ui = HUSS.ui || {};

  var KEYS = ['head', 'foot', 'ceiling', 'wall', 'axis'];
  var DEF = {
    head: { num: '1', label: 'h_head', dir: 'y', cssVar: '--c-head' },
    foot: { num: '2', label: 'h_foot', dir: 'y', cssVar: '--c-foot' },
    ceiling: { num: '3', label: 'h_ceiling', dir: 'y', cssVar: '--c-ceiling' },
    wall: { num: '4', label: 'h_wall', dir: 'x', cssVar: '--c-wall' },
    axis: { num: '', label: 'h_axis', dir: 'x', cssVar: '--c-axis' }
  };
  var WALL_LEN_MM = 10, AXIS_GRIP_BELOW_MM = 9;

  var colorCache = null;
  function color(key) {
    if (!colorCache) {
      colorCache = {};
      var cs = getComputedStyle(document.documentElement);
      KEYS.forEach(function (k) { colorCache[k] = cs.getPropertyValue(DEF[k].cssVar).trim() || '#333'; });
    }
    return colorCache[key];
  }

  function floorY(s, x) {
    return HUSS.detect.floorline.yAt(s.analysis.floor, x);
  }

  function value(s, key) {
    var h = s.handles[key];
    return DEF[key].dir === 'y' ? h.y : h.x;
  }

  function isPlaced(s, key) {
    return value(s, key) != null;
  }

  function setValue(s, key, v, placement) {
    var h = s.handles[key];
    if (DEF[key].dir === 'y') h.y = v; else h.x = v;
    if (placement) h.placement = placement;
  }

  /** Coordinate along the handle's own direction for a page point, clamped to the page. */
  function project(s, key, px, py) {
    var T = s.analysis.template;
    return DEF[key].dir === 'y' ? Math.max(0, Math.min(T.height_mm, py)) : Math.max(0, Math.min(T.width_mm, px));
  }

  /** Snap a released position (spec 7.8). Axis never snaps. */
  function snap(s, key, v) {
    var P = HUSS.detect.pipeline, a = s.analysis, r = s.params.snap_radius_mm, ax = s.handles.axis.x;
    switch (key) {
      case 'head': return P.snapHead(a, v, r);
      case 'foot': return P.snapFoot(a, ax, v, r);
      case 'ceiling': return P.snapCeiling(a, ax, v, r);
      case 'wall': return P.snapWall(a, v, r);
      default: return { pos: v, snapped: false };
    }
  }

  function halfLenMm(view, cfg) {
    return Math.max(cfg.UI.HANDLE_HALF_LEN_MM, cfg.UI.HANDLE_MIN_HALF_LEN_PX / view.scale);
  }

  /** Screen-space segment [x1, y1, x2, y2] of a placed handle (axis: grip point twice). */
  function segment(view, s, key, cfg, v) {
    if (v === undefined) v = value(s, key);
    if (v == null) return null;
    var ax = s.handles.axis.x, L = halfLenMm(view, cfg), a, b;
    if (key === 'wall') {
      var fy = floorY(s, v);
      a = view.toScreen(v, fy - WALL_LEN_MM); b = view.toScreen(v, fy + 0.8);
    } else if (key === 'axis') {
      a = b = view.toScreen(v, floorY(s, v) + AXIS_GRIP_BELOW_MM);
    } else {
      a = view.toScreen(ax - L, v); b = view.toScreen(ax + L, v);
    }
    return [a[0], a[1], b[0], b[1]];
  }

  /**
   * Ceiling and opposite wall are also drawn across the whole drawing area:
   * the ceiling over the full page width, the wall from the top of the page down to the floor line.
   */
  function fullLine(view, s, key, v) {
    if (v === undefined) v = value(s, key);
    if (v == null || (key !== 'ceiling' && key !== 'wall')) return null;
    var T = s.analysis.template, a, b;
    if (key === 'ceiling') { a = view.toScreen(0, v); b = view.toScreen(T.width_mm, v); }
    else { a = view.toScreen(v, 0); b = view.toScreen(v, floorY(s, v) + 0.8); }
    return [a[0], a[1], b[0], b[1]];
  }

  function distToSeg(px, py, x1, y1, x2, y2) {
    var vx = x2 - x1, vy = y2 - y1, L = vx * vx + vy * vy;
    var t = L > 0 ? ((px - x1) * vx + (py - y1) * vy) / L : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
  }

  /** Closest handle within the hit radius, or null. */
  function hitTest(view, s, sx, sy, cfg) {
    var best = null, bestD = Infinity;
    KEYS.forEach(function (k) {
      var g = fullLine(view, s, k) || segment(view, s, k, cfg);
      if (!g) return;
      var d = distToSeg(sx, sy, g[0], g[1], g[2], g[3]);
      var lim = cfg.UI.HANDLE_HIT_PX + (k === 'axis' ? 5 : 0);
      if (d <= lim && d < bestD) { bestD = d; best = k; }
    });
    return best;
  }

  function strokeSeg(ctx, g, col, width, dashed, halo) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = width + (halo == null ? 3 : halo);
    ctx.beginPath(); ctx.moveTo(g[0], g[1]); ctx.lineTo(g[2], g[3]); ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = width;
    if (dashed) ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.moveTo(g[0], g[1]); ctx.lineTo(g[2], g[3]); ctx.stroke();
    ctx.restore();
  }

  function label(ctx, text, x, y, col) {
    ctx.save();
    ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    var w = ctx.measureText(text).width + 8;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(x, y - 8, w, 16);
    ctx.fillStyle = col;
    ctx.fillText(text, x + 4, y + 4);
    ctx.restore();
  }

  function drawGuides(ctx, view, s) {
    var T = s.analysis.template, ax = s.handles.axis.x;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(43,138,61,0.55)';
    var a = view.toScreen(ax, 0), b = view.toScreen(ax, floorY(s, ax) + AXIS_GRIP_BELOW_MM);
    ctx.beginPath(); ctx.moveTo(Math.round(a[0]) + 0.5, a[1]); ctx.lineTo(Math.round(b[0]) + 0.5, b[1]); ctx.stroke();
    ctx.strokeStyle = 'rgba(31,95,191,0.55)';
    var p = view.toScreen(T.floor.x0, floorY(s, T.floor.x0)), q = view.toScreen(T.floor.x1, floorY(s, T.floor.x1));
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    ctx.restore();
  }

  /**
   * Draws guides and handles. ui: { guides, selected, dragging, confirmed, placing, hoverPage }.
   */
  function draw(ctx, view, s, ui, cfg) {
    if (ui.guides) drawGuides(ctx, view, s);
    KEYS.forEach(function (k) {
      var g = segment(view, s, k, cfg);
      if (!g) return;
      var col = color(k), sel = ui.selected === k;
      var dashed = s.handles[k].placement === 'suggested' && !ui.confirmed && ui.dragging !== k;
      if (k === 'axis') {
        var r = sel ? 8 : 6.5;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(g[0], g[1] - r); ctx.lineTo(g[0] + r, g[1]); ctx.lineTo(g[0], g[1] + r); ctx.lineTo(g[0] - r, g[1]); ctx.closePath();
        ctx.fillStyle = col; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.fill(); ctx.stroke();
        ctx.restore();
        return;
      }
      var full = fullLine(view, s, k);
      if (full) strokeSeg(ctx, full, col, sel ? 2 : 1.25, dashed, 2);
      strokeSeg(ctx, g, col, sel ? 3.5 : 2.5, dashed);
      var text = DEF[k].num + ' ' + HUSS.t(DEF[k].label);
      if (k === 'wall') label(ctx, text, g[0] + 6, g[1] + 2, col);
      else label(ctx, text, g[2] + 6, g[3], col);
    });
    if (ui.placing && ui.hoverPage) {
      var k = ui.placing, v = project(s, k, ui.hoverPage[0], ui.hoverPage[1]);
      var pg = fullLine(view, s, k, v) || segment(view, s, k, cfg, v);
      if (pg) {
        ctx.save(); ctx.globalAlpha = 0.6;
        strokeSeg(ctx, pg, color(k), 1.5, true, 2);
        ctx.restore();
      }
    }
  }

  /** Magnifier content: crosshair on the handle point and the handle line. */
  function drawInMagnifier(mctx, toLocal, s, key, size) {
    var ax = s.handles.axis.x, v = value(s, key), col = color(key);
    mctx.save();
    mctx.lineWidth = 1.5;
    mctx.strokeStyle = col;
    if (DEF[key].dir === 'y') {
      var p = toLocal(ax, v);
      mctx.beginPath(); mctx.moveTo(0, p[1]); mctx.lineTo(size, p[1]); mctx.stroke();
    } else {
      var q = toLocal(v, floorY(s, v));
      mctx.beginPath(); mctx.moveTo(q[0], 0); mctx.lineTo(q[0], size); mctx.stroke();
    }
    mctx.restore();
  }

  /** Page point the magnifier centres on while a handle is dragged. */
  function anchor(s, key) {
    var v = value(s, key), ax = s.handles.axis.x;
    if (key === 'wall' || key === 'axis') return [v, floorY(s, v) - (key === 'wall' ? 2 : 0)];
    return [ax, v];
  }

  HUSS.ui.handles = {
    KEYS: KEYS, DEF: DEF, color: color, value: value, isPlaced: isPlaced, setValue: setValue,
    project: project, snap: snap, hitTest: hitTest, draw: draw, drawInMagnifier: drawInMagnifier, anchor: anchor
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
