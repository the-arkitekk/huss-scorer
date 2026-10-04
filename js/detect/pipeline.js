/* HuSS Scorer — js/detect/pipeline.js
 * Runs the detection steps of section 7 on one decoded image and offers the
 * snap helpers the scoring screen needs. DOM-free.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.detect = HUSS.detect || {};

  function now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  /**
   * img: RGBA { width, height, data } (EXIF orientation already applied).
   * opts: { template: 'A4L' | 'A3L', params: { foot_tolerance_mm, ... }, config }
   * Returns { ok: false, error, stage } or the analysis object (see bottom).
   */
  function setup(opts) {
    opts = opts || {};
    var cfg = opts.config || HUSS.config;
    var params = opts.params || cfg.DEFAULTS;
    return { cfg: cfg, params: params, T: HUSS.sheet.template.get(opts.template || params.template || cfg.DEFAULTS.template) };
  }

  function analyze(img, opts) {
    var o = setup(opts), cfg = o.cfg, T = o.T, D = HUSS.detect;
    var t = { start: now() };
    var corners = D.corners.findCorners(img, T, cfg);
    t.corners = now();
    if (!corners.ok) return { ok: false, stage: 'corners', error: corners.error, missing: corners.missing };
    var orient = D.corners.chooseOrientation(img, corners.points, T, corners.threshold, cfg);
    t.orientation = now();
    if (!orient.ok) return { ok: false, stage: 'orientation', error: orient.error };
    return analyzeAligned(img, {
      H: orient.H, method: 'auto', corners: orient.corners, quarter: orient.quarter, tie: orient.tie,
      tieBreak: orient.tieBreak, qr: orient.qr, floorRatio: orient.floorRatio, markRatio: orient.markRatio
    }, opts, t);
  }

  /**
   * Manual alignment, corner marks (spec 7.5): four clicks near the corner squares, in any order.
   * Each click is centred on its square; the orientation is found as in automatic alignment.
   */
  function manualCorners(img, clicks, opts) {
    var o = setup(opts), cfg = o.cfg, T = o.T, D = HUSS.detect;
    if (!clicks || clicks.length !== 4) return { ok: false, stage: 'manual', error: 'manual_points' };
    var est = Math.max(img.width, img.height) / Math.max(T.width_mm, T.height_mm);
    var win = cfg.MANUAL.REFINE_WINDOW_MM * est;
    var pts = [];
    for (var i = 0; i < 4; i++) {
      var c = clicks[i];
      for (var k = 0; k < 2; k++) {
        var r = D.corners.refineCentre(img, c[0] - win, c[1] - win, c[0] + win, c[1] + win, cfg.CORNERS);
        if (!r) return { ok: false, stage: 'manual', error: 'manual_no_square', index: i };
        c = r;
      }
      pts.push(c);
    }
    var cx = 0, cy = 0;
    pts.forEach(function (p) { cx += p[0] / 4; cy += p[1] / 4; });
    pts.sort(function (a, b) { return Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx); }); // TL, TR, BR, BL
    var orient = D.corners.chooseOrientation(img, pts, T, D.corners.darkThreshold(img, cfg), cfg);
    if (!orient.ok) return { ok: false, stage: 'manual', error: 'orientation_failed' };
    return analyzeAligned(img, {
      H: orient.H, method: 'manual_corners', corners: orient.corners, quarter: orient.quarter, tie: orient.tie,
      tieBreak: orient.tieBreak, qr: orient.qr, floorRatio: orient.floorRatio, markRatio: orient.markRatio
    }, opts);
  }

  /**
   * Manual alignment, floor line (spec 7.5): the two ends of the printed floor line, the end at
   * the start mark first; a similarity transform maps the page.
   */
  function manualFloorline(img, p1, p2, opts) {
    var o = setup(opts), T = o.T, Hm = HUSS.image.homography;
    var sim = Hm.fitSimilarity([[T.floor.x0, T.floor.y], [T.floor.x1, T.floor.y]], [p1, p2]);
    var corners = T.corners.map(function (c) { return Hm.apply(sim.H, c[0], c[1]); });
    return analyzeAligned(img, { H: sim.H, method: 'manual_floorline', corners: corners, residual: null }, opts);
  }

  /** Everything after alignment: rectification, floor line, QR, red figure, profiles, suggestions. */
  function analyzeAligned(img, al, opts, t) {
    var o = setup(opts), cfg = o.cfg, params = o.params, T = o.T;
    var Hm = HUSS.image.homography, D = HUSS.detect;
    t = t || { start: now() };
    if (!t.corners) { t.corners = t.start; t.orientation = t.start; }
    var H = al.H, Hinv = Hm.invert(H);
    var residual = al.residual === undefined ? 0 : al.residual;
    if (al.residual === undefined) {
      var sim = Hm.fitSimilarity(T.corners, al.corners);
      for (var i = 0; i < 4; i++) {
        var q = Hm.apply(sim.H, T.corners[i][0], T.corners[i][1]);
        residual = Math.max(residual, Math.hypot(q[0] - al.corners[i][0], q[1] - al.corners[i][1]) / sim.scale);
      }
    }
    var J = Hm.jacobian(H, T.width_mm / 2, T.height_mm / 2);
    var pxx = Math.hypot(J[0][0], J[1][0]), pxy = Math.hypot(J[0][1], J[1][1]);
    var rot = Math.atan2(J[1][0], J[0][0]) * 180 / Math.PI;

    var R = HUSS.image.rectify.chooseR((pxx + pxy) / 2, T, cfg.RECTIFY);
    var rect = HUSS.image.rectify.rectify(img, H, T, R, cfg.RECTIFY.OUTSIDE_VALUE);
    t.rectify = now();
    var dark = HUSS.image.lab.darkness(rect);
    var floor = D.floorline.refine(dark, R, T, cfg);
    t.floor = now();
    var qr = al.qr || D.qr.read(D.qr.rectSampler(dark, R), T, cfg);
    if (qr.found) qr.template_mismatch = qr.template !== T.id;
    t.qr = now();
    var markX = HUSS.sheet.template.markX(T);
    var red = D.redfigure.detect(rect, T, D.floorline.yAt(floor, markX), cfg);
    t.red = now();
    var dm = D.profile.maskedDarkness(dark, red.pageMask, cfg.RED.DARKNESS_DILATE_PX);
    var sigma = cfg.PROFILE.SMOOTH_SIGMA_MM * R;
    var wallProfile = D.profile.smooth(D.profile.wallProfile(dm, R, floor, cfg.PROFILE), sigma);
    var redEdges = D.redfigure.edges(red, R, cfg.RED.HEAD_MIN_PIXELS, 1);
    t.profiles = now();

    var axisX = red.found ? red.axis_x : markX;
    var sug = { axis_x: axisX, head_y: null, foot_y: null, foot_off_floor: false, ceiling_y: null, wall_x: null };
    if (red.found) {
      var fr = HUSS.measure.compute.footRule(red.raw_foot_y, D.floorline.yAt(floor, axisX), params.foot_tolerance_mm);
      sug.head_y = red.head_y;
      sug.foot_y = fr.foot_y;
      sug.foot_off_floor = fr.off_floor;
    }
    var result = {
      ok: true, template: T, config: cfg, R: R, dm: dm, floor: floor, wallProfile: wallProfile, ceilingCache: {}
    };
    var switches = params.suggestions || {};
    if (switches.ceiling !== false) sug.ceiling_y = D.suggest.ceiling(result, axisX, sug.head_y);
    if (switches.wall !== false) {
      var ceilMm = sug.ceiling_y != null ? D.floorline.yAt(floor, axisX) - sug.ceiling_y : null;
      sug.wall_x = D.suggest.wall(result, axisX, red.found ? red.right_x : null, ceilMm);
    }
    t.suggest = now();

    var c = al.corners; // page order TL, TR, BR, BL
    return {
      ok: true,
      template: T,
      config: cfg,
      image: { width: img.width, height: img.height },
      H: H, Hinv: Hinv, R: R,
      rect: rect, dark: dark, dm: dm,
      align: {
        method: al.method,
        corners: { tl: c[0], tr: c[1], br: c[2], bl: c[3] },
        px_per_mm_x: pxx, px_per_mm_y: pxy, rotation_deg: rot,
        residual_mm: residual,
        warning: (residual != null && residual > cfg.ALIGN.RESIDUAL_WARN_MM) || !floor.ok,
        quarter: al.quarter == null ? null : al.quarter, orientation_tie: !!al.tie, tie_break: al.tieBreak || null,
        floor_ratio: al.floorRatio == null ? null : al.floorRatio, mark_ratio: al.markRatio == null ? null : al.markRatio
      },
      floor: floor,
      qr: qr,
      red: red,
      redEdges: redEdges,
      wallProfile: wallProfile,
      ceilingCache: result.ceilingCache,
      suggestions: sug,
      timings: {
        corners: t.corners - t.start, orientation: t.orientation - t.corners, rectify: t.rectify - t.orientation,
        floor: t.floor - t.rectify, qr: t.qr - t.floor, red: t.red - t.qr, profiles: t.profiles - t.red,
        suggest: t.suggest - t.profiles, total: t.suggest - t.start
      }
    };
  }

  /**
   * Fast sheet code reading for the queue (no rectification): corner marks, orientation, QR.
   * Returns { ok: true, sheet_code, template, template_mismatch } or { ok: false, reason }.
   */
  function readCode(img, opts) {
    opts = opts || {};
    var cfg = opts.config || HUSS.config;
    var params = opts.params || cfg.DEFAULTS;
    var T = HUSS.sheet.template.get(opts.template || params.template || cfg.DEFAULTS.template);
    var D = HUSS.detect;
    var corners = D.corners.findCorners(img, T, cfg);
    if (!corners.ok) return { ok: false, reason: 'corners' };
    var orient = D.corners.chooseOrientation(img, corners.points, T, corners.threshold, cfg);
    if (!orient.ok) return { ok: false, reason: 'orientation' };
    var qr = orient.qr || D.qr.read(D.qr.imageSampler(img, orient.H), T, cfg);
    if (!qr.found) return { ok: false, reason: 'qr' };
    return { ok: true, sheet_code: qr.sheet_code, template: qr.template, template_mismatch: qr.template !== T.id };
  }

  function floorY(a, x) {
    return HUSS.detect.floorline.yAt(a.floor, x);
  }

  /** Smoothed ceiling profile for an axis position (cached per axis value). */
  function ceilingProfile(a, axisX) {
    var key = axisX.toFixed(4);
    if (!a.ceilingCache[key]) {
      var P = HUSS.detect.profile, cfg = a.config.PROFILE;
      a.ceilingCache = {};
      a.ceilingCache[key] = P.smooth(P.ceilingProfile(a.dm, a.R, axisX, cfg), cfg.SMOOTH_SIGMA_MM * a.R);
    }
    return a.ceilingCache[key];
  }

  function snapCeiling(a, axisX, dropY, radius) {
    return HUSS.detect.snap.toLine(ceilingProfile(a, axisX), a.R, dropY, radius, a.config.PROFILE);
  }

  function snapWall(a, dropX, radius) {
    return HUSS.detect.snap.toLine(a.wallProfile, a.R, dropX, radius, a.config.PROFILE);
  }

  function snapHead(a, dropY, radius) {
    return HUSS.detect.snap.toCandidates(a.redEdges.tops, dropY, radius);
  }

  function snapFoot(a, axisX, dropY, radius) {
    return HUSS.detect.snap.toCandidates(a.redEdges.bottoms.concat([floorY(a, axisX)]), dropY, radius);
  }

  /** Page mm -> original image px. */
  function toImagePx(a, x, y) {
    return HUSS.image.homography.apply(a.H, x, y);
  }

  var api = {
    analyze: analyze, analyzeAligned: analyzeAligned, manualCorners: manualCorners, manualFloorline: manualFloorline,
    readCode: readCode, floorY: floorY, ceilingProfile: ceilingProfile,
    snapCeiling: snapCeiling, snapWall: snapWall, snapHead: snapHead, snapFoot: snapFoot,
    toImagePx: toImagePx
  };
  HUSS.detect.pipeline = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
