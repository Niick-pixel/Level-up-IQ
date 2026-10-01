// Set: every card has a number (1–3), a shape, a fill and a colour. Three cards make a set when,
// for each feature, they're all the same or all different. Find sets in the layout.
// Trains visual attention and rule-based reasoning. (Game by Marsha Falco, 1974; this is our own
// implementation of the rules, with its own look.)

export const meta = {
  id: 'set-game',
  name: 'Set',
  blurb: 'Find three cards where every feature is all the same or all different.',
  howTo: [
    'Each card: number (1–3), shape, fill and colour.',
    'Three cards are a set when each feature is all the same, or all different, across the three.',
    'Click three cards (or press their letters). Find the target number of sets.',
  ],
  skills: ['attention', 'logic'],
  durationRange: [60, 300],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const FEATURES = ['number', 'shape', 'fill', 'colour'];
export const SHAPES = ['oval', 'diamond', 'wave'];
export const FILLS = ['solid', 'shaded', 'open'];
export const COLOURS = ['purple', 'orange', 'grey'];

/** Easy levels use solid cards only (three features, 27 cards). */
export const features = (d) => (d <= 3 ? 3 : 4);
export const boardSize = (d) => (d <= 3 ? 9 : 12);
export const target = (d) => (d <= 3 ? 4 : d <= 6 ? 5 : 6);

/** card: [number 0–2, shape 0–2, fill 0–2, colour 0–2] */
export function deck(d) {
  const out = [];
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 3; c++) {
    if (features(d) === 3) out.push([a, b, 0, c]);
    else for (let e = 0; e < 3; e++) out.push([a, b, c, e]);
  }
  return out;
}

export const isSet = (x, y, z) => [0, 1, 2, 3].every((k) => (x[k] + y[k] + z[k]) % 3 === 0);

export function findSets(cards) {
  const out = [];
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) for (let k = j + 1; k < cards.length; k++) {
    if (cards[i] && cards[j] && cards[k] && isSet(cards[i], cards[j], cards[k])) out.push([i, j, k]);
  }
  return out;
}

/** Deals a board with at least one set, drawing from the shuffled pile (mutated). */
export function dealBoard(rng, pile, size) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const board = pile.splice(0, size);
    if (findSets(board).length) return board;
    pile.push(...board);
    pile.splice(0, pile.length, ...rng.shuffle(pile));
  }
  throw new Error('Could not deal a board with a set');
}

/** Replaces the found cards; reshuffles the rest of the pile in until a set exists. */
export function refill(rng, board, picked, pile) {
  const next = board.slice();
  for (const i of picked) next[i] = pile.shift() || null;
  let guard = 0;
  while (!findSets(next).length && guard++ < 60) {
    // swap a random card on the board for one from the pile
    const i = rng.int(0, next.length - 1);
    if (!pile.length) break;
    pile.push(next[i]);
    next[i] = pile.shift();
  }
  return next;
}

export const describe = (c) => `${c[0] + 1} ${FILLS[c[2]]} ${COLOURS[c[3]]} ${SHAPES[c[1]]}${c[0] ? 's' : ''}`;

export function scoreRound({ d, found, mistakes, hints, timeMs }) {
  const t = target(d);
  const accuracy = found / (found + mistakes || 1);
  const speed = Math.min(1, (t * (d <= 3 ? 15 : 22)) / Math.max(1, timeMs / 1000));
  return {
    accuracy,
    performance: Math.min(1, Math.max(0, accuracy * (0.5 + 0.5 * speed) - hints * 0.08)),
    score: Math.round(found * 200 * accuracy * (0.5 + speed) * (1 + d / 10)),
  };
}
