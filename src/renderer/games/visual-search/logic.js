// Visual search (Treisman): is there a T among the other shapes? Among O's the T "pops out" in
// parallel; among rotated L's you have to check them one by one, so bigger displays take longer.
import { trialsGame, defaultScore } from '../_engine/trials.js';
import { h } from '../../ui.js';

export const meta = {
  id: 'visual-search',
  name: 'Visual search',
  blurb: 'Is there a T hidden among the other letters? Answer yes or no, fast.',
  howTo: ['J or → : a T is there.', 'F or ← : no T.', 'The T can be rotated.'],
  skills: ['attention', 'spatial'],
  durationRange: [45, 120],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const TRIALS = 20;
export const setSize = (d) => [6, 8, 10, 8, 12, 16, 20, 24, 28, 32][Math.min(9, d - 1)];
export const distractor = (d) => (d <= 3 ? 'O' : 'L');
export const limitMs = (d) => (d <= 3 ? 3000 : 3000 + setSize(d) * 90);
const GRID = 8; // 8 × 6 cells, one letter per cell at most
const ROWS = 6;

export function makeTrials(rng, d) {
  const n = setSize(d);
  const present = rng.shuffle(Array.from({ length: TRIALS }, (_, i) => i < TRIALS / 2));
  return present.map((isThere) => {
    const cells = rng.shuffle(Array.from({ length: GRID * ROWS }, (_, i) => i)).slice(0, n);
    const items = cells.map((cell, k) => ({
      ch: isThere && k === 0 ? 'T' : distractor(d),
      x: (cell % GRID) * (100 / GRID) + rng.int(1, 5),
      y: Math.floor(cell / GRID) * (100 / ROWS) + rng.int(1, 5),
      rot: rng.pick([0, 90, 180, 270]),
    }));
    return { present: isThere, items };
  });
}

export const game = trialsGame({
  meta,
  keys: [{ key: 'ArrowLeft', alt: ['f'], label: '← No T (F)' }, { key: 'ArrowRight', alt: ['j'], label: 'T is there (J) →' }],
  makeTrials,
  limitMs,
  expect: (t) => (t.present ? 1 : 0),
  render: (stage, t) => stage.append(h('div', { class: 'vs-field' }, t.items.map((it) => h('span', {
    class: 'vs-item', style: { left: `${it.x}%`, top: `${it.y}%`, transform: `rotate(${it.rot}deg)` },
  }, it.ch)))),
  score: (args) => defaultScore({ ...args, targetRt: 1200 }),
  gapMs: 500,
});
