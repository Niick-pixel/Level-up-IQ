// Online extras for the knowledge games. Everything here is optional: each function returns
// what it could get within a few seconds, and the games fill the rest from offline packs.
const { makeRng } = require('../shared/rng.js');
const { sentences, blankTerm } = require('./quiz');

const withTimeout = (p, ms, fallback) => Promise.race([p, new Promise((r) => setTimeout(() => r(fallback), ms))]);
const levelWord = (d) => (d <= 3 ? 'easy' : d <= 7 ? 'medium' : 'hard');

function mc(rng, prompt, correct, incorrect, source) {
  const options = rng.shuffle([correct, ...rng.shuffle(incorrect).slice(0, 3)]);
  return { prompt, options, answer: options.indexOf(correct), source };
}

class Knowledge {
  /** @param {{ bank, providers }} deps */
  constructor(deps) {
    this.deps = deps;
  }

  /** Up to `amount` online trivia questions, from both trivia providers at once. */
  async trivia({ seed = 'trivia', amount = 8, difficulty = 5 } = {}) {
    const { opentdb, triviaapi } = this.deps.providers;
    const rng = makeRng(`trivia:${seed}`);
    const half = Math.ceil(amount / 2);
    const [a, b] = await Promise.all([
      withTimeout(triviaapi.questions(half, levelWord(difficulty)).catch(() => []), 8000, []),
      withTimeout(opentdb.questions(null, amount - half, levelWord(difficulty)).catch(() => []), 8000, []),
    ]);
    const questions = [
      ...a.map((q) => mc(rng, q.question, q.correct, q.incorrect, 'triviaapi')),
      ...b.map((q) => mc(rng, q.question, q.correct, q.incorrect, 'opentdb')),
    ];
    const sources = [a.length ? triviaapi : null, b.length ? opentdb : null].filter(Boolean)
      .map((p) => ({ id: p.id, name: p.name, license: p.license, licenseUrl: p.licenseUrl, homepage: p.homepage }));
    return { questions: rng.shuffle(questions), sources };
  }

  /**
   * "Guess the article": clues from Wikipedia summaries of keywords (with the name blanked out);
   * offline, the clue is the keyword's tags and related topics instead.
   */
  async guess({ seed = 'guess', count = 5, difficulty = 5 } = {}) {
    const { bank, providers } = this.deps;
    const rng = makeRng(`guess:${seed}`);
    const tier = Math.min(5, Math.max(1, Math.ceil(difficulty / 2)));
    const pool = bank.keywords.filter((k) => !k.user && Math.abs(k.difficulty - tier) <= 1);
    const picks = rng.shuffle(pool).slice(0, count);
    const summaries = await withTimeout(Promise.all(picks.map((k) => providers.wikipedia.summary(k.wikipedia).catch(() => null))), 10000, []);
    const domainLabel = (id) => bank.domains.find((d) => d.id === id)?.label || id;
    const items = picks.map((k, i) => {
      const s = summaries[i];
      const sameDomain = bank.keywords.filter((o) => o.domain === k.domain && o.id !== k.id && !o.user);
      const distractors = rng.shuffle(sameDomain).slice(0, 3).map((o) => o.term);
      const options = rng.shuffle([k.term, ...distractors]);
      const words = `${k.term} ${k.wikipedia}`.split(/[\s,()]+/).filter((w) => w.length >= 4 && !/^(the|and|of|theory|effect)$/i.test(w));
      const names = [k.term, k.wikipedia, ...k.aliases, ...words];
      let clue = null;
      if (s && s.extract && s.type !== 'disambiguation') {
        const text = sentences(s.extract).slice(0, 2).map((x) => blankTerm(x, names) || x).join(' ');
        const leaked = names.some((n) => n.length >= 4 && new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
        if (text && !leaked) clue = { kind: 'wikipedia', text, url: s.url };
      }
      if (!clue) {
        const related = k.related.map((r) => bank.get(r)?.term).filter(Boolean);
        clue = { kind: 'bank', text: `A topic in ${domainLabel(k.domain)}. Tags: ${k.tags.join(', ') || 'none'}.${related.length ? ` Related: ${related.join(', ')}.` : ''}` };
      }
      return { keywordId: k.id, clue, options, answer: options.indexOf(k.term), term: k.term, wikipedia: k.wikipedia };
    }).filter((it) => it.options.length === 4);
    return { items, online: items.some((it) => it.clue.kind === 'wikipedia') };
  }

  /** Events from Wikipedia's "On this day" for today (cached for a month), or null. */
  async onThisDay({ seed = 'otd' } = {}) {
    try {
      const events = await withTimeout(this.deps.providers.wikipedia.onThisDay(), 8000, null);
      if (!events || events.length < 8) return null;
      const rng = makeRng(`otd:${seed}`);
      return {
        events: rng.shuffle(events).map((e) => ({ year: e.year, text: e.text, url: e.pages[0]?.url || null })),
        source: { name: 'Wikipedia, “On this day”', license: 'CC BY-SA 4.0', url: 'https://en.wikipedia.org/wiki/Wikipedia:Selected_anniversaries' },
      };
    } catch {
      return null;
    }
  }
}

module.exports = { Knowledge };
