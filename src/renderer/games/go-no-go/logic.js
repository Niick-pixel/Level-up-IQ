// Go/No-Go: press for every letter except X. Most letters are "go", so pressing becomes a habit,
// and stopping yourself on the X is response inhibition.
import { trialsGame, defaultScore } from '../_engine/trials.js';
import { h } from '../../ui.js';

export const meta = {
  id: 'go-no-go',
  name: 'Go / No-Go',
  blurb: 'Press Space for every letter, except X. Hold back on the X.',
  howTo: ['Press Space (or the button) as soon as a letter appears.', 'When it is an X, do nothing.'],
  skills: ['attention'],
  durationRange: [45, 90],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const TRIALS = 40;
export const goShare = (d) => Math.min(0.85, 0.7 + d * 0.015);
export const limitMs = (d) => Math.max(550, 1000 - d * 45);
const LETTERS = 'ABCDEFGHJKLMNPRSTUVWYZ';

export function makeTrials(rng, d) {
  const go = Math.round(TRIALS * goShare(d));
  const flags = rng.shuffle(Array.from({ length: TRIALS }, (_, i) => i < go));
  // never start with a no-go, so the habit has a chance to form
  if (!flags[0]) { const k = flags.indexOf(true); [flags[0], flags[k]] = [flags[k], flags[0]]; }
  return flags.map((isGo) => ({ go: isGo, letter: isGo ? rng.pick([...LETTERS]) : 'X' }));
}

/** Misses on "go" and presses on "no-go" both count; the no-go ones count double. */
export function score({ trials, responses, difficulty }) {
  const base = defaultScore({ responses, difficulty, targetRt: 450 });
  const nogo = trials.map((t, i) => [t, responses[i]]).filter(([t]) => !t.go);
  const held = nogo.filter(([, r]) => r.ok).length;
  const inhibition = nogo.length ? held / nogo.length : 1;
  return { ...base, performance: Math.min(1, Math.max(0, (2 * base.performance + inhibition) / 3 - (1 - inhibition) * 0.2)) };
}

export const game = trialsGame({
  meta,
  keys: [{ key: ' ', label: 'Go (Space)' }],
  makeTrials,
  limitMs,
  expect: (t) => (t.go ? 0 : -1),
  foreperiodMs: (rng) => rng.int(250, 600),
  render: (stage, t) => stage.append(h('div', { class: 'gonogo-stim' }, t.letter)),
  score,
  gapMs: 250,
  intro: 'Space for every letter. Nothing for X.',
});
