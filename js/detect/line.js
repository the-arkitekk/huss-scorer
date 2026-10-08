/* HuSS Scorer — js/detect/line.js
 * Average position of a hand-drawn ceiling or wall line (rules 1.3, rules 4 and 5).
 *
 * The line is followed sample by sample: column by column for the ceiling, row by row for the
 * wall. In each sample its centre is the darkness-weighted middle of the part darker than
 * halfway between the paper and that sample's darkest point (rule 1: the middle of the line).
 * The ceiling is averaged from the figure axis (or, when the drawn ceiling does not reach over the
 * figure, from where it starts) to 1 mm before the opposite wall, the wall from
 * 1 mm above the floor to 1 mm below the ceiling. Where the line runs into a crossing line or
 * turns by more than 45 degrees (a corner, also a rounded one) the last 1 mm before it is left out.
 * Rules 1.4: a line slanted more than SLANT_DEG (a straight line fitted through it, against the
 * horizontal for the ceiling, the vertical for the wall) is measured at one point instead: the
 * ceiling right above the figure (on the axis, or its end nearest to it), the wall where it
 * stands on the floor.
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
    if (n / R < a.config.LINE.MIN_LENGTH_MM) return { pos: point, average: null, spread: null, slant_deg: null, followed: false, pts: [] };
    var sum = 0, i;
    for (i = 0; i < n; i++) sum += f.pts[i][1];
    var mean = sum / n / R, spread = 0;
    for (i = 0; i < n; i++) spread = Math.max(spread, Math.abs(f.pts[i][1] / R - mean));
    return {
      pos: mean, average: mean, spread: spread, slant_deg: slant(f.pts), followed: true, junction: f.junction,
      pts: f.pts.map(function (p) { return horizontal ? [p[0] / R, p[1] / R] : [p[1] / R, p[0] / R]; })
    };
  }

  /** Slant (degrees) of the straight line fitted through the samples: across against along. */
  function slant(pts) {
    var n = pts.length, sa = 0, sc = 0, saa = 0, sac = 0;
    for (var i = 0; i < n; i++) { var A = pts[i][0], C = pts[i][1]; sa += A; sc += C; saa += A * A; sac += A * C; }
    var d = n * saa - sa * sa;
    return d > 0 ? Math.atan(Math.abs((n * sac - sa * sc) / d)) * 180 / Math.PI : 0;
  }

  /** Rules 1.4: the average, or the point (at_axis / at_floor) when the line is too slanted. */
  function choose(a, r, point, pointName) {
    if (r.followed && r.slant_deg > a.config.LINE.SLANT_DEG) { r.pos = point; r.basis = pointName; }
    else r.basis = r.followed ? 'average' : null;
    return r;
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
   * The first column from a0 towards a1 where a line near cross position c0 starts: it can be
   * followed over most of STRENGTH_RUN_MM (a speck or a dot is passed over). Probes every half
   * millimetre; null when there is none.
   */
  function startRight(a, a0, a1, c0, o, L) {
    var R = a.R, step = Math.max(1, Math.round(0.5 * R)), run = Math.round(L.STRENGTH_RUN_MM * R);
    var loose = a.dm.paper + L.MIN_CONTRAST;
    for (var s = a0; s <= a1 - run; s += step) {
      if (follow(a.dm, true, s, s + run, c0, loose, o).pts.length >= 0.7 * run && threshold(a.dm, true, s, s + run, c0, o, L) != null) return s;
    }
    return null;
  }

  /**
   * The ceiling line through (axisX, yAtAxis), averaged from the axis to 1 mm before the wall
   * (wallX; without a wall, as far as the line goes). A ceiling drawn only right of the figure
   * (it does not reach over it) is averaged from where it starts; at_axis is then its point
   * nearest to the axis. Returns { pos, at_axis, from_x, spread, followed, pts }.
   */
  function ceilingLine(a, axisX, yAtAxis, wallX) {
    return cached(a, 'c' + axisX.toFixed(4) + '|' + yAtAxis.toFixed(4) + '|' + (wallX == null ? '-' : wallX.toFixed(4)), function () {
      var R = a.R, L = a.config.LINE, o = options(a);
      var end = wallX != null ? wallX - L.END_MM : a.template.width_mm - L.PAGE_MARGIN_MM;
      var a0 = Math.floor(axisX * R), a1 = Math.max(a0, Math.floor(end * R)), run = Math.round(L.STRENGTH_RUN_MM * R);
      var thr = threshold(a.dm, true, a0, Math.min(a1, a0 + run), yAtAxis * R, o, L), from = a0;
      var f = thr == null ? { pts: [], junction: false } : follow(a.dm, true, a0, a1, yAtAxis * R, thr, o);
      var r = summarize(a, f, true, yAtAxis);
      if (!r.followed) {
        // Nothing to follow from the axis (or only a speck there): the line may start further right.
        var st = startRight(a, a0 + 1, a1, yAtAxis * R, o, L);
        if (st != null) {
          // a hand-drawn line often starts faintly: up to STRENGTH_RUN_MM may pass before it is dark enough
          var os = Object.assign({}, o, { startGap: run });
          thr = threshold(a.dm, true, st, Math.min(a1, st + run), yAtAxis * R, os, L);
          if (thr != null) { from = st; f = follow(a.dm, true, st, a1, yAtAxis * R, thr, os); r = summarize(a, f, true, yAtAxis); }
        }
      }
      r.at_axis = r.followed && from > a0 ? r.pts[0][1] : yAtAxis;
      r.from_x = r.followed ? r.pts[0][0] : axisX;
      return choose(a, r, r.at_axis, 'axis');
    });
  }

  /**
   * Rows (px) of horizontal lines right of the axis between rows lo and hi: peaks of the ceiling
   * profiles taken every OFF_AXIS_STEP_MM from the axis to the wall (or the page margin), combined
   * by their maximum. Finds a ceiling that does not reach over the figure.
   */
  function rowsRight(a, axisX, lo, hi, wallX) {
    var R = a.R, cfg = a.config, L = cfg.LINE, P = HUSS.detect.profile;
    var end = wallX != null ? wallX - L.END_MM : a.template.width_mm - L.PAGE_MARGIN_MM;
    var comb = null;
    for (var x = axisX + L.OFF_AXIS_STEP_MM; x <= end; x += L.OFF_AXIS_STEP_MM) {
      var pr = P.ceilingProfile(a.dm, R, x, cfg.PROFILE);
      if (!comb) comb = new Float64Array(pr.length);
      for (var k = Math.max(0, lo); k <= Math.min(pr.length - 1, hi); k++) if (pr[k] > comb[k]) comb[k] = pr[k];
    }
    if (!comb) return [];
    comb = P.smooth(comb, cfg.PROFILE.SMOOTH_SIGMA_MM * R);
    return P.findPeaks(comb, lo, hi, cfg.PROFILE).map(function (pk) { return pk.centre; });
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
      return choose(a, r, xAtFloor, 'floor');
    });
  }

  /**
   * The ceiling line whose average lies nearest to y, within radius: candidates are the lines
   * crossing the axis within radius + CANDIDATE_EXTRA_MM (a slanted line crosses the axis away from
   * its average). Returns the ceilingLine result or null.
   */
  function ceilingNear(a, axisX, y, radius, wallX) {
    var R = a.R, ex = a.config.LINE.CANDIDATE_EXTRA_MM;
    var lo = Math.floor((y - radius - ex) * R), hi = Math.ceil((y + radius + ex) * R);
    var prof = HUSS.detect.pipeline.ceilingProfile(a, axisX);
    var rows = HUSS.detect.profile.findPeaks(prof, lo, hi, a.config.PROFILE).map(function (pk) { return pk.centre; });
    var l = nearest(rows.map(function (c) { return ceilingLine(a, axisX, c / R, wallX); }), y, radius);
    if (l) return l;
    // a ceiling drawn only right of the figure
    return nearest(rowsRight(a, axisX, lo, hi, wallX).map(function (c) { return ceilingLine(a, axisX, c / R, wallX); })
      .filter(function (c) { return c.followed; }), y, radius);
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
    follow: follow, ceilingLine: ceilingLine, wallLine: wallLine, ceilingNear: ceilingNear, wallNear: wallNear, rowsRight: rowsRight
  };
  HUSS.detect.line = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
