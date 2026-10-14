// Mancala (Kalah, 6 pits and 4 seeds each): sow seeds counter-clockwise; land in your store for
// another turn; land in an empty pit on your side to capture the seeds opposite. Simple rules,
// deep counting: one of the oldest strategy games there is.
import { bestMove as search, WIN } from '../_engine/negamax.js';

export const meta = {
  id: 'mancala',
  name: 'Mancala',
  blurb: 'Sow, chain extra turns and capture. Count ahead to out-plan the computer.',
  howTo: [
    'Pick one of your pits (bottom row); its seeds are sown one by one counter-clockwise, skipping the opponent’s store.',
    'Last seed in your store: you go again. Last seed in an empty pit on your side: capture it and the seeds opposite.',
    'When one side runs out, the other side’s seeds go to their owner. Most seeds in store wins.',
  ],
  skills: ['strategy', 'math'],
  durationRange: [180, 600],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const depthFor = (d) => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10][Math.min(10, Math.max(1, d)) - 1];
export const slipFor = (d) => [0.5, 0.35, 0.25, 0.15, 0.1, 0.05, 0.02, 0, 0, 0][Math.min(10, Math.max(1, d)) - 1];

// board: 14 slots. 0–5 player 1 pits (left→right), 6 player 1 store, 7–12 player 2 pits, 13 player 2 store.
export const STORE = { 1: 6, 2: 13 };
export const PITS = { 1: [0, 1, 2, 3, 4, 5], 2: [7, 8, 9, 10, 11, 12] };

export function initial(seeds = 4) {
  const b = new Array(14).fill(seeds);
  b[6] = 0; b[13] = 0;
  return { b, p: 1 };
}

export const legal = (s) => PITS[s.p].filter((i) => s.b[i] > 0);

export function play(s, pit) {
  const b = s.b.slice();
  const p = s.p;
  let seeds = b[pit];
  b[pit] = 0;
  let i = pit;
  while (seeds > 0) {
    i = (i + 1) % 14;
    if (i === STORE[3 - p]) continue;
    b[i] += 1;
    seeds -= 1;
  }
  let next = 3 - p;
  if (i === STORE[p]) next = p;
  else if (PITS[p].includes(i) && b[i] === 1 && b[12 - i] > 0) {
    b[STORE[p]] += b[12 - i] + 1;
    b[12 - i] = 0;
    b[i] = 0;
  }
  // a side is empty: the rest goes to its owner
  if (PITS[1].every((j) => !b[j]) || PITS[2].every((j) => !b[j])) {
    for (const q of [1, 2]) for (const j of PITS[q]) { b[STORE[q]] += b[j]; b[j] = 0; }
  }
  return { b, p: next, last: i };
}

export const isOver = (s) => PITS[1].every((j) => !s.b[j]) && PITS[2].every((j) => !s.b[j]);

export const GAME = {
  moves: legal,
  play,
  sameSide: (a, b) => a.p === b.p,
  over: (s) => {
    if (!isOver(s)) return null;
    const diff = s.b[STORE[s.p]] - s.b[STORE[3 - s.p]];
    return diff > 0 ? WIN + diff : diff < 0 ? -WIN + diff : 0;
  },
  evaluate: (s) => {
    const me = s.p; const op = 3 - me;
    const side = (q) => PITS[q].reduce((a, j) => a + s.b[j], 0);
    return 4 * (s.b[STORE[me]] - s.b[STORE[op]]) + (side(me) - side(op));
  },
};

export function aiMove(s, d, rng) {
  return search(GAME, s, depthFor(d), { rng, slip: slipFor(d) }).move;
}

export function scoreGame({ you, them, d }) {
  const outcome = you > them ? 'win' : you < them ? 'loss' : 'draw';
  const base = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : Math.min(0.3, you / 48);
  return { outcome, score: Math.round(base * 100 * d + you), accuracy: base, performance: base };
}
