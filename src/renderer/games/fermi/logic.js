// Fermi estimation: get within the right order of magnitude. Scored on the log of the error,
// so being off by 2× costs much less than being off by 100×.
export const meta = {
  id: 'fermi',
  name: 'Fermi estimation',
  blurb: 'Estimate big quantities from what you already know. Being within a factor of 2 is excellent.',
  howTo: ['Type a number: 3000, 3e6, 3.5 million, 2 billion…', 'Break the problem into parts you can estimate.'],
  skills: ['math', 'deep-thinking'],
  durationRange: [90, 600],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

const WORDS = { thousand: 1e3, k: 1e3, million: 1e6, m: 1e6, mn: 1e6, billion: 1e9, bn: 1e9, b: 1e9, trillion: 1e12, t: 1e12, quadrillion: 1e15 };

/** Parses "3e6", "3,000,000", "3.5 million", "2 billion", "10^6", "4k". Returns NaN if unreadable. */
export function parseNumber(text) {
  const s = String(text).toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ').trim();
  let m = /^(\d+(?:\.\d+)?)\s*(?:x|×|\*)\s*10\s*\^\s*(-?\d+)$/.exec(s);
  if (m) return Number(m[1]) * 10 ** Number(m[2]);
  m = /^10\s*\^\s*(-?\d+)$/.exec(s);
  if (m) return 10 ** Number(m[1]);
  m = /^(\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*([a-z]+)?$/.exec(s);
  if (!m) return NaN;
  const base = Number(m[1]);
  if (!m[2]) return base;
  return WORDS[m[2]] ? base * WORDS[m[2]] : NaN;
}

/** 1 when exact, 0.5 at a factor of ~5.6 off, 0 at a factor of 32 or more. */
export function logScore(guess, answer) {
  if (!(guess > 0)) return 0;
  const err = Math.abs(Math.log10(guess / answer));
  return Math.max(0, 1 - err / 1.5);
}

const fmt = (n) => (n >= 1e6 ? `${Number((n / 10 ** Math.floor(Math.log10(n))).toFixed(2))} × 10^${Math.floor(Math.log10(n))}` : n.toLocaleString('en'));

export function makeItems(rng, d, data) {
  return rng.shuffle(data).slice(0, 4).map((f) => ({
    prompt: f.q,
    check: (t) => logScore(parseNumber(t), f.a),
    answerText: fmt(f.a),
    explain: f.explain,
    placeholder: 'e.g. 3 million',
  }));
}
