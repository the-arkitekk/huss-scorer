// The lossy part of baseline JPEG, applied in memory (spec 10.2 S11): RGB -> YCbCr, 4:2:0
// chroma subsampling, 8 x 8 DCT, quantisation with the standard tables scaled to a quality,
// and back. Entropy coding is lossless, so the result equals a decoded JPEG of that quality
// (up to the decoder's chroma upsampling, here pixel replication).
'use strict';

const LUMA = [16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56,
  14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92,
  49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99];
const CHROMA = [17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99, 99, 99, 99,
  47, 66, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99];

function scaled(table, quality) {
  const q = Math.max(1, Math.min(100, quality));
  const s = q < 50 ? 5000 / q : 200 - 2 * q;
  return table.map((v) => Math.max(1, Math.min(255, Math.floor((v * s + 50) / 100))));
}

// cos table C[u][x] = c(u) * cos((2x + 1) u pi / 16) / 2
const C = [];
for (let u = 0; u < 8; u++) {
  C.push([]);
  for (let x = 0; x < 8; x++) C[u].push((u === 0 ? Math.SQRT1_2 : 1) * Math.cos(((2 * x + 1) * u * Math.PI) / 16) / 2);
}

/** In-place: quantise one plane (Float32Array, w x h, both multiples of 8) block by block. */
function quantisePlane(plane, w, h, q) {
  const blk = new Float64Array(64), tmp = new Float64Array(64);
  for (let by = 0; by < h; by += 8) {
    for (let bx = 0; bx < w; bx += 8) {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) blk[y * 8 + x] = plane[(by + y) * w + bx + x] - 128;
      // forward DCT: rows then columns
      for (let y = 0; y < 8; y++) for (let u = 0; u < 8; u++) {
        let s = 0;
        for (let x = 0; x < 8; x++) s += C[u][x] * blk[y * 8 + x];
        tmp[y * 8 + u] = s;
      }
      for (let u = 0; u < 8; u++) for (let v = 0; v < 8; v++) {
        let s = 0;
        for (let y = 0; y < 8; y++) s += C[v][y] * tmp[y * 8 + u];
        blk[v * 8 + u] = Math.round(s / q[v * 8 + u]) * q[v * 8 + u];
      }
      // inverse DCT
      for (let v = 0; v < 8; v++) for (let x = 0; x < 8; x++) {
        let s = 0;
        for (let u = 0; u < 8; u++) s += C[u][x] * blk[v * 8 + u];
        tmp[v * 8 + x] = s;
      }
      for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
        let s = 0;
        for (let v = 0; v < 8; v++) s += C[v][y] * tmp[v * 8 + x];
        plane[(by + y) * w + bx + x] = s + 128;
      }
    }
  }
}

/** Returns a new RGBA image degraded like a JPEG of the given quality. */
function degrade(img, quality) {
  const { width: W, height: H, data } = img;
  const W16 = Math.ceil(W / 16) * 16, H16 = Math.ceil(H / 16) * 16;
  const Y = new Float32Array(W16 * H16), Cb = new Float32Array(W16 * H16), Cr = new Float32Array(W16 * H16);
  for (let y = 0; y < H16; y++) {
    const sy = Math.min(H - 1, y);
    for (let x = 0; x < W16; x++) {
      const o = (sy * W + Math.min(W - 1, x)) * 4, r = data[o], g = data[o + 1], b = data[o + 2], k = y * W16 + x;
      Y[k] = 0.299 * r + 0.587 * g + 0.114 * b;
      Cb[k] = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
      Cr[k] = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;
    }
  }
  const w2 = W16 / 2, h2 = H16 / 2, cb2 = new Float32Array(w2 * h2), cr2 = new Float32Array(w2 * h2);
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
    const k = 2 * y * W16 + 2 * x;
    cb2[y * w2 + x] = (Cb[k] + Cb[k + 1] + Cb[k + W16] + Cb[k + W16 + 1]) / 4;
    cr2[y * w2 + x] = (Cr[k] + Cr[k + 1] + Cr[k + W16] + Cr[k + W16 + 1]) / 4;
  }
  quantisePlane(Y, W16, H16, scaled(LUMA, quality));
  quantisePlane(cb2, w2, h2, scaled(CHROMA, quality));
  quantisePlane(cr2, w2, h2, scaled(CHROMA, quality));
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const yy = Y[y * W16 + x], c = (y >> 1) * w2 + (x >> 1), cb = cb2[c] - 128, cr = cr2[c] - 128, o = (y * W + x) * 4;
    out[o] = yy + 1.402 * cr;
    out[o + 1] = yy - 0.344136 * cb - 0.714136 * cr;
    out[o + 2] = yy + 1.772 * cb;
    out[o + 3] = 255;
  }
  return { width: W, height: H, data: out };
}

/** Adds Gaussian noise (sigma in grey levels) per channel, seeded. */
function addNoise(img, sigma, seed) {
  let s = seed >>> 0 || 1;
  const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    for (let k = 0; k < 3; k++) {
      const u = Math.max(1e-12, rnd()), v = rnd();
      d[i + k] = d[i + k] + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
  }
  return img;
}

module.exports = { degrade, addNoise, scaled };
