// Watch and learn (spec §3 "Video flow"): suggest → watch in the browser → mark watched →
// 3 recall questions → a review card and an entry in "Things I've learned".
//   watch.json   the watch-later queue and everything you've watched (with your recall notes)
const path = require('path');
const { readJson, writeJson } = require('./json-file');
const { activeChannels } = require('./channels');

const STOP = new Set('the a an of and or in on to for with from by at as is are was were be this that how why what who when where your you it its into about vs'.split(' '));
const words = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
const phrase = (s) => ` ${words(s).join(' ')} `;

/**
 * How well a video matches a keyword: the full name (or an alias) in the title counts most,
 * then in the description, then single words. Pure; exported for tests.
 */
function matchScore(video, keyword) {
  const title = phrase(video.title);
  const desc = phrase(video.description);
  let score = 0;
  for (const [name, w] of [[keyword.term, 1], ...keyword.aliases.map((a) => [a, 0.8])]) {
    const p = phrase(name);
    if (p.trim().length < 3) continue;
    if (title.includes(p)) score = Math.max(score, 6 * w);
    else if (desc.includes(p)) score = Math.max(score, 3 * w);
  }
  const tokens = words(keyword.term).filter((t) => t.length >= 4);
  if (tokens.length > 1) {
    const hits = tokens.filter((t) => title.includes(` ${t} `)).length;
    score = Math.max(score, (2.5 * hits) / tokens.length);
  }
  if ((video.domains || []).includes(keyword.domain)) score += 0.5;
  return score;
}

const keyOf = (v) => `${v.source}:${v.id}`;
const pick = (v) => ({
  key: keyOf(v), id: v.id, source: v.source, title: String(v.title).slice(0, 200), channel: String(v.channel || '').slice(0, 100),
  url: v.url, thumbnail: v.thumbnail || null, published: v.published || '', license: v.license || null,
});

class Media {
  /**
   * @param {string|null} dir
   * @param {{ providers, bank, learning, getSettings, now? }} deps
   */
  constructor(dir, deps) {
    this.deps = deps;
    this.now = deps.now || Date.now;
    this.file = dir ? path.join(dir, 'watch.json') : null;
    this.items = readJson(this.file, []);
  }

