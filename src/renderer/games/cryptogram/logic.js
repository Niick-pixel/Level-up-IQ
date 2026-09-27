// Cryptograms: a quotation with every letter swapped for another. Crack the substitution.
export const meta = {
  id: 'cryptogram',
  name: 'Cryptogram',
  blurb: 'Each letter of a famous quotation has been swapped for another. Crack the code.',
  howTo: ['Click a letter and type what you think it stands for; every copy updates.', 'Short words and apostrophes are good places to start. Hints unlock after the thinking timer.'],
  skills: ['language', 'logic'],
  durationRange: [120, 900],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** A random substitution where no letter maps to itself. */
export function makeKey(rng) {
  for (;;) {
    const perm = rng.shuffle([...ABC]);
    if (perm.every((c, i) => c !== ABC[i])) return Object.fromEntries([...ABC].map((c, i) => [c, perm[i]]));
  }
}

export function encode(text, key) {
  return [...text.toUpperCase()].map((c) => key[c] || c).join('');
}

export function pickQuote(rng, d, quotes) {
  const letters = (q) => q.text.replace(/[^A-Za-z]/g, '').length;
  const [lo, hi] = d <= 3 ? [0, 40] : d <= 6 ? [30, 70] : [55, 999];
  const pool = quotes.filter((q) => letters(q) >= lo && letters(q) <= hi);
  return rng.pick(pool.length ? pool : quotes);
}

/** Letters given for free at easy levels (the most frequent cipher letters). */
export const freeLetters = (d) => (d <= 2 ? 3 : d <= 4 ? 2 : d <= 6 ? 1 : 0);
