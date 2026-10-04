/* HuSS Scorer — js/detect/line.js
 * Average position of a hand-drawn ceiling or wall line (rules 1.3, rules 4 and 5).
 *
 * The line is followed sample by sample: column by column for the ceiling, row by row for the
 * wall. In each sample its centre is the darkness-weighted middle of the part darker than
 * halfway between the paper and that sample's darkest point (rule 1: the middle of the line).
 * The ceiling is averaged from the figure axis to 1 mm before the opposite wall, the wall from
 * 1 mm above the floor to 1 mm below the ceiling. Where the line runs into a crossing line or
 * turns by more than 45 degrees (a corner, also a rounded one) the last 1 mm before it is left out.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.detect = HUSS.detect || {};

  var CACHE_MAX = 64;

  /**
   * Follows a line from along index a0 towards a1 (inclusive; columns when horizontal, rows
   * otherwise), starting at cross position c0 (px, continuous: pixel i spans [i, i + 1)).
   * Returns { pts: [[along, cross, darkest]] (px, sample centres), junction }.
   */
  function follow(dm, horizontal, a0, a1, c0, thr, o) {
    var W = dm.width, H = dm.height, d = dm.data, paper = dm.paper;
    var crossMax = (horizontal ? H : W) - 1, alongMax = (horizontal ? W : H) - 1;
    var raw = horizontal ? function (a, c) { return d[c * W + a]; } : function (a, c) { return d[a * W + c]; };
    // Across the line, values are averaged over 3 px so the grain of a broad pencil stroke does not split it.
    var get = function (a, c) { return (raw(a, Math.max(0, c - 1)) + raw(a, c) + raw(a, Math.min(crossMax, c + 1))) / 3; };
    var mean3 = function (k) {
      var n = 0, t = 0;
      for (var q = Math.max(0, k - 1); q <= Math.min(pts.length - 1, k + 1); q++) { t += pts[q][1]; n++; }
      return t / n;
    };
    var step = a1 >= a0 ? 1 : -1, cross = c0, pts = [], gap = 0, junction = false;
    for (var a = a0; step > 0 ? a <= a1 : a >= a1; a += step) {
      if (a < 0 || a > alongMax) break;
      var ci = Math.floor(cross), lo = Math.max(0, ci - o.half), hi = Math.min(crossMax, ci + o.half);
      var m = -1, im = ci;
      for (var j = lo; j <= hi; j++) { var v = get(a, j); if (v > m) { m = v; im = j; } }
      if (m < thr) {
        if (++gap > (pts.length ? o.gap : o.startGap)) break;
        continue;
      }
      var level = paper + 0.5 * (m - paper), j0 = im, j1 = im;
      while (j0 > lo && get(a, j0 - 1) > level) j0--;
      while (j1 < hi && get(a, j1 + 1) > level) j1++;
      if (j0 === lo && j1 === hi && pts.length) { junction = true; break; } // a crossing line fills the window
      var sw = 0, s = 0;
      for (j = j0; j <= j1; j++) { var w = get(a, j) - level; sw += w; s += w * (j + 0.5); }
      var c = s / sw, back = pts.length - o.turnRun;
      // A line turning more than TURN_SLOPE (45 degrees) against the samples a little before is a corner
      // (both ends averaged over three samples against pencil grain).
      if (back >= 1) {
        var now = pts.length >= 2 ? (c + pts[pts.length - 1][1] + pts[pts.length - 2][1]) / 3 : c;
        if (Math.abs(now - mean3(back)) > o.turnSlope * Math.abs(a + 0.5 - pts[back][0]) + o.turnSlack) { junction = true; break; }
      }
      cross = c;
      pts.push([a + 0.5, cross, m]);
      gap = 0;
    }
    if (junction && pts.length) {
      var last = pts[pts.length - 1][0];
      pts = pts.filter(function (p) { return Math.abs(p[0] - last) > o.end; });
    }
    return { pts: pts, junction: junction };
  }

  /**
   * Threshold for "this sample is on the line": a fraction of the way from the paper to the
   * line's typical darkness. The line is first followed loosely over a stretch at its start (so a
   * slanted line is not lost) and its typical darkness is the median of its darkest value per
   * sample there (pencil grain makes single samples vary a lot). null when there is no line.
   */
  function threshold(dm, horizontal, a0, a1, c0, o, L) {
    var floorThr = dm.paper + L.MIN_CONTRAST;
    var pre = follow(dm, horizontal, a0, a1, c0, floorThr, o);
    if (pre.pts.length < 3) return null;
    var maxima = pre.pts.map(function (p) { return p[2]; }).sort(function (p, q) { return p - q; });
    var typical = maxima[Math.floor(maxima.length / 2)];
    if (typical - dm.paper < L.MIN_CONTRAST) return null;
    return Math.max(floorThr, dm.paper + L.FOLLOW_FRACTION * (typical - dm.paper));
  }

  function options(a) {
    var L = a.config.LINE, R = a.R;
    return {
      half: Math.max(2, Math.round(L.WINDOW_HALF_MM * R)), gap: Math.round(L.GAP_MM * R),
      startGap: Math.round(L.GAP_MM * R), end: L.END_MM * R,
      turnRun: Math.max(2, Math.round(L.TURN_RUN_MM * R)), turnSlope: L.TURN_SLOPE, turnSlack: L.TURN_SLACK_MM * R
    };
  }

  /**
   * Mean position and spread of followed samples. pos falls back to the given point when less
   * than MIN_LENGTH_MM of line was followed. pts are returned in page mm as [x, y].
   */
  function summarize(a, f, horizontal, point) {
    var R = a.R, n = f.pts.length;
    if (n / R < a.config.LINE.MIN_LENGTH_MM) return { pos: point, spread: null, followed: false, pts: [] };
    var sum = 0, i;
    for (i = 0; i < n; i++) sum += f.pts[i][1];
    var mean = sum / n / R, spread = 0;
    for (i = 0; i < n; i++) spread = Math.max(spread, Math.abs(f.pts[i][1] / R - mean));
    return {
      pos: mean, spread: spread, followed: true, junction: f.junction,
      pts: f.pts.map(function (p) { return horizontal ? [p[0] / R, p[1] / R] : [p[1] / R, p[0] / R]; })
    };
  }

  function cached(a, key, fn) {
    var c = a.lineCache || (a.lineCache = { n: 0, map: {} });
    if (!(key in c.map)) {
      if (c.n >= CACHE_MAX) { c.map = {}; c.n = 0; }
      c.map[key] = fn();
      c.n++;
    }
    return c.map[key];
  }

  /**
   * The ceiling line through (axisX, yAtAxis), averaged from the axis to 1 mm before the wall
   * (wallX; without a wall, as far as the line goes). Returns { pos, at_axis, spread, followed, pts }.
   */
  function ceilingLine(a, axisX, yAtAxis, wallX) {
    return cached(a, 'c' + axisX.toFixed(4) + '|' + yAtAxis.toFixed(4) + '|' + (wallX == null ? '-' : wallX.toFixed(4)), function () {
      var R = a.R, L = a.config.LINE, o = options(a);
      var end = wallX != null ? wallX - L.END_MM : a.template.width_mm - L.PAGE_MARGIN_MM;
      var a0 = Math.floor(axisX * R), a1 = Math.max(a0, Math.floor(end * R));
      var thr = threshold(a.dm, true, a0, Math.min(a1, a0 + Math.round(L.STRENGTH_RUN_MM * R)), yAtAxis * R, o, L);
      var f = thr == null ? { pts: [], junction: false } : follow(a.dm, true, a0, a1, yAtAxis * R, thr, o);
      var r = summarize(a, f, true, yAtAxis);
      r.at_axis = yAtAxis;
      return r;
    });
  }

  /**
   * The wall line through xAtFloor (its centre just above the floor), averaged from 1 mm above
   * the floor to 1 mm below the ceiling (ceilingY; without a ceiling, as far as the line goes).
   * Returns { pos, at_floor, spread, followed, pts }.
   */
  function wallLine(a, xAtFloor, ceilingY) {
    return cached(a, 'w' + xAtFloor.toFixed(4) + '|' + (ceilingY == null ? '-' : ceilingY.toFixed(4)), function () {
      var R = a.R, L = a.config.LINE, S = a.config.SUGGEST, o = options(a);
      var floorY = HUSS.detect.floorline.yAt(a.floor, xAtFloor);
      var top = ceilingY != null ? ceilingY + L.END_MM : S.TOP_MM;
      // Drawn walls often stop short of the floor line: the start may lie up to WALL_SEARCH_TO_MM above it.
      o.startGap = Math.round((S.WALL_SEARCH_TO_MM - L.END_MM) * R);
      var a0 = Math.floor((floorY - L.END_MM) * R), a1 = Math.min(a0, Math.floor(top * R));
      var thr = threshold(a.dm, false, a0, Math.max(a1, Math.floor((floorY - S.WALL_SEARCH_TO_MM - L.STRENGTH_RUN_MM) * R)), xAtFloor * R, o, L);
      var f = thr == null ? { pts: [], junction: false } : follow(a.dm, false, a0, a1, xAtFloor * R, thr, o);
      var r = summarize(a, f, false, xAtFloor);
      r.at_floor = xAtFloor;
      return r;
    });
  }

  /**
   * The ceiling line whose average lies nearest to y, within radius: candidates are the lines
   * crossing the axis within radius + CANDIDATE_EXTRA_MM (a slanted line crosses the axis away from
   * its average). Returns the ceilingLine result or null.
   */
  function ceilingNear(a, axisX, y, radius, wallX) {
    var R = a.R, ex = a.config.LINE.CANDIDATE_EXTRA_MM;
    var prof = HUSS.detect.pipeline.ceilingProfile(a, axisX);
    var peaks = HUSS.detect.profile.findPeaks(prof, Math.floor((y - radius - ex) * R), Math.ceil((y + radius + ex) * R), a.config.PROFILE);
    return nearest(peaks.map(function (pk) { return ceilingLine(a, axisX, pk.centre / R, wallX); }), y, radius);
  }

  /** The wall line whose average lies nearest to x, within radius (see ceilingNear). */
  function wallNear(a, x, radius, ceilingY) {
    var R = a.R, ex = a.config.LINE.CANDIDATE_EXTRA_MM;
    var peaks = HUSS.detect.profile.findPeaks(a.wallProfile, Math.floor((x - radius - ex) * R), Math.ceil((x + radius + ex) * R), a.config.PROFILE);
    return nearest(peaks.map(function (pk) { return wallLine(a, pk.centre / R, ceilingY); }), x, radius);
  }

  function nearest(lines, v, radius) {
    var best = null, bestD = Infinity;
    lines.forEach(function (l) {
      var dd = Math.abs(l.pos - v);
      if (dd <= radius + 1e-9 && dd < bestD) { bestD = dd; best = l; }
    });
    return best;
  }

  var api = {
    follow: follow, ceilingLine: ceilingLine, wallLine: wallLine, ceilingNear: ceilingNear, wallNear: wallNear
  };
  HUSS.detect.line = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
