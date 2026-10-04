// Synthetic HuSS scans with known geometry (spec 10.2).
//
//   node tests/synthetic/generate.js        -> samples/synthetic/S*.png + tests/synthetic/expected.json
//
// Pages are described in page mm and rasterised with exact distance-based
// anti-aliasing, then placed on a scanner bed (margin, rotation, quarter turns).
// Tests call generate(id) and work on the in-memory image.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const HUSS = require('../unit/_load.js');

const PAPER = [248, 248, 246];
const BED = [253, 253, 253];
const BLACK = [25, 25, 25];
const RED = [210, 35, 45];
const grey = (g) => [g, g, g];

const RED_STROKE_MM = 0.4;
const PENCIL_STROKE_MM = 0.5;
const BED_MARGIN_MM = 6;

// ---------------------------------------------------------------- scenes

const BASE = {
  template: 'A4L',
  dpi: 300,
  rotationDeg: 0,
  quarterTurns: 0,          // clockwise quarter turns applied to the finished scan
  pencil: 60,               // grey level of the pencil section lines
  figure: { dx: 0, height: 20, lift: 0, color: 'red' },
  ceilingRel: 60,           // ceiling line, mm above the floor line
  wallRel: 120,             // opposite wall, mm right of the start mark
  tieDecoy: false           // draw a mirrored floor line and start mark (orientation tie, QR decides)
};

const SCENES = {
  S1: { description: 'Clean' },
  S2: { description: '2 degree skew', rotationDeg: 2 },
  S3: { description: 'Rotated 180 degrees', quarterTurns: 2 },
  S4: { description: 'Rotated 90 degrees', quarterTurns: 1 },
  S5: { description: 'Faint pencil (grey 180)', pencil: 180 },
  S6: { description: 'No red: figure drawn in grey', figure: { color: 'grey' } },
  S7: { description: 'Figure 8 mm off the start mark', figure: { dx: 8 } },
  S8: { description: 'Figure floating 1.5 mm above the floor', figure: { lift: 1.5 } },
  S12: { description: '600 dpi', dpi: 600 },
  S13: { description: 'Figure 6 mm tall', figure: { height: 6 } },
  S15: { description: 'A3L template', template: 'A3L' },
  T1: { description: 'Orientation tie: mirrored floor line and start mark drawn by hand; the QR decides', tieDecoy: true, quarterTurns: 2 }
};

/** Deterministic, valid sheet code for a scene. */
function sceneCode(id) {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return HUSS.sheet.code.generate(mulberry32(h >>> 0));
}

function sceneParams(id) {
  const s = SCENES[id];
  if (!s) throw new Error('Unknown scene ' + id);
  return Object.assign({}, BASE, s, { id, code: sceneCode(id), figure: Object.assign({}, BASE.figure, s.figure || {}) });
}

// ---------------------------------------------------------------- shapes (page mm)

const rect = (x0, y0, x1, y1) => ({ type: 'rect', x0, y0, x1, y1 });
const seg = (a, b, w) => ({ type: 'seg', a, b, w });
const ring = (c, r, w) => ({ type: 'ring', c, r, w });
const poly = (pts) => ({ type: 'poly', pts });

function bbox(s) {
  switch (s.type) {
    case 'rect': return [s.x0, s.y0, s.x1, s.y1];
    case 'seg': {
      const h = s.w / 2;
      return [Math.min(s.a[0], s.b[0]) - h, Math.min(s.a[1], s.b[1]) - h, Math.max(s.a[0], s.b[0]) + h, Math.max(s.a[1], s.b[1]) + h];
    }
    case 'ring': {
      const e = s.r + s.w / 2;
      return [s.c[0] - e, s.c[1] - e, s.c[0] + e, s.c[1] + e];
    }
    case 'poly': {
      const xs = s.pts.map((p) => p[0]), ys = s.pts.map((p) => p[1]);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }
  }
  throw new Error('bad shape');
}

function distSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const L = vx * vx + vy * vy;
  let t = L > 0 ? ((px - ax) * vx + (py - ay) * vy) / L : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

