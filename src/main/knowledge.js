// Online extras for the knowledge games. Everything here is optional: each function returns
// what it could get within a few seconds, and the games fill the rest from offline packs.
const { makeRng } = require('../shared/rng.js');
const { sentences, blankTerm } = require('./quiz');

const path = require('path');
const { readJson, writeJson } = require('./json-file');
const { GROUPS } = require('./providers/inaturalist');

const POOL_MAX = 400;
const withTimeout = (p, ms, fallback) => Promise.race([p, new Promise((r) => setTimeout(() => r(fallback), ms))]);
const levelWord = (d) => (d <= 3 ? 'easy' : d <= 7 ? 'medium' : 'hard');

function mc(rng, prompt, correct, incorrect, source) {
  const options = rng.shuffle([correct, ...rng.shuffle(incorrect).slice(0, 3)]);
  return { prompt, options, answer: options.indexOf(correct), source };
}

class Knowledge {
  /** @param {{ bank, providers, cache, dir?, getSettings? }} deps */
  constructor(deps) {
    this.deps = deps;
    // Items (with their images cached) seen online, so the picture quizzes still work offline.
    this.poolFile = deps.dir ? path.join(deps.dir, 'pools.json') : null;
    this.pools = readJson(this.poolFile, { art: [], apod: [] });
  }

  #remember(kind, items) {
    const pool = this.pools[kind] || (this.pools[kind] = []);
    for (const it of items) {
      const i = pool.findIndex((p) => p.id === it.id);
      if (i >= 0) pool.splice(i, 1);
      pool.push(it);
    }
    if (pool.length > POOL_MAX) pool.splice(0, pool.length - POOL_MAX);
    writeJson(this.poolFile, this.pools);
  }

  /** Items from the pool whose image is still in the cache (hash → mg-cache URL). */
  #fromPool(kind, rng, n, exclude) {
    const { cache } = this.deps;
    return rng.shuffle(this.pools[kind] || [])
      .filter((it) => !exclude.has(it.id))
      .map((it) => {
        const hash = cache.hasImage(it.imageUrl);
        return hash ? { ...it, image: `mg-cache://img/${hash}` } : null;
      })
      .filter(Boolean)
      .slice(0, n);
  }

  async #withImages(provider, items) {
    const out = [];
    for (const it of items) {
      const hash = await withTimeout(provider.cacheImage(it.imageUrl), 15000, null);
      if (hash) out.push({ ...it, image: `mg-cache://img/${hash}` });
    }
    return out;
  }

  /** Artworks for the art quiz: a few fresh ones online, the rest from the pool. */
  async art({ seed = 'art', count = 8 } = {}) {
    const { met, aic } = this.deps.providers;
    const rng = makeRng(`art:${seed}`);
    const fresh = [];
    const [a, b] = await Promise.all([
      withTimeout(met.sample(rng, 3).then((x) => this.#withImages(met, x)).catch(() => []), 25000, []),
      withTimeout(aic.sample(rng, 3).then((x) => this.#withImages(aic, x)).catch(() => []), 25000, []),
    ]);
    fresh.push(...a, ...b);
    if (fresh.length) this.#remember('art', fresh.map(({ image, ...it }) => it));
    const items = [...fresh, ...this.#fromPool('art', rng, count - fresh.length, new Set(fresh.map((x) => x.id)))];
    return { items: rng.shuffle(items).slice(0, count), online: fresh.length > 0, poolSize: (this.pools.art || []).length };
  }

  /** APOD pictures for the space quiz. */
  async apod({ seed = 'apod', count = 6 } = {}) {
    const { apod } = this.deps.providers;
    const rng = makeRng(`apod:${seed}`);
    const list = await withTimeout(apod.random(count + 4, rng).catch(() => []), 15000, []);
    const fresh = await withTimeout(this.#withImages(apod, rng.shuffle(list).slice(0, count)), 40000, []);
    if (fresh.length) this.#remember('apod', fresh.map(({ image, ...it }) => it));
    const items = [...fresh, ...this.#fromPool('apod', rng, count - fresh.length, new Set(fresh.map((x) => x.id)))];
    // titles of other pictures, for answer options
    const titles = [...new Set([...list, ...(this.pools.apod || [])].map((x) => x.title))];
    return { items, titles, online: fresh.length > 0 };
  }

  /**
   * Species for the species quiz: the most-observed species of a few groups (Costa Rica by
   * default). Lists are cached for 30 days; photos are cached as they're shown.
   */
  async species({ seed = 'species', difficulty = 5, count = 8 } = {}) {
    const { inaturalist } = this.deps.providers;
    const costaRica = this.deps.getSettings?.().speciesCostaRica !== false;
    const rng = makeRng(`species:${seed}`);
    const groups = difficulty <= 3 ? ['Aves', 'Mammalia', 'Reptilia', 'Amphibia', 'Insecta'] : rng.shuffle(GROUPS).slice(0, 3);
    const lists = await Promise.all(groups.map((g) => withTimeout(inaturalist.species({ group: g, costaRica }).catch(() => []), 12000, [])));
    const depth = difficulty <= 3 ? 25 : difficulty <= 7 ? 60 : 100;
    const byGroup = Object.fromEntries(groups.map((g, i) => [g, lists[i].slice(0, depth)]));
    const all = Object.values(byGroup).flat();
    const questions = [];
    for (const sp of rng.shuffle(all)) {
      if (questions.length >= count) break;
      const [withImg] = await this.#withImages(inaturalist, [sp]);
      if (!withImg) continue;
      const pool = difficulty <= 3 ? all : byGroup[sp.group];
      const others = rng.shuffle(pool.filter((o) => o.id !== sp.id && o.name !== sp.name)).slice(0, 3);
      if (others.length < 3) continue;
      questions.push({ ...withImg, options: rng.shuffle([sp, ...others].map((o) => o.name)) });
    }
    return { questions, place: costaRica ? 'Costa Rica' : 'the world' };
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
