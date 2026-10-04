'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const HUSS = require('./_load.js');

const T4 = HUSS.sheet.template.get('A4L');
const T3 = HUSS.sheet.template.get('A3L');

/** Rasterises the QR rectangles of a sheet back into a 21 x 21 grid and decodes it. */
function qrFromItems(t, items) {
  const m = t.qr.size / 29, x0 = t.qr.x + 4 * m, y0 = t.qr.y + 4 * m;
  const grid = Array.from({ length: 21 }, () => new Array(21).fill(false));
  for (const it of items.filter((i) => i.k === 'rects').flatMap((i) => i.rects)) {
    const r = Math.round((it.y - y0) / m), c0 = Math.round((it.x - x0) / m), n = Math.round(it.w / m);
    for (let c = c0; c < c0 + n; c++) grid[r][c] = true;
  }
  return HUSS.sheet.qr.decodeGrid(grid);
}

test('sheet items: corner marks, floor line, hatching, mark, texts and a readable QR', () => {
  for (const t of [T4, T3]) {
    const items = HUSS.sheet.template.items(t, '6QHJ4', 'figür');
    const rects = items.filter((i) => i.k === 'rect');
    for (const [cx, cy] of t.corners) {
      assert.ok(rects.some((r) => Math.abs(r.x + r.w / 2 - cx) < 1e-9 && Math.abs(r.y + r.h / 2 - cy) < 1e-9 && Math.abs(r.w - 5) < 1e-9));
    }
    const lines = items.filter((i) => i.k === 'line');
    assert.equal(lines[0].y1, t.floor.y);
    assert.ok(lines.length > 60, 'hatching present');
    for (const l of lines.slice(1)) assert.ok(Math.min(l.y1, l.y2) > t.floor.y + t.floor.width / 2 + 0.6, 'hatching keeps its gap below the line');
    const texts = items.filter((i) => i.k === 'text').map((i) => i.text);
    assert.deepEqual(texts, ['figür', '6QHJ4', t.name]);
    const d = qrFromItems(t, items);
    assert.equal(d.ok, true);
    assert.equal(d.text, `HUSS1/${t.id}/6QHJ4`);
    // nothing printed above the floor line except the two top corner marks (rule 4.3)
    const bottom = (i) => i.k === 'rect' ? i.y + i.h : i.k === 'rects' ? Math.max(...i.rects.map((r) => r.y + r.h)) :
      i.k === 'line' ? Math.max(i.y1, i.y2) : i.k === 'poly' ? Math.max(...i.pts.map((p) => p[1])) : i.y;
    const above = items.filter((i) => bottom(i) < t.floor.y - 0.2);
    assert.equal(above.length, 2);
  }
});

test('SVG print view: true size in mm, escaped text', () => {
  const svg = HUSS.sheet.svg.sheet(T4, '6QHJ4', 'a<b & "c"');
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 297 210">'));
  assert.ok(svg.includes('a&lt;b &amp; &quot;c&quot;'));
  assert.ok(svg.includes('>6QHJ4</text>'));
  assert.ok(svg.includes('text-anchor="middle"'));
  assert.equal((svg.match(/<path /g) || []).length, 1, 'QR drawn as one path');
  assert.ok(HUSS.sheet.svg.sheet(T3, '6QHJ4', 'x').includes('width="420mm" height="297mm"'));
});

test('PDF: one page per code, true page size, valid cross-reference table', () => {
  let k = 0;
  const codes = HUSS.sheet.code.batch(3, [], () => [0.37, 0.81, 0.12, 0.55, 0.93, 0.28][k++ % 6]);
  const bytes = HUSS.sheet.pdf.sheets(T4, codes, 'figür');
  const s = Buffer.from(bytes).toString('latin1');
  assert.ok(s.startsWith('%PDF-1.4'));
  assert.ok(s.trimEnd().endsWith('%%EOF'));
  assert.equal((s.match(/\/Type \/Page /g) || []).length, 3);
  assert.ok(s.includes('/MediaBox [0 0 841.890 595.276]'));
  const xref = Number(/startxref\n(\d+)/.exec(s)[1]);
  assert.equal(s.slice(xref, xref + 4), 'xref');
  // every object offset in the table points at "N 0 obj"
  const offs = s.slice(xref).split('\n').slice(3).filter((l) => / n $/.test(l)).map((l) => Number(l.slice(0, 10)));
  offs.forEach((o, i) => assert.ok(s.startsWith(`${i + 1} 0 obj`, o), `object ${i + 1}`));
  for (const c of codes) assert.ok(s.includes(`(${c}) Tj`));
  assert.ok(s.includes('(figür) Tj'), 'WinAnsi ü');
  assert.equal(HUSS.sheet.pdf.toWinAnsi('şığ İ'), 'sig I');
});

test('code batches are unique, valid and avoid the codes not to use', () => {
  const exclude = HUSS.sheet.code.extract('sheet_code,template\nCV94Y,A4L\n6QHJ4,A4L\n66j34 xyz 12345');
  assert.deepEqual(exclude, ['CV94Y', '6QHJ4', '66J34']);
  let seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const codes = HUSS.sheet.code.batch(500, exclude, rnd);
  assert.equal(new Set(codes).size, 500);
  for (const c of codes) {
    assert.equal(HUSS.sheet.code.isValid(c), true);
    assert.equal(exclude.includes(c), false);
  }
  const r = HUSS.sheet.code.secureRandom();
  assert.ok(r >= 0 && r < 1);
});
