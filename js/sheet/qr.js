/* HuSS Scorer — js/sheet/qr.js
 * Minimal QR Code (ISO/IEC 18004) for sheet codes: version 1 (21 x 21 modules),
 * alphanumeric mode, any error correction level (sheets use Q). Encoder and grid decoder
 * with Reed–Solomon error correction. No dependencies; standard codes, readable by phones.
 *
 * Grid convention: grid[row][col], true = dark. x = column, y = row.
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.sheet = HUSS.sheet || {};

  var SIZE = 21;                       // version 1
  var ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
  // Version 1 codeword counts per level: [data, ecc]; format bits per level (L=1, M=0, Q=3, H=2)
  var LEVELS = {
    L: { data: 19, ecc: 7, fmt: 1 },
    M: { data: 16, ecc: 10, fmt: 0 },
    Q: { data: 13, ecc: 13, fmt: 3 },
    H: { data: 9, ecc: 17, fmt: 2 }
  };
  var LEVEL_BY_FMT = { 1: 'L', 0: 'M', 3: 'Q', 2: 'H' };

  // ---------------------------------------------------------------- GF(256), primitive 0x11D
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11D;
    }
    for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  function gmul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }
  function gdiv(a, b) {
    if (!b) throw new Error('GF division by zero');
    return a ? EXP[(LOG[a] + 255 - LOG[b]) % 255] : 0;
  }

  /** Generator polynomial (highest degree first, leading 1) with roots alpha^0..alpha^(n-1). */
  function generator(n) {
    var g = [1];
    for (var i = 0; i < n; i++) {
      var next = new Array(g.length + 1).fill(0);
      for (var j = 0; j < g.length; j++) {
        next[j] ^= g[j];
        next[j + 1] ^= gmul(g[j], EXP[i]);
      }
      g = next;
    }
    return g;
  }

  /** Reed–Solomon error correction codewords for `data`. */
  function rsEncode(data, n) {
    var g = generator(n), res = data.concat(new Array(n).fill(0));
    for (var i = 0; i < data.length; i++) {
      var c = res[i];
      if (!c) continue;
      for (var j = 1; j <= n; j++) res[i + j] ^= gmul(g[j], c);
    }
    return res.slice(data.length);
  }

  /**
   * Reed–Solomon decoding in place (codewords: data followed by `nEcc` ecc codewords).
   * Returns the number of corrected codewords, or -1 when the errors cannot be corrected.
   */
  function rsDecode(cw, nEcc) {
    var n = cw.length, i, j;
    // Syndromes S_j = r(alpha^j), r[0] is the highest-degree coefficient
    var S = new Array(nEcc), any = false;
    for (j = 0; j < nEcc; j++) {
      var s = 0;
      for (i = 0; i < n; i++) s = gmul(s, EXP[j]) ^ cw[i];
      S[j] = s;
      if (s) any = true;
    }
    if (!any) return 0;
    // Berlekamp–Massey (ascending coefficients)
    var C = [1], B = [1], L = 0, m = 1, b = 1;
    for (var k = 0; k < nEcc; k++) {
      var d = S[k];
      for (i = 1; i <= L; i++) d ^= gmul(C[i] || 0, S[k - i]);
      if (d === 0) { m++; continue; }
      var coef = gdiv(d, b), T = C.slice();
      var need = B.length + m;
      while (C.length < need) C.push(0);
      for (i = 0; i < B.length; i++) C[i + m] ^= gmul(coef, B[i]);
      if (2 * L <= k) { L = k + 1 - L; B = T; b = d; m = 1; } else { m++; }
    }
    if (2 * L > nEcc) return -1;
    var lambda = C.slice(0, L + 1);
    var evalAsc = function (p, x) { var y = 0; for (var q = p.length - 1; q >= 0; q--) y = gmul(y, x) ^ p[q]; return y; };
    // Chien search: position i has power p = n-1-i, X = alpha^p
    var pos = [];
    for (i = 0; i < n; i++) {
      var p = n - 1 - i;
      if (evalAsc(lambda, EXP[(255 - p) % 255]) === 0) pos.push(i);
    }
    if (pos.length !== L) return -1;
    // Omega = S(x) * Lambda(x) mod x^nEcc
    var omega = new Array(nEcc).fill(0);
    for (i = 0; i < nEcc; i++) {
      for (j = 0; j <= i && j < lambda.length; j++) omega[i] ^= gmul(S[i - j], lambda[j]);
    }
    // Formal derivative of Lambda
    var dl = [];
    for (i = 1; i < lambda.length; i++) dl.push(i % 2 ? lambda[i] : 0);
    for (var e = 0; e < pos.length; e++) {
      var pw = n - 1 - pos[e], X = EXP[pw], Xinv = EXP[(255 - pw) % 255];
      var den = evalAsc(dl, Xinv);
      if (!den) return -1;
      cw[pos[e]] ^= gmul(X, gdiv(evalAsc(omega, Xinv), den));
    }
    // Verify
    for (j = 0; j < nEcc; j++) {
      var t = 0;
      for (i = 0; i < n; i++) t = gmul(t, EXP[j]) ^ cw[i];
      if (t) return -1;
    }
    return L;
  }

  // ---------------------------------------------------------------- data bits

  function encodeData(text, level) {
    var cap = LEVELS[level].data, bits = [];
    var push = function (v, len) { for (var i = len - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
    push(2, 4);                 // alphanumeric mode 0010
    push(text.length, 9);       // character count (versions 1-9)
    for (var i = 0; i + 1 < text.length; i += 2) push(ALNUM.indexOf(text[i]) * 45 + ALNUM.indexOf(text[i + 1]), 11);
    if (text.length % 2) push(ALNUM.indexOf(text[text.length - 1]), 6);
    var capBits = cap * 8;
    if (bits.length > capBits) throw new Error('QR: text too long for version 1-' + level);
    push(0, Math.min(4, capBits - bits.length));          // terminator
    while (bits.length % 8) bits.push(0);
    var bytes = [];
    for (i = 0; i < bits.length; i += 8) {
      var v = 0;
      for (var j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
      bytes.push(v);
    }
    for (var pad = 0xEC; bytes.length < cap; pad ^= 0xEC ^ 0x11) bytes.push(pad);
    return bytes;
  }

  function decodeData(bytes) {
    var bits = [], i;
    bytes.forEach(function (b) { for (var k = 7; k >= 0; k--) bits.push((b >>> k) & 1); });
    var p = 0;
    var read = function (len) {
      if (p + len > bits.length) throw new Error('short');
      var v = 0;
      for (var k = 0; k < len; k++) v = (v << 1) | bits[p++];
      return v;
    };
    var mode = read(4);
    if (mode !== 2) return null;                 // only alphanumeric is used on sheets
    var count = read(9), out = '';
    for (i = 0; i + 1 < count; i += 2) {
      var v = read(11);
      if (Math.floor(v / 45) >= 45) return null;
      out += ALNUM[Math.floor(v / 45)] + ALNUM[v % 45];
    }
    if (count % 2) {
      var w = read(6);
      if (w >= 45) return null;
      out += ALNUM[w];
    }
    return out;
  }

  // ---------------------------------------------------------------- matrix

  function emptyGrid() {
    var g = [];
    for (var r = 0; r < SIZE; r++) g.push(new Array(SIZE).fill(false));
    return g;
  }

  /** Grid of function-pattern modules (true) for version 1. */
  function functionMap() {
    var f = emptyGrid(), r, c;
    var block = function (r0, c0) {
      for (r = Math.max(0, r0 - 1); r <= Math.min(SIZE - 1, r0 + 7); r++) {
        for (c = Math.max(0, c0 - 1); c <= Math.min(SIZE - 1, c0 + 7); c++) f[r][c] = true;
      }
    };
    block(0, 0); block(0, SIZE - 7); block(SIZE - 7, 0);          // finders + separators
    for (var i = 0; i < SIZE; i++) { f[6][i] = true; f[i][6] = true; } // timing
    for (i = 0; i < 9; i++) { f[8][i] = true; f[i][8] = true; }      // format (top-left)
    for (i = 0; i < 8; i++) { f[8][SIZE - 1 - i] = true; f[SIZE - 1 - i][8] = true; } // format (copies) + dark module
    return f;
  }
  var FUNC = functionMap();

  function drawFunctionPatterns(g) {
    var finder = function (r0, c0) {
      for (var r = -1; r <= 7; r++) {
        for (var c = -1; c <= 7; c++) {
          var rr = r0 + r, cc = c0 + c;
          if (rr < 0 || cc < 0 || rr >= SIZE || cc >= SIZE) continue;
          var d = Math.max(Math.abs(r - 3), Math.abs(c - 3));
          g[rr][cc] = d !== 2 && d !== 4;   // ring (3), gap (2), centre (0-1), separator (4)
        }
      }
    };
    finder(0, 0); finder(0, SIZE - 7); finder(SIZE - 7, 0);
    for (var i = 8; i < SIZE - 8; i++) { g[6][i] = i % 2 === 0; g[i][6] = i % 2 === 0; }
    g[SIZE - 8][8] = true;                 // dark module
  }

  function formatBits(level, mask) {
    var data = (LEVELS[level].fmt << 3) | mask, rem = data;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return ((data << 10) | (rem & 0x3FF)) ^ 0x5412;
  }

  // Positions of format bit i (LSB = 0) in copy 1 and copy 2, as [row, col].
  var FMT_POS = (function () {
    var a = [], b = [], i;
    for (i = 0; i <= 5; i++) a.push([i, 8]);
    a.push([7, 8], [8, 8], [8, 7]);
    for (i = 9; i < 15; i++) a.push([8, 14 - i]);
    for (i = 0; i < 8; i++) b.push([8, SIZE - 1 - i]);
    for (i = 8; i < 15; i++) b.push([SIZE - 15 + i, 8]);
    return [a, b];
  })();

  function drawFormat(g, bits) {
    for (var i = 0; i < 15; i++) {
      var on = ((bits >>> i) & 1) === 1;
      g[FMT_POS[0][i][0]][FMT_POS[0][i][1]] = on;
      g[FMT_POS[1][i][0]][FMT_POS[1][i][1]] = on;
    }
    g[SIZE - 8][8] = true;
  }

  /** Visits data modules in placement order: fn(row, col, index). */
  function eachDataModule(fn) {
    var idx = 0;
    for (var right = SIZE - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      var upward = ((right + 1) & 2) === 0;
      for (var v = 0; v < SIZE; v++) {
        for (var j = 0; j < 2; j++) {
          var c = right - j, r = upward ? SIZE - 1 - v : v;
          if (!FUNC[r][c]) fn(r, c, idx++);
        }
      }
    }
  }

  function maskBit(mask, r, c) {
    switch (mask) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return (r * c) % 2 + (r * c) % 3 === 0;
      case 6: return ((r * c) % 2 + (r * c) % 3) % 2 === 0;
      case 7: return ((r + c) % 2 + (r * c) % 3) % 2 === 0;
    }
    return false;
  }

  function penalty(g) {
    var score = 0, r, c, run, i;
    var lineAt = function (k, horizontal, idx) { return horizontal ? g[k][idx] : g[idx][k]; };
    for (var pass = 0; pass < 2; pass++) {
      var hz = pass === 0;
      for (var k = 0; k < SIZE; k++) {
        run = 1;
        for (i = 1; i < SIZE; i++) {
          if (lineAt(k, hz, i) === lineAt(k, hz, i - 1)) {
            run++;
            if (run === 5) score += 3; else if (run > 5) score += 1;
          } else run = 1;
        }
        // finder-like 1011101 with 4 light modules on one side
        for (i = 0; i + 10 < SIZE; i++) {
          var pat = '';
          for (var q = 0; q < 11; q++) pat += lineAt(k, hz, i + q) ? '1' : '0';
          if (pat === '10111010000' || pat === '00001011101') score += 40;
        }
      }
    }
    for (r = 0; r < SIZE - 1; r++) {
      for (c = 0; c < SIZE - 1; c++) {
        var v = g[r][c];
        if (v === g[r][c + 1] && v === g[r + 1][c] && v === g[r + 1][c + 1]) score += 3;
      }
    }
    var dark = 0;
    for (r = 0; r < SIZE; r++) for (c = 0; c < SIZE; c++) if (g[r][c]) dark++;
    var total = SIZE * SIZE;
    score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return score;
  }

  /**
   * Encodes alphanumeric `text` as a version 1 QR code. The mask with the lowest penalty is
   * used unless `forceMask` (0-7) is given (tests).
   * Returns { size, level, mask, grid, dark(r, c) }.
   */
  function encode(text, level, forceMask) {
    level = level || 'Q';
    for (var t = 0; t < text.length; t++) if (ALNUM.indexOf(text[t]) < 0) throw new Error('QR: not alphanumeric: ' + text[t]);
    var data = encodeData(text, level);
    var codewords = data.concat(rsEncode(data, LEVELS[level].ecc));
    var best = null, bestScore = Infinity;
    for (var mask = 0; mask < 8; mask++) {
      if (forceMask != null && mask !== forceMask) continue;
      var g = emptyGrid();
      drawFunctionPatterns(g);
      eachDataModule(function (r, c, i) {
        var bit = (codewords[i >>> 3] >>> (7 - (i & 7))) & 1;
        g[r][c] = (bit === 1) !== maskBit(mask, r, c);
      });
      drawFormat(g, formatBits(level, mask));
      var sc = penalty(g);
      if (sc < bestScore) { bestScore = sc; best = { grid: g, mask: mask }; }
    }
    var grid = best.grid;
    return { size: SIZE, level: level, mask: best.mask, grid: grid, dark: function (r, c) { return grid[r][c]; } };
  }

  function hamming(a, b) {
    var x = a ^ b, n = 0;
    while (x) { n += x & 1; x >>>= 1; }
    return n;
  }

  /**
   * Decodes a 21 x 21 grid (grid[row][col], truthy = dark).
   * Returns { ok, text, level, mask, corrected } or { ok: false, reason }.
   */
  function decodeGrid(grid) {
    if (!grid || grid.length !== SIZE) return { ok: false, reason: 'size' };
    var read = function (copy) {
      var v = 0;
      for (var i = 0; i < 15; i++) if (grid[FMT_POS[copy][i][0]][FMT_POS[copy][i][1]]) v |= 1 << i;
      return v;
    };
    var f1 = read(0), f2 = read(1), best = null, bestD = 99;
    Object.keys(LEVELS).forEach(function (lv) {
      for (var mask = 0; mask < 8; mask++) {
        var fb = formatBits(lv, mask), d = Math.min(hamming(fb, f1), hamming(fb, f2));
        if (d < bestD) { bestD = d; best = { level: lv, mask: mask }; }
      }
    });
    if (bestD > 3) return { ok: false, reason: 'format' };
    var spec = LEVELS[best.level], total = spec.data + spec.ecc;
    var cw = new Array(total).fill(0);
    eachDataModule(function (r, c, i) {
      if (i >= total * 8) return;
      var bit = (!!grid[r][c]) !== maskBit(best.mask, r, c);
      if (bit) cw[i >>> 3] |= 1 << (7 - (i & 7));
    });
    var corrected = rsDecode(cw, spec.ecc);
    if (corrected < 0) return { ok: false, reason: 'ecc' };
    var text;
    try { text = decodeData(cw.slice(0, spec.data)); } catch (e) { text = null; }
    if (text === null) return { ok: false, reason: 'data' };
    return { ok: true, text: text, level: best.level, mask: best.mask, corrected: corrected };
  }

  // ---------------------------------------------------------------- sheet content

  /** QR content of a sheet: HUSS1/<TEMPLATE>/<SHEETCODE>. */
  function sheetText(templateId, code) {
    return 'HUSS1/' + templateId + '/' + code;
  }

  /** Parses sheet QR content; ok only for a known template and a valid sheet code. */
  function parseSheetText(text) {
    var m = /^HUSS1\/(A4L|A3L)\/([A-Z0-9]{5})$/.exec(text || '');
    if (!m || !HUSS.sheet.code.isValid(m[2])) return { ok: false };
    return { ok: true, template: m[1], sheet_code: m[2] };
  }

  /**
   * Dark-module rectangles (mm) for a QR occupying the square (x, y, size) including a
   * `quiet`-module quiet zone; horizontal runs are merged. Returns [{ x, y, w, h }].
   */
  function moduleRects(qr, x, y, size, quiet) {
    var q = quiet == null ? 4 : quiet, m = size / (qr.size + 2 * q), out = [];
    for (var r = 0; r < qr.size; r++) {
      var c = 0;
      while (c < qr.size) {
        if (!qr.dark(r, c)) { c++; continue; }
        var c0 = c;
        while (c < qr.size && qr.dark(r, c)) c++;
        out.push({ x: x + (q + c0) * m, y: y + (q + r) * m, w: (c - c0) * m, h: m });
      }
    }
    return out;
  }

  var api = {
    SIZE: SIZE, LEVELS: LEVELS, ALNUM: ALNUM,
    encode: encode, decodeGrid: decodeGrid, sheetText: sheetText, parseSheetText: parseSheetText,
    moduleRects: moduleRects, rsEncode: rsEncode, rsDecode: rsDecode, encodeData: encodeData,
    formatBits: formatBits, functionMap: function () { return functionMap(); }, LEVEL_BY_FMT: LEVEL_BY_FMT
  };
  HUSS.sheet.qr = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
