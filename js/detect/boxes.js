/* HuSS Scorer — js/detect/boxes.js
 * Structure boxes (projects with two or more structures): which boxes are printed on the sheet
 * and which one the desk coordinator marked (a cross, a tick or filled in). Works on a darkness
 * sampler in page mm, so it does not depend on the scan resolution. DOM-free.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.detect = HUSS.detect || {};

  function median(v) {
    var s = v.slice().sort(function (a, b) { return a - b; }), n = s.length;
    return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0;
  }

  /** Is the printed frame of a box there? Each side must be dark along most of its length. */
  function framed(sample, b, line, paper, C) {
    var c = line / 2, s = b.size, sides = [
      function (t, o) { return sample(b.x + t, b.y + c + o); },          // top
      function (t, o) { return sample(b.x + t, b.y + s - c + o); },      // bottom
      function (t, o) { return sample(b.x + c + o, b.y + t); },          // left
      function (t, o) { return sample(b.x + s - c + o, b.y + t); }       // right
    ];
    return sides.every(function (at) {
      var n = 0, hit = 0;
      for (var t = C.FRAME_END_MM; t <= s - C.FRAME_END_MM + 1e-9; t += C.FRAME_STEP_MM) {
        var best = 0;
        for (var o = -C.FRAME_SLACK_MM; o <= C.FRAME_SLACK_MM + 1e-9; o += 0.1) best = Math.max(best, at(t, o));
        n++;
        if (best - paper >= C.FRAME_CONTRAST) hit++;
      }
      return n > 0 && hit / n >= C.FRAME_MIN;
    });
  }

  /** Share of the inside of a box (frame left out) darker than the paper by MARK_CONTRAST. */
  function fill(sample, b, paper, C) {
    var n = 0, dark = 0, a = C.INSET_MM, z = b.size - C.INSET_MM;
    for (var y = a; y <= z + 1e-9; y += C.STEP_MM) {
      for (var x = a; x <= z + 1e-9; x += C.STEP_MM) {
        n++;
        if (sample(b.x + x, b.y + y) - paper >= C.MARK_CONTRAST) dark++;
      }
    }
    return n ? dark / n : 0;
  }

  /**
   * sample(x, y): darkness (0 paper .. 255 black) at page mm. Returns
   * { printed: number of boxes found, fills: [share per box], index: marked box (0-based) or null,
   *   status: 'one' | 'none' | 'several' | 'not_printed' }.
   * One box clearly darker than the others is the mark; a stray stroke in a neighbouring box is
   * tolerated when the mark is DOMINANCE times fuller. Two similar marks (a corrected choice) or
   * none leave the structure open.
   */
  function read(sample, T, cfg) {
    var g = T.boxes, C = (cfg || HUSS.config).BOXES;
    var none = { printed: 0, fills: [], index: null, status: 'not_printed' };
    if (!g) return none;
    var all = HUSS.sheet.template.structureBoxes(T, g.max);
    var ps = [];
    for (var x = g.x0 - 2; x <= g.x0 + g.max * g.pitch; x += 0.5) ps.push(sample(x, g.y - C.PAPER_ABOVE_MM));
    var paper = median(ps);
    var printed = 0;
    while (printed < all.length && framed(sample, all[printed], g.line, paper, C)) printed++;
    if (printed < 2) return none;
    var fills = all.slice(0, printed).map(function (b) { return fill(sample, b, paper, C); });
    var order = fills.map(function (f, i) { return i; }).sort(function (a, b) { return fills[b] - fills[a]; });
    var top = order[0], second = order[1];
    var res = { printed: printed, fills: fills, index: null, status: 'none', paper: paper };
    if (fills[top] < C.MIN_FILL) return res;
    if (fills[second] >= C.MIN_FILL && fills[top] < C.DOMINANCE * fills[second]) { res.status = 'several'; return res; }
    res.index = top;
    res.status = 'one';
    return res;
  }

  /** The structure code of a reading, from the project's structures in their order (or null). */
  function codeOf(reading, structures) {
    if (!reading || reading.status !== 'one' || !structures || reading.index >= structures.length) return null;
    var s = structures[reading.index];
    return typeof s === 'string' ? s : s.code;
  }

  var api = { read: read, codeOf: codeOf };
  HUSS.detect.boxes = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