  #save() {
    writeJson(this.file, this.items);
  }

  // ---- the queue

  list() {
    return structuredClone(this.items);
  }

  add(video, keywordId = null) {
    if (!video || !['youtube', 'archive'].includes(video.source) || !/^[A-Za-z0-9_.-]{1,100}$/.test(String(video.id))) throw new Error('Not a video we know');
    const url = String(video.url || '');
    const expected = video.source === 'youtube' ? `https://www.youtube.com/watch?v=${video.id}` : `https://archive.org/details/${encodeURIComponent(video.id)}`;
    if (url !== expected) throw new Error('Unexpected video link');
    const key = keyOf(video);
    const existing = this.items.find((x) => x.key === key);
    if (existing) return existing;
    const keyword = keywordId ? this.deps.bank.get(keywordId) : null;
    const item = { ...pick(video), keywordId: keyword?.id || null, domains: video.domains || (keyword ? [keyword.domain] : []), addedAt: this.now(), watchedAt: null, recall: null };
    this.items.push(item);
    this.#save();
    return item;
  }

  remove(key) {
    const before = this.items.length;
    this.items = this.items.filter((x) => x.key !== key);
    if (this.items.length !== before) this.#save();
    return before !== this.items.length;
  }

  /** The recall questions for a video (3). The topic question appears when we know the topic. */
  recallQuestions(key, rng) {
    const item = this.items.find((x) => x.key === key);
    if (!item) throw new Error('Not in your list');
    const qs = [
      { id: 'main', kind: 'text', prompt: 'In one or two sentences: what was the main idea?' },
      { id: 'fact', kind: 'text', prompt: 'One fact, number or example you remember:' },
    ];
    const { bank } = this.deps;
    const k = item.keywordId ? bank.get(item.keywordId) : bank.keywords.map((kw) => [kw, matchScore(item, kw)]).filter(([, s]) => s >= 6).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (k) {
      const others = rng.shuffle(bank.keywords.filter((o) => o.domain === k.domain && o.id !== k.id)).slice(0, 3).map((o) => o.term);
      const options = rng.shuffle([k.term, ...others]);
      qs.push({ id: 'topic', kind: 'choice', prompt: 'Which of these topics was it about?', options, answer: options.indexOf(k.term), keywordId: k.id });
    } else {
      qs.push({ id: 'question', kind: 'text', prompt: 'What question do you still have after watching?' });
    }
    return { item, questions: qs };
  }

  /** Marks a video watched with your recall answers; saves a review card from them. */
  markWatched(key, answers = {}) {
    const item = this.items.find((x) => x.key === key);
    if (!item) throw new Error('Not in your list');
    const clean = (s) => String(s || '').trim().slice(0, 1000);
    item.watchedAt = this.now();
    item.recall = {
      main: clean(answers.main),
      fact: clean(answers.fact),
      question: clean(answers.question),
      topicCorrect: typeof answers.topicCorrect === 'boolean' ? answers.topicCorrect : null,
      confidence: [1, 2, 3].includes(answers.confidence) ? answers.confidence : null,
    };
    if (answers.keywordId && this.deps.bank.get(answers.keywordId) && !item.keywordId) item.keywordId = answers.keywordId;
    this.#save();
    const back = [item.recall.main, item.recall.fact && `Example: ${item.recall.fact}`].filter(Boolean).join('\n');
    const cards = back ? this.deps.learning.addCards([{ keywordId: item.keywordId || `video:${item.key}`, front: `From the video “${item.title}”: what was the main idea?`, back, source: item.url }]) : [];
    return { item: structuredClone(item), cards: cards.length };
  }

  /** Things I've learned: watched videos plus finished keyword sessions, newest first. */
  learned() {
    const { bank, learning } = this.deps;
    const videos = this.items.filter((x) => x.watchedAt).map((x) => ({ kind: 'video', at: x.watchedAt, title: x.title, channel: x.channel, url: x.url, note: x.recall?.main || '', keywordId: x.keywordId, key: x.key }));
    const sessions = learning.sessions().map((s) => {
      const k = bank.get(s.keywordId);
      return k ? { kind: 'keyword', at: s.at, title: k.term, keywordId: k.id, note: s.quizTotal ? `Quiz ${s.quizCorrect}/${s.quizTotal}` : '' } : null;
    }).filter(Boolean);
    return [...videos, ...sessions].sort((a, b) => b.at - a.at);
  }

  // ---- finding videos

  /** Latest videos from your channels (optionally one domain). Failed feeds are listed, not fatal. */
  async latest({ domain = null, limit = 60 } = {}) {
    const channels = activeChannels(this.deps.getSettings()).filter((c) => !domain || c.domains.includes(domain));
    const { videos, failed } = await this.deps.providers.youtube.latest(channels);
    const saved = new Set(this.items.map((x) => x.key));
    return { videos: videos.slice(0, limit).map((v) => ({ ...v, saved: saved.has(keyOf(v)) })), failed, channels: channels.length };
  }

  /**
   * Suggestions for a keyword (the session's Watch step): matching videos from your channels,
   * public-domain films from the Internet Archive, and YouTube search if you've added a key.
   */
  async suggestions(keywordId, { limit = 6 } = {}) {
    const { bank, providers } = this.deps;
    const k = bank.get(keywordId);
    if (!k) throw new Error('Unknown keyword');
    const settings = this.deps.getSettings();
    const inDomain = activeChannels(settings).filter((c) => c.domains.includes(k.domain));
    const [feeds, films, search] = await Promise.all([
      providers.youtube.latest(inDomain).catch(() => ({ videos: [] })),
      providers.archive.films(k.term).catch(() => []),
      providers.youtubeapi.enabled() ? providers.youtubeapi.search(`${k.term} explained`).catch(() => []) : Promise.resolve([]),
    ]);
    const scored = (list) => list.map((v) => ({ v, s: matchScore(v, k) })).filter((x) => x.s >= 2).sort((a, b) => b.s - a.s).map((x) => x.v);
    const saved = new Set(this.items.map((x) => x.key));
    const seen = new Set();
    const out = [];
    for (const v of [...scored(feeds.videos), ...search, ...scored(films).slice(0, 3)]) {
      if (seen.has(keyOf(v)) || out.length >= limit) continue;
      seen.add(keyOf(v));
      out.push({ ...pick(v), domains: [k.domain], saved: saved.has(keyOf(v)) });
    }
    return {
      videos: out,
      searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${k.term} documentary explained`)}`,
      usedSearch: search.length > 0,
    };
  }
}

module.exports = { Media, matchScore, keyOf };
