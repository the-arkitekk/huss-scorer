// Developer tool: cuts the printed sheet code out of real scans, as test material for the
// printed-code reader (tests/unit/ocr.test.js). Only the strip with the five printed characters
// is kept, sampled on the aligned page at 16 px per mm, named after the code.
//
//   node tests/tools/code-crops.js <outDir> <scan> [<scan> ...]
//
// The code of each scan is taken from the reader itself; check the pictures before keeping them.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const HUSS = require('../unit/_load.js');
const png = require('../synthetic/png.js');

const R = 16;            // px per mm
const BOX = { left: -15, right: 1.5, top: -5, bottom: 2.5 };   // mm around (code_text.right, code_text.baseline)

function decode(file) {
  const src = fs.readFileSync(path.join(__dirname, 'inspect.js'), 'utf8');
  const readBmp = new Function('fs', src.match(/function readBmp[\s\S]*?\n}\n/)[0] + 'return readBmp;')(fs);
  const tmp = path.join(os.tmpdir(), `huss-crop-${process.pid}.bmp`);
  execFileSync('sips', ['-s', 'format', 'bmp', file, '--out', tmp], { stdio: 'ignore' });
  try { return readBmp(tmp); } finally { fs.rmSync(tmp, { force: true }); }
}

function main() {
  const [outDir, ...scans] = process.argv.slice(2);
  if (!outDir || !scans.length) { console.error('usage: node tests/tools/code-crops.js <outDir> <scan> [...]'); process.exit(2); }
  fs.mkdirSync(outDir, { recursive: true });
  for (const file of scans) {
    const img = decode(file);
    const a = HUSS.detect.pipeline.analyze(img, { template: 'A4L' });
    if (!a.ok) { console.log(path.basename(file), 'not aligned:', a.error); continue; }
    const T = a.template, ct = T.code_text, sample = HUSS.detect.qr.imageSampler(img, a.H);
    const r = HUSS.detect.ocr.read(sample, T, HUSS.config);
    const x0 = ct.right + BOX.left, y0 = ct.baseline + BOX.top;
    const w = Math.round((BOX.right - BOX.left) * R), h = Math.round((BOX.bottom - BOX.top) * R);
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = 255 - Math.round(sample(x0 + (x + 0.5) / R, y0 + (y + 0.5) / R)), o = (y * w + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = v; data[o + 3] = 255;
    }
    const name = (r.found ? r.sheet_code : 'UNREAD-' + path.basename(file, path.extname(file))) + '.png';
    fs.writeFileSync(path.join(outDir, name), png.encode({ width: w, height: h, data }, R * 25.4));
    console.log(path.basename(file), '->', name);
  }
}

main();
