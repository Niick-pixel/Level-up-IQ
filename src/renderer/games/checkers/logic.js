// Checkers (English draughts) against a negamax opponent. Captures are compulsory and a chain of
// jumps must be finished; a man that reaches the far row is crowned and his move ends there.
import { bestMove as search, WIN } from '../_engine/negamax.js';

export const meta = {
  id: 'checkers',
  name: 'Checkers',
  blurb: 'English draughts: jump, chain captures, crown kings. Captures are compulsory.',
  howTo: [
    'You play the dark pieces from the bottom and move first. Men move diagonally forward; kings both ways.',
    'If you can capture, you must, and you keep jumping while you can.',
    'Click a piece, then where it should go (for a multi-jump, click the final square). Take all pieces or block them to win.',
  ],
  skills: ['strategy', 'spatial'],
  durationRange: [240, 1200],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const depthFor = (d) => [1, 2, 2, 3, 4, 5, 6, 7, 8, 8][Math.min(10, Math.max(1, d)) - 1];
export const slipFor = (d) => [0.5, 0.35, 0.25, 0.18, 0.12, 0.08, 0.04, 0.02, 0, 0][Math.min(10, Math.max(1, d)) - 1];
export const DRAW_PLIES = 80; // 40 moves each with no capture and no man moving

// pieces: 0 empty, 1 man of player 1 (you, moving up), 2 man of player 2, 3 king of 1, 4 king of 2
export const owner = (x) => (x === 1 || x === 3 ? 1 : x === 2 || x === 4 ? 2 : 0);
export const isKing = (x) => x >= 3;
const rc = (i) => [Math.floor(i / 8), i % 8];
const at = (r, c) => (r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1);

export function initial() {
  const b = new Array(64).fill(0);
  for (let i = 0; i < 64; i++) {
    const [r, c] = rc(i);
    if ((r + c) % 2 !== 1) continue;
    if (r < 3) b[i] = 2;
    else if (r > 4) b[i] = 1;
  }
  return { b, p: 1, quiet: 0 };
}

const dirsFor = (x) => (isKing(x) ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : owner(x) === 1 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]);
const crownRow = (p) => (p === 1 ? 0 : 7);

function jumps(b, from, piece, captured, path, out) {
  let extended = false;
  const [r, c] = rc(from);
  for (const [dr, dc] of dirsFor(piece)) {
    const mid = at(r + dr, c + dc);
    const land = at(r + 2 * dr, c + 2 * dc);
    if (mid < 0 || land < 0 || captured.includes(mid)) continue;
    if (owner(b[mid]) !== 3 - owner(piece) || (b[land] && land !== path[0])) continue;
    extended = true;
    const crowned = !isKing(piece) && rc(land)[0] === crownRow(owner(piece));
    if (crowned) out.push({ path: [...path, land], caps: [...captured, mid] });
    else jumps(b, land, piece, [...captured, mid], [...path, land], out);
  }
  if (!extended && captured.length) out.push({ path, caps: captured });
}

/** Legal moves for the side to move: captures if any exist (compulsory), else simple moves. */
export function legal(s) {
  const caps = [];
  const steps = [];
  for (let i = 0; i < 64; i++) {
    if (owner(s.b[i]) !== s.p) continue;
    jumps(s.b, i, s.b[i], [], [i], caps);
    const [r, c] = rc(i);
    for (const [dr, dc] of dirsFor(s.b[i])) {
      const to = at(r + dr, c + dc);
      if (to >= 0 && !s.b[to]) steps.push({ path: [i, to], caps: [] });
    }
  }
  return caps.length ? caps : steps;
}

export function play(s, m) {
  const b = s.b.slice();
  const from = m.path[0];
  const to = m.path[m.path.length - 1];
  let piece = b[from];
  b[from] = 0;
  for (const x of m.caps) b[x] = 0;
  if (!isKing(piece) && rc(to)[0] === crownRow(owner(piece))) piece += 2;
  b[to] = piece;
  const reset = m.caps.length || !isKing(s.b[from]);
  return { b, p: 3 - s.p, quiet: reset ? 0 : s.quiet + 1 };
}

export const GAME = {
  moves: legal,
  play,
  over: (s) => {
    if (!legal(s).length) return -WIN; // no pieces or no moves: the side to move has lost
    if (s.quiet >= DRAW_PLIES) return 0;
    return null;
  },
  evaluate: (s) => {
    let v = 0;
    for (let i = 0; i < 64; i++) {
      const x = s.b[i];
      if (!x) continue;
      const [r, c] = rc(i);
      let val = isKing(x) ? 175 : 100;
      if (!isKing(x)) val += 3 * (owner(x) === 1 ? 7 - r : r); // advanced men are closer to a crown
      if (c >= 2 && c <= 5 && r >= 2 && r <= 5) val += 4; // centre control
      if (!isKing(x) && r === (owner(x) === 1 ? 7 : 0)) val += 6; // back-row guard
      v += owner(x) === s.p ? val : -val;
    }
    return v;
  },
};

export function aiMove(s, d, rng) {
  return search(GAME, s, depthFor(d), { rng, slip: slipFor(d) }).move;
}

export function scoreGame({ outcome, d, material }) {
  const base = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : Math.max(0, Math.min(0.3, 0.15 + material / 2000));
  return { score: Math.round(base * 100 * d), accuracy: base, performance: base };
}
