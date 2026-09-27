// Digit span: digits appear one at a time; type them back. From level 6 you type them backwards
// (reversing the list in your head is the hard part: that's working memory, not just storage).
export const meta = {
  id: 'digit-span',
  name: 'Digit span',
  blurb: 'Watch a list of digits, then type it back. Later levels ask for it backwards.',
  howTo: ['Digits appear one at a time.', 'Type them in order (or reversed, when asked) and press Enter.', 'Get one right and the next list is longer.'],
  skills: ['memory'],
  durationRange: [60, 180],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const startSpan = (d) => Math.min(8, 3 + Math.ceil(d / 2));
export const isBackwards = (d) => d >= 6;
export const msPerDigit = (d) => Math.max(600, 1000 - d * 40);

/** Random digits with no repeat next to each other and no runs like 4-5-6. */
export function genDigits(rng, n) {
  const out = [];
  while (out.length < n) {
    const x = rng.int(0, 9);
    const k = out.length;
    if (k && out[k - 1] === x) continue;
    if (k >= 2 && out[k - 1] - out[k - 2] === x - out[k - 1] && Math.abs(x - out[k - 1]) === 1) continue;
    out.push(x);
  }
  return out;
}

export const expected = (digits, backwards) => (backwards ? digits.slice().reverse() : digits).join('');
