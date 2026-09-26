// Local training history.
//   stats.json     per-day totals, personal bests, explored keywords
//   history.jsonl  one line per finished game (the raw record; everything else can be rebuilt from it)
const path = require('path');
const { readJson, writeJson, appendJsonl, readJsonl } = require('./json-file');

const SESSION_GAP_MS = 30 * 60 * 1000; // plays closer together than this are one session

const EMPTY = { days: {}, bests: {}, keywords: {}, lastPlayAt: 0 };

function emptyDay() {
  return { ms: 0, games: 0, sessions: 0, noAiMs: 0, bySkill: {}, byGame: {} };
}

class Stats {
  constructor(dir, { now = Date.now, dateKey } = {}) {
    this.dir = dir;
    this.file = dir ? path.join(dir, 'stats.json') : null;
    this.historyFile = dir ? path.join(dir, 'history.jsonl') : null;
    this.memoryHistory = []; // used when there's no dir (tests)
    this.now = now;
    this.dateKey = dateKey;
    this.data = { ...structuredClone(EMPTY), ...readJson(this.file, {}) };
  }

  #day(key) {
    if (!this.data.days[key]) this.data.days[key] = emptyDay();
    return this.data.days[key];
  }

  /**
   * Records a normalized game result.
   * @returns {{ newBest: boolean }}
   */
  record(result) {
    const at = this.now();
    const day = this.#day(this.dateKey(at));
    if (at - (this.data.lastPlayAt || 0) > SESSION_GAP_MS) day.sessions += 1;
    this.data.lastPlayAt = at;

    day.ms += result.timeMs;
    day.noAiMs += result.timeMs; // every local game is thinking without AI
    day.games += 1;
    for (const s of result.skills) day.bySkill[s] = (day.bySkill[s] || 0) + 1;
    day.byGame[result.gameId] = (day.byGame[result.gameId] || 0) + 1;

    const best = this.data.bests[result.gameId];
    const newBest = !best || result.score > best.score;
    if (newBest) {
      this.data.bests[result.gameId] = {
        score: result.score, accuracy: result.accuracy, difficulty: result.difficulty, timeMs: result.timeMs, at,
      };
    }

    const line = { at, ...result };
    if (this.historyFile) appendJsonl(this.historyFile, line);
    else this.memoryHistory.push(line);
    writeJson(this.file, this.data);
    return { newBest };
  }

  /** Marks a keyword as explored (feeds "outside my comfort zone"). */
  exploreKeyword(id, domain) {
    const k = this.data.keywords[id] || { first: this.now(), count: 0, domain };
    k.count += 1;
    k.last = this.now();
    this.data.keywords[id] = k;
    writeJson(this.file, this.data);
  }

  /** How many keywords of each domain you've explored. */
  domainCounts() {
    const out = {};
    for (const k of Object.values(this.data.keywords)) out[k.domain] = (out[k.domain] || 0) + 1;
    return out;
  }

  history() {
    return this.historyFile ? readJsonl(this.historyFile) : this.memoryHistory.slice();
  }

  /** Last N days (oldest first), with zeros for days you didn't train. */
  recentDays(n = 14) {
    const out = [];
    const t = new Date(this.now());
    for (let i = n - 1; i >= 0; i--) {
      // calendar arithmetic, so DST changes never skip or repeat a day
      const key = this.dateKey(new Date(t.getFullYear(), t.getMonth(), t.getDate() - i, 12).getTime());
      out.push({ date: key, ...(this.data.days[key] || emptyDay()) });
    }
    return out;
  }

  summary() {
    const today = this.data.days[this.dateKey(this.now())] || emptyDay();
    let totalMs = 0, totalGames = 0, activeDays = 0;
    for (const d of Object.values(this.data.days)) {
      totalMs += d.ms;
      totalGames += d.games;
      if (d.games) activeDays += 1;
    }
    return {
      today,
      recent: this.recentDays(14),
      totals: { ms: totalMs, games: totalGames, activeDays, keywords: Object.keys(this.data.keywords).length },
      bests: structuredClone(this.data.bests),
    };
  }

  /** Everything, for export. */
  exportJson(ratings) {
    return {
      exportedAt: new Date(this.now()).toISOString(),
      stats: structuredClone(this.data),
      ratings,
      history: this.history(),
    };
  }

  exportCsv() {
    const cols = ['at', 'date', 'gameId', 'difficulty', 'score', 'accuracy', 'performance', 'timeMs', 'seed', 'skills'];
    const esc = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = this.history().map((h) => cols.map((c) => {
      if (c === 'date') return esc(new Date(h.at).toISOString());
      if (c === 'skills') return esc((h.skills || []).join(' '));
      return esc(h[c]);
    }).join(','));
    return [cols.join(','), ...rows].join('\n') + '\n';
  }

  reset() {
    this.data = structuredClone(EMPTY);
    this.memoryHistory = [];
    writeJson(this.file, this.data);
    if (this.historyFile) {
      try { require('fs').rmSync(this.historyFile, { force: true }); } catch { /* ignore */ }
    }
  }
}

module.exports = { Stats, SESSION_GAP_MS };
