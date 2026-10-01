// Task switching: the cue says which question to answer about the digit (odd or even? less or
// more than 5?), and it changes without warning. Switching costs time; practice shrinks the cost.
// Trains cognitive flexibility, one of the core executive functions.
import { trialsGame } from '../_engine/trials.js';
import { h } from '../../ui.js';

export const meta = {
  id: 'task-switch',
  name: 'Task switching',
  blurb: 'Odd or even? Less or more than 5? The question keeps changing.',
  howTo: ['Read the question above the digit, then answer it.', 'Left (← or F): odd / less than 5. Right (→ or J): even / more than 5.'],
  skills: ['attention', 'logic'],
  durationRange: [50, 110],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const TRIALS = 32;
export const TASKS = { parity: 'Odd or even?', magnitude: 'Less or more than 5?' };
export const switchRate = (d) => Math.min(0.6, 0.2 + d * 0.04);
export const limitMs = (d) => Math.max(1100, 2800 - d * 150);

/** trial: { task, digit }; digits 1–9 without 5. */
export function makeTrials(rng, d) {
  const digits = [1, 2, 3, 4, 6, 7, 8, 9];
  let task = rng.pick(['parity', 'magnitude']);
  return Array.from({ length: TRIALS }, (_, i) => {
    if (i > 0 && rng.chance(switchRate(d))) task = task === 'parity' ? 'magnitude' : 'parity';
    return { task, digit: rng.pick(digits) };
  });
}

/** 0 = left (odd / less), 1 = right (even / more). */
export const answer = (t) => (t.task === 'parity' ? (t.digit % 2 === 0 ? 1 : 0) : (t.digit > 5 ? 1 : 0));

export const game = trialsGame({
  meta,
  keys: [{ key: 'ArrowLeft', alt: ['f'], label: '← Odd · Less' }, { key: 'ArrowRight', alt: ['j'], label: 'Even · More →' }],
  makeTrials,
  limitMs,
  expect: answer,
  render: (stage, t) => stage.append(h('div', { class: `ts-wrap ${t.task}` },
    h('div', { class: 'ts-cue' }, TASKS[t.task]),
    h('div', { class: 'ts-digit' }, String(t.digit)))),
  targetRt: 800,
  intro: 'Answer the question shown above each digit.',
});
