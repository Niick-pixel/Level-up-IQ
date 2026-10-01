// Simon: watch (and hear) a sequence of pads light up, then repeat it. Each round adds one.
// Trains working memory for sequences; more pads and a faster tempo at higher levels.

export const meta = {
  id: 'simon',
  name: 'Simon',
  blurb: 'Pads light up in a sequence. Repeat it; it grows by one each round.',
  howTo: ['Watch and listen, then click the pads in the same order.', 'Keys 1–9 press the pads.', 'One mistake ends the game (two lives at levels 1–3).'],
  skills: ['memory'],
  durationRange: [40, 200],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const pads = (d) => (d <= 3 ? 4 : d <= 7 ? 6 : 9);
export const startLength = (d) => (d <= 4 ? 2 : 3);
export const stepMs = (d) => Math.max(320, 760 - d * 45);
export const lives = (d) => (d <= 3 ? 2 : 1);
/** The length a practised player reaches at this level (used to rate the round). */
export const parLength = (d) => 6 + Math.round(d * 0.6);

export function makeSequence(rng, d, length = 40) {
  const n = pads(d);
  const seq = [];
  for (let i = 0; i < length; i++) {
    let p = rng.int(0, n - 1);
    if (i >= 2 && p === seq[i - 1] && p === seq[i - 2]) p = (p + 1) % n; // no triple repeats
    seq.push(p);
  }
  return seq;
}

export function scoreRound({ d, best, mistakes }) {
  const performance = Math.min(1, Math.max(0, best / parLength(d)));
  return { accuracy: best / (best + mistakes || 1), performance, score: Math.round(best * 100 * (1 + d / 10)) };
}
