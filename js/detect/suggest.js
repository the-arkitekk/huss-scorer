/* HuSS Scorer — js/detect/suggest.js
 * Automatic suggestions for the ceiling and the opposite wall (spec 7.9).
 *
 * Ceiling: going up from 1 mm above the head top, the first line in the ceiling profile that
 * runs horizontally: on its row, at least 60 % of the 10 mm to the right of the axis is dark, or
 * (a wavy freehand line) the line can be followed over at least 60 % of those 10 mm.
 * Wall: among the lines right of the figure, the rightmost one that rises from the floor for at
 * least half the ceiling height (10 mm without a ceiling); if another such line lies within
 * 6 mm to its left, that one (the inner face of a double-line wall).
 *
 * "Dark" (left open by the spec): darker than halfway between the paper and the line itself.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.detect = HUSS.detect || {};

  function candidates(profile, lo, hi, cfg) {
    // All clear local maxima; the continuity rules decide, not the relative prominence.
    return HUSS.detect.profile.findPeaks(profile, lo, hi, {
      PEAK_MIN_PROMINENCE: cfg.PROFILE.PEAK_MIN_PROMINENCE, PEAK_REL_PROMINENCE: 0
    });
  }

  function threshold(paper, peakValue, frac) {
    return paper + frac * Math.max(0, peakValue - paper);
  }

  /**
   * Share of columns from x0 to x1 (mm) that are dark near row y (mm): within +-tol at x0,
   * widening by slopeMax per mm, so a slightly rising or falling hand-drawn line still counts.
   */
  function horizontalRun(dm, R, y, x0, x1, tol, slopeMax, thr) {
    var W = dm.width, H = dm.height, d = dm.data;
    var c0 = Math.max(0, Math.floor(x0 * R)), c1 = Math.min(W - 1, Math.floor(x1 * R));
    var dark = 0, n = 0;
    for (var c = c0; c <= c1; c++) {
      var band = tol + slopeMax * Math.max(0, (c - c0) / R);
      var r0 = Math.max(0, Math.floor((y - band) * R)), r1 = Math.min(H - 1, Math.floor((y + band) * R));
      var m = 0;
      for (var r = r0; r <= r1; r++) { var v = d[r * W + c]; if (v > m) m = v; }
      n++;
      if (m >= thr) dark++;
    }
    return n ? dark / n : 0;
  }

  /**
   * Length (mm) a line keeps rising from the floor. The line is picked up at its lowest dark
   * point a little above the floor line (drawn walls often stop short of it), then followed
   * row by row, allowing a sideways drift and pencil breaks up to WALL_GAP_MM.
   */
  function verticalRun(dm, R, x, floorY, cfg, thr) {
    var W = dm.width, d = dm.data;
    var S = cfg.SUGGEST;
    var reach = Math.max(1, Math.ceil(S.WALL_DRIFT_PER_MM)); // px per row (1 row = 1/R mm)
    var cx = Math.round(x * R - 0.5);
    var darkAt = function (r, c) {
      var best = -1, bestC = c;
      for (var k = Math.max(0, c - reach); k <= Math.min(W - 1, c + reach); k++) {
        var v = d[r * W + k];
        if (v > best) { best = v; bestC = k; }
      }
      return best >= thr ? bestC : -1;
    };
    // lowest dark row in the search band above the floor
    var startRow = -1;
    for (var rr = Math.floor((floorY - S.WALL_SEARCH_FROM_MM) * R); rr >= Math.floor((floorY - S.WALL_SEARCH_TO_MM) * R); rr--) {
      var hit = darkAt(rr, cx);
      if (hit >= 0) { startRow = rr; cx = hit; break; }
    }
    if (startRow < 0) return 0;
    var topRow = Math.max(0, Math.floor(S.TOP_MM * R));
    var gapRows = Math.round(S.WALL_GAP_MM * R);
    var lastDark = startRow, gap = 0;
    for (var r = startRow; r >= topRow; r--) {
      var best = -1, bestC = cx;
      for (var c = Math.max(0, cx - reach); c <= Math.min(W - 1, cx + reach); c++) {
        var v = d[r * W + c];
        if (v > best) { best = v; bestC = c; }
      }
      if (best >= thr) { cx = bestC; lastDark = r; gap = 0; }
      else if (++gap > gapRows) break;
    }
    return Math.max(0, floorY - lastDark / R);
  }

  /** Share of the CEILING_RUN_MM right of the axis over which the line through (axisX, y) is followed. */
  function followedShare(a, axisX, y) {
    var S = a.config.SUGGEST, l = HUSS.detect.line.ceilingLine(a, axisX, y, null);
    if (!l.followed) return 0;
    var n = l.pts.filter(function (p) { return p[0] <= axisX + S.CEILING_RUN_MM; }).length;
    return n / (S.CEILING_RUN_MM * a.R);
  }

  /** Suggested ceiling line y (mm) above the head, or null. */
  function ceiling(a, axisX, headY) {
    var cfg = a.config, S = cfg.SUGGEST, R = a.R, P = HUSS.detect.pipeline;
    var floorAxis = P.floorY(a, axisX);
    var start = (headY != null ? headY : floorAxis - S.NO_HEAD_START_MM) - S.CEILING_START_ABOVE_HEAD_MM;
    var prof = P.ceilingProfile(a, axisX), paper = a.dm.paper;
    var peaks = candidates(prof, Math.floor(S.TOP_MM * R), Math.floor(start * R), cfg)
      .sort(function (p, q) { return q.centre - p.centre; }); // nearest to the head first
    for (var i = 0; i < peaks.length; i++) {
      var y = peaks[i].centre / R;
      var thr = threshold(paper, prof[peaks[i].index], S.CONTINUITY_FRACTION);
      var run = horizontalRun(a.dm, R, y, axisX, axisX + S.CEILING_RUN_MM, S.CEILING_Y_TOLERANCE_MM, S.CEILING_SLOPE_MAX, thr);
      if (run >= S.CEILING_RUN_MIN) return y;
      if (followedShare(a, axisX, y) >= S.CEILING_RUN_MIN) return y;
    }
    return null;
  }

  /** Suggested opposite wall x (mm) right of the figure, or null. */
  function wall(a, axisX, figureRightX, ceilingMm) {
    var cfg = a.config, S = cfg.SUGGEST, R = a.R, P = HUSS.detect.pipeline;
    var prof = a.wallProfile, paper = a.dm.paper, T = a.template;
    var from = Math.max(axisX, figureRightX != null ? figureRightX : axisX) + S.WALL_START_RIGHT_OF_FIGURE_MM;
    var need = ceilingMm != null && ceilingMm > 0 ? S.WALL_MIN_FRACTION * ceilingMm : S.WALL_MIN_MM;
    var ok = candidates(prof, Math.ceil(from * R), Math.floor((T.width_mm - 8) * R), cfg).map(function (pk) {
      var x = pk.centre / R;
      var thr = threshold(paper, prof[pk.index], S.CONTINUITY_FRACTION);
      return { x: x, run: verticalRun(a.dm, R, x, P.floorY(a, x), cfg, thr) };
    }).filter(function (c) { return c.run >= need; });
    if (!ok.length) return null;
    var right = ok[ok.length - 1];
    var inner = ok.filter(function (c) { return c.x < right.x && c.x >= right.x - S.WALL_INNER_MM; });
    return inner.length ? inner[0].x : right.x;
  }

  var api = { ceiling: ceiling, wall: wall, horizontalRun: horizontalRun, verticalRun: verticalRun };
  HUSS.detect.suggest = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
