'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const HUSS = require('./_load.js');

const Hm = HUSS.image.homography;
const A4L = HUSS.sheet.template.get('A4L');

// A realistic page -> scan mapping: 300 dpi, 2 degree rotation, offset, slight perspective.
function trueMap(x, y) {
  const s = 300 / 25.4, th = 2 * Math.PI / 180;
  const X = s * (Math.cos(th) * x - Math.sin(th) * y) + 70;
  const Y = s * (Math.sin(th) * x + Math.cos(th) * y) + 45;
  const w = 1 + 1e-5 * x - 2e-5 * y;
  return [X / w, Y / w];
}

test('round trip through H and its inverse is below 1e-6 at the known points', () => {
  const src = A4L.corners;
  const dst = src.map(([x, y]) => trueMap(x, y));
  const H = Hm.fromPoints(src, dst);
  const Hi = Hm.invert(H);
  for (let i = 0; i < 4; i++) {
    const p = Hm.apply(H, src[i][0], src[i][1]);
    assert.ok(Math.hypot(p[0] - dst[i][0], p[1] - dst[i][1]) < 1e-6, 'forward');
    const q = Hm.apply(Hi, dst[i][0], dst[i][1]);
    assert.ok(Math.hypot(q[0] - src[i][0], q[1] - src[i][1]) < 1e-6, 'inverse');
    const r = Hm.apply(Hi, p[0], p[1]);
    assert.ok(Math.hypot(r[0] - src[i][0], r[1] - src[i][1]) < 1e-6, 'round trip');
  }
});

test('a projective map is recovered exactly away from the fitting points', () => {
  const src = A4L.corners;
  const dst = src.map(([x, y]) => trueMap(x, y));
  const H = Hm.fromPoints(src, dst);
  for (const [x, y] of [[40, 180], [150, 100], [289, 180], [12, 190]]) {
    const p = Hm.apply(H, x, y), t = trueMap(x, y);
    assert.ok(Math.hypot(p[0] - t[0], p[1] - t[1]) < 1e-6);
  }
});

test('least-squares DLT with more than 4 points', () => {
  const src = [...A4L.corners, [40, 180], [150, 100]];
  const dst = src.map(([x, y]) => trueMap(x, y));
  const H = Hm.fromPoints(src, dst);
  for (let i = 0; i < src.length; i++) {
    const p = Hm.apply(H, src[i][0], src[i][1]);
    assert.ok(Math.hypot(p[0] - dst[i][0], p[1] - dst[i][1]) < 1e-6);
  }
});

test('similarity fit recovers scale and angle; Jacobian matches', () => {
  const s = 11.811, th = -0.3;
  const src = A4L.corners;
  const dst = src.map(([x, y]) => [s * (Math.cos(th) * x - Math.sin(th) * y) + 5, s * (Math.sin(th) * x + Math.cos(th) * y) + 9]);
  const sim = Hm.fitSimilarity(src, dst);
  assert.ok(Math.abs(sim.scale - s) < 1e-9);
  assert.ok(Math.abs(sim.angle - th) < 1e-12);
  const J = Hm.jacobian(Hm.fromPoints(src, dst), 148, 105);
  assert.ok(Math.abs(Math.hypot(J[0][0], J[1][0]) - s) < 1e-6);
  assert.ok(Math.abs(Math.atan2(J[1][0], J[0][0]) - th) < 1e-9);
});
