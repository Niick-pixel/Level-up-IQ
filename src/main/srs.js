// Spaced repetition with FSRS (ts-fsrs, MIT). Every review card (facts from keyword sessions,
// video recall, vocabulary) gets a schedule: it comes back just before you'd forget it.
//   cards.json     the cards, each with an `fsrs` field (null until its first review)
//   reviews.jsonl  one line per review (for stats and, later, fitting your own parameters)
const path = require('path');
const { fsrs, generatorParameters, createEmptyCard, Rating, State } = require('ts-fsrs');
const { appendJsonl, readJsonl } = require('./json-file');

const DAY = 24 * 3600 * 1000;
const RATINGS = { 1: Rating.Again, 2: Rating.Hard, 3: Rating.Good, 4: Rating.Easy };
const STATE_NAME = { [State.New]: 'new', [State.Learning]: 'learning', [State.Review]: 'review', [State.Relearning]: 'relearning' };

/** A card's kind, from where it came from. */
function cardType(c) {
  if (c.type) return c.type;
  if (String(c.keywordId).startsWith('video:') || /^From the video/.test(c.front)) return 'video';
  if (String(c.keywordId).startsWith('word:')) return 'vocab';
  return 'fact';
}

// FSRS cards carry Dates; we store ISO strings.
const toStored = (c) => ({ ...c, due: c.due.toISOString(), last_review: c.last_review ? c.last_review.toISOString() : null });
const fromStored = (c) => ({ ...c, due: new Date(c.due), last_review: c.last_review ? new Date(c.last_review) : undefined });

/** "10 min", "3 days", "2 months": how long until a card comes back. */
function fmtInterval(ms) {
  const min = ms / 60000;
  if (min < 60) return `${Math.max(1, Math.round(min))} min`;
  const h = min / 60;
  if (h < 24) return `${Math.round(h)} h`;
  const d = h / 24;
  if (d < 31) return `${Math.round(d)} ${Math.round(d) === 1 ? 'day' : 'days'}`;
  const mo = d / 30.4;
  if (mo < 12) return `${Math.round(mo)} ${Math.round(mo) === 1 ? 'month' : 'months'}`;
  return `${(d / 365).toFixed(1)} years`;
}

class Srs {
  /**
   * @param {string|null} dir
   * @param {{ learning, getSettings, now?, dateKey }} deps
   */
  constructor(dir, deps) {
    this.deps = deps;
    this.now = deps.now || Date.now;
    this.logFile = dir ? path.join(dir, 'reviews.jsonl') : null;
    this.memLog = [];
    this.retention = null;
  }

  #scheduler() {
    const s = this.deps.getSettings();
    const retention = Math.min(0.97, Math.max(0.7, Number(s.srsRetention) || 0.9));
    if (!this.f || this.retention !== retention) {
      // no fuzz: the same review history always gives the same schedule (and testable dates)
      this.f = fsrs(generatorParameters({ request_retention: retention, enable_fuzz: false, maximum_interval: 3650 }));
      this.retention = retention;
    }
    return this.f;
  }

  log() {
    return this.logFile ? readJsonl(this.logFile) : this.memLog.slice();
  }

  #newToday() {
    const today = this.deps.dateKey(this.now());
    return this.log().filter((r) => r.wasNew && this.deps.dateKey(r.at) === today).length;
  }

  /** Cards due now: reviews first (oldest due first), then up to the daily limit of new cards. */
  queue(limit = 50) {
    const now = this.now();
    const cards = this.deps.learning.allCards();
    const due = cards.filter((c) => c.fsrs && Date.parse(c.fsrs.due) <= now).sort((a, b) => Date.parse(a.fsrs.due) - Date.parse(b.fsrs.due));
    const newLimit = Math.max(0, (this.deps.getSettings().srsNewPerDay ?? 15) - this.#newToday());
    const fresh = cards.filter((c) => !c.fsrs).slice(0, newLimit);
    return [...due, ...fresh].slice(0, limit).map((c) => this.#view(c));
  }

  #view(c) {
    const f = this.#scheduler();
    const card = c.fsrs ? fromStored(c.fsrs) : createEmptyCard(new Date(this.now()));
    const preview = f.repeat(card, new Date(this.now()));
    const next = Object.fromEntries(Object.entries(RATINGS).map(([k, r]) => [k, fmtInterval(preview[r].card.due.getTime() - this.now())]));
    return {
      id: c.id, front: c.front, back: c.back, source: c.source, keywordId: c.keywordId, type: cardType(c),
      state: c.fsrs ? STATE_NAME[c.fsrs.state] : 'new', next,
    };
  }

  /** Grades a card 1 (again) … 4 (easy) and schedules its next review. */
  review(id, grade, elapsedMs = 0) {
    const rating = RATINGS[grade];
    if (!rating) throw new Error('Grade must be 1–4');
    const c = this.deps.learning.allCards().find((x) => x.id === id);
    if (!c) throw new Error('No such card');
    const now = new Date(this.now());
    const wasNew = !c.fsrs;
    const card = c.fsrs ? fromStored(c.fsrs) : createEmptyCard(now);
    const { card: next, log } = this.#scheduler().next(card, now, rating);
    c.fsrs = toStored(next);
    this.deps.learning.saveCards();
    const line = { at: this.now(), cardId: id, grade, wasNew, state: STATE_NAME[log.state], elapsedMs: Math.max(0, Math.round(elapsedMs)) || 0, type: cardType(c) };
    if (this.logFile) appendJsonl(this.logFile, line);
    else this.memLog.push(line);
    return { due: c.fsrs.due, in: fmtInterval(next.due.getTime() - this.now()) };
  }

  /** Numbers for Home and Stats. */
  stats(days = 14) {
    const now = this.now();
    const cards = this.deps.learning.allCards();
    const byState = { new: 0, learning: 0, review: 0, relearning: 0 };
    const byType = {};
    let dueNow = 0, mature = 0;
    for (const c of cards) {
      byState[c.fsrs ? STATE_NAME[c.fsrs.state] : 'new'] += 1;
      byType[cardType(c)] = (byType[cardType(c)] || 0) + 1;
      if (c.fsrs && Date.parse(c.fsrs.due) <= now) dueNow += 1;
      if (c.fsrs && c.fsrs.state === State.Review && c.fsrs.scheduled_days >= 21) mature += 1;
    }
    const newLimit = Math.max(0, (this.deps.getSettings().srsNewPerDay ?? 15) - this.#newToday());
    // reviews due on each of the next `days` days (today includes anything overdue)
    const forecast = Array.from({ length: days }, () => 0);
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    for (const c of cards) {
      if (!c.fsrs) continue;
      const i = Math.max(0, Math.floor((Date.parse(c.fsrs.due) - startOfToday.getTime()) / DAY));
      if (i < days) forecast[i] += 1;
    }
    const log = this.log();
    const recent = log.filter((r) => r.at > now - 30 * DAY && !r.wasNew);
    const retention = recent.length ? recent.filter((r) => r.grade > 1).length / recent.length : null;
    return {
      total: cards.length, byState, byType, dueNow, newAvailable: Math.min(byState.new, newLimit),
      mature, forecast, reviews: log.length, retention30d: retention,
    };
  }
}

module.exports = { Srs, cardType, fmtInterval };
