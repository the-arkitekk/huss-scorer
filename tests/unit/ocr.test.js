'use strict';
// Printed sheet code reader (js/detect/ocr.js). The fixtures are the printed-code strips of the six
// trial scans (tests/tools/code-crops.js), sampled on the aligned page at 16 px per mm.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const HUSS = require('./_load.js');
const png = require('../synthetic/png.js');

const T = HUSS.sheet.template.get('A4L');
const cfg = HUSS.config;
const R = 16;
const BOX = { left: -15, top: -5 };                       // as in tests/tools/code-crops.js
const DIR = path.join(__dirname, '..', 'fixtures', 'printed-codes');
const FILES = fs.readdirSync(DIR).filter((f) => f.endsWith('.png')).sort();
const ocr = HUSS.detect.ocr;

/** Darkness image of a fixture: { w, h, d, x0, y0 } (page mm of its top left corner). */
function fixture(name) {
  const img = png.decode(fs.readFileSync(path.join(DIR, name)));
  const d = new Float64Array(img.width * img.height);
  for (let k = 0; k < d.length; k++) d[k] = 255 - img.data[k * 4];
  return { w: img.width, h: img.height, d, x0: T.code_text.right + BOX.left, y0: T.code_text.baseline + BOX.top };
}

/** Bilinear sampler over a darkness image, moved by (dx, dy) mm on the page. */
function sampler(im, dx = 0, dy = 0) {
  return (x, y) => {
    const sx = (x - im.x0 - dx) * R - 0.5, sy = (y - im.y0 - dy) * R - 0.5;
    const ix = Math.floor(sx), iy = Math.floor(sy);
    if (ix < 0 || iy < 0 || ix >= im.w - 1 || iy >= im.h - 1) return 0;
    const fx = sx - ix, fy = sy - iy, o = iy * im.w + ix, d = im.d;
    return (1 - fx) * (1 - fy) * d[o] + fx * (1 - fy) * d[o + 1] + (1 - fx) * fy * d[o + im.w] + fx * fy * d[o + im.w + 1];
  };
}

/** Centre (page mm) of character i of the printed code. */
function charCentre(i) {
  const em = (T.code_text.size_pt * 25.4) / 72, pitch = 0.6 * em;
  return [T.code_text.right - (5 - i - 0.5) * pitch, T.code_text.baseline - 0.3 * em];
}

/** A copy with a filled dark disc (an ink blot) or a stroke painted on it. */
function paint(im, fn) {
  const out = Object.assign({}, im, { d: new Float64Array(im.d) });
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
    const px = im.x0 + (x + 0.5) / R, py = im.y0 + (y + 0.5) / R;
    if (fn(px, py)) out.d[y * im.w + x] = 210;
  }
  return out;
}
const disc = (c, r) => (x, y) => Math.hypot(x - c[0], y - c[1]) <= r;
const stroke = (a, b, w) => (x, y) => {
  const vx = b[0] - a[0], vy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(x - a[0] - t * vx, y - a[1] - t * vy) <= w / 2;
};

test('the printed codes of the six trial scans are read', () => {
  assert.equal(FILES.length, 6);
  for (const f of FILES) {
    const code = f.replace('.png', '');
    const r = ocr.read(sampler(fixture(f)), T, cfg);
    assert.equal(r.found, true, `${code}: ${r.reason} (guess ${r.best_guess})`);
    assert.equal(r.sheet_code, code);
    assert.ok(r.score > 0.85, `${code}: score ${r.score}`);
  }
});

test('still read when the characters sit up to 0.6 mm sideways and 0.5 mm up or down from their place', () => {
  for (const f of FILES) {
    const code = f.replace('.png', ''), im = fixture(f);
    for (const [dx, dy] of [[0.6, 0], [-0.6, 0], [0, 0.5], [0, -0.5], [0.4, -0.4]]) {
      const r = ocr.read(sampler(im, dx, dy), T, cfg);
      assert.equal(r.sheet_code, code, `${code} moved ${dx}/${dy}: ${r.reason}`);
    }
  }
});

test('an ink blot on one character: the right code (check character) or no code, never a wrong one', () => {
  let rescued = 0;
  for (const f of FILES) {
    const code = f.replace('.png', ''), im = fixture(f);
    for (let i = 0; i < 5; i++) {
      for (const rad of [0.6, 1.2, 1.6]) {
        const r = ocr.read(sampler(paint(im, disc(charCentre(i), rad))), T, cfg);
        if (r.found) { assert.equal(r.sheet_code, code, `${code}, blot on ${i + 1} (r ${rad}) gave ${r.sheet_code}`); rescued++; }
      }
    }
  }
  assert.ok(rescued >= 50, `blotted codes rescued by the check character: ${rescued} of 90`);
});

test('two characters blotted or struck through: never a wrong code', () => {
  for (const f of FILES) {
    const code = f.replace('.png', ''), im = fixture(f);
    for (const [i, j] of [[0, 1], [1, 3], [2, 4], [0, 4]]) {
      const r = ocr.read(sampler(paint(im, (x, y) => disc(charCentre(i), 1.0)(x, y) || disc(charCentre(j), 1.0)(x, y))), T, cfg);
      if (r.found) assert.equal(r.sheet_code, code, `${code}, blots on ${i + 1} and ${j + 1} gave ${r.sheet_code}`);
    }
    const a = charCentre(1), b = charCentre(3);
    const r = ocr.read(sampler(paint(im, stroke([a[0] - 1.5, a[1] + 1], [b[0] + 1.5, b[1] - 1], 0.35))), T, cfg);
    if (r.found) assert.equal(r.sheet_code, code, `${code}, struck through gave ${r.sheet_code}`);
  }
});

test('an empty strip gives no code', () => {
  const im = fixture(FILES[0]);
  const blank = Object.assign({}, im, { d: new Float64Array(im.d.length).fill(8) });
  const r = ocr.read(sampler(blank), T, cfg);
  assert.equal(r.found, false);
  assert.equal(r.reason, 'no_text');
});

test('Courier New characters (as the print view sets them) are read too', () => {
  const G = HUSS.detect.glyphs, codes = ['23456', 'ABCDE', 'FGHJK', 'LMNPQ', 'RTUVW', 'XYZ78', '9QW2M'].map((b) => b.slice(0, 4) + HUSS.sheet.code.checkChar(b.slice(0, 4)));
  const em = (T.code_text.size_pt * 25.4) / 72, capH = 0.6 * em;
  for (const code of codes) {
    // Each stored glyph put into its cell: centred, cap height tall, its own width; the rest paper.
    const sample = (x, y) => {
      const i = Math.floor((x - (T.code_text.right - 5 * 0.6 * em)) / (0.6 * em));
      if (i < 0 || i > 4) return 8;
      const g = G.fonts['Courier New'][code[i]], grid = G.decode(g.g), w = g.a * capH;
      const cx = T.code_text.right - (5 - i - 0.5) * 0.6 * em, u = (x - (cx - w / 2)) / w, v = (y - (T.code_text.baseline - capH)) / capH;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) return 8;
      return Math.max(8, grid[Math.floor(v * G.GH) * G.GW + Math.floor(u * G.GW)]);
    };
    const r = ocr.read(sample, T, cfg);
    assert.equal(r.sheet_code, code, `${code}: ${r.reason} (guess ${r.best_guess})`);
  }
});
