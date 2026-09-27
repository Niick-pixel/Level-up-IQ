// The 24 game: use all four numbers exactly once with + − × ÷ to make 24.
// At the top levels, puzzles are chosen that need fractions along the way.
import { solve, evaluate, value } from '../_engine/arith.js';

export const meta = {
  id: 'game-24',
  name: 'The 24 game',
  blurb: 'Use all four numbers, each exactly once, with + − × ÷ to make 24.',
  howTo: ['Type an expression and press Enter, e.g. (8 − 2) × (7 − 3).', 'Four puzzles per round.'],
  skills: ['math'],
  durationRange: [60, 300],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export function genPuzzle(rng, d) {
  const max = d <= 3 ? 9 : d <= 7 ? 10 : 13;
  for (let attempt = 0; attempt < 2000; attempt++) {
    const numbers = [...Array(4)].map(() => rng.int(1, max));
    const whole = solve(numbers, 24, { useAll: true, integerSteps: true });
    if (d >= 9) {
      // hardest: solvable only with a fraction along the way
      if (whole) continue;
      const any = solve(numbers, 24, { useAll: true });
      if (any) return { numbers, solution: any };
    } else if (whole) {
      return { numbers, solution: whole };
    }
  }
  throw new Error('Could not find a 24 puzzle');
}

export function checkAnswer(p, text) {
  let r;
  try {
    r = evaluate(text);
  } catch {
    return false;
  }
  const a = [...r.numbers].sort((x, y) => x - y).join(',');
  const b = [...p.numbers].sort((x, y) => x - y).join(',');
  return a === b && Math.abs(value(r.value) - 24) < 1e-9;
}

export function makeItems(rng, d) {
  return [...Array(4)].map(() => {
    const p = genPuzzle(rng, d);
    return {
      prompt: 'Make 24',
      detail: p.numbers.join('   '),
      check: (t) => checkAnswer(p, t),
      answerText: `${p.solution} = 24`,
      placeholder: 'e.g. (8 − 2) × (7 − 3)',
    };
  });
}
