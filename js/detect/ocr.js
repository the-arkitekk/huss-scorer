/* HuSS Scorer — js/detect/ocr.js
 * Reads the printed sheet code (five Courier characters left of the QR code) when the QR code
 * cannot be read, e.g. under an ink blot. Each character is compared with stored Courier and
 * Courier New glyphs (js/detect/glyphs.js); the check character then picks the reading, or the
 * read is refused. A refused read leaves the code to the rater; a wrong code is never returned
 * on purpose: every reading must pass the check character and be clearly better than any other
 * reading that passes it. One character lost under a blot is worked out from the check character
 * when the other four are read beyond doubt.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.detect = HUSS.detect || {};

  var PT_MM = 25.4 / 72;
  var refs = null;

  /** Mean of sample() over each cell of a gw x gh grid laid over the box (sub x sub samples per cell). */
  function toGrid(sample, x0, y0, x1, y1, gw, gh, sub) {
    var out = new Float64Array(gw * gh), cw = (x1 - x0) / gw, ch = (y1 - y0) / gh;
    for (var j = 0; j < gh; j++) {
      for (var i = 0; i < gw; i++) {
        var s = 0;
        for (var b = 0; b < sub; b++) {
          for (var a = 0; a < sub; a++) s += sample(x0 + (i + (a + 0.5) / sub) * cw, y0 + (j + (b + 0.5) / sub) * ch);
        }
        out[j * gw + i] = s / (sub * sub);
      }
    }
    return out;
  }

  /**
   * Bounding box [x0, y0, x1, y1] of the ink in a box: samples darker than thr on a grid of
   * `step`, without specks smaller than minArea samples. null when there is no ink.
   */
  function inkBox(sample, x0, y0, x1, y1, step, thr, minArea) {
    var w = Math.max(1, Math.round((x1 - x0) / step)), h = Math.max(1, Math.round((y1 - y0) / step));
    var mask = new Uint8Array(w * h), i, j;
    for (j = 0; j < h; j++) for (i = 0; i < w; i++) mask[j * w + i] = sample(x0 + (i + 0.5) * step, y0 + (j + 0.5) * step) > thr ? 1 : 0;
    var cc = HUSS.image.components.label(mask, w, h), bx0 = Infinity, by0 = Infinity, bx1 = -1, by1 = -1;
    cc.stats.forEach(function (s) {
      if (s.area < minArea) return;
      bx0 = Math.min(bx0, s.x0); by0 = Math.min(by0, s.y0); bx1 = Math.max(bx1, s.x1); by1 = Math.max(by1, s.y1);
    });
    if (bx1 < 0) return null;
    return [x0 + bx0 * step, y0 + by0 * step, x0 + (bx1 + 1) * step, y0 + (by1 + 1) * step];
  }

  /** Pearson correlation of two equal-length arrays (0 when one is flat). */
  function correlate(a, b) {
    var n = a.length, ma = 0, mb = 0, i;
    for (i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
    ma /= n; mb /= n;
    var sab = 0, saa = 0, sbb = 0;
    for (i = 0; i < n; i++) { var da = a[i] - ma, db = b[i] - mb; sab += da * db; saa += da * da; sbb += db * db; }
    return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : 0;
  }

  /** Stored glyphs decoded once: [{ ch, font, aspect, grid }]. */
  function references() {
    if (refs) return refs;
    var G = HUSS.detect.glyphs;
    refs = [];
    Object.keys(G.fonts).forEach(function (font) {
      Object.keys(G.fonts[font]).forEach(function (ch) {
        var e = G.fonts[font][ch], bytes = HUSS.detect.glyphs.decode(e.g), grid = new Float64Array(bytes.length);
        for (var k = 0; k < bytes.length; k++) grid[k] = bytes[k];
        refs.push({ ch: ch, font: font, aspect: e.a, grid: grid });
      });
    });
    return refs;
  }

  /** Every character with its best score over the stored fonts, best first. */
  function classify(grid, aspect, cfg) {
    var best = {};
    references().forEach(function (r) {
      var sc = correlate(grid, r.grid) - cfg.ASPECT_WEIGHT * Math.abs(Math.log(aspect / r.aspect));
      if (!(r.ch in best) || sc > best[r.ch]) best[r.ch] = sc;
    });
    return Object.keys(best).map(function (ch) { return { ch: ch, score: best[ch] }; })
      .sort(function (p, q) { return q.score - p.score; });
  }

  /**
   * One unreadable character (blotted, torn, missing) with the other four read beyond doubt:
   * the check character leaves exactly one possibility for it. Returns the code or null.
   */
  function solveOne(cands, cfg) {
    var lost = -1, i;
    for (i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (!c.length || c[0].score < cfg.MIN_CHAR_SCORE) { if (lost >= 0) return null; lost = i; continue; }
      if (c[0].score < cfg.SOLVE_MIN_SCORE || (c.length > 1 && c[0].score - c[1].score < cfg.SOLVE_MIN_GAP)) return null;
    }
    if (lost < 0) return null;
    var A = HUSS.sheet.code.ALPHABET, fits = [];
    for (var k = 0; k < A.length; k++) {
      var code = cands.map(function (c, j) { return j === lost ? A[k] : c[0].ch; }).join('');
      if (HUSS.sheet.code.isValid(code)) fits.push(code);
    }
    return fits.length === 1 ? { code: fits[0], position: lost } : null;
  }

  /** Among the readings built from each position's TOP_K characters, the valid ones by total score. */
  function decide(cands, cfg) {
    var n = cands.length, valid = [];
    (function walk(i, code, sum, min) {
      if (i === n) { if (HUSS.sheet.code.isValid(code)) valid.push({ code: code, sum: sum, min: min }); return; }
      for (var k = 0; k < Math.min(cfg.TOP_K, cands[i].length); k++) {
        var c = cands[i][k];
        walk(i + 1, code + c.ch, sum + c.score, Math.min(min, c.score));
      }
    })(0, '', 0, Infinity);
    valid.sort(function (p, q) { return q.sum - p.sum; });
    var top = cands.map(function (c) { return c.length ? c[0].ch : '?'; }).join('');
    var out = { found: false, best_guess: top, candidates: valid.slice(0, 3) };
    var best = valid[0], margin = valid.length > 1 ? best.sum - valid[1].sum : Infinity;
    if (best) { out.score = best.sum / n; out.margin = margin; }
    if (!best) out.reason = 'no_valid_reading';
    else if (best.min < cfg.MIN_CHAR_SCORE) out.reason = 'unsure_character';
    else if (margin < cfg.MIN_MARGIN) out.reason = 'ambiguous';
    if (out.reason) {
      var solved = solveOne(cands, cfg);
      if (solved) {
        out.found = true; out.sheet_code = solved.code; out.solved_position = solved.position; out.corrected = true;
        delete out.reason;
      }
      return out;
    }
    out.found = true;
    out.sheet_code = best.code;
    out.corrected = best.code !== top;
    return out;
  }

  /**
   * sample(x_mm, y_mm) -> darkness 0..255 on the aligned page (see detect/qr.js samplers).
   * Returns { found, sheet_code, score, margin, corrected } or { found: false, reason, best_guess }.
   */
  function read(sample, T, config) {
    var cfg = config.OCR, ct = T.code_text, G = HUSS.detect.glyphs;
    var n = cfg.LENGTH, em = ct.size_pt * PT_MM, pitch = cfg.ADVANCE_EM * em, step = cfg.STEP_MM;
    var left = ct.right - n * pitch, y0 = ct.baseline - cfg.TOP_EM * em, y1 = ct.baseline + cfg.BOTTOM_EM * em;
    var rx0 = left - cfg.MAX_SHIFT_MM, rx1 = ct.right + cfg.MAX_SHIFT_MM;
    var cols = Math.round((rx1 - rx0) / step), rows = Math.round((y1 - y0) / step);

    // Threshold and contrast from the code area
    var vals = new Float64Array(cols * rows), i, j;
    for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) vals[j * cols + i] = sample(rx0 + (i + 0.5) * step, y0 + (j + 0.5) * step);
    var sorted = Array.prototype.slice.call(vals).sort(function (p, q) { return p - q; });
    var paper = sorted[Math.floor(sorted.length * 0.5)], ink = sorted[Math.floor(sorted.length * 0.99)];
    if (ink - paper < cfg.MIN_CONTRAST) return { found: false, reason: 'no_text' };
    var thr = paper + 0.5 * (ink - paper);

    // Horizontal registration: the shift that puts the least ink on the borders between characters
    var colInk = new Float64Array(cols);
    for (i = 0; i < cols; i++) for (j = 0; j < rows; j++) if (vals[j * cols + i] > thr) colInk[i]++;
    var bestDx = 0, bestCost = Infinity;
    for (var dx = -cfg.MAX_SHIFT_MM; dx <= cfg.MAX_SHIFT_MM + 1e-9; dx += step) {
      var cost = 0;
      for (var k = 0; k <= n; k++) {
        var c = Math.floor((left + k * pitch + dx - rx0) / step);
        for (var e = -1; e <= 1; e++) if (c + e >= 0 && c + e < cols) cost += colInk[c + e];
      }
      if (cost < bestCost - 1e-9 || (Math.abs(cost - bestCost) <= 1e-9 && Math.abs(dx) < Math.abs(bestDx))) { bestCost = cost; bestDx = dx; }
    }

    var minArea = cfg.MIN_SPECK_MM2 / (step * step), cands = [];
    for (i = 0; i < n; i++) {
      var box = inkBox(sample, left + i * pitch + bestDx, y0, left + (i + 1) * pitch + bestDx, y1, step, thr, minArea);
      if (!box) { cands.push([]); continue; } // nothing there (torn off, erased): maybe solvable
      var grid = toGrid(sample, box[0], box[1], box[2], box[3], G.GW, G.GH, cfg.SUB);
      cands.push(classify(grid, (box[2] - box[0]) / (box[3] - box[1]), cfg));
    }
    var out = decide(cands, cfg);
    out.shift_mm = bestDx;
    out.characters = cands.map(function (c) { return c.slice(0, cfg.TOP_K); });
    return out;
  }

  var api = { read: read, toGrid: toGrid, inkBox: inkBox, correlate: correlate, classify: classify, decide: decide };
  HUSS.detect.ocr = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
