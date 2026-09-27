// Rush Hour-style sliding blocks: slide the cars and lorries (only along their length) until the
// red car can drive out of the exit on the right.
//
// Generator: place a random set of vehicles, explore every position reachable from there, then
// run a breadth-first search backwards from the solved positions. That gives the exact minimum
// number of moves from EVERY position, so we can start from one as hard as the level asks for.
export const meta = {
  id: 'rush-hour',
  name: 'Rush hour',
  blurb: 'Slide the cars out of the way so the red car can reach the exit.',
  howTo: ['Drag a vehicle along its length (or select it and use the arrow keys).', 'Get the red car to the exit on the right.', 'A move is one vehicle sliding any distance; fewer is better.'],
  skills: ['spatial', 'logic'],
  durationRange: [60, 480],
  difficultyRange: [1, 10],
  offline: true,
  lang: [],
};

export const N = 6;
export const EXIT_ROW = 2;
const TARGET = [3, 5, 7, 9, 11, 13, 15, 18, 21, 25];
export const targetFor = (d) => TARGET[Math.min(9, Math.max(0, d - 1))];

// vehicle: { h: true|false (horizontal), len, fixed } where fixed is the row (h) or column (v);
// a state is an array with each vehicle's moving coordinate. Vehicle 0 is the red car.

function occupancy(vs, st) {
  const g = new Int8Array(N * N).fill(-1);
  vs.forEach((v, i) => {
    for (let k = 0; k < v.len; k++) {
      const r = v.h ? v.fixed : st[i] + k;
      const c = v.h ? st[i] + k : v.fixed;
      g[r * N + c] = i;
    }
  });
  return g;
}

/** Every state one move away, as [vehicle, newPos, nextState]. */
export function moves(vs, st) {
  const g = occupancy(vs, st);
  const out = [];
  vs.forEach((v, i) => {
    const at = (p) => (v.h ? g[v.fixed * N + p] : g[p * N + v.fixed]);
    for (let p = st[i] - 1; p >= 0 && at(p) === -1; p--) out.push([i, p, withPos(st, i, p)]);
    for (let p = st[i] + v.len; p < N && at(p) === -1; p++) out.push([i, p - v.len + 1, withPos(st, i, p - v.len + 1)]);
  });
  return out;
}
const withPos = (st, i, p) => { const s = st.slice(); s[i] = p; return s; };
const enc = (st) => st.reduce((k, p) => k * N + p, 0);
export const isSolved = (st) => st[0] === N - 2;

/** Minimum moves from every state reachable from `start` (Map key → distance), plus the states. */
export function analyse(vs, start, limit = 60000) {
  const states = new Map([[enc(start), start]]);
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    for (const [, , next] of moves(vs, queue[q])) {
      const k = enc(next);
      if (!states.has(k)) {
        if (states.size >= limit) return null;
        states.set(k, next);
        queue.push(next);
      }
    }
  }
  const dist = new Map();
  let frontier = [];
  for (const [k, st] of states) if (isSolved(st)) { dist.set(k, 0); frontier.push(st); }
  let d = 0;
  while (frontier.length) {
    const next = [];
    d += 1;
    for (const st of frontier) {
      for (const [, , n] of moves(vs, st)) {
        const k = enc(n);
        if (!dist.has(k)) { dist.set(k, d); next.push(n); }
      }
    }
    frontier = next;
  }
  return { states, dist };
}

// ---- boards as 36-character strings (row by row; '.' empty, 'A' the red car, 'B'… the rest),
// the format used by the prebuilt pack in assets/packs/rush-hour.json

export function toBoard(vs, st) {
  const g = occupancy(vs, st);
  return Array.from(g, (i) => (i < 0 ? '.' : String.fromCharCode(65 + i))).join('');
}

export function fromBoard(board) {
  const seen = new Map();
  for (let i = 0; i < N * N; i++) {
    const ch = board[i];
    if (ch === '.') continue;
    if (!seen.has(ch)) seen.set(ch, []);
    seen.get(ch).push(i);
  }
  const ids = [...seen.keys()].sort();
  const vs = [];
  const st = [];
  for (const ch of ids) {
    const cells = seen.get(ch);
    const h = cells.length > 1 && cells[1] - cells[0] === 1;
    vs.push({ h, len: cells.length, fixed: h ? Math.floor(cells[0] / N) : cells[0] % N });
    st.push(h ? cells[0] % N : Math.floor(cells[0] / N));
  }
  return { vehicles: vs, start: st };
}

export function randomVehicles(rng, count) {
  const vs = [{ h: true, len: 2, fixed: EXIT_ROW }];
  const start = [rng.int(0, 2)];
  const taken = new Set([EXIT_ROW * N + start[0], EXIT_ROW * N + start[0] + 1]);
  let guard = 0;
  while (vs.length < count && guard++ < 400) {
    const h = rng.chance(0.5);
    const len = rng.chance(0.25) ? 3 : 2;
    const fixed = rng.int(0, N - 1);
    if (h && fixed === EXIT_ROW) continue; // nothing else slides along the exit row
    const pos = rng.int(0, N - len);
    const cells = Array.from({ length: len }, (_, k) => (h ? fixed * N + pos + k : (pos + k) * N + fixed));
    if (cells.some((c) => taken.has(c))) continue;
    cells.forEach((c) => taken.add(c));
    vs.push({ h, len, fixed });
    start.push(pos);
  }
  return { vs, start };
}

/**
 * @returns {{ vehicles, start: number[], optimal: number }}
 */
export function generate(rng, d, { tries = 40, budgetMs = 1500 } = {}) {
  const target = targetFor(d);
  const until = Date.now() + budgetMs;
  let best = null;
  for (let t = 0; t < tries && Date.now() < until; t++) {
    const { vs, start } = randomVehicles(rng, rng.int(8, 12) + (d >= 6 ? 1 : 0));
    const a = analyse(vs, start);
    if (!a || !a.dist.size) continue;
    const byDist = [...a.dist].filter(([, x]) => x >= target && x <= target + 2);
    if (byDist.length) {
      const [k, optimal] = rng.pick(byDist);
      return { vehicles: vs, start: a.states.get(k), optimal };
    }
    const [k, optimal] = [...a.dist].reduce((m, e) => (e[1] > m[1] ? e : m));
    if (!best || optimal > best.optimal) best = { vehicles: vs, start: a.states.get(k), optimal };
  }
  return best;
}

/** Picks a prebuilt puzzle near the level's target (seeded). */
export function fromPack(rng, d, pack) {
  const target = targetFor(d);
  const options = pack.puzzles.filter((p) => p.moves >= target && p.moves <= target + 2);
  const pool = options.length ? options : pack.puzzles.filter((p) => Math.abs(p.moves - target) <= 4);
  if (!pool.length) return null;
  const p = rng.pick(pool);
  return { ...fromBoard(p.board), optimal: p.moves };
}

export function scoreRound({ moves: made, optimal, difficulty }) {
  const performance = Math.max(0.2, Math.min(1, optimal / Math.max(1, made)) ** 0.7);
  return { score: Math.round(optimal * 40 * performance * (1 + difficulty / 10)), accuracy: 1, performance };
}
