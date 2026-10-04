'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const HUSS = require('./_load.js');

const QR = HUSS.sheet.qr;

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cloneGrid = (g) => g.map((row) => row.slice());

test('known answer: "HELLO WORLD" version 1-Q data and error correction codewords', () => {
  const data = QR.encodeData('HELLO WORLD', 'Q');
  assert.deepEqual(data, [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236]);
  assert.deepEqual(QR.rsEncode(data, 13), [168, 72, 22, 82, 217, 54, 156, 0, 46, 15, 180, 122, 16]);
});

test('format information matches the standard table', () => {
  // ISO 18004 table C.1 examples (after masking with 0x5412)
  assert.equal(QR.formatBits('M', 5).toString(2).padStart(15, '0'), '100000011001110');
  assert.equal(QR.formatBits('L', 0).toString(2).padStart(15, '0'), '111011111000100');
  assert.equal(QR.formatBits('H', 7).toString(2).padStart(15, '0'), '000100000111011');
});

test('version 1 layout: 208 data modules, finder patterns, timing pattern', () => {
  const f = QR.functionMap();
  let data = 0;
  for (let r = 0; r < 21; r++) for (let c = 0; c < 21; c++) if (!f[r][c]) data++;
  assert.equal(data, 208);
  const q = QR.encode('HUSS1/A4L/6QHJ4');
  for (const [r0, c0] of [[0, 0], [0, 14], [14, 0]]) {
    assert.equal(q.dark(r0, c0), true);
    assert.equal(q.dark(r0 + 1, c0 + 1), false);
    assert.equal(q.dark(r0 + 3, c0 + 3), true);
  }
  for (let i = 8; i <= 12; i++) {
    assert.equal(q.dark(6, i), i % 2 === 0);
    assert.equal(q.dark(i, 6), i % 2 === 0);
  }
  assert.equal(q.dark(13, 8), true, 'dark module');
});

test('encode -> decode round trip for sheet codes of both templates', () => {
  const rnd = mulberry32(11);
  for (let k = 0; k < 200; k++) {
    const tpl = k % 2 ? 'A3L' : 'A4L';
    const text = QR.sheetText(tpl, HUSS.sheet.code.generate(rnd));
    const q = QR.encode(text, 'Q');
    const d = QR.decodeGrid(q.grid);
    assert.equal(d.ok, true, text);
    assert.equal(d.text, text);
    assert.equal(d.level, 'Q');
    assert.equal(d.corrected, 0);
    assert.deepEqual(QR.parseSheetText(d.text).ok, true);
  }
});

test('all eight masks round trip', () => {
  for (let mask = 0; mask < 8; mask++) {
    const q = QR.encode('HUSS1/A4L/6QHJ4', 'Q', mask);
    assert.equal(q.mask, mask);
    const d = QR.decodeGrid(q.grid);
    assert.equal(d.mask, mask);
    assert.equal(d.text, 'HUSS1/A4L/6QHJ4');
  }
});

test('other error correction levels also round trip', () => {
  for (const lv of ['L', 'M']) {
    const q = QR.encode('HUSS1/A4L/22222', lv);
    assert.equal(QR.decodeGrid(q.grid).text, 'HUSS1/A4L/22222');
  }
  // level H holds at most 10 alphanumeric characters in version 1
  assert.equal(QR.decodeGrid(QR.encode('A4L/22222', 'H').grid).text, 'A4L/22222');
  assert.throws(() => QR.encode('HUSS1/A4L/22222', 'H'), /too long/);
});

// Data module positions grouped by codeword, to corrupt whole codewords.
function codewordModules() {
  const f = QR.functionMap(), groups = Array.from({ length: 26 }, () => []);
  let idx = 0;
  for (let right = 20; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let v = 0; v < 21; v++) {
      for (let j = 0; j < 2; j++) {
        const c = right - j, r = upward ? 20 - v : v;
        if (!f[r][c]) { groups[idx >>> 3].push([r, c]); idx++; }
      }
    }
  }
  return groups;
}

test('up to 6 damaged codewords are corrected', () => {
  const rnd = mulberry32(5), groups = codewordModules();
  for (let k = 0; k < 300; k++) {
    const text = QR.sheetText('A4L', HUSS.sheet.code.generate(rnd));
    const g = cloneGrid(QR.encode(text).grid);
    const nErr = 1 + (k % 6);
    const picked = new Set();
    while (picked.size < nErr) picked.add(Math.floor(rnd() * 26));
    for (const cw of picked) {
      for (const [r, c] of groups[cw]) if (rnd() < 0.6) g[r][c] = !g[r][c];
      const [r, c] = groups[cw][0]; g[r][c] = !g[r][c]; // at least one bit
    }
    const d = QR.decodeGrid(g);
    assert.equal(d.ok, true, `${nErr} errors`);
    assert.equal(d.text, text);
  }
});

test('heavier damage never yields a different valid sheet code', () => {
  const rnd = mulberry32(9), groups = codewordModules();
  let refused = 0;
  for (let k = 0; k < 300; k++) {
    const text = QR.sheetText('A4L', HUSS.sheet.code.generate(rnd));
    const g = cloneGrid(QR.encode(text).grid);
    const picked = new Set();
    while (picked.size < 7 + (k % 4)) picked.add(Math.floor(rnd() * 26));
    for (const cw of picked) for (const [r, c] of groups[cw]) g[r][c] = rnd() < 0.5;
    const d = QR.decodeGrid(g);
    if (!d.ok) { refused++; continue; }
    const p = QR.parseSheetText(d.text);
    if (p.ok) assert.equal(d.text, text, 'miscorrected to another valid code');
  }
  assert.ok(refused > 250, `most heavy damage is refused (${refused}/300)`);
});

test('format information survives 3 flipped bits', () => {
  const q = QR.encode('HUSS1/A4L/6QHJ4');
  const g = cloneGrid(q.grid);
  // flip three bits of the first format copy (row 8, columns 0-2)
  for (const c of [0, 1, 2]) g[8][c] = !g[8][c];
  assert.equal(QR.decodeGrid(g).text, 'HUSS1/A4L/6QHJ4');
});

test('sheet text parsing requires the template and a valid check character', () => {
  assert.deepEqual(QR.parseSheetText('HUSS1/A4L/6QHJ4'), { ok: true, template: 'A4L', sheet_code: '6QHJ4' });
  assert.equal(QR.parseSheetText('HUSS1/A4L/6QHJ5').ok, false);
  assert.equal(QR.parseSheetText('HUSS1/A5L/6QHJ4').ok, false);
  assert.equal(QR.parseSheetText('hello').ok, false);
});

test('module rectangles: quiet zone and merged runs', () => {
  const q = QR.encode('HUSS1/A4L/6QHJ4');
  const rects = QR.moduleRects(q, 262, 185, 15, 4);
  const m = 15 / 29;
  let area = 0, dark = 0;
  for (const r of rects) {
    area += r.w * r.h;
    assert.ok(r.x >= 262 + 4 * m - 1e-9 && r.x + r.w <= 262 + 25 * m + 1e-9);
  }
  for (let r = 0; r < 21; r++) for (let c = 0; c < 21; c++) if (q.dark(r, c)) dark++;
  assert.ok(Math.abs(area - dark * m * m) < 1e-9);
});
