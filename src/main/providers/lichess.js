// Lichess: the daily puzzle and puzzles by id. Lichess asks for one request at a time and a full
// minute's pause after a 429. The offline puzzle set comes from the CC0 puzzle database
// (scripts/build-lichess-subset.js); the chess games that use it arrive in Phase 3.
const { Provider } = require('./provider');

const HOUR = 3600 * 1000;

const INFO = {
  id: 'lichess',
  name: 'Lichess',
  hosts: ['lichess.org'],
  license: 'CC0 1.0 (puzzle database)',
  licenseUrl: 'https://database.lichess.org/',
  attribution: 'Chess puzzles from lichess.org (puzzle database released under CC0).',
  homepage: 'https://lichess.org/',
  minIntervalMs: 1000,
  concurrency: 1,
  ttlMs: 30 * 24 * HOUR,
  lockoutMs: 60 * 1000,
};

/** Keeps what the app needs from a /api/puzzle response. Pure; exported for tests. */
function normalizePuzzle(d) {
  const p = d?.puzzle;
  if (!p?.id) return null;
  return {
    id: p.id,
    rating: p.rating,
    plays: p.plays,
    themes: p.themes || [],
    solution: p.solution || [],
    initialPly: p.initialPly,
    pgn: d.game?.pgn || '',
    url: `https://lichess.org/training/${p.id}`,
  };
}

class Lichess extends Provider {
  constructor(deps) {
    super(INFO, deps);
  }

  async daily() {
    const { data } = await this.getJson('https://lichess.org/api/puzzle/daily', { ttlMs: 3 * HOUR, accept: (d) => d?.puzzle?.id });
    return normalizePuzzle(data);
  }

  async byId(id) {
    if (!/^[A-Za-z0-9]{5,8}$/.test(id)) return null;
    const { data } = await this.getJson(`https://lichess.org/api/puzzle/${id}`, { accept: (d) => d?.puzzle?.id });
    return normalizePuzzle(data);
  }
}

module.exports = { Lichess, normalizePuzzle, INFO };
