// Eriksen flanker task: which way does the MIDDLE arrow point? The arrows around it pull
// your attention; ignoring them is selective attention.
import { trialsGame } from '../_engine/trials.js';
import { h } from '../../ui.js';

export const meta = {
  id: 'flanker',
  name: 'Flanker',
  blurb: 'Which way does the middle arrow point? Ignore the arrows around it.',
  howTo: ['Press ← or → (or F / J) for the MIDDLE arrow.', 'Be fast, but be right.'],
  skills: ['attention'],
  durationRange: [45, 90],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const TRIALS = 32;
export const width = (d) => (d >= 7 ? 7 : 5);
export const congruentShare = (d) => Math.max(0.25, 0.5 - d * 0.03);
export const neutralShare = (d) => (d <= 3 ? 0.25 : 0);
export const limitMs = (d) => (d < 4 ? 2000 : Math.max(850, 1600 - (d - 4) * 125));

/** kind: 'congruent' | 'incongruent' | 'neutral'; dir: 0 left, 1 right. */
export function makeTrials(rng, d) {
  const n = TRIALS;
  const cong = Math.round(n * congruentShare(d));
  const neut = Math.round(n * neutralShare(d));
  const kinds = rng.shuffle(Array.from({ length: n }, (_, i) => (i < cong ? 'congruent' : i < cong + neut ? 'neutral' : 'incongruent')));
  return kinds.map((kind) => ({ kind, dir: rng.int(0, 1), width: width(d) }));
}

export function stimulus({ kind, dir, width: w }) {
  const mid = dir ? '>' : '<';
  const flank = kind === 'neutral' ? '–' : kind === 'congruent' ? mid : dir ? '<' : '>';
  const side = flank.repeat((w - 1) / 2);
  return side + mid + side;
}

export const game = trialsGame({
  meta,
  keys: [{ key: 'ArrowLeft', alt: ['f'], label: '← Left' }, { key: 'ArrowRight', alt: ['j'], label: 'Right →' }],
  makeTrials,
  limitMs,
  expect: (t) => t.dir,
  render: (stage, t) => stage.append(h('div', { class: 'flanker-stim' }, stimulus(t))),
  intro: 'Respond to the middle arrow only.',
});
