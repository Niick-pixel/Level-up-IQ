// Orders of magnitude: which of two quantities of the same kind is bigger? Higher levels pick
// pairs that are closer together (a smaller ratio between them).
import { formatQuantity } from '../_data/magnitudes.js';

export const meta = {
  id: 'magnitude',
  name: 'Which is bigger?',
  blurb: 'Two quantities of the same kind: pick the bigger one. The gap narrows as you level up.',
  howTo: ['Press 1 or 2.', 'Answers show the actual values.'],
  skills: ['knowledge', 'math'],
  durationRange: [45, 180],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

/** Allowed log10 ratio band for a level: easy = far apart, hard = close. */
export const band = (d) => (d <= 3 ? [1.5, 30] : d <= 6 ? [0.6, 2] : [0.05, 0.8]);

export function makeQuestions(rng, d, data) {
  const [lo, hi] = band(d);
  const pairs = [];
  for (let i = 0; i < data.length; i++) {
    for (let j = i + 1; j < data.length; j++) {
      if (data[i].kind !== data[j].kind) continue;
      const r = Math.abs(Math.log10(data[i].v / data[j].v));
      if (r >= lo && r <= hi) pairs.push([data[i], data[j]]);
    }
  }
  return rng.shuffle(pairs).slice(0, 8).map((pair) => {
    const [a, b] = rng.shuffle(pair);
    const answer = a.v > b.v ? 0 : 1;
    return {
      prompt: 'Which is bigger?',
      options: [a.name, b.name],
      answer,
      explain: `${a.name}: ${formatQuantity(a)}. ${b.name}: ${formatQuantity(b)}.`,
    };
  });
}
