// Minimal PNG encoder (8-bit RGB, no dependencies). Writes a pHYs chunk so the
// image prints at its true size (e.g. 300 dpi -> 1:1 page).
'use strict';
const zlib = require('node:zlib');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** img: { width, height, data: RGBA }, dpi: number -> PNG Buffer */
function encode(img, dpi) {
  const { width, height, data } = img;
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (stride + 1);
    raw[o] = 1; // filter: Sub
    let prevR = 0, prevG = 0, prevB = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4, j = o + 1 + x * 3;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      raw[j] = (r - prevR) & 0xFF;
      raw[j + 1] = (g - prevG) & 0xFF;
      raw[j + 2] = (b - prevB) & 0xFF;
      prevR = r; prevG = g; prevB = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // colour type RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const phys = Buffer.alloc(9);
  const ppm = Math.round(dpi / 0.0254);
  phys.writeUInt32BE(ppm, 0);
  phys.writeUInt32BE(ppm, 4);
  phys[8] = 1; // unit: metre
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('pHYs', phys),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/** PNG Buffer (8-bit grey, RGB or RGBA, not interlaced) -> { width, height, data: RGBA } */
function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504E47) throw new Error('not a PNG');
  let off = 8, width = 0, height = 0, type = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), kind = buf.toString('ascii', off + 4, off + 8), body = buf.subarray(off + 8, off + 8 + len);
    if (kind === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4); type = body[9];
      if (body[8] !== 8 || body[12] !== 0) throw new Error('unsupported PNG');
    } else if (kind === 'IDAT') idat.push(body);
    off += 12 + len;
  }
  const bpp = { 0: 1, 2: 3, 6: 4 }[type];
  if (!bpp) throw new Error('unsupported PNG colour type ' + type);
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = width * bpp;
  const px = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[dst + i - bpp] : 0, b = y > 0 ? px[dst - stride + i] : 0, c = i >= bpp && y > 0 ? px[dst - stride + i - bpp] : 0;
      const x = raw[src + i];
      px[dst + i] = (ft === 0 ? x : ft === 1 ? x + a : ft === 2 ? x + b : ft === 3 ? x + ((a + b) >> 1) : x + paeth(a, b, c)) & 0xFF;
    }
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let k = 0; k < width * height; k++) {
    for (let ch = 0; ch < 3; ch++) data[k * 4 + ch] = px[k * bpp + (bpp === 1 ? 0 : ch)];
    data[k * 4 + 3] = bpp === 4 ? px[k * 4 + 3] : 255;
  }
  return { width, height, data };
}

module.exports = { encode, decode, crc32 };
