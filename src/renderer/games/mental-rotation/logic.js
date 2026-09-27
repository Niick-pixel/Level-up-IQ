// 3D mental rotation (Shepard & Metzler, 1971): are the two block figures the same object turned
// around, or mirror images? Response time grows with the angle between them, as if you were
// rotating a picture in your head.
import { trialsGame, defaultScore } from '../_engine/trials.js';
import { h } from '../../ui.js';

export const meta = {
  id: 'mental-rotation',
  name: '3D mental rotation',
  blurb: 'Two block figures: the same object turned around, or its mirror image?',
  howTo: ['← or F: same object, just rotated.', '→ or J: mirror image (can never be turned to match).'],
  skills: ['spatial'],
  durationRange: [60, 180],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const TRIALS = 12;

const AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const key = (p) => p.join(',');

/** A Shepard–Metzler figure: four straight arms, each at a right angle to the last. */
export function genShape(rng, cubes = 10) {
  for (;;) {
    const lengths = cubes >= 10 ? rng.shuffle([2, 3, 3, 2]) : rng.shuffle([2, 2, 3, 1]);
    const pts = [[0, 0, 0]];
    let dir = null;
    let ok = true;
    for (const len of lengths) {
      const options = AXES.filter((a) => !dir || a.every((v, i) => v * dir[i] === 0));
      // the last arm must leave the plane of the previous two, so the figure is truly 3D (and chiral)
      dir = rng.pick(options);
      for (let k = 0; k < len; k++) {
        const p = add(pts[pts.length - 1], dir);
        if (pts.some((q) => key(q) === key(p))) { ok = false; break; }
        pts.push(p);
      }
      if (!ok) break;
    }
    if (ok && isChiral(pts) && spansThreeAxes(pts)) return center(pts);
  }
}

const spansThreeAxes = (pts) => [0, 1, 2].every((i) => new Set(pts.map((p) => p[i])).size > 1);

function center(pts) {
  const c = [0, 1, 2].map((i) => pts.reduce((s, p) => s + p[i], 0) / pts.length);
  return pts.map((p) => p.map((v, i) => v - c[i]));
}

export const mirror = (pts) => pts.map(([x, y, z]) => [-x, y, z]);

/** The 24 rotations of a cube, as integer matrices. */
const ROT24 = (() => {
  const out = [];
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const p of perms) {
    for (let s = 0; s < 8; s++) {
      const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      p.forEach((col, row) => { m[row][col] = s & (1 << row) ? -1 : 1; });
      const det = m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
      if (det === 1) out.push(m);
    }
  }
  return out;
})();

const apply = (m, p) => [0, 1, 2].map((r) => m[r][0] * p[0] + m[r][1] * p[1] + m[r][2] * p[2]);
function canon(pts) {
  const min = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i])));
  return pts.map((p) => p.map((v, i) => Math.round((v - min[i]) * 2))).map(key).sort().join('|');
}

/** True when no rotation turns the figure into its mirror image. */
export function isChiral(pts) {
  const m = canon(mirror(pts));
  return ROT24.every((r) => canon(pts.map((p) => apply(r, p))) !== m);
}

/** Can figure b be rotated onto figure a? (Used by tests.) */
export const sameUpToRotation = (a, b) => ROT24.some((r) => canon(b.map((p) => apply(r, p))) === canon(a));

// ---- continuous rotations for display

export function rotation(axis, angle) {
  const [x, y, z] = axis;
  const n = Math.hypot(x, y, z);
  const [u, v, w] = [x / n, y / n, z / n];
  const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  return [
    [t * u * u + c, t * u * v - s * w, t * u * w + s * v],
    [t * u * v + s * w, t * v * v + c, t * v * w - s * u],
    [t * u * w - s * v, t * v * w + s * u, t * w * w + c],
  ];
}
export const mul = (a, b) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));

