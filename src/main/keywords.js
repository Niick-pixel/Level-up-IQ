// The keyword bank: fuzzy search, random picks, the related-topic graph, and Keyword of the Day.
const fs = require('fs');
const path = require('path');
const Fuse = require('fuse.js');
const { makeRng } = require('../shared/rng.js');

const BANK_FILE = path.join(__dirname, '..', '..', 'assets', 'keywords.json');

class KeywordBank {
  /** @param {{ domains: {id: string, label: string}[], keywords: object[] }} bank */
  constructor(bank) {
    this.domains = bank.domains;
    this.keywords = bank.keywords;
    this.byId = new Map(this.keywords.map((k) => [k.id, k]));
    const labels = new Map(this.domains.map((d) => [d.id, d.label]));
    for (const k of this.keywords) k.domainLabel = labels.get(k.domain) || k.domain;
    this.fuse = new Fuse(this.keywords, {
      keys: [
        { name: 'term', weight: 3 },
        { name: 'aliases', weight: 2 },
        { name: 'tags', weight: 1 },
        { name: 'domainLabel', weight: 0.5 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
      includeScore: true,
    });
  }

  static load(file = BANK_FILE) {
    return new KeywordBank(JSON.parse(fs.readFileSync(file, 'utf8')));
  }

  get(id) {
    return this.byId.get(id) || null;
  }

  /** Fuzzy search with optional domain / tag filters. */
  search(query, { domain = null, tag = null, limit = 20 } = {}) {
    const q = String(query || '').trim();
    const pass = (k) => (!domain || k.domain === domain) && (!tag || k.tags.includes(tag));
    if (!q) return this.keywords.filter(pass).slice(0, limit);
    return this.fuse.search(q, { limit: limit * 3 }).map((r) => r.item).filter(pass).slice(0, limit);
  }

  /**
   * Random keyword.
   *   mode 'any'      fully random
   *   mode 'domain'   random within `domain`
   *   mode 'comfort'  "outside my comfort zone": domains you've explored least weigh most
   *   mode 'rabbit'   a neighbour of `fromId` in the related graph (falls back to random)
   */
  random({ mode = 'any', domain = null, fromId = null, domainCounts = {}, exclude = [], rng } = {}) {
    const r = rng || makeRng(String(Math.random()));
    const skip = new Set(exclude);
    const pool = (list) => {
      const left = list.filter((k) => !skip.has(k.id));
      return left.length ? left : list;
    };
    if (mode === 'domain' && domain) {
      const list = this.keywords.filter((k) => k.domain === domain);
      if (list.length) return r.pick(pool(list));
    }
    if (mode === 'comfort') {
      const d = r.weighted(this.domains, (x) => 1 / (1 + (domainCounts[x.id] || 0)) ** 2);
      const list = this.keywords.filter((k) => k.domain === d.id);
      if (list.length) return r.pick(pool(list));
    }
    if (mode === 'rabbit' && fromId) {
      const from = this.get(fromId);
      const next = (from?.related || []).map((id) => this.get(id)).filter(Boolean);
      if (next.length) return r.pick(pool(next));
    }
    return r.pick(pool(this.keywords));
  }

  /** Deterministic per local date, so it's the same all day. */
  ofTheDay(dateKey) {
    return makeRng(`kotd:${dateKey}`).pick(this.keywords);
  }

  /** Keywords that list this one as related, plus the ones it lists. */
  neighbours(id) {
    const k = this.get(id);
    if (!k) return [];
    const out = new Map();
    for (const r of k.related) if (this.byId.has(r)) out.set(r, this.byId.get(r));
    for (const other of this.keywords) if (other.related.includes(id)) out.set(other.id, other);
    out.delete(id);
    return [...out.values()];
  }
}

module.exports = { KeywordBank, BANK_FILE };
