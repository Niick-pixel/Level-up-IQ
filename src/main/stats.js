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

  /** A spaced-repetition review counts as training time too (it's recall without help). */
  recordReview(elapsedMs) {
    const at = this.now();
    const day = this.#day(this.dateKey(at));
    const ms = Math.min(Math.max(0, elapsedMs || 0), 5 * 60 * 1000);
    day.reviews = (day.reviews || 0) + 1;
    day.ms += ms;
    day.noAiMs += ms;
    writeJson(this.file, this.data);
  }

  /** Current and best streak (see streak() below). */
  streak(restPerWeek = 1) {
    return streak(this.data.days, this.dateKey(this.now()), restPerWeek);
  }

  /**
   * Marks a keyword as explored (feeds "outside my comfort zone" and the curiosity map).
   * @param {{ quiz: number, explain: number }} [mastery] best scores from a finished session
   */
  exploreKeyword(id, domain, mastery) {
    const k = this.data.keywords[id] || { first: this.now(), count: 0, domain };
    k.count += 1;
    k.last = this.now();
    if (mastery) {
      k.sessions = (k.sessions || 0) + 1;
      k.bestQuiz = Math.max(k.bestQuiz || 0, mastery.quiz || 0);
      k.bestExplain = Math.max(k.bestExplain || 0, mastery.explain || 0);
    }
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

  /** Rounds played per game, all time. */
  gameCounts() {
    const out = {};
    for (const d of Object.values(this.data.days)) for (const [g, n] of Object.entries(d.byGame || {})) out[g] = (out[g] || 0) + n;
    return out;
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

/** Calendar day keys from `from` to `to` inclusive (local dates, DST-safe). */
function dayKeys(from, to) {
  const [fy, fm, fd] = from.split('-').map(Number);
  const out = [];
  for (let i = 0; ; i++) {
    const d = new Date(fy, fm - 1, fd + i, 12);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push(k);
    if (k >= to || i > 4000) return out;
  }
}

const trained = (d) => Boolean(d && (d.games || d.reviews));

/**
 * Streaks that don't punish rest: a day off doesn't break the streak as long as you've taken no
 * more than `restPerWeek` days off in the last 7 days. Today only counts once you've trained;
 * an untrained today never breaks anything. Pure; exported for tests.
 * @returns {{ current, best, trainedToday, restLeft, restDays }}
 */
function streak(days, todayKey, restPerWeek = 1) {
  const keys = Object.keys(days).filter((k) => trained(days[k])).sort();
  if (!keys.length) return { current: 0, best: 0, trainedToday: false, restLeft: restPerWeek, restDays: [] };
  const all = dayKeys(keys[0], todayKey);
  let run = 0, best = 0, rests = []; // rests = indexes of rest days inside the current run
  all.forEach((k, i) => {
    if (trained(days[k])) {
      run += 1;
    } else if (k === todayKey) {
      // today isn't over yet
    } else {
      rests = rests.filter((j) => j > i - 7);
      if (run > 0 && rests.length < restPerWeek) rests.push(i);
      else { run = 0; rests = []; }
    }
    best = Math.max(best, run);
  });
  const lastIndex = all.length - 1;
  const recentRests = rests.filter((j) => j > lastIndex - 7);
  return {
    current: run,
    best,
    trainedToday: trained(days[todayKey]),
    restLeft: Math.max(0, restPerWeek - recentRests.length),
    restDays: recentRests.map((j) => all[j]),
  };
}

module.exports = { Stats, SESSION_GAP_MS, streak };
