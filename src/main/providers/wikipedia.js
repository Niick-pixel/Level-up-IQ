// Wikipedia (English): page summaries, random articles, "On this day", search, and links.
// Text is CC BY-SA 4.0, so every summary carries its title, link and license.
// Endpoints live in one table so the 2026–27 Wikimedia API migration is a one-line change.
const { Provider } = require('./provider');

const DAY = 24 * 3600 * 1000;
const REST = 'https://en.wikipedia.org/api/rest_v1';
const ACTION = 'https://en.wikipedia.org/w/api.php';

const ENDPOINTS = {
  summary: (title) => `${REST}/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
  random: () => `${REST}/page/random/summary`,
  onThisDay: (mm, dd) => `${REST}/feed/onthisday/events/${mm}/${dd}`,
  search: (q) => `${ACTION}?action=opensearch&format=json&namespace=0&limit=8&search=${encodeURIComponent(q)}`,
  links: (title) => `${ACTION}?action=query&format=json&formatversion=2&prop=links&plnamespace=0&pllimit=200&redirects=1&titles=${encodeURIComponent(title)}`,
  pageprops: (titles) => `${ACTION}?action=query&format=json&formatversion=2&prop=pageprops&ppprop=wikibase_item&redirects=1&titles=${encodeURIComponent(titles.join('|'))}`,
};

const INFO = {
  id: 'wikipedia',
  name: 'Wikipedia',
  hosts: ['en.wikipedia.org', 'upload.wikimedia.org'],
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  attribution: 'Text from Wikipedia, the free encyclopedia, available under CC BY-SA 4.0.',
  homepage: 'https://en.wikipedia.org/',
  minIntervalMs: 250, // well under the ~200 requests/minute allowed for an identified client
  concurrency: 2,
  ttlMs: 14 * DAY,
};

/** Keeps only what we show, as plain text (no HTML ever reaches the UI). */
function normalizeSummary(d) {
  return {
    title: d.title,
    description: d.description || '',
    extract: String(d.extract || '').trim(),
    type: d.type || 'standard',
    url: d.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(String(d.title).replace(/ /g, '_'))}`,
    thumbnail: d.thumbnail?.source || null,
    qid: d.wikibase_item || null,
  };
}

class Wikipedia extends Provider {
  constructor(deps) {
    super(INFO, deps);
  }

  async summary(title) {
    const { data, stale } = await this.getJson(ENDPOINTS.summary(title), { accept: (d) => d && typeof d.title === 'string' });
    return { ...normalizeSummary(data), stale };
  }

  async random() {
    const { data } = await this.getJson(ENDPOINTS.random(), { cache: false, accept: (d) => d && d.title });
    return normalizeSummary(data);
  }

  /** Events that happened on this calendar day, newest first. */
  async onThisDay(date = new Date(this.now)) {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const { data } = await this.getJson(ENDPOINTS.onThisDay(mm, dd), { ttlMs: 30 * DAY, accept: (d) => Array.isArray(d?.events) });
    return data.events
      .filter((e) => e && typeof e.text === 'string' && Number.isInteger(e.year))
      .map((e) => ({
        year: e.year,
        text: e.text,
        pages: (e.pages || []).slice(0, 3).map((p) => ({ title: p.titles?.normalized || p.title, url: p.content_urls?.desktop?.page || null })),
      }))
      .sort((a, b) => b.year - a.year);
  }

  /** Title suggestions for "add a keyword". */
  async search(query) {
    const q = String(query).trim().slice(0, 100);
    if (!q) return [];
    const { data } = await this.getJson(ENDPOINTS.search(q), { ttlMs: DAY, accept: Array.isArray });
    const [, titles = [], descriptions = []] = data;
    return titles.map((title, i) => ({ title, description: descriptions[i] || '' }));
  }

  /** Articles linked from a page (for "suggest related keywords"). */
  async links(title) {
    const { data } = await this.getJson(ENDPOINTS.links(title), { accept: (d) => d && d.query });
    const page = data.query.pages?.[0];
    return (page?.links || []).map((l) => l.title);
  }

  /**
   * Wikidata item IDs for up to 50 titles, following redirects.
   * @returns {Record<string, string|null>} requested title → QID (null if missing)
   */
  async qids(titles) {
    const { data } = await this.getJson(ENDPOINTS.pageprops(titles.slice(0, 50)), { accept: (d) => d && d.query });
    return mapQids(titles, data);
  }
}

/** Pure helper (exported for tests): resolves normalization and redirects back to the asked titles. */
function mapQids(titles, data) {
  const q = data.query || {};
  const step = (list) => new Map((list || []).map((x) => [x.from, x.to]));
  const normalized = step(q.normalized);
  const redirects = step(q.redirects);
  const pages = new Map((q.pages || []).map((p) => [p.title, p.missing ? null : p.pageprops?.wikibase_item || null]));
  const out = {};
  for (const t of titles) {
    let name = normalized.get(t) || t;
    name = redirects.get(name) || name;
    out[t] = pages.has(name) ? pages.get(name) : null;
  }
  return out;
}

module.exports = { Wikipedia, ENDPOINTS, normalizeSummary, mapQids, INFO };
