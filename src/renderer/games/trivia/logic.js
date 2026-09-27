// General trivia: questions from Open Trivia DB and The Trivia API when online, topped up from
// the offline bank (and entirely offline when there's no connection).
import { TRIVIA } from '../_data/trivia.js';

export const meta = {
  id: 'trivia',
  name: 'Trivia',
  blurb: 'Eight general-knowledge questions: science, history, geography, arts and more.',
  howTo: ['Pick an answer (1–4).', 'Online, questions come from two open trivia databases; offline, from the built-in bank.'],
  skills: ['knowledge'],
  durationRange: [60, 150],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

export const COUNT = 8;
export const tierFor = (d) => (d <= 3 ? 1 : d <= 7 ? 2 : 3);

export const SOURCES = {
  opentdb: 'Open Trivia DB (CC BY-SA 4.0)',
  triviaapi: 'The Trivia API (CC BY-NC 4.0)',
  offline: 'Mind Gym offline bank',
};

/** Online questions first, then offline ones at the level's tier (neighbouring tiers if short). */
export function makeQuestions(rng, d, online = []) {
  const tier = tierFor(d);
  const need = Math.max(0, COUNT - online.length);
  const byTier = (t) => TRIVIA.filter((q) => q.level === t);
  const pool = [...rng.shuffle(byTier(tier)), ...rng.shuffle(TRIVIA.filter((q) => q.level !== tier))];
  const offline = pool.slice(0, need).map((q) => {
    const options = rng.shuffle([q.a, ...q.wrong]);
    return { prompt: q.q, options, answer: options.indexOf(q.a), source: 'offline', category: q.category };
  });
  return rng.shuffle([...online.slice(0, COUNT), ...offline]).map((q) => ({ ...q, explain: `Source: ${SOURCES[q.source] || q.source}` }));
}