/** Angle (degrees) between the two views grows with the level; high levels rotate in depth. */
export function viewFor(rng, d) {
  const angle = (d <= 3 ? rng.int(40, 100) : d <= 6 ? rng.int(60, 140) : rng.int(90, 180)) * (Math.PI / 180);
  const axis = d <= 3 ? [0, 1, 0] : d <= 6 ? rng.pick([[0, 1, 0], [1, 0, 0]]) : [rng.int(-9, 9) || 1, rng.int(-9, 9), rng.int(-9, 9)];
  return rotation(axis, angle);
}

export function makeTrials(rng, d) {
  const cubes = d <= 4 ? 8 : 10;
  const mirrorFlags = rng.shuffle(Array.from({ length: TRIALS }, (_, i) => i < TRIALS / 2));
  return mirrorFlags.map((isMirror) => {
    const shape = genShape(rng, cubes);
    const base = mul(rotation([1, 0, 0], -0.45), rotation([0, 1, 0], rng.int(0, 359) * (Math.PI / 180)));
    return { shape, other: isMirror ? mirror(shape) : shape, isMirror, left: base, right: mul(base, viewFor(rng, d)) };
  });
}

// ---- drawing (painter's algorithm on a canvas; enough for unit cubes)

const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

export function drawFigure(canvas, pts, m, colors) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  const occupied = new Set(pts.map(key));
  const scale = W / 8.5;
  const light = [0.35, 0.8, 0.5];
  const polys = [];
  for (const p of pts) {
    for (const f of FACES) {
      if (occupied.has(key(add(p, f.n)))) continue; // hidden between two cubes
      const n = apply(m, f.n);
      if (n[2] <= 0.001) continue; // facing away (camera looks down −z; +z faces us)
      const corners = f.c.map((c) => apply(m, [p[0] + c[0] - 0.5, p[1] + c[1] - 0.5, p[2] + c[2] - 0.5]));
      const depth = corners.reduce((s, c) => s + c[2], 0) / 4;
      const lum = 0.45 + 0.55 * Math.max(0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
      polys.push({ corners, depth, lum });
    }
  }
  polys.sort((a, b) => a.depth - b.depth);
  for (const poly of polys) {
    g.beginPath();
    poly.corners.forEach(([x, y], i) => {
      const X = W / 2 + x * scale, Y = H / 2 - y * scale;
      if (i) g.lineTo(X, Y); else g.moveTo(X, Y);
    });
    g.closePath();
    const [r, gg, b] = colors.fill;
    g.fillStyle = `rgb(${Math.round(r * poly.lum)}, ${Math.round(gg * poly.lum)}, ${Math.round(b * poly.lum)})`;
    g.fill();
    g.strokeStyle = colors.edge;
    g.lineWidth = 1.2;
    g.stroke();
  }
}

function parseColor(css) {
  const m = /^#?([0-9a-f]{6})$/i.exec(css.trim());
  if (!m) return [182, 166, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const game = trialsGame({
  meta,
  keys: [{ key: 'ArrowLeft', alt: ['f'], label: '← Same (F)' }, { key: 'ArrowRight', alt: ['j'], label: 'Mirror (J) →' }],
  makeTrials,
  limitMs: () => 15000,
  expect: (t) => (t.isMirror ? 1 : 0),
  foreperiodMs: () => 300,
  render: (stage, t) => {
    const css = getComputedStyle(document.documentElement);
    const colors = { fill: parseColor(css.getPropertyValue('--accent') || '#b6a6ff'), edge: 'rgba(0,0,0,0.55)' };
    const a = h('canvas', { width: 240, height: 240, class: 'mr-canvas', 'aria-label': 'Figure A' });
    const b = h('canvas', { width: 240, height: 240, class: 'mr-canvas', 'aria-label': 'Figure B' });
    stage.append(h('div', { class: 'mr-pair' }, a, b));
    drawFigure(a, t.shape, t.left, colors);
    drawFigure(b, t.other, t.right, colors);
  },
  score: (args) => defaultScore({ ...args, targetRt: 4000 }),
  gapMs: 500,
  intro: 'Same object rotated (←), or a mirror image (→)?',
});
