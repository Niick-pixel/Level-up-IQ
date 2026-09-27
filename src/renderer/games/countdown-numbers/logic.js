// Countdown numbers round: reach the target using some of the numbers once each, with + − × ÷.
// Every target is checked by the solver to be reachable exactly under Countdown rules
// (whole-number steps only).
import { solve, evaluate, usesOnly, value } from '../_engine/arith.js';

export const meta = {
  id: 'countdown-numbers',
  name: 'Countdown numbers',
  blurb: 'Reach the target using some of the numbers, each at most once, with + − × ÷.',
  howTo: ['Type an expression, e.g. (75 − 5) × 3 + 1, and press Enter.', 'Exact scores full marks; within 5 or 10 scores partly.'],
  skills: ['math'],
  durationRange: [90, 400],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

const LARGE = [25, 50, 75, 100];
const SMALL = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10];

export function genPuzzle(rng, d) {
  for (let attempt = 0; attempt < 200; attempt++) {
    let numbers, target;
    if (d <= 3) {
      numbers = rng.shuffle(SMALL).slice(0, 4);
      target = rng.int(12, 60);
    } else {
      const large = d <= 6 ? 1 : rng.int(1, Math.min(4, d - 5));
      numbers = [...rng.shuffle(LARGE).slice(0, large), ...rng.shuffle(SMALL).slice(0, 6 - large)];
      target = d <= 6 ? rng.int(101, 400) : rng.int(101, 999);
    }
    const solution = solve(numbers, target, { integerSteps: true });
    if (solution) return { numbers, target, solution };
  }
  throw new Error('Could not find a solvable target');
}

/** 1 = exact, 0.7 = within 5, 0.5 = within 10 (Countdown scoring 10/7/5). */
export function checkAnswer(p, text) {
  let r;
  try {
    r = evaluate(text);
  } catch {
    return 0;
  }
  if (!usesOnly(r.numbers, p.numbers)) return 0;
  const v = value(r.value);
  const off = Math.abs(v - p.target);
  return off < 1e-9 ? 1 : off <= 5 ? 0.7 : off <= 10 ? 0.5 : 0;
}

export function makeItems(rng, d) {
  return [...Array(3)].map(() => {
    const p = genPuzzle(rng, d);
    return {
      prompt: `Target: ${p.target}`,
      detail: `Numbers: ${p.numbers.join('   ')}`,
      check: (t) => checkAnswer(p, t),
      answerText: `${p.solution} = ${p.target}`,
      placeholder: 'e.g. (75 − 5) × 3 + 1',
    };
  });
}
