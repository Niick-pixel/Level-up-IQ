// Reversi (Othello): place a disc so it outflanks a line of your opponent's discs, which flip to
// your colour. Most discs at the end wins. Against a negamax opponent that values corners,
// edges and mobility the way strong players do.
import { bestMove as search, WIN } from '../_engine/negamax.js';

export const meta = {
  id: 'reversi',
  name: 'Reversi',
  blurb: 'Outflank and flip. Corners are forever; mobility wins games.',
  howTo: [
    'You are black and move first. Place a disc so it traps a straight line of white discs between it and another black disc; they flip.',
    'No legal move? You pass. When neither side can move, most discs wins.',
    'Dots show your legal moves. Tip: corners can never be flipped back.',
  ],
  skills: ['strategy', 'spatial'],
  durationRange: [240, 900],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const depthFor = (d) => [1, 1, 2, 2, 3, 3, 4, 4, 5, 5][Math.min(10, Math.max(1, d)) - 1];
export const slipFor = (d) => [0.5, 0.35, 0.3, 0.2, 0.15, 0.1, 0.05, 0.02, 0, 0][Math.min(10, Math.max(1, d)) - 1];

const DIRS = [-9, -8, -7, -1, 1, 7, 8, 9];
// classic positional weights: corners great, squares next to them dangerous
const W = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -50, -2, -2, -2, -2, -50, -20,
  10, -2, 1, 1, 1, 1, -2, 10,
  5, -2, 1, 0, 0, 1, -2, 5,
  5, -2, 1, 0, 0, 1, -2, 5,
  10, -2, 1, 1, 1, 1, -2, 10,
  -20, -50, -2, -2, -2, -2, -50, -20,
  100, -20, 10, 5, 5, 10, -20, 100,
];

/** state: { b: number[64] (0 empty, 1 black, 2 white), p: side to move, passes } */
export function initial() {
  const b = new Array(64).fill(0);
  b[27] = 2; b[28] = 1; b[35] = 1; b[36] = 2;
  return { b, p: 1, passes: 0 };
}

const step = (i, dir) => {
  const c = i % 8;
  const n = i + dir;
  if (n < 0 || n > 63) return -1;
  if ((dir === -9 || dir === -1 || dir === 7) && c === 0) return -1;
  if ((dir === -7 || dir === 1 || dir === 9) && c === 7) return -1;
  return n;
};

/** Discs that a move at i would flip for player p. */
export function flips(b, i, p) {
  if (b[i]) return [];
  const out = [];
  for (const dir of DIRS) {
    const line = [];
    let j = step(i, dir);
    while (j >= 0 && b[j] === 3 - p) { line.push(j); j = step(j, dir); }
    if (j >= 0 && b[j] === p && line.length) out.push(...line);
  }
  return out;
}

export const legal = (s, p = s.p) => s.b.map((_, i) => i).filter((i) => flips(s.b, i, p).length);

/** Plays move i (or -1 = pass). */
export function play(s, i) {
  if (i < 0) return { b: s.b, p: 3 - s.p, passes: s.passes + 1 };
  const b = s.b.slice();
  for (const j of flips(b, i, s.p)) b[j] = s.p;
  b[i] = s.p;
  return { b, p: 3 - s.p, passes: 0 };
}

export const count = (b, p) => b.filter((x) => x === p).length;
export const isOver = (s) => s.passes >= 2 || (!legal(s, 1).length && !legal(s, 2).length);

export const GAME = {
  moves: (s) => { const m = legal(s); return m.length ? m : (isOver(s) ? [] : [-1]); },
  play,
  over: (s) => {
    if (!isOver(s)) return null;
    const diff = count(s.b, s.p) - count(s.b, 3 - s.p);
    return diff > 0 ? WIN + diff : diff < 0 ? -WIN + diff : 0;
  },
  evaluate: (s) => {
    const me = s.p; const op = 3 - me;
    let pos = 0;
    for (let i = 0; i < 64; i++) if (s.b[i] === me) pos += W[i]; else if (s.b[i] === op) pos -= W[i];
    const mob = legal(s, me).length - legal(s, op).length;
    const empties = s.b.filter((x) => !x).length;
    const discs = count(s.b, me) - count(s.b, op);
    return pos + 5 * mob + (empties < 12 ? 8 * discs : 0);
  },
};

export function aiMove(s, d, rng) {
  return search(GAME, s, depthFor(d), { rng, slip: slipFor(d) }).move;
}

export function scoreGame({ you, them, d }) {
  const outcome = you > them ? 'win' : you < them ? 'loss' : 'draw';
  const base = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : Math.min(0.3, you / 64);
  return { outcome, score: Math.round(base * 100 * d + you), accuracy: base, performance: base };
}
