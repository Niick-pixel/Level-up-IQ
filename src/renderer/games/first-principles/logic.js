// First principles: break a question down to what you know for certain, then reason back up,
// instead of reasoning by analogy ("it's always been done like this").
import { FIRST_PRINCIPLES } from '../_data/thinking.js';

export const meta = {
  id: 'first-principles',
  name: 'First principles',
  blurb: 'Strip a question down to basic facts, then rebuild an answer from them.',
  howTo: ['List what you assume.', 'Break the problem into facts you are sure of.', 'Rebuild an answer from those facts only.'],
  skills: ['deep-thinking', 'logic'],
  durationRange: [180, 600],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

export function makePrompt(rng, d) {
  const tier = d <= 3 ? 1 : d <= 7 ? 2 : 3;
  const pool = FIRST_PRINCIPLES.filter((x) => x.level === tier);
  const q = rng.pick(pool.length ? pool : FIRST_PRINCIPLES);
  return {
    title: 'First principles',
    prompt: q.q,
    steps: ['1. Assumptions: what are you taking for granted?', '2. Basics: which facts are you sure of (physics, numbers, people’s needs)?', '3. Rebuild: reason from those basics to an answer.', '4. Check: what would make your answer wrong?'],
    checklist: [
      'I wrote down at least two assumptions and questioned them',
      'I used facts or numbers I am confident of',
      'My answer follows from those basics, step by step',
      'I named what would prove me wrong',
      'I avoided “because that’s how it’s done”',
    ],
    minWords: 70 + d * 12,
  };
}
