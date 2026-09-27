// Reaction time: simple (one signal, one key) at low levels; choice reaction time (2 then 4
// possible signals) higher up. Each extra choice adds decision time: Hick's law.
import { trialsGame, defaultScore } from '../_engine/trials.js';
import { h } from '../../ui.js';

export const meta = {
  id: 'reaction-time',
  name: 'Reaction time',
  blurb: 'Hit the key the moment the signal appears. Later: pick the right key out of 2, then 4.',
  howTo: ['Wait for the signal (pressing early is a false start).', 'Simple: press Space. Choice: press the arrow pointing where the dot is.'],
  skills: ['attention'],
  durationRange: [30, 90],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const TRIALS = 15;
export const choices = (d) => (d <= 3 ? 1 : d <= 7 ? 2 : 4);
export const limitMs = (d) => (choices(d) === 1 ? 1200 : 1500);
const DIRS = [
  { key: 'ArrowLeft', label: '←', cls: 'left' },
  { key: 'ArrowRight', label: '→', cls: 'right' },
  { key: 'ArrowUp', label: '↑', cls: 'up' },
  { key: 'ArrowDown', label: '↓', cls: 'down' },
];
export const targetRt = (d) => ({ 1: 330, 2: 450, 4: 550 })[choices(d)];

export function makeTrials(rng, d) {
  const n = choices(d);
  return Array.from({ length: TRIALS }, () => ({ at: rng.int(0, n - 1), n }));
}

/** The game object depends on the level (1, 2 or 4 keys), so it's built per round. */
export function gameFor(d) {
  const n = choices(d);
  const keys = n === 1 ? [{ key: ' ', label: 'Now! (Space)' }] : DIRS.slice(0, n).map((x) => ({ key: x.key, label: x.label }));
  return trialsGame({
    meta,
    keys,
    makeTrials,
    limitMs,
    expect: (t) => t.at,
    foreperiodMs: (rng) => rng.int(900, 2800),
    render: (stage, t) => stage.append(h('div', { class: `rt-signal ${t.n === 1 ? 'center' : DIRS[t.at].cls}` })),
    score: (args) => defaultScore({ ...args, targetRt: targetRt(d) }),
    gapMs: 700,
    intro: n === 1 ? 'Press Space as soon as the circle appears.' : 'Press the arrow key pointing to where the circle appears.',
  });
}
