// Per-skill adaptive difficulty.
//
// Each skill has an Elo-style rating that starts uncertain (big steps) and settles as you play.
// A game's difficulty level d (1..10) behaves like an opponent rated 700 + 100·d. After a round,
// performance p (0..1) is compared with the expected score E and the rating moves by K·(p − E).
// To pick a difficulty we aim for E ≈ 75 % (the 70–80 % "desirable difficulty" band), shifted by
// the user's difficulty bias.
const path = require('path');
const { readJson, writeJson } = require('./json-file');
const { SKILLS } = require('../shared/game-contract.js');

const START_RATING = 1200;
const TARGET = 0.75;
const BIAS_STEP = 0.05; // each bias step moves the target success rate by 5 %
const HISTORY_DAYS = 365;

const levelRating = (d) => 700 + 100 * d;
const expected = (rating, d) => 1 / (1 + 10 ** ((levelRating(d) - rating) / 400));

/** K shrinks from 64 to 16 over the first ~30 rounds of a skill. */
const kFactor = (n) => Math.max(16, 64 * Math.exp(-n / 15));

class Ratings {
  constructor(dir, { now = Date.now, dateKey } = {}) {
    this.file = dir ? path.join(dir, 'ratings.json') : null;
    this.now = now;
    this.dateKey = dateKey;
    this.data = readJson(this.file, {});
  }

  #skill(skill) {
    if (!this.data[skill]) this.data[skill] = { r: START_RATING, n: 0, history: [] };
    return this.data[skill];
  }

  get(skill) {
    const s = this.data[skill];
    return s ? s.r : START_RATING;
  }

  all() {
    const out = {};
    for (const skill of SKILLS) {
      const s = this.data[skill];
      out[skill] = { r: s ? Math.round(s.r) : START_RATING, n: s ? s.n : 0, history: s ? s.history.slice() : [] };
    }
    return out;
  }

  /** Difficulty 1..10 whose expected success is closest to the target for these skills. */
  suggest(skills, bias = 0) {
    const list = (skills || []).filter((s) => SKILLS.includes(s));
    const rating = list.length ? list.reduce((a, s) => a + this.get(s), 0) / list.length : START_RATING;
    const target = Math.min(0.95, Math.max(0.5, TARGET - bias * BIAS_STEP));
    let best = 1;
    let bestGap = Infinity;
    for (let d = 1; d <= 10; d++) {
      const gap = Math.abs(expected(rating, d) - target);
      if (gap < bestGap) { best = d; bestGap = gap; }
    }
    return best;
  }

  /**
   * Updates ratings from a normalized result. The first skill counts fully, the others half.
   * @returns {Record<string, {before: number, after: number}>}
   */
  record({ skills, difficulty, performance }) {
    const changes = {};
    skills.forEach((skill, i) => {
      if (!SKILLS.includes(skill)) return;
      const s = this.#skill(skill);
      const weight = i === 0 ? 1 : 0.5;
      const before = s.r;
      s.r = before + weight * kFactor(s.n) * (performance - expected(before, difficulty));
      s.n += 1;
      const day = this.dateKey(this.now());
      const last = s.history[s.history.length - 1];
      if (last && last[0] === day) last[1] = Math.round(s.r);
      else s.history.push([day, Math.round(s.r)]);
      if (s.history.length > HISTORY_DAYS) s.history.splice(0, s.history.length - HISTORY_DAYS);
      changes[skill] = { before: Math.round(before), after: Math.round(s.r) };
    });
    writeJson(this.file, this.data);
    return changes;
  }

  reset() {
    this.data = {};
    writeJson(this.file, this.data);
  }
}

module.exports = { Ratings, expected, levelRating, START_RATING };
