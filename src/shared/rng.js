// Seeded random numbers, shared by the main process and the games.
//
// A seed is any string. cyrb128 hashes it into four 32-bit words and sfc32 turns those into a
// stream of floats in [0, 1). Same seed, same stream, on every machine, so any puzzle can be
// replayed or shared with its seed code ("gameId:difficulty:seed").

export function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

function sfc32(a, b, c, d) {
  return function next() {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** A seeded generator with the helpers games need. */
export function makeRng(seed) {
  const next = sfc32(...cyrb128(String(seed)));
  for (let i = 0; i < 12; i++) next(); // warm up: the first outputs are less mixed
  const rng = {
    seed: String(seed),
    next,
    /** Integer in [min, max], both inclusive. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(arr) {
      if (!arr.length) throw new Error('pick() from an empty array');
      return arr[Math.floor(next() * arr.length)];
    },
    chance(p) {
      return next() < p;
    },
    /** Returns a shuffled copy (Fisher-Yates). */
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    /** Picks an item with probability proportional to weight(item). */
    weighted(arr, weight) {
      const ws = arr.map((x) => Math.max(0, weight(x)));
      const total = ws.reduce((a, b) => a + b, 0);
      if (total <= 0) return rng.pick(arr);
      let r = next() * total;
      for (let i = 0; i < arr.length; i++) {
        r -= ws[i];
        if (r < 0) return arr[i];
      }
      return arr[arr.length - 1];
    },
    /** A child generator with its own independent stream. */
    fork(label) {
      return makeRng(`${rng.seed}/${label}`);
    },
  };
  return rng;
}

const SEED_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no look-alikes (i, l, o, 0, 1)

/** A short random seed that's easy to read aloud or type. Uses Math.random on purpose. */
export function randomSeed(length = 6) {
  let s = '';
  for (let i = 0; i < length; i++) s += SEED_ALPHABET[Math.floor(Math.random() * SEED_ALPHABET.length)];
  return s;
}

export function formatSeedCode({ gameId, difficulty, seed }) {
  return `${gameId}:${difficulty}:${seed}`;
}

export function parseSeedCode(code) {
  const m = /^([a-z0-9-]+):(\d{1,2}):([A-Za-z0-9_-]{1,64})$/.exec(String(code).trim());
  if (!m) return null;
  const difficulty = Number(m[2]);
  if (difficulty < 1 || difficulty > 10) return null;
  return { gameId: m[1], difficulty, seed: m[3] };
}

/** Local calendar date as YYYY-MM-DD (not UTC, so "today" matches the user's clock). */
export function localDateKey(ms = Date.now()) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