/** Signed distance in mm (negative inside). */
function sdf(s, x, y) {
  switch (s.type) {
    case 'rect': {
      const dx = Math.max(s.x0 - x, 0, x - s.x1), dy = Math.max(s.y0 - y, 0, y - s.y1);
      if (dx > 0 || dy > 0) return Math.hypot(dx, dy);
      return -Math.min(x - s.x0, s.x1 - x, y - s.y0, s.y1 - y);
    }
    case 'seg': return distSeg(x, y, s.a[0], s.a[1], s.b[0], s.b[1]) - s.w / 2;
    case 'ring': return Math.abs(Math.hypot(x - s.c[0], y - s.c[1]) - s.r) - s.w / 2;
    case 'poly': {
      const p = s.pts;
      let inside = false, d = Infinity;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const [xi, yi] = p[i], [xj, yj] = p[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        d = Math.min(d, distSeg(x, y, xi, yi, xj, yj));
      }
      return inside ? -d : d;
    }
  }
  throw new Error('bad shape');
}

// ---------------------------------------------------------------- page content

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Printed template, drawn from the same items as the PDF and the print view
 * (HUSS.sheet.template.items). Text becomes one block per glyph (glyph width, cap height).
 */
function templateGroups(T, code) {
  const shapes = [], PT = 72 / 25.4, label = HUSS.config.DEFAULTS.sheet_label;
  const glyphW = (ch, it) => HUSS.sheet.pdf.widthPt(ch, it.font, it.size_pt) / PT;
  for (const it of HUSS.sheet.template.items(T, code, label)) {
    if (it.k === 'rect') shapes.push(rect(it.x, it.y, it.x + it.w, it.y + it.h));
    else if (it.k === 'rects') for (const r of it.rects) shapes.push(rect(r.x, r.y, r.x + r.w, r.y + r.h));
    else if (it.k === 'line') shapes.push(seg([it.x1, it.y1], [it.x2, it.y2], it.w));
    else if (it.k === 'poly') shapes.push(poly(it.pts));
    else if (it.k === 'text') {
      const cap = 0.7 * it.size_pt / PT, w = HUSS.sheet.pdf.widthPt(it.text, it.font, it.size_pt) / PT;
      let x = it.anchor === 'middle' ? it.x - w / 2 : it.anchor === 'end' ? it.x - w : it.x;
      for (const ch of it.text) {
        const cw = glyphW(ch, it);
        if (ch !== ' ') shapes.push(rect(x + 0.12 * cw, it.y - cap, x + 0.88 * cw, it.y));
        x += cw;
      }
    }
  }
  return [{ color: BLACK, shapes }];
}

/**
 * Stick figure. footBottom: lowest outer edge of the red trace; height: outer head top to
 * foot bottom. Returns the shapes and the exact head top.
 */
function figureShapes(cx, footBottom, height) {
  const w = RED_STROKE_MM, H = height;
  const top = footBottom - H;
  const headR = 0.07 * H - w / 2;                    // ring centre-line radius
  const headC = [cx, top + w / 2 + headR];
  const shoulderY = top + 0.2 * H, hipY = footBottom - 0.47 * H, handY = top + 0.5 * H;
  const footY = footBottom - w / 2;                  // round cap reaches footBottom
  return {
    head_top: top,
    shapes: [
      ring(headC, headR, w),
      seg([cx, headC[1] + headR], [cx, hipY], w),
      seg([cx, shoulderY], [cx - 0.17 * H, handY], w),
      seg([cx, shoulderY], [cx + 0.17 * H, handY], w),
      seg([cx, hipY], [cx - 0.12 * H, footY], w),
      seg([cx, hipY], [cx + 0.12 * H, footY], w)
    ]
  };
}

