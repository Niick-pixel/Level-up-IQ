// Which side has more dots? Two clouds flash too briefly to count, so you rely on your
// "number sense" (the approximate number system). The ratio gets closer as levels rise.
// Dot sizes vary, so the bigger-looking cloud isn't always the one with more dots.
import { trialsGame } from '../_engine/trials.js';
import { h } from '../../ui.js';

export const meta = {
  id: 'dot-compare',
  name: 'More dots',
  blurb: 'Two clouds of dots flash. Which side has more? No time to count.',
  howTo: ['Press ← (F) if the left side had more, → (J) for the right.', 'Go with your gut: the dots disappear fast.'],
  skills: ['math', 'attention'],
  durationRange: [45, 90],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const TRIALS = 24;
/** smaller ÷ larger count: 1:2 at level 1, about 9:10 at level 10. */
export const ratio = (d) => [0.5, 0.6, 0.67, 0.72, 0.77, 0.8, 0.83, 0.86, 0.88, 0.9][d - 1];
export const flashMs = (d) => Math.max(450, 950 - d * 50);

function cloud(rng, n) {
  const dots = [];
  let guard = 0;
  while (dots.length < n && guard++ < 4000) {
    const r = 1.6 + rng.next() * 2.4;
    const x = r + rng.next() * (100 - 2 * r);
    const y = r + rng.next() * (100 - 2 * r);
    if (dots.every((p) => Math.hypot(p.x - x, p.y - y) > p.r + r + 1.2)) dots.push({ x, y, r });
  }
  return dots;
}

/** trial: { left: dots[], right: dots[], more: 0 | 1 }. */
export function makeTrials(rng, d) {
  return Array.from({ length: TRIALS }, () => {
    const big = rng.int(14, 32);
    const small = Math.min(big - 1, Math.max(1, Math.round(big * ratio(d))));
    const more = rng.int(0, 1);
    const [l, r] = more === 0 ? [big, small] : [small, big];
    return { left: cloud(rng, l), right: cloud(rng, r), more };
  });
}

const svgNs = 'http://www.w3.org/2000/svg';
function panel(dots) {
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'dots-panel');
  svg.setAttribute('aria-hidden', 'true');
  for (const p of dots) {
    const c = document.createElementNS(svgNs, 'circle');
    c.setAttribute('cx', p.x.toFixed(1));
    c.setAttribute('cy', p.y.toFixed(1));
    c.setAttribute('r', p.r.toFixed(1));
    svg.append(c);
  }
  return svg;
}

export const game = trialsGame({
  meta,
  keys: [{ key: 'ArrowLeft', alt: ['f'], label: '← Left' }, { key: 'ArrowRight', alt: ['j'], label: 'Right →' }],
  makeTrials,
  limitMs: () => 2600,
  expect: (t) => t.more,
  render: (stage, t, ctx) => {
    const wrap = h('div', { class: 'dots-pair' }, panel(t.left), panel(t.right));
    stage.append(wrap);
    // mask after the flash, so it's estimation, not counting
    setTimeout(() => wrap.isConnected && wrap.classList.add('masked'), flashMs(ctx.difficulty));
  },
  targetRt: 900,
  intro: 'Which side had more dots?',
});
