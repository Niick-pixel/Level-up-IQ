// Things you've learned: keywords you added yourself, cards for spaced repetition, and
// the record of each keyword session.
//   user-keywords.json  keywords added from Wikipedia (merged into the bank at startup)
//   cards.json          facts to review; Phase 5 adds FSRS scheduling to these same cards
//   sessions.jsonl      one line per finished keyword session
const path = require('path');
const { readJson, writeJson, appendJsonl, readJsonl } = require('./json-file');

const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'topic';

class Learning {
  constructor(dir, { now = Date.now } = {}) {
    this.now = now;
    this.userFile = dir ? path.join(dir, 'user-keywords.json') : null;
    this.cardsFile = dir ? path.join(dir, 'cards.json') : null;
    this.sessionsFile = dir ? path.join(dir, 'sessions.jsonl') : null;
    this.user = readJson(this.userFile, []);
    this.cards = readJson(this.cardsFile, []);
    this.memSessions = [];
  }

  // ---- user keywords

  userKeywords() {
    return structuredClone(this.user);
  }

  /** Creates a keyword from a Wikipedia summary. Returns the new entry (or the existing one). */
  addUserKeyword({ summary, domain, taken }) {
    const existing = this.user.find((k) => k.wikipedia.toLowerCase() === summary.title.toLowerCase());
    if (existing) return existing;
    let id = `u-${slug(summary.title)}`;
    for (let n = 2; taken(id); n++) id = `u-${slug(summary.title)}-${n}`;
    const k = {
      id,
      term: summary.title,
      aliases: [],
      domain,
      tags: summary.description ? [summary.description.slice(0, 60)] : [],
      difficulty: 3,
      related: [],
      wikipedia: summary.title,
      wikidata: summary.qid || null,
      user: true,
      addedAt: this.now(),
    };
    this.user.push(k);
    writeJson(this.userFile, this.user);
    return k;
  }

  removeUserKeyword(id) {
    const before = this.user.length;
    this.user = this.user.filter((k) => k.id !== id);
    writeJson(this.userFile, this.user);
    return this.user.length !== before;
  }

  // ---- cards

  /** Adds cards, skipping ones with the same front for the same keyword. */
  addCards(list) {
    const added = [];
    for (const c of list) {
      if (this.cards.some((x) => x.keywordId === c.keywordId && x.front === c.front)) continue;
      const card = {
        id: `c${this.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        keywordId: c.keywordId,
        front: String(c.front).slice(0, 500),
        back: String(c.back).slice(0, 1000),
        source: c.source || null,
        createdAt: this.now(),
        fsrs: null, // scheduled in Phase 5
      };
      this.cards.push(card);
      added.push(card);
    }
    if (added.length) writeJson(this.cardsFile, this.cards);
    return added;
  }

  recentCards(limit = 50) {
    return this.cards.slice(-limit).reverse().map((c) => ({ ...c }));
  }

  /**
   * Cards for "yesterday" recall: some from about 1, 3 and 7 days ago (spacing makes recall
   * stick), topped up with any other card at least a few hours old. Newest-first within a bucket.
   */
  recallCards(max = 6) {
    const DAY = 24 * 3600 * 1000;
    const age = (c) => (this.now() - c.createdAt) / DAY;
    const buckets = [[0.5, 2], [2, 5], [5, 10]];
    const per = Math.ceil(max / buckets.length);
    const picked = [];
    for (const [lo, hi] of buckets) {
      picked.push(...this.cards.filter((c) => age(c) >= lo && age(c) < hi).slice(-per));
    }
    for (const c of this.cards.slice().reverse()) {
      if (picked.length >= max) break;
      if (age(c) >= 0.125 && !picked.includes(c)) picked.push(c);
    }
    return picked.slice(0, max).map((c) => ({ ...c, daysAgo: Math.round(age(c)) }));
  }

  /** All cards (for the scheduler). Mutate through saveCards(). */
  allCards() {
    return this.cards;
  }

  saveCards() {
    writeJson(this.cardsFile, this.cards);
  }

  deleteCard(id) {
    const before = this.cards.length;
    this.cards = this.cards.filter((c) => c.id !== id);
    if (this.cards.length !== before) this.saveCards();
    return before !== this.cards.length;
  }

  cardCount() {
    return this.cards.length;
  }

  // ---- sessions

  recordSession(s) {
    const line = { at: this.now(), ...s };
    if (this.sessionsFile) appendJsonl(this.sessionsFile, line);
    else this.memSessions.push(line);
  }

  sessions() {
    return this.sessionsFile ? readJsonl(this.sessionsFile) : this.memSessions.slice();
  }
}

module.exports = { Learning, slug };
