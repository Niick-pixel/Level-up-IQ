// Dual n-back: a square lights up on a 3×3 grid and a letter appears. Press when the position
// and/or the letter match the one from n steps back.

export const meta = {
  id: 'nback',
  name: 'Dual n-back',
  blurb: 'Track positions and letters at the same time. Press when either matches n steps back.',
  howTo: ['A = position matches n back', 'L = letter matches n back', 'Space starts the round.'],
  skills: ['memory', 'attention'],
  durationRange: [60, 110],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const LETTERS = ['C', 'H', 'K', 'L', 'Q', 'R', 'S', 'T'];
export const SCORED_TRIALS = 20;
export const TARGETS = 6; // per stream, out of the scored trials

export const levelN = (d) => [1, 1, 2, 2, 2, 3, 3, 3, 4, 4][d - 1];
export const stepMs = (d) => (d >= 7 ? 2200 : 2600);

/** One stream: values in [0, size), exactly `targets` matches with n back, no accidental ones. */
export function genStream(rng, n, trials, targets, size) {
  const candidates = Array.from({ length: trials - n }, (_, i) => i + n);
  const targetSet = new Set(rng.shuffle(candidates).slice(0, targets));
  const seq = [];
  for (let i = 0; i < trials; i++) {
    if (i < n) seq.push(rng.int(0, size - 1));
    else if (targetSet.has(i)) seq.push(seq[i - n]);
    else {
      let v;
      do v = rng.int(0, size - 1); while (v === seq[i - n]);
      seq.push(v);
    }
  }
  return seq;
}

export function genRound(rng, difficulty) {
  const n = levelN(difficulty);
  const trials = SCORED_TRIALS + n;
  return {
    n,
    trials,
    positions: genStream(rng.fork('pos'), n, trials, TARGETS, 9),
    letters: genStream(rng.fork('let'), n, trials, TARGETS, LETTERS.length),
  };
}

/** Is trial i a target in this stream? */
export const isTarget = (seq, n, i) => i >= n && seq[i] === seq[i - n];

/**
 * @param {{ positions: number[], letters: number[], n: number }} round
 * @param {{ pos: boolean, let: boolean }[]} responses one entry per trial
 */
export function scoreRound(round, responses, difficulty) {
  let hits = 0, misses = 0, falseAlarms = 0, correctRejections = 0;
  for (const stream of ['positions', 'letters']) {
    const key = stream === 'positions' ? 'pos' : 'let';
    for (let i = round.n; i < round.positions.length; i++) {
      const target = isTarget(round[stream], round.n, i);
      const pressed = Boolean(responses[i]?.[key]);
      if (target && pressed) hits++;
      else if (target) misses++;
      else if (pressed) falseAlarms++;
      else correctRejections++;
    }
  }
  const decisions = hits + misses + falseAlarms + correctRejections;
  const hitRate = hits / Math.max(1, hits + misses);
  const faRate = falseAlarms / Math.max(1, falseAlarms + correctRejections);
  return {
    hits, misses, falseAlarms, correctRejections,
    accuracy: decisions ? (hits + correctRejections) / decisions : 0,
    performance: Math.max(0, hitRate - faRate),
    score: Math.max(0, Math.round((hits * 10 - falseAlarms * 5) * round.n * (1 + difficulty / 10))),
  };
}
