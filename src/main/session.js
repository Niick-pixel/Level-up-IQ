// A keyword session (spec §2): predict → learn → quiz → puzzle → explain it back → watch →
// remember. This module gathers the content; the renderer walks you through the steps.
// Everything degrades gracefully: offline, the quiz comes from the keyword bank alone.
const { buildQuiz, sentences } = require('./quiz');
const { compareExplanation } = require('./explain');
const { makeRng } = require('../shared/rng.js');

// Which local game suits a domain (Phase 3 adds Fermi estimation, chronology and more).
const PUZZLE_BY_DOMAIN = {
  mathematics: 'mental-math', physics: 'mental-math', chemistry: 'mental-math', engineering: 'mental-math',
  'computer-science': 'mental-math', economics: 'mental-math', astronomy: 'mental-math', 'sports-science': 'mental-math',
  linguistics: 'word-ladder', literature: 'word-ladder', film: 'word-ladder', philosophy: 'word-ladder', logic: 'word-ladder',
  psychology: 'stroop', neuroscience: 'nback', medicine: 'nback', biology: 'nback',
};
const PUZZLE_BY_KEYWORD = { 'stroop-effect': 'stroop', 'working-memory': 'nback', 'magical-number-seven': 'nback' };

const withTimeout = (p, ms, fallback) => Promise.race([p, new Promise((r) => setTimeout(() => r(fallback), ms))]);

class KeywordSessions {
  /**
   * @param {{ bank, providers, learning, stats, ratings, now?, dateKey }} deps
   */
  constructor(deps) {
    this.deps = deps;
    this.now = deps.now || Date.now;
    this.memo = new Map(); // keyword id → learn() result, for the length of a session
  }

  keyword(id) {
    const k = this.deps.bank.get(id);
    if (!k) throw new Error('Unknown keyword');
    return k;
  }

  /** Step 2: summary, image and key facts. */
  async learn(id) {
    const hit = this.memo.get(id);
    if (hit && this.now() - hit.at < 10 * 60 * 1000) return hit.value;
    const k = this.keyword(id);
    const { wikipedia, wikidata } = this.deps.providers;
    const out = { keyword: k, summary: null, image: null, facts: [], notes: [], attribution: [] };

    try {
      out.summary = await wikipedia.summary(k.wikipedia);
      if (out.summary.type === 'disambiguation') {
        out.notes.push('Wikipedia has several articles with this name; the summary may be a list of meanings.');
      }
      out.attribution.push({ name: 'Wikipedia', url: out.summary.url, license: wikipedia.license, licenseUrl: wikipedia.licenseUrl });
      if (out.summary.stale) out.notes.push('Showing a saved copy (you seem to be offline).');
    } catch (err) {
      out.notes.push(err.code === 'disabled' ? 'Wikipedia is turned off in Settings.' : 'Couldn\'t reach Wikipedia, so this session uses the offline keyword bank.');
    }
    if (out.summary?.thumbnail) {
      const hash = await wikipedia.cacheImage(out.summary.thumbnail);
      if (hash) out.image = `mg-cache://img/${hash}`;
    }
    const qid = k.wikidata || out.summary?.qid;
    if (qid) {
      try {
        out.facts = await withTimeout(wikidata.facts(qid), 35000, []);
        if (out.facts.length) out.attribution.push({ name: 'Wikidata', url: `https://www.wikidata.org/wiki/${qid}`, license: wikidata.license, licenseUrl: wikidata.licenseUrl });
      } catch { /* facts are optional */ }
    }
    this.memo.set(id, { at: this.now(), value: out });
    return out;
  }

  /** Step 3: 5–8 questions. */
  async quiz(id, seed = String(this.now())) {
    const k = this.keyword(id);
    const learned = await this.learn(id);
    let trivia = [];
    try {
      trivia = await withTimeout(this.deps.providers.opentdb.questions(k.domain, 2), 8000, []);
    } catch { /* optional */ }
    const questions = buildQuiz({
      keyword: k,
      bank: this.deps.bank,
      summary: learned.summary,
      facts: learned.facts,
      trivia,
      rng: makeRng(`quiz:${id}:${seed}`),
      thisYear: new Date(this.now()).getFullYear(),
    });
    return { questions, trivia: trivia.length > 0 };
  }

  /** Step 4: the puzzle tie-in. */
  puzzleFor(id) {
    const k = this.keyword(id);
    return PUZZLE_BY_KEYWORD[k.id] || PUZZLE_BY_DOMAIN[k.domain] || 'schulte';
  }

