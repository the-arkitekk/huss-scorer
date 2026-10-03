/* HuSS Scorer — js/image/homography.js
 * Planar homographies (3x3, row-major arrays of 9 numbers) and least-squares
 * similarity transforms. Used for page mm <-> image px mapping (spec 7.2).
 */
(function (root) {
  'use strict';
  var HUSS = root.HUSS = root.HUSS || {};
  HUSS.image = HUSS.image || {};

  /** Solves A x = b in place (Gaussian elimination, partial pivoting). A: array of rows. */
  function solveLinear(A, b) {
    var n = b.length, i, j, k;
    for (k = 0; k < n; k++) {
      var piv = k, best = Math.abs(A[k][k]);
      for (i = k + 1; i < n; i++) {
        var v = Math.abs(A[i][k]);
        if (v > best) { best = v; piv = i; }
      }
      if (best < 1e-12) return null;
      if (piv !== k) {
        var tr = A[k]; A[k] = A[piv]; A[piv] = tr;
        var tb = b[k]; b[k] = b[piv]; b[piv] = tb;
      }
      for (i = k + 1; i < n; i++) {
        var f = A[i][k] / A[k][k];
        if (f === 0) continue;
        for (j = k; j < n; j++) A[i][j] -= f * A[k][j];
        b[i] -= f * b[k];
      }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) {
      var s = b[i];
      for (j = i + 1; j < n; j++) s -= A[i][j] * x[j];
      x[i] = s / A[i][i];
    }
    return x;
  }

  function multiply(A, B) {
    var C = new Array(9);
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 3; c++) {
        C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
      }
    }
    return C;
  }

  function invert(H) {
    var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7], i = H[8];
    var A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    var det = a * A + b * B + c * C;
    if (Math.abs(det) < 1e-300) return null;
    var inv = [
      A, -(b * i - c * h), b * f - c * e,
      B, a * i - c * g, -(a * f - c * d),
      C, -(a * h - b * g), a * e - b * d
    ];
    for (var k = 0; k < 9; k++) inv[k] /= det;
    return inv;
  }

  function apply(H, x, y) {
    var w = H[6] * x + H[7] * y + H[8];
    return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
  }

  /** Partial derivatives of the mapping at (x, y): [[dX/dx, dX/dy], [dY/dx, dY/dy]]. */
  function jacobian(H, x, y) {
    var w = H[6] * x + H[7] * y + H[8];
    var X = (H[0] * x + H[1] * y + H[2]) / w;
    var Y = (H[3] * x + H[4] * y + H[5]) / w;
    return [
      [(H[0] - X * H[6]) / w, (H[1] - X * H[7]) / w],
      [(H[3] - Y * H[6]) / w, (H[4] - Y * H[7]) / w]
    ];
  }

  /** Hartley normalisation: centroid to origin, mean distance sqrt(2). */
  function normalizer(pts) {
    var n = pts.length, mx = 0, my = 0, d = 0, i;
    for (i = 0; i < n; i++) { mx += pts[i][0]; my += pts[i][1]; }
    mx /= n; my /= n;
    for (i = 0; i < n; i++) d += Math.hypot(pts[i][0] - mx, pts[i][1] - my);
    d /= n;
    var s = d > 0 ? Math.SQRT2 / d : 1;
    return [s, 0, -s * mx, 0, s, -s * my, 0, 0, 1];
  }

  /**
   * DLT homography mapping src[i] -> dst[i] (at least 4 point pairs).
   * With exactly 4 pairs the solution is exact; with more it is least squares (h33 = 1).
   */
  function fromPoints(src, dst) {
    if (src.length < 4 || src.length !== dst.length) return null;
    var Ts = normalizer(src), Td = normalizer(dst);
    var ps = src.map(function (p) { return apply(Ts, p[0], p[1]); });
    var pd = dst.map(function (p) { return apply(Td, p[0], p[1]); });
    var rows = [], rhs = [];
    for (var i = 0; i < ps.length; i++) {
      var x = ps[i][0], y = ps[i][1], u = pd[i][0], v = pd[i][1];
      rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); rhs.push(u);
      rows.push([0, 0, 0, x, y, 1, -v * x, -v * y]); rhs.push(v);
    }
    var A, b;
    if (rows.length === 8) {
      A = rows; b = rhs;
    } else {
      // Normal equations
      A = []; b = [];
      for (var r = 0; r < 8; r++) {
        A.push(new Array(8).fill(0)); b.push(0);
      }
      for (var k = 0; k < rows.length; k++) {
        for (r = 0; r < 8; r++) {
          b[r] += rows[k][r] * rhs[k];
          for (var c = 0; c < 8; c++) A[r][c] += rows[k][r] * rows[k][c];
        }
      }
    }
    var h = solveLinear(A, b);
    if (!h) return null;
    var Hn = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
    var TdInv = invert(Td);
    var H = multiply(TdInv, multiply(Hn, Ts));
    var s = H[8];
    if (Math.abs(s) > 1e-300) for (var q = 0; q < 9; q++) H[q] /= s;
    return H;
  }

  /**
   * Least-squares similarity src -> dst: X = a x - b y + tx, Y = b x + a y + ty.
   * Returns { a, b, tx, ty, scale, angle, H }.
   */
  function fitSimilarity(src, dst) {
    var n = src.length, i;
    var msx = 0, msy = 0, mdx = 0, mdy = 0;
    for (i = 0; i < n; i++) {
      msx += src[i][0]; msy += src[i][1]; mdx += dst[i][0]; mdy += dst[i][1];
    }
    msx /= n; msy /= n; mdx /= n; mdy /= n;
    var sxx = 0, num_a = 0, num_b = 0;
    for (i = 0; i < n; i++) {
      var xs = src[i][0] - msx, ys = src[i][1] - msy;
      var xd = dst[i][0] - mdx, yd = dst[i][1] - mdy;
      sxx += xs * xs + ys * ys;
      num_a += xs * xd + ys * yd;
      num_b += xs * yd - ys * xd;
    }
    var a = num_a / sxx, b = num_b / sxx;
    var tx = mdx - a * msx + b * msy;
    var ty = mdy - b * msx - a * msy;
    return {
      a: a, b: b, tx: tx, ty: ty,
      scale: Math.hypot(a, b),
      angle: Math.atan2(b, a),
      H: [a, -b, tx, b, a, ty, 0, 0, 1]
    };
  }

  var api = {
    solveLinear: solveLinear, multiply: multiply, invert: invert, apply: apply,
    jacobian: jacobian, fromPoints: fromPoints, fitSimilarity: fitSimilarity
  };
  HUSS.image.homography = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
