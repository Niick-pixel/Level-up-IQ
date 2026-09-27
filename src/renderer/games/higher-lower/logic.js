// Higher or lower: see one quantity's value, guess whether the next is higher or lower.
// Offline it uses the built-in quantities; online it can use country populations from Wikidata.
import { formatQuantity } from '../_data/magnitudes.js';

export const meta = {
  id: 'higher-lower',
  name: 'Higher or lower',
  blurb: 'You see one value. Is the next one higher or lower? Keep the streak going.',
  howTo: ['Press 1 for higher, 2 for lower.', 'Ten comparisons per round.'],
  skills: ['knowledge', 'math'],
  durationRange: [45, 200],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

/** A chain of same-kind quantities; each question compares one with the next. */
export function makeQuestions(rng, d, data) {
  const kinds = [...new Set(data.map((x) => x.kind))];
  const kind = rng.pick(kinds);
  const pool = data.filter((x) => x.kind === kind);
  // harder levels: neighbours closer in size
  const maxRatio = d <= 3 ? Infinity : d <= 6 ? 3 : 1.5;
  const chain = [rng.pick(pool)];
  const used = new Set([chain[0].name]);
  while (chain.length < 11) {
    const prev = chain.at(-1);
    const cands = pool.filter((x) => !used.has(x.name) && x.v !== prev.v && Math.abs(Math.log10(x.v / prev.v)) <= maxRatio);
    const next = cands.length ? rng.pick(cands) : pool.find((x) => !used.has(x.name) && x.v !== prev.v);
    if (!next) break;
    chain.push(next);
    used.add(next.name);
  }
  const qs = [];
  for (let i = 1; i < chain.length; i++) {
    const a = chain[i - 1], b = chain[i];
    qs.push({
      prompt: `${b.name}: higher or lower?`,
      detail: `${a.name}: ${formatQuantity(a)}`,
      options: ['Higher', 'Lower'],
      answer: b.v > a.v ? 0 : 1,
      explain: `${b.name}: ${formatQuantity(b)}.`,
    });
  }
  return qs;
}
