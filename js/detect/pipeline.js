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
  function analyze(img, opts) {
    opts = opts || {};
    var cfg = opts.config || HUSS.config;
    var params = opts.params || cfg.DEFAULTS;
    var T = HUSS.sheet.template.get(opts.template || params.template || cfg.DEFAULTS.template);
    var Hm = HUSS.image.homography, D = HUSS.detect;
    var t = { start: now() };

    var corners = D.corners.findCorners(img, T, cfg);
    t.corners = now();
    if (!corners.ok) return { ok: false, stage: 'corners', error: corners.error, missing: corners.missing };
    var orient = D.corners.chooseOrientation(img, corners.points, T, corners.threshold, cfg);
    t.orientation = now();
    if (!orient.ok) return { ok: false, stage: 'orientation', error: orient.error };

    var H = orient.H, Hinv = Hm.invert(H);
    var sim = Hm.fitSimilarity(T.corners, orient.corners);
    var residual = 0;
    for (var i = 0; i < 4; i++) {
      var q = Hm.apply(sim.H, T.corners[i][0], T.corners[i][1]);
      residual = Math.max(residual, Math.hypot(q[0] - orient.corners[i][0], q[1] - orient.corners[i][1]) / sim.scale);
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
    var markX = HUSS.sheet.template.markX(T);
    var red = D.redfigure.detect(rect, T, D.floorline.yAt(floor, markX), cfg);
    t.red = now();
    var dm = D.profile.maskedDarkness(dark, red.pageMask, cfg.RED.DARKNESS_DILATE_PX);
    var sigma = cfg.PROFILE.SMOOTH_SIGMA_MM * R;
    var wallProfile = D.profile.smooth(D.profile.wallProfile(dm, R, floor, cfg.PROFILE), sigma);
    var redEdges = D.redfigure.edges(red, R, cfg.RED.HEAD_MIN_PIXELS, 1);
    t.profiles = now();

    var axisX = red.found ? red.axis_x : markX;
    var sug = { axis_x: axisX, head_y: null, foot_y: null, foot_off_floor: false };
    if (red.found) {
      var fr = HUSS.measure.compute.footRule(red.raw_foot_y, D.floorline.yAt(floor, axisX), params.foot_tolerance_mm);
      sug.head_y = red.head_y;
      sug.foot_y = fr.foot_y;
      sug.foot_off_floor = fr.off_floor;
    }

    var c = orient.corners; // page order TL, TR, BR, BL
    return {
      ok: true,
      template: T,
      config: cfg,
      image: { width: img.width, height: img.height },
      H: H, Hinv: Hinv, R: R,
      rect: rect, dark: dark, dm: dm,
      align: {
        method: 'auto',
        corners: { tl: c[0], tr: c[1], br: c[2], bl: c[3] },
        px_per_mm_x: pxx, px_per_mm_y: pxy, rotation_deg: rot,
        residual_mm: residual,
        warning: residual > cfg.ALIGN.RESIDUAL_WARN_MM || !floor.ok,
        quarter: orient.quarter, orientation_tie: orient.tie,
        floor_ratio: orient.floorRatio, mark_ratio: orient.markRatio
      },
      floor: floor,
      red: red,
      redEdges: redEdges,
      wallProfile: wallProfile,
      ceilingCache: {},
      suggestions: sug,
      timings: {
        corners: t.corners - t.start, orientation: t.orientation - t.corners, rectify: t.rectify - t.orientation,
        floor: t.floor - t.rectify, red: t.red - t.floor, profiles: t.profiles - t.red, total: t.profiles - t.start
      }
    };
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
    analyze: analyze, floorY: floorY, ceilingProfile: ceilingProfile,
    snapCeiling: snapCeiling, snapWall: snapWall, snapHead: snapHead, snapFoot: snapFoot,
    toImagePx: toImagePx
  };
  HUSS.detect.pipeline = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
