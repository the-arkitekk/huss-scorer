// Printable blank A4L test sheets (vector PDF, true size) until the Phase 2 sheet generator exists.
//
//   node tests/synthetic/blank-sheet.js [pages]   -> samples/template/HuSS_A4L_test-sheets.pdf
//
// The QR area holds a non-decodable stand-in pattern; real QR codes come with Phase 2.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const HUSS = require('../unit/_load.js');
const { qrStandIn } = require('./generate.js');

const PT = 72 / 25.4; // points per mm

function pageContent(T, sheetCode) {
  const Y = (y) => ((T.height_mm - y) * PT).toFixed(3);
  const X = (x) => (x * PT).toFixed(3);
  const ops = ['0 g', '0 G'];
  const rectOp = (x0, y0, x1, y1) => `${X(x0)} ${Y(y1)} ${((x1 - x0) * PT).toFixed(3)} ${((y1 - y0) * PT).toFixed(3)} re f`;

  const h = T.corner_size_mm / 2;
  for (const [cx, cy] of T.corners) ops.push(rectOp(cx - h, cy - h, cx + h, cy + h));
  ops.push(`${(T.floor.width * PT).toFixed(3)} w 0 J`);
  ops.push(`${X(T.floor.x0)} ${Y(T.floor.y)} m ${X(T.floor.x1)} ${Y(T.floor.y)} l S`);
  const [a, b, c] = [T.mark.apex, T.mark.base[0], T.mark.base[1]];
  ops.push(`${X(a[0])} ${Y(a[1])} m ${X(b[0])} ${Y(b[1])} l ${X(c[0])} ${Y(c[1])} l h f`);
  for (const s of qrStandIn(T)) ops.push(rectOp(s.x0, s.y0, s.x1, s.y1));

  const esc = (s) => s.replace(/[\\()]/g, (m) => '\\' + m);
  ops.push(`BT /F1 8 Tf ${X(T.label.x)} ${Y(T.label.baseline)} Td (${esc(HUSS.config.DEFAULTS.sheet_label)}) Tj ET`);
  const codeWidthPt = sheetCode.length * 0.6 * 12; // Courier: 600/1000 em per glyph
  ops.push(`BT /F2 12 Tf ${(T.code_text.right * PT - codeWidthPt).toFixed(3)} ${Y(T.code_text.baseline)} Td (${sheetCode}) Tj ET`);
  ops.push(`BT /F1 6 Tf ${X(T.template_id.x)} ${Y(T.template_id.baseline)} Td (${esc(T.name)}) Tj ET`);
  return ops.join('\n') + '\n';
}

function buildPdf(T, codes) {
  const W = (T.width_mm * PT).toFixed(2), H = (T.height_mm * PT).toFixed(2);
  const objs = [];
  const add = (s) => { objs.push(s); return objs.length; };
  const catalog = add(null), pages = add(null);
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
  const kids = [];
  for (const code of codes) {
    const content = pageContent(T, code);
    const cs = add(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}endstream`);
    kids.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${cs} 0 R >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pages} 0 R /ViewerPreferences << /PrintScaling /None >> >>`;
  objs[pages - 1] = `<< /Type /Pages /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;

  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += String(off).padStart(10, '0') + ' 00000 n \n';
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

function main() {
  const n = Math.max(1, parseInt(process.argv[2] || '3', 10));
  const T = HUSS.sheet.template.get('A4L');
  const codes = [];
  while (codes.length < n) {
    const c = HUSS.sheet.code.generate();
    if (!codes.includes(c)) codes.push(c);
  }
  const dir = path.join(__dirname, '..', '..', 'samples', 'template');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'HuSS_A4L_test-sheets.pdf');
  fs.writeFileSync(file, buildPdf(T, codes));
  console.log(file);
  console.log('Sheet codes:', codes.join(', '));
}

if (require.main === module) main();
