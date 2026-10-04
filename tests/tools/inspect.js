// Developer tool: runs the detection pipeline on a real scan and writes overlay images.
//
//   node tests/tools/inspect.js <scan.jpg|png> [outDir]
//
// JPEG/PNG are converted to BMP with macOS `sips` (no npm dependencies). Writes
// <name>_overlay.png (whole rectified page) and <name>_figure.png (figure close-up)
// with: fitted floor line (blue), axis (green), head/foot suggestions (magenta),
// red mask (cyan), ceiling/wall snap candidates (orange ticks).
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const HUSS = require('../unit/_load.js');
const png = require('../synthetic/png.js');

function readBmp(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 2) !== 'BM') throw new Error('not a BMP');
  const off = b.readUInt32LE(10), w = b.readInt32LE(18), hRaw = b.readInt32LE(22), bpp = b.readUInt16LE(28);
  const comp = b.readUInt32LE(30);
  if ((bpp !== 24 && bpp !== 32) || (comp !== 0 && comp !== 3)) throw new Error(`unsupported BMP: ${bpp} bpp, compression ${comp}`);
  const h = Math.abs(hRaw), bottomUp = hRaw > 0, Bpp = bpp / 8;
  const stride = Math.ceil((w * Bpp) / 4) * 4;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const row = off + (bottomUp ? h - 1 - y : y) * stride;
    for (let x = 0; x < w; x++) {
      const s = row + x * Bpp, d = (y * w + x) * 4;
      data[d] = b[s + 2]; data[d + 1] = b[s + 1]; data[d + 2] = b[s]; data[d + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

function decode(file) {
  const tmp = path.join(os.tmpdir(), `huss-inspect-${process.pid}.bmp`);
  execFileSync('sips', ['-s', 'format', 'bmp', file, '--out', tmp], { stdio: 'ignore' });
  try { return readBmp(tmp); } finally { fs.rmSync(tmp, { force: true }); }
}

function dpiOf(file) {
  try {
    const out = execFileSync('sips', ['-g', 'dpiWidth', file], { encoding: 'utf8' });
    const m = out.match(/dpiWidth:\s*([\d.]+)/);
    return m ? Number(m[1]) : null;
  } catch (e) { return null; }
}

// --- drawing on an RGBA copy of the rectified page
function makeCanvas(rect) {
  return { width: rect.width, height: rect.height, data: new Uint8ClampedArray(rect.data) };
}
function px(c, x, y, col, alpha) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
  const o = (y * c.width + x) * 4, a = alpha == null ? 1 : alpha;
  for (let k = 0; k < 3; k++) c.data[o + k] = c.data[o + k] * (1 - a) + col[k] * a;
}
function hline(c, x0, x1, y, col, t) { for (let x = x0; x <= x1; x++) for (let k = -t; k <= t; k++) px(c, x, y + k, col); }
function vline(c, x, y0, y1, col, t) { for (let y = y0; y <= y1; y++) for (let k = -t; k <= t; k++) px(c, x + k, y, col); }
function crop(c, x0, y0, x1, y1) {
  x0 = Math.max(0, Math.round(x0)); y0 = Math.max(0, Math.round(y0));
  x1 = Math.min(c.width, Math.round(x1)); y1 = Math.min(c.height, Math.round(y1));
  const w = x1 - x0, h = y1 - y0, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) data.set(c.data.subarray(((y0 + y) * c.width + x0) * 4, ((y0 + y) * c.width + x1) * 4), y * w * 4);
  return { width: w, height: h, data };
}