/** Builds the page description and the ground truth for one scene. */
function buildPage(p) {
  const T = HUSS.sheet.template.get(p.template);
  const floorY = T.floor.y;
  const groups = templateGroups(T, p.code);
  p = Object.assign({}, p, { ceilingY: floorY - p.ceilingRel, wallX: HUSS.sheet.template.markX(T) + p.wallRel });

  // Pencil section: only what the section cuts — ceiling, back wall behind the viewer, opposite wall.
  const pw = PENCIL_STROKE_MM, left = 14;
  groups.push({
    color: grey(p.pencil),
    shapes: [
      seg([left, p.ceilingY], [p.wallX + 0.6, p.ceilingY], pw),
      seg([left, p.ceilingY], [left, floorY], pw),
      seg([p.wallX, p.ceilingY], [p.wallX, floorY], pw)
    ]
  });
  if (p.tieDecoy) {
    // What the floor line and start mark look like when the page is turned 180 degrees.
    const W = T.width_mm, Hh = T.height_mm, mir = ([x, y]) => [W - x, Hh - y];
    groups.push({
      color: grey(40),
      shapes: [
        seg(mir([T.floor.x0, T.floor.y]), mir([T.floor.x1, T.floor.y]), pw),
        poly([mir(T.mark.apex), mir(T.mark.base[0]), mir(T.mark.base[1])])
      ]
    });
  }

  // Figure: feet touch the floor line (outer edge 0.1 mm past its centre) unless lifted.
  const cx = HUSS.sheet.template.markX(T) + p.figure.dx;
  const footBottom = p.figure.lift > 0 ? floorY - p.figure.lift : floorY + 0.1;
  const fig = figureShapes(cx, footBottom, p.figure.height);
  groups.push({ color: p.figure.color === 'red' ? RED : grey(p.pencil), shapes: fig.shapes });

  const cfg = HUSS.config.DEFAULTS;
  const rule = HUSS.measure.compute.footRule(footBottom, floorY, cfg.foot_tolerance_mm);
  const isRed = p.figure.color === 'red';
  const handles = {
    head_y: fig.head_top, foot_y: rule.foot_y, ceiling_y: p.ceilingY, wall_x: p.wallX,
    axis_x: cx, floor_y_axis: floorY
  };
  const comp = HUSS.measure.compute.compute(handles, cfg);
  return {
    T, groups,
    truth: {
      sheet_code: p.code,
      floor_y: floorY,
      axis_x: cx,
      head_y: fig.head_top,
      raw_foot_y: footBottom,
      foot_y: rule.foot_y,
      ceiling_y: p.ceilingY,
      wall_x: p.wallX,
      figure_mm: comp.figure_mm,
      ceiling_mm: comp.ceiling_mm,
      distance_mm: comp.distance_mm,
      est_vertical_m: comp.est_vertical_m,
      est_horizontal_m: comp.est_horizontal_m,
      flags: {
        flag_red_not_found: !isRed,
        flag_figure_off_mark: Math.abs(p.figure.dx) > HUSS.config.MARK.OFF_MARK_MM,
        flag_foot_off_floor: isRed && rule.off_floor,
        flag_figure_small: comp.figure_mm < cfg.min_figure_mm
      }
    }
  };
}

// ---------------------------------------------------------------- rasteriser

