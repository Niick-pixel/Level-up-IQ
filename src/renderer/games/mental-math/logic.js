// Mental math sprint: as many correct answers as you can in 60 seconds, no calculator.

export const meta = {
  id: 'mental-math',
  name: 'Mental math sprint',
  blurb: 'Answer as many as you can in 60 seconds. No calculator.',
  howTo: ['Type the answer and press Enter.', 'Press Enter on an empty box to skip.'],
  skills: ['math', 'attention'],
  durationRange: [60, 60],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const SPRINT_MS = 60000;

// Each kind of problem unlocks at a difficulty level. Higher levels mix in harder kinds.
const KINDS = [
  { min: 1, max: 3, make: (r) => { const a = r.int(1, 9), b = r.int(1, 9); return [`${a} + ${b}`, a + b]; } },
  { min: 1, max: 3, make: (r) => { const a = r.int(2, 18), b = r.int(1, a); return [`${a} − ${b}`, a - b]; } },
  { min: 2, max: 5, make: (r) => { const a = r.int(2, 5), b = r.int(2, 9); return [`${a} × ${b}`, a * b]; } },
  { min: 3, max: 6, make: (r) => { const a = r.int(11, 89), b = r.int(2, 9); return r.chance(0.5) ? [`${a} + ${b}`, a + b] : [`${a} − ${b}`, a - b]; } },
  { min: 4, max: 7, make: (r) => { const a = r.int(2, 10), b = r.int(2, 10); return [`${a} × ${b}`, a * b]; } },
  { min: 4, max: 8, make: (r) => { const a = r.int(12, 89), b = r.int(11, 60); return r.chance(0.5) ? [`${a} + ${b}`, a + b] : [`${a + b} − ${b}`, a]; } },
  { min: 5, max: 8, make: (r) => { const b = r.int(2, 10), q = r.int(2, 12); return [`${b * q} ÷ ${b}`, q]; } },
  { min: 6, max: 10, make: (r) => { const a = r.int(12, 49), b = r.int(3, 9); return [`${a} × ${b}`, a * b]; } },
  { min: 6, max: 9, make: (r) => { const a = r.int(101, 899), b = r.int(12, 99); return r.chance(0.5) ? [`${a} + ${b}`, a + b] : [`${a} − ${b}`, a - b]; } },
  { min: 7, max: 10, make: (r) => { const p = r.pick([10, 20, 25, 50, 75]); const base = r.int(1, 12) * (p === 75 || p === 25 ? 4 : 10); return [`${p}% of ${base}`, (p * base) / 100]; } },
  { min: 7, max: 10, make: (r) => { const a = r.int(11, 25); return [`${a}²`, a * a]; } },
  { min: 8, max: 10, make: (r) => { const a = r.int(11, 39), b = r.int(11, 19); return [`${a} × ${b}`, a * b]; } },
  { min: 8, max: 10, make: (r) => { const b = r.int(3, 9), q = r.int(12, 99); return [`${b * q} ÷ ${b}`, q]; } },
  { min: 9, max: 10, make: (r) => { const a = r.int(3, 12), b = r.int(3, 12), c = r.int(5, 60); return [`${a} × ${b} + ${c}`, a * b + c]; } },
  { min: 10, max: 10, make: (r) => { const p = r.pick([15, 35, 45]); const base = r.int(2, 20) * 20; return [`${p}% of ${base}`, (p * base) / 100]; } },
];

/** @returns {{ text: string, answer: number }} */
export function genProblem(rng, difficulty) {
  const pool = KINDS.filter((k) => difficulty >= k.min && difficulty <= k.max);
  // favour the kinds that unlocked most recently (they match this level best)
  const kind = rng.weighted(pool, (k) => 1 + k.min);
  const [text, answer] = kind.make(rng);
  return { text, answer };
}

/** Expected correct answers in a minute at this level (harder problems take longer). */
export function targetCount(difficulty) {
  return Math.max(6, Math.round(20 - difficulty * 1.4));
}

export function scoreRound({ correct, attempted, difficulty }) {
  const accuracy = attempted ? correct / attempted : 0;
  const pace = Math.min(1, correct / targetCount(difficulty));
  return {
    score: correct * 10 * difficulty,
    accuracy,
    performance: accuracy * (0.4 + 0.6 * pace),
  };
}
