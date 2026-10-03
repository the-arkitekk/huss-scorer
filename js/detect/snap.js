/* HuSS Scorer — js/detect/snap.js
 * Snap rules (spec 7.8): a released handle jumps to the nearest line centre (or red edge)
 * within snap_radius_mm; otherwise it stays where it was released.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.detect = HUSS.detect || {};

  /** Nearest candidate (mm) within radius of the drop point. */
  function toCandidates(cands, dropMm, radiusMm) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < cands.length; i++) {
      var d = Math.abs(cands[i] - dropMm);
      if (d <= radiusMm && d < bestD) { bestD = d; best = cands[i]; }
    }
    return best === null ? { pos: dropMm, snapped: false } : { pos: best, snapped: true };
  }

  /** Line centres (mm) of a smoothed profile around the drop point. */
  function lineCandidates(profile, R, dropMm, radiusMm, cfg) {
    var lo = Math.floor((dropMm - radiusMm) * R), hi = Math.ceil((dropMm + radiusMm) * R);
    return HUSS.detect.profile.findPeaks(profile, lo, hi, cfg).map(function (pk) { return pk.centre / R; });
  }

  /** Snap on a smoothed darkness profile. */
  function toLine(profile, R, dropMm, radiusMm, cfg) {
    return toCandidates(lineCandidates(profile, R, dropMm, radiusMm, cfg), dropMm, radiusMm);
  }

  var api = { toCandidates: toCandidates, lineCandidates: lineCandidates, toLine: toLine };
  HUSS.detect.snap = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