function main() {
  const file = process.argv[2];
  if (!file) { console.error('usage: node tests/tools/inspect.js <scan> [outDir]'); process.exit(2); }
  const outDir = process.argv[3] || path.join(os.tmpdir(), 'huss-inspect');
  fs.mkdirSync(outDir, { recursive: true });
  const t0 = Date.now();
  const img = decode(file);
  const tDecode = Date.now() - t0;
  const P = HUSS.detect.pipeline, prm = HUSS.config.DEFAULTS;
  const a = P.analyze(img, { template: 'A4L', params: prm });
  const name = path.basename(file).replace(/\.[^.]+$/, '');
  console.log(`file: ${path.basename(file)}  ${img.width}x${img.height}  dpi(meta): ${dpiOf(file)}  decode ${tDecode} ms`);
  if (!a.ok) { console.log('FAILED at', a.stage, a.error, a.missing || ''); return; }

  const R = a.R, al = a.align;
  const f = (v, d = 3) => (v == null ? '-' : v.toFixed(d));
  console.log(`align: R=${R} px/mm  px_per_mm ${f(al.px_per_mm_x)} / ${f(al.px_per_mm_y)}  rotation ${f(al.rotation_deg)} deg  residual ${f(al.residual_mm)} mm  quarter ${al.quarter}  floorRatio ${f(al.floor_ratio, 2)} markRatio ${f(al.mark_ratio, 2)}${al.orientation_tie ? ' (tie)' : ''}  warning ${al.warning}`);
  console.log(`floor: ok ${a.floor.ok}  y(40)=${f(P.floorY(a, 40))}  slope ${f(a.floor.b, 6)}  inliers ${a.floor.inliers}/${a.floor.samples}`);
  console.log(`qr: ${a.qr.found ? a.qr.text + '  (corrected ' + a.qr.corrected + ', offset ' + a.qr.offset_mm.join('/') + ' mm' + (a.qr.template_mismatch ? ', TEMPLATE MISMATCH' : '') + ')' : 'not read'}${al.orientation_tie ? '  orientation tie broken by ' + al.tie_break : ''}`);
  const red = a.red, s = a.suggestions;
  console.log(`red: found ${red.found}  multiple ${red.multiple}  T_a ${f(red.Ta, 1)}  head ${f(red.head_y)}  raw foot ${f(red.raw_foot_y)}  axis ${f(red.axis_x)}`);
  console.log(`suggest: head ${f(s.head_y)}  foot ${f(s.foot_y)} (off floor: ${s.foot_off_floor})  figure ${s.head_y != null ? f(s.foot_y - s.head_y) : '-'} mm`);
  const L = HUSS.detect.line;
  const cl = s.ceiling_y != null ? L.ceilingLine(a, s.axis_x, s.ceiling_at_axis_y, s.wall_x) : null;
  const wl = s.wall_x != null ? L.wallLine(a, s.wall_at_floor_x, s.ceiling_y) : null;
  console.log(`lines (rules 1.3): ceiling average ${f(s.ceiling_y)} (at axis ${f(s.ceiling_at_axis_y)}, spread ${cl ? f(cl.spread, 2) : '-'})  wall average ${f(s.wall_x)} (at floor ${f(s.wall_at_floor_x)}, spread ${wl ? f(wl.spread, 2) : '-'})`);
  console.log('timings ms:', JSON.stringify(Object.fromEntries(Object.entries(a.timings).map(([k, v]) => [k, Math.round(v)]))));

  // Snap candidates: ceiling above the head along the axis, wall right of the figure.
  const ax = s.axis_x;
  const cp = P.ceilingProfile(a, ax), cfg = HUSS.config.PROFILE;
  const headRow = Math.floor(((s.head_y != null ? s.head_y : P.floorY(a, ax) - 5) - 1) * R);
  const ceilPeaks = HUSS.detect.profile.findPeaks(cp, Math.floor(13 * R), headRow, cfg);
  const wallPeaks = HUSS.detect.profile.findPeaks(a.wallProfile, Math.ceil((ax + 3) * R), Math.floor(289 * R), cfg);
  console.log('ceiling candidates (y mm, prominence):', ceilPeaks.map((p) => `${(p.centre / R).toFixed(2)}(${p.prominence.toFixed(0)})`).join('  ') || 'none');
  console.log('wall candidates (x mm, prominence):', wallPeaks.map((p) => `${(p.centre / R).toFixed(2)}(${p.prominence.toFixed(0)})`).join('  ') || 'none');

  // Overlay
  const c = makeCanvas(a.rect);
  const reg = red.region;
  for (let y = 0; y < reg.h; y++) for (let x = 0; x < reg.w; x++) {
    if (red.regionMask[y * reg.w + x]) px(c, reg.x0 + x, reg.y0 + y, [0, 200, 255], red.clusterMask[y * reg.w + x] ? 0.8 : 0.4);
  }
  for (let x = 0; x < c.width; x++) px(c, x, P.floorY(a, (x + 0.5) / R) * R, [0, 90, 255], 0.7);
  vline(c, ax * R, 0, c.height - 1, [0, 170, 0], 0);
  const half = Math.round(5 * R);
  if (s.head_y != null) hline(c, ax * R - half, ax * R + half, s.head_y * R, [220, 0, 220], 1);
  if (s.foot_y != null) hline(c, ax * R - half, ax * R + half, s.foot_y * R, [220, 0, 220], 1);
  for (const p of ceilPeaks) hline(c, ax * R - 2 * R, ax * R + 2 * R, p.centre, [255, 140, 0], 1);
  const fy = P.floorY(a, 150);
  for (const p of wallPeaks) vline(c, p.centre, (fy - 8) * R, (fy - 0.5) * R, [255, 140, 0], 1);
  // Followed lines (red-orange: ceiling, purple: wall) and their averages (thin).
  if (cl) { for (const [x, y] of cl.pts) for (let k = -1; k <= 1; k++) px(c, x * R, y * R + k, [255, 60, 0], 0.9); hline(c, ax * R, (s.wall_x || ax + 50) * R, s.ceiling_y * R, [255, 60, 0], 0); }
  if (wl) { for (const [x, y] of wl.pts) for (let k = -1; k <= 1; k++) px(c, x * R + k, y * R, [150, 0, 200], 0.9); vline(c, s.wall_x * R, (s.ceiling_y || 20) * R, P.floorY(a, s.wall_x) * R, [150, 0, 200], 0); }
  if (cl || wl) {
    const x1 = (s.wall_x != null ? s.wall_x + 12 : ax + 80), y0 = (s.ceiling_y != null ? s.ceiling_y - 12 : 20);
    fs.writeFileSync(path.join(outDir, `${name}_lines.png`), png.encode(crop(c, (ax - 15) * R, y0 * R, x1 * R, (P.floorY(a, ax) + 5) * R), R * 25.4));
  }
  const overlay = path.join(outDir, `${name}_overlay.png`);
  fs.writeFileSync(overlay, png.encode(c, R * 25.4));
  const figTop = (s.head_y != null ? s.head_y : P.floorY(a, ax) - 30) - 8;
  const figure = path.join(outDir, `${name}_figure.png`);
  fs.writeFileSync(figure, png.encode(crop(c, (ax - 22) * R, figTop * R, (ax + 22) * R, (P.floorY(a, ax) + 6) * R), R * 25.4));
  console.log('wrote', overlay);
  console.log('wrote', figure);
}

main();