function render(p, page) {
  const T = page.T;
  const s = p.dpi / 25.4;                                 // px per mm
  const M = BED_MARGIN_MM;
  const W = Math.round((T.width_mm + 2 * M) * s), H = Math.round((T.height_mm + 2 * M) * s);
  const th = (p.rotationDeg * Math.PI) / 180, c = Math.cos(th), sn = Math.sin(th);
  const pcx = T.width_mm / 2, pcy = T.height_mm / 2;
  // page mm -> unrotated scan px (continuous; pixel i spans [i, i + 1))
  const fwd = (x, y) => [
    (pcx + M + c * (x - pcx) - sn * (y - pcy)) * s,
    (pcy + M + sn * (x - pcx) + c * (y - pcy)) * s
  ];
  const inv = (X, Y) => {
    const u = X / s - (pcx + M), v = Y / s - (pcy + M);
    return [pcx + c * u + sn * v, pcy - sn * u + c * v];
  };

  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    data[i * 4] = BED[0]; data[i * 4 + 1] = BED[1]; data[i * 4 + 2] = BED[2]; data[i * 4 + 3] = 255;
  }
  const cov = new Float32Array(W * H);

  const groups = [{ color: PAPER.map((v, k) => (255 * v) / BED[k]), shapes: [rect(0, 0, T.width_mm, T.height_mm)] }].concat(page.groups);
  for (const g of groups) {
    const boxes = [];
    for (const shape of g.shapes) {
      const [bx0, by0, bx1, by1] = bbox(shape);
      const pad = 2 / s;
      const corners = [fwd(bx0 - pad, by0 - pad), fwd(bx1 + pad, by0 - pad), fwd(bx1 + pad, by1 + pad), fwd(bx0 - pad, by1 + pad)];
      const X0 = Math.max(0, Math.floor(Math.min(...corners.map((q) => q[0]))));
      const X1 = Math.min(W - 1, Math.ceil(Math.max(...corners.map((q) => q[0]))));
      const Y0 = Math.max(0, Math.floor(Math.min(...corners.map((q) => q[1]))));
      const Y1 = Math.min(H - 1, Math.ceil(Math.max(...corners.map((q) => q[1]))));
      if (X1 < X0 || Y1 < Y0) continue;
      boxes.push([X0, Y0, X1, Y1]);
      for (let Y = Y0; Y <= Y1; Y++) {
        for (let X = X0; X <= X1; X++) {
          const [x, y] = inv(X + 0.5, Y + 0.5);
          const d = sdf(shape, x, y) * s;
          let a = 0.5 - d;
          if (a <= 0) continue;
          if (a > 1) a = 1;
          const k = Y * W + X;
          if (a > cov[k]) cov[k] = a;
        }
      }
    }
    const f = g.color.map((v) => 1 - v / 255);
    for (const [X0, Y0, X1, Y1] of boxes) {
      for (let Y = Y0; Y <= Y1; Y++) {
        for (let X = X0; X <= X1; X++) {
          const k = Y * W + X, a = cov[k];
          if (a === 0) continue;
          cov[k] = 0;
          const o = k * 4;
          data[o] = data[o] * (1 - a * f[0]);
          data[o + 1] = data[o + 1] * (1 - a * f[1]);
          data[o + 2] = data[o + 2] * (1 - a * f[2]);
        }
      }
    }
  }

  let img = { width: W, height: H, data };
  let map = fwd;
  for (let q = 0; q < p.quarterTurns; q++) {
    const prev = map, hPrev = img.height;
    img = rotateCW(img);
    map = (x, y) => { const [X, Y] = prev(x, y); return [hPrev - Y, X]; };
  }
  return { img, map, pxPerMm: s };
}

/** Rotates an RGBA image 90 degrees clockwise: (x, y) -> (H - 1 - y, x). */
function rotateCW(img) {
  const { width: W, height: H, data } = img;
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, nx = H - 1 - y, ny = x, j = (ny * H + nx) * 4;
      out[j] = data[i]; out[j + 1] = data[i + 1]; out[j + 2] = data[i + 2]; out[j + 3] = 255;
    }
  }
  return { width: H, height: W, data: out };
}

// ---------------------------------------------------------------- API

/** Returns { id, params, img, map (page mm -> image px), pxPerMm, truth }. */
function generate(id) {
  const params = sceneParams(id);
  const page = buildPage(params);
  const r = render(params, page);
  const truth = page.truth;
  const T = page.T;
  truth.corners_px = T.corners.map(([x, y]) => r.map(x, y));
  return { id, params, template: T.id, img: r.img, map: r.map, pxPerMm: r.pxPerMm, truth };
}

function main() {
  const png = require('./png.js');
  const root = path.join(__dirname, '..', '..');
  const outDir = path.join(root, 'samples', 'synthetic');
  fs.mkdirSync(outDir, { recursive: true });
  const expected = {};
  for (const id of Object.keys(SCENES)) {
    const g = generate(id);
    fs.writeFileSync(path.join(outDir, id + '.png'), png.encode(g.img, g.params.dpi));
    expected[id] = {
      description: g.params.description,
      template: g.template,
      dpi: g.params.dpi,
      rotation_deg: g.params.rotationDeg,
      quarter_turns: g.params.quarterTurns,
      image_width_px: g.img.width,
      image_height_px: g.img.height,
      truth: g.truth
    };
    console.log(id, g.img.width + 'x' + g.img.height, g.params.description);
  }
  fs.writeFileSync(path.join(__dirname, 'expected.json'), JSON.stringify(expected, null, 2) + '\n');
}

module.exports = { generate, SCENES };
if (require.main === module) main();
