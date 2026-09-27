// Card pairs (Concentration): turn over two cards at a time and find every matching pair.
import { OBJECTS } from '../_data/emoji.js';

export const meta = {
  id: 'card-pairs',
  name: 'Card pairs',
  blurb: 'Turn over two cards at a time and find every pair, in as few turns as you can.',
  howTo: ['Click a card (or use arrow keys + Enter) to turn it over.', 'Matching pairs stay face up.', 'Fewer turns means a better score.'],
  skills: ['memory'],
  durationRange: [60, 240],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

const PAIRS = [6, 6, 8, 8, 10, 10, 12, 12, 15, 18];
export const pairsFor = (d) => PAIRS[Math.min(9, Math.max(0, d - 1))];
export const columnsFor = (pairs) => (pairs * 2 <= 16 ? 4 : pairs * 2 <= 20 ? 5 : 6);

export function genDeck(rng, pairs) {
  const faces = rng.shuffle(OBJECTS).slice(0, pairs);
  return rng.shuffle([...faces, ...faces].map((f, i) => ({ ...f, id: i })));
}

/**
 * A player with perfect memory still needs about 1.6 turns per pair (the first sighting of each
 * card is luck). Doing that well scores 1.
 */
export function scoreRound({ pairs, turns, difficulty }) {
  const par = Math.round(pairs * 1.6);
  const performance = Math.min(1, Math.max(0, 1 - (turns - par) / (pairs * 1.6)));
  return { score: Math.round(pairs * 60 * (0.4 + performance) * (1 + difficulty / 10)), accuracy: Math.min(1, pairs / Math.max(pairs, turns)), performance, par };
}
