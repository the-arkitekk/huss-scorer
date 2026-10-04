/* HuSS Scorer — js/report/charts.js
 * Charts of the Report as self-contained SVG text (no library, no fonts to load). DOM-free.
 * Every chart has a white background and inline styles, so the same SVG works on screen, in the
 * downloadable HTML report, as an .svg file and as the source of a PNG.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.report = HUSS.report || {};

  var FONT = 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
  var INK = '#1f2430', MUTED = '#5f6672', GRID = '#e6e8ec', AXIS = '#9aa0aa';
  // Okabe-Ito colours: distinguishable with colour vision deficiencies
  var PALETTE = ['#0072B2', '#E69F00', '#009E73', '#D55E00', '#CC79A7', '#56B4E9', '#8C6D1F', '#000000'];

  function isNum(x) { return typeof x === 'number' && isFinite(x); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function r1(v) { return Math.round(v * 10) / 10; }

  function fmt(v, percent, decimals) {
    if (v == null || !isFinite(v)) return '–';
    if (percent) return (v * 100).toFixed(decimals == null ? 0 : decimals).replace('-0', '0') + '%';
    return (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(decimals == null ? 2 : decimals));
  }

  /** Rounded tick values covering [lo, hi]: { ticks, lo, hi, step }; integer: steps of whole numbers. */
  function niceTicks(lo, hi, count, integer) {
    count = count || 5;
    if (!(hi > lo)) { var c = isFinite(lo) ? lo : 0; lo = integer ? Math.max(0, c - 1) : c - 1; hi = c + 1; }
    var raw = (hi - lo) / count, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
    if (integer) step = Math.max(1, Math.round(step));
    var a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step, ticks = [];
    for (var t = a; t <= b + step / 2; t += step) ticks.push(Math.abs(t) < step / 1e6 ? 0 : t);
    return { ticks: ticks, lo: a, hi: b, step: step };
  }

  function extent(values, include) {
    var v = values.filter(isNum).concat(include || []);
    if (!v.length) return [0, 1];
    return [Math.min.apply(null, v), Math.max.apply(null, v)];
  }

  /** Deterministic jitter in [-1, 1] for point i (same picture every time). */
  function jitter(i) {
    var x = Math.sin((i + 1) * 12.9898) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;
  }

  function open(w, h, title) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h +
      '" role="img" font-family="' + FONT + '"><title>' + esc(title) + '</title>' +
      '<rect width="' + w + '" height="' + h + '" fill="#ffffff"/>' +
      '<text x="12" y="20" font-size="13" font-weight="600" fill="' + INK + '">' + esc(title) + '</text>';
  }

  function text(x, y, s, o) {
    o = o || {};
    return '<text x="' + r1(x) + '" y="' + r1(y) + '" font-size="' + (o.size || 10) + '" fill="' + (o.fill || MUTED) + '"' +
      (o.anchor ? ' text-anchor="' + o.anchor + '"' : '') + (o.weight ? ' font-weight="' + o.weight + '"' : '') +
      (o.rotate ? ' transform="rotate(' + o.rotate + ' ' + r1(x) + ' ' + r1(y) + ')"' : '') + '>' + esc(s) + '</text>';
  }

  function line(x1, y1, x2, y2, stroke, width, dash) {
    return '<line x1="' + r1(x1) + '" y1="' + r1(y1) + '" x2="' + r1(x2) + '" y2="' + r1(y2) + '" stroke="' + stroke +
      '" stroke-width="' + (width || 1) + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>';
  }

  function legend(items, x, y) {
    var out = '', cx = x;
    items.forEach(function (it) {
      out += '<rect x="' + r1(cx) + '" y="' + r1(y - 8) + '" width="10" height="10" rx="2" fill="' + it.color + '"/>' +
        text(cx + 14, y + 1, it.label, { size: 10, fill: INK });
      cx += 22 + it.label.length * 5.6;
    });
    return out;
  }

  /** Decimals a tick step needs (0.25 -> 2, 2.5 -> 1, 10 -> 0); percent steps counted in percent. */
  function stepDecimals(step, percent) {
    var s = (percent ? step * 100 : step).toPrecision(6).replace(/0+$/, '').replace(/\.$/, '');
    return s.indexOf('.') < 0 ? 0 : s.length - s.indexOf('.') - 1;
  }

  function tickLabel(v, step, percent) {
    var d = stepDecimals(step, percent), s = (percent ? v * 100 : v).toFixed(d);
    if (/^-0(\.0+)?$/.test(s)) s = s.slice(1);
    return s + (percent ? '%' : '');
  }

  /** A vertical value axis with grid lines; returns { svg, y(v) }. */
  function yAxis(dom, top, bottom, left, right, percent, label, integer) {
    var t = niceTicks(dom[0], dom[1], 5, integer), span = t.hi - t.lo;
    var y = function (v) { return bottom - (v - t.lo) / span * (bottom - top); };
    var svg = '';
    t.ticks.forEach(function (v) {
      svg += line(left, y(v), right, y(v), GRID, 1) + text(left - 6, y(v) + 3, tickLabel(v, t.step, percent), { anchor: 'end' });
    });
    if (label) svg += text(14, (top + bottom) / 2, label, { anchor: 'middle', rotate: -90, size: 11, fill: INK });
    return { svg: svg, y: y, ticks: t };
  }

  function xAxis(dom, left, right, top, bottom, percent, label) {
    var t = niceTicks(dom[0], dom[1], 5), span = t.hi - t.lo;
    var x = function (v) { return left + (v - t.lo) / span * (right - left); };
    var svg = '';
    t.ticks.forEach(function (v) {
      svg += line(x(v), top, x(v), bottom, GRID, 1) + text(x(v), bottom + 14, tickLabel(v, t.step, percent), { anchor: 'middle' });
    });
    if (label) svg += text((left + right) / 2, bottom + 32, label, { anchor: 'middle', size: 11, fill: INK });
    return { svg: svg, x: x, ticks: t };
  }

  function empty(o, w, h) {
    return open(w, h, o.title) + text(w / 2, h / 2, o.emptyText || 'No data', { anchor: 'middle', size: 12 }) + '</svg>';
  }

  /**
   * Points per group with a box (quartiles), median line and whiskers (min to max).
   * o: { title, yLabel, groups: [{ label, values, color }], percent, zeroLine, width, height }
   */
  function stripBox(o) {
    var w = o.width || 560, h = o.height || 340, L = 60, R = w - 16, T = 40, B = h - 52;
    var all = [];
    o.groups.forEach(function (g) { all = all.concat(g.values.filter(isNum)); });
    if (!all.length) return empty(o, w, h);
    var dom = extent(all, o.zeroLine ? [0] : []), pad = (dom[1] - dom[0]) * 0.08 || 0.05;
    var ya = yAxis([dom[0] - pad, dom[1] + pad], T, B, L, R, o.percent, o.yLabel);
    var svg = open(w, h, o.title) + ya.svg;
    if (o.zeroLine) svg += line(L, ya.y(0), R, ya.y(0), AXIS, 1.2);
    var band = (R - L) / o.groups.length, S = HUSS.report.stats, k = 0;
    o.groups.forEach(function (g, gi) {
      var cx = L + band * (gi + 0.5), col = g.color || PALETTE[gi % PALETTE.length], s = S.summary(g.values);
      var bw = Math.min(56, band * 0.42);
      if (s.n) {
        svg += line(cx, ya.y(s.min), cx, ya.y(s.max), col, 1.2);
        if (s.n >= 3) {
          svg += '<rect x="' + r1(cx - bw / 2) + '" y="' + r1(ya.y(s.q3)) + '" width="' + r1(bw) + '" height="' + r1(Math.max(1, ya.y(s.q1) - ya.y(s.q3))) +
            '" fill="' + col + '" fill-opacity="0.12" stroke="' + col + '" stroke-width="1.2" rx="2"/>';
        }
        svg += line(cx - bw / 2 - 4, ya.y(s.median), cx + bw / 2 + 4, ya.y(s.median), col, 2.5);
        g.values.filter(isNum).forEach(function (v) {
          svg += '<circle cx="' + r1(cx + jitter(k++) * bw * 0.45) + '" cy="' + r1(ya.y(v)) + '" r="3.4" fill="' + col + '" fill-opacity="0.75" stroke="#fff" stroke-width="0.8"/>';
        });
      }
      svg += text(cx, B + 16, g.label, { anchor: 'middle', size: 11, fill: INK }) +
        text(cx, B + 30, 'n = ' + s.n + (s.n ? ' · median ' + fmt(s.median, o.percent, 1) : ''), { anchor: 'middle' });
    });
    return svg + '</svg>';
  }

  /**
   * o: { title, xLabel, yLabel, points: [{ x, y, color }], identity, zeroLines, equal, xPercent, yPercent,
   *      legend: [{ label, color }], quadrants: [tl, tr, bl, br], width, height }
   */
  function scatter(o) {
    var w = o.width || 560, h = o.height || 380, L = 64, R = w - 18, T = o.legend && o.legend.length ? 52 : 40, B = h - 52;
    var pts = o.points.filter(function (p) { return isNum(p.x) && isNum(p.y); });
    if (!pts.length) return empty(o, w, h);
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    var dx = extent(xs, o.zeroLines ? [0] : []), dy = extent(ys, o.zeroLines ? [0] : []);
    if (o.equal) { var lo = Math.min(dx[0], dy[0]), hi = Math.max(dx[1], dy[1]); dx = [lo, hi]; dy = [lo, hi]; }
    var px = (dx[1] - dx[0]) * 0.08 || 0.1, py = (dy[1] - dy[0]) * 0.08 || 0.1;
    var ya = yAxis([dy[0] - py, dy[1] + py], T, B, L, R, o.yPercent, o.yLabel);
    var xa = xAxis([dx[0] - px, dx[1] + px], L, R, T, B, o.xPercent, o.xLabel);
    var svg = open(w, h, o.title) + ya.svg + xa.svg;
    if (o.legend && o.legend.length) svg += legend(o.legend, 14, 40);
    var X0 = xa.ticks.lo, X1 = xa.ticks.hi, Y0 = ya.ticks.lo, Y1 = ya.ticks.hi;
    if (o.zeroLines) {
      if (X0 <= 0 && X1 >= 0) svg += line(xa.x(0), T, xa.x(0), B, AXIS, 1.2);
      if (Y0 <= 0 && Y1 >= 0) svg += line(L, ya.y(0), R, ya.y(0), AXIS, 1.2);
    }
    if (o.quadrants) {
      var q = o.quadrants;
      svg += text(L + 6, T + 12, q[0], { size: 10 }) + text(R - 6, T + 12, q[1], { size: 10, anchor: 'end' }) +
        text(L + 6, B - 6, q[2], { size: 10 }) + text(R - 6, B - 6, q[3], { size: 10, anchor: 'end' });
    }
    if (o.identity) {
      var a = Math.max(X0, Y0), b = Math.min(X1, Y1);
      if (b > a) svg += line(xa.x(a), ya.y(a), xa.x(b), ya.y(b), INK, 1.2, '5 4') + text(xa.x(b) - 4, ya.y(b) + 12, o.identityLabel || 'est = true', { anchor: 'end' });
    }
    pts.forEach(function (p) {
      svg += '<circle cx="' + r1(xa.x(p.x)) + '" cy="' + r1(ya.y(p.y)) + '" r="4" fill="' + (p.color || PALETTE[0]) + '" fill-opacity="0.75" stroke="#fff" stroke-width="0.8"/>';
    });
    return svg + '</svg>';
  }

  /** o: { title, xLabel, values, percent, color, zeroLine, width, height } */
  function histogram(o) {
    var w = o.width || 560, h = o.height || 300, L = 52, R = w - 16, T = 40, B = h - 52;
    var v = o.values.filter(isNum);
    if (!v.length) return empty(o, w, h);
    var dom = extent(v, o.zeroLine ? [0] : []), t = niceTicks(dom[0], dom[1], Math.min(16, Math.max(6, Math.round(Math.sqrt(v.length) * 2.5))));
    var bins = [];
    for (var b = t.lo; b < t.hi - t.step / 2; b += t.step) bins.push({ a: b, b: b + t.step, n: 0 });
    if (!bins.length) bins.push({ a: t.lo, b: t.lo + t.step, n: 0 });
    v.forEach(function (x) {
      var i = Math.min(bins.length - 1, Math.max(0, Math.floor((x - t.lo) / t.step)));
      bins[i].n++;
    });
    var maxN = Math.max.apply(null, bins.map(function (q) { return q.n; }));
    var ya = yAxis([0, maxN], T, B, L, R, false, o.yLabel || 'Drawings', true);
    var xa = xAxis([t.lo, t.hi], L, R, T, B, o.percent, o.xLabel);
    var svg = open(w, h, o.title) + ya.svg + xa.svg, col = o.color || PALETTE[0];
    bins.forEach(function (q) {
      var x1 = xa.x(q.a) + 1, x2 = xa.x(q.b) - 1;
      if (q.n) svg += '<rect x="' + r1(x1) + '" y="' + r1(ya.y(q.n)) + '" width="' + r1(Math.max(1, x2 - x1)) + '" height="' + r1(B - ya.y(q.n)) + '" fill="' + col + '" fill-opacity="0.8" rx="1.5"/>';
    });
    if (o.zeroLine && t.lo <= 0 && t.hi >= 0) svg += line(xa.x(0), T, xa.x(0), B, INK, 1.2, '4 3');
    return svg + '</svg>';
  }

  /** Horizontal bars. o: { title, items: [{ label, value, text }], max, percent, color, width } */
  function hbars(o) {
    var rowH = 24, w = o.width || 560, L = o.labelWidth || 210, R = w - 70, T = 36, h = T + o.items.length * rowH + 14;
    if (!o.items.length) return empty(o, w, 120);
    var max = o.max || Math.max.apply(null, o.items.map(function (i) { return i.value || 0; })) || 1;
    var svg = open(w, h, o.title), col = o.color || PALETTE[0];
    o.items.forEach(function (it, i) {
      var y = T + i * rowH, bw = Math.max(0, (it.value || 0) / max * (R - L));
      svg += text(L - 8, y + 15, it.label, { anchor: 'end', size: 11, fill: INK }) +
        '<rect x="' + L + '" y="' + (y + 4) + '" width="' + r1(R - L) + '" height="15" fill="' + GRID + '" rx="2"/>' +
        (bw ? '<rect x="' + L + '" y="' + (y + 4) + '" width="' + r1(bw) + '" height="15" fill="' + (it.color || col) + '" rx="2"/>' : '') +
        text(R + 6, y + 15, it.text != null ? it.text : fmt(it.value, o.percent, 0), { size: 11, fill: INK });
    });
    return svg + '</svg>';
  }

  /** 100 % stacked horizontal bars. o: { title, rows: [{ label, parts: [values] }], keys: [{ label, color }], width } */
  function stacked(o) {
    var rowH = 26, w = o.width || 560, L = 90, R = w - 20, T = 56, h = T + o.rows.length * rowH + 12;
    var svg = open(w, h, o.title) + legend(o.keys, 14, 40);
    o.rows.forEach(function (row, i) {
      var y = T + i * rowH, total = row.parts.reduce(function (s, v) { return s + v; }, 0), x = L;
      svg += text(L - 8, y + 15, row.label, { anchor: 'end', size: 11, fill: INK });
      if (!total) { svg += '<rect x="' + L + '" y="' + (y + 3) + '" width="' + r1(R - L) + '" height="16" fill="' + GRID + '" rx="2"/>'; return; }
      row.parts.forEach(function (v, k) {
        if (!v) return;
        var bw = v / total * (R - L);
        svg += '<rect x="' + r1(x) + '" y="' + (y + 3) + '" width="' + r1(bw) + '" height="16" fill="' + o.keys[k].color + '"/>';
        if (bw > 30) svg += text(x + bw / 2, y + 15, Math.round(v / total * 100) + '%', { anchor: 'middle', size: 10, fill: '#ffffff', weight: '600' });
        x += bw;
      });
    });
    return svg + '</svg>';
  }

  /**
   * Agreement of two raters (Bland-Altman form, descriptive): mean of the two against their
   * difference, with the mean difference and the 95 % limits of agreement (mean +- 1.96 SD).
   * o: { title, xLabel, yLabel, points: [{ x: mean, y: diff }], percent, width, height }
   */
  function blandAltman(o) {
    var w = o.width || 560, h = o.height || 340, L = 64, R = w - 96, T = 40, B = h - 52;
    var pts = o.points.filter(function (p) { return isNum(p.x) && isNum(p.y); });
    if (!pts.length) return empty(o, w, h);
    var s = HUSS.report.stats.summary(pts.map(function (p) { return p.y; }));
    var loa = s.sd != null ? [s.mean - 1.96 * s.sd, s.mean + 1.96 * s.sd] : [s.mean, s.mean];
    var dy = extent(pts.map(function (p) { return p.y; }), [0, loa[0], loa[1]]), dx = extent(pts.map(function (p) { return p.x; }));
    var py = (dy[1] - dy[0]) * 0.1 || 0.01, px = (dx[1] - dx[0]) * 0.08 || 0.05;
    var ya = yAxis([dy[0] - py, dy[1] + py], T, B, L, R, o.percent, o.yLabel);
    var xa = xAxis([dx[0] - px, dx[1] + px], L, R, T, B, o.percent, o.xLabel);
    var svg = open(w, h, o.title) + ya.svg + xa.svg + line(L, ya.y(0), R, ya.y(0), AXIS, 1.2);
    svg += line(L, ya.y(s.mean), R, ya.y(s.mean), PALETTE[3], 1.6) + text(R + 6, ya.y(s.mean) + 3, 'mean ' + fmt(s.mean, o.percent, 1), { fill: PALETTE[3] });
    if (s.sd != null) {
      [0, 1].forEach(function (k) {
        svg += line(L, ya.y(loa[k]), R, ya.y(loa[k]), PALETTE[0], 1.2, '5 4') +
          text(R + 6, ya.y(loa[k]) + 3, (k ? '+' : '−') + '1.96 SD ' + fmt(loa[k], o.percent, 1), { fill: PALETTE[0] });
      });
    }
    pts.forEach(function (p) {
      svg += '<circle cx="' + r1(xa.x(p.x)) + '" cy="' + r1(ya.y(p.y)) + '" r="4" fill="' + INK + '" fill-opacity="0.65" stroke="#fff" stroke-width="0.8"/>';
    });
    return svg + '</svg>';
  }

  var api = {
    PALETTE: PALETTE, niceTicks: niceTicks, fmt: fmt, esc: esc,
    stripBox: stripBox, scatter: scatter, histogram: histogram, hbars: hbars, stacked: stacked, blandAltman: blandAltman
  };
  HUSS.report.charts = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