  /** Step 5: compare your explanation with the summary. */
  async compare(id, text) {
    const k = this.keyword(id);
    const learned = await this.learn(id);
    if (!learned.summary?.extract) return null;
    if (!this.vocab) {
      this.vocab = [...new Set(this.deps.bank.keywords.flatMap((x) => [x.term.replace(/\s*\(.*\)$/, ''), ...x.aliases, ...x.tags]))];
    }
    return compareExplanation(text, learned.summary.extract, [k.term, ...k.aliases], this.vocab);
  }

  /** Step 7: save cards and stats. */
  async finish(id, { quizCorrect = 0, quizTotal = 0, explainScore = 0, activeMs = 0, predicted = false, explained = false }) {
    const k = this.keyword(id);
    const learned = await this.learn(id);
    const { learning, stats, ratings } = this.deps;

    const cards = [];
    const first = sentences(learned.summary?.extract)[0];
    if (first) cards.push({ keywordId: k.id, front: `What is “${k.term}”?`, back: first, source: learned.summary.url });
    for (const f of learned.facts.slice(0, 3)) {
      cards.push({ keywordId: k.id, front: `${k.term}: ${f.label.toLowerCase()}?`, back: f.display, source: 'Wikidata' });
    }
    if (k.related.length) {
      const names = k.related.map((r) => this.deps.bank.get(r)?.term).filter(Boolean);
      cards.push({ keywordId: k.id, front: `Name a topic connected to “${k.term}”.`, back: names.join(', '), source: null });
    }
    const added = learning.addCards(cards);

    const quiz = quizTotal ? quizCorrect / quizTotal : 0;
    const performance = explained ? 0.7 * quiz + 0.3 * explainScore : quiz;
    const result = {
      gameId: 'keyword-session',
      skills: ['knowledge', 'deep-thinking'],
      difficulty: Math.min(10, k.difficulty * 2),
      score: Math.round(quizCorrect * 100 + explainScore * 200 + (predicted ? 50 : 0)),
      accuracy: quiz,
      performance,
      timeMs: Math.max(0, Math.round(activeMs)),
      seed: k.id,
    };
    const { newBest } = stats.record(result);
    const changes = ratings.record(result);
    stats.exploreKeyword(k.id, k.domain, { quiz, explain: explainScore });
    learning.recordSession({ keywordId: k.id, quizCorrect, quizTotal, explainScore, predicted, explained, activeMs: result.timeMs });
    this.memo.delete(id);
    return { cards: added, newBest, changes, result };
  }

  /** Home screen extras: one "On this day" event and the Lichess daily puzzle. */
  async homeExtras(dateKey) {
    const { wikipedia, lichess } = this.deps.providers;
    const [events, puzzle] = await Promise.all([
      withTimeout(wikipedia.onThisDay().catch(() => []), 8000, []),
      withTimeout(lichess.daily().catch(() => null), 8000, null),
    ]);
    let event = null;
    if (events.length) {
      // prefer an event that links to a keyword in the bank
      const titles = new Map(this.deps.bank.keywords.map((k) => [k.wikipedia.toLowerCase(), k]));
      const linked = events.filter((e) => e.pages.some((p) => titles.has(String(p.title).toLowerCase())));
      const pick = makeRng(`otd:${dateKey}`).pick(linked.length ? linked : events);
      const kw = pick.pages.map((p) => titles.get(String(p.title).toLowerCase())).find(Boolean);
      event = { year: pick.year, text: pick.text, url: pick.pages[0]?.url || null, keywordId: kw?.id || null };
    }
    return { onThisDay: event, dailyPuzzle: puzzle };
  }

  /** Wikipedia articles linked from a keyword's page that aren't in the bank yet. */
  async suggestions(id, limit = 12) {
    const k = this.keyword(id);
    const links = await this.deps.providers.wikipedia.links(k.wikipedia);
    const known = new Set(this.deps.bank.keywords.map((x) => x.wikipedia.toLowerCase()));
    const skip = /^(List of|Index of|Outline of|Timeline of|Glossary of)|\(disambiguation\)|^\d{3,4}s?$/;
    const pool = links.filter((t) => !known.has(t.toLowerCase()) && !skip.test(t));
    return makeRng(`sugg:${id}:${new Date(this.now()).toDateString()}`).shuffle(pool).slice(0, limit);
  }
}

module.exports = { KeywordSessions, PUZZLE_BY_DOMAIN };
