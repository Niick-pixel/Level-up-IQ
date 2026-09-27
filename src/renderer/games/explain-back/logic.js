// Explain it back (the Feynman technique): explain an idea in plain words, as if to a curious
// 12-year-old. Where you get stuck is exactly what you don't understand yet.
import { CONCEPTS } from '../_data/thinking.js';

export const meta = {
  id: 'explain-back',
  name: 'Explain it back',
  blurb: 'Explain an idea in plain words, as if to a curious 12-year-old. No looking it up.',
  howTo: ['Write your explanation from memory (no searching, no AI).', 'Then check which key ideas you covered.'],
  skills: ['deep-thinking'],
  durationRange: [180, 600],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

export function makePrompt(rng, d) {
  const tier = d <= 3 ? 1 : d <= 7 ? 2 : 3;
  const pool = CONCEPTS.filter((c) => c.level <= tier);
  const c = rng.pick(pool.filter((x) => x.level === tier).length ? pool.filter((x) => x.level === tier) : pool);
  return {
    title: 'Explain it back (Feynman technique)',
    prompt: `Explain: ${c.topic}.`,
    steps: ['Use simple words; if you need a technical term, explain it.', 'Give one concrete example.', 'Say why it matters, or what it is for.'],
    checklist: [...c.points.map((p) => `I explained that ${p}`), 'I used no unexplained jargon', 'I gave a concrete example'],
    minWords: 60 + d * 12,
  };
}
