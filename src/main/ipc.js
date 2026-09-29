// Every IPC handler in one place. Arguments from the renderer are validated here.
const fs = require('fs');
const { normalizeResult, validateMeta } = require('../shared/game-contract.js');
const { isAllowedLink } = require('./links');

const { CHANNELS } = require('./channels');
const { curiosityMap } = require('./curiosity');
const { makeRng } = require('../shared/rng.js');
const str = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
const ID = /^[a-z0-9-]{1,80}$/;

/**
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain
 */
function registerIpc({
  ipcMain, app, shell, dialog, store, stats, ratings, bank, updater, dateKey, getWindow, guard, engines, knowledge, secrets, media, srs, ai,
  onSettingsChanged, cache, providers, learning, sessions,
}) {
  const handle = (channel, fn) => ipcMain.handle(channel, (_e, ...args) => fn(...args));

  // --- settings
  handle('settings:get', () => store.get());
  handle('settings:set', (partial) => {
    const next = store.set(partial && typeof partial === 'object' ? partial : {});
    onSettingsChanged(next);
    return next;
  });
  handle('settings:reset', () => {
    const next = store.reset();
    onSettingsChanged(next);
    return next;
  });

  // --- keywords
  handle('keywords:domains', () => bank.domains.map((d) => ({ ...d, count: bank.keywords.filter((k) => k.domain === d.id).length })));
  handle('keywords:search', (query, opts = {}) => bank.search(str(query), {
    domain: ID.test(opts.domain || '') ? opts.domain : null,
    tag: str(opts.tag, 80) || null,
    limit: Math.min(100, Math.max(1, Number(opts.limit) || 20)),
  }));
  handle('keywords:get', (id) => {
    const k = ID.test(id || '') ? bank.get(id) : null;
    if (!k) return null;
    return { ...k, neighbours: bank.neighbours(id).map(({ id: nid, term, domain }) => ({ id: nid, term, domain })) };
  });
  handle('keywords:today', () => bank.ofTheDay(dateKey()));
  handle('keywords:random', (opts = {}) => bank.random({
    mode: ['any', 'domain', 'comfort', 'rabbit'].includes(opts.mode) ? opts.mode : 'any',
    domain: ID.test(opts.domain || '') ? opts.domain : null,
    fromId: ID.test(opts.fromId || '') ? opts.fromId : null,
    exclude: Array.isArray(opts.exclude) ? opts.exclude.filter((x) => ID.test(x)).slice(0, 50) : [],
    domainCounts: stats.domainCounts(),
  }));
  handle('keywords:explore', (id) => {
    const k = ID.test(id || '') ? bank.get(id) : null;
    if (k) stats.exploreKeyword(k.id, k.domain);
    return Boolean(k);
  });
  handle('keywords:count', () => bank.keywords.length);
  handle('keywords:user', () => learning.userKeywords());
  handle('keywords:add', async (title, domain) => {
    if (!bank.domains.some((d) => d.id === domain)) throw new Error('Pick a domain');
    const summary = await providers.wikipedia.summary(str(title, 300));
    if (summary.type === 'disambiguation') throw new Error('That title is a disambiguation page; pick a more specific article.');
    const known = bank.keywords.find((k) => k.wikipedia.toLowerCase() === summary.title.toLowerCase());
    if (known) return known;
    return bank.add(learning.addUserKeyword({ summary, domain, taken: (id) => Boolean(bank.get(id)) }));
  });
  handle('keywords:remove', (id) => {
    if (!ID.test(id || '')) return false;
    return bank.remove(id) && learning.removeUserKeyword(id);
  });
  handle('keywords:suggest', (id) => (ID.test(id || '') ? sessions.suggestions(id) : []));
  handle('wiki:search', (q) => providers.wikipedia.search(str(q, 100)));
  handle('wiki:random', () => providers.wikipedia.random());

  // --- keyword sessions (spec §2)
  const kid = (id) => {
    if (!ID.test(id || '')) throw new Error('Unknown keyword');
    return id;
  };
  handle('session:learn', (id) => sessions.learn(kid(id)));
  handle('session:quiz', (id, seed) => sessions.quiz(kid(id), str(seed, 40) || undefined));
  handle('session:puzzle', (id) => sessions.puzzleFor(kid(id)));
  handle('session:compare', (id, text) => sessions.compare(kid(id), str(text, 5000)));
  handle('session:finish', (id, r = {}) => sessions.finish(kid(id), {
    quizCorrect: Math.max(0, Math.min(20, Number(r.quizCorrect) || 0)),
    quizTotal: Math.max(0, Math.min(20, Number(r.quizTotal) || 0)),
    explainScore: Math.max(0, Math.min(1, Number(r.explainScore) || 0)),
    activeMs: Math.max(0, Math.min(3 * 3600 * 1000, Number(r.activeMs) || 0)),
    predicted: Boolean(r.predicted),
    explained: Boolean(r.explained),
  }));
  handle('home:extras', () => sessions.homeExtras(dateKey()));
  handle('cards:count', () => learning.cardCount());
  handle('cards:recent', () => learning.recentCards(50));
  handle('cards:recall', () => learning.recallCards(6));

  // --- online sources and cache
  const num = (x, lo, hi, dflt) => (Number.isFinite(Number(x)) ? Math.min(hi, Math.max(lo, Math.round(Number(x)))) : dflt);
  handle('knowledge:trivia', (o = {}) => knowledge.trivia({ seed: str(o.seed, 40), amount: num(o.amount, 1, 12, 8), difficulty: num(o.difficulty, 1, 10, 5) }));
  handle('knowledge:guess', (o = {}) => knowledge.guess({ seed: str(o.seed, 40), count: num(o.count, 1, 8, 5), difficulty: num(o.difficulty, 1, 10, 5) }));
  handle('knowledge:onThisDay', (o = {}) => knowledge.onThisDay({ seed: str(o.seed, 40) }));
  handle('knowledge:art', (o = {}) => knowledge.art({ seed: str(o.seed, 40) }));
  handle('knowledge:apod', (o = {}) => knowledge.apod({ seed: str(o.seed, 40) }));
  handle('knowledge:species', (o = {}) => knowledge.species({ seed: str(o.seed, 40), difficulty: num(o.difficulty, 1, 10, 5) }));

  // --- watch and learn
  const videoKey = (k) => (typeof k === 'string' && /^(youtube|archive):[A-Za-z0-9_.-]{1,100}$/.test(k) ? k : '');
  handle('media:latest', (o = {}) => media.latest({ domain: bank.domains.some((d) => d.id === o.domain) ? o.domain : null }));
  handle('media:suggest', (id) => media.suggestions(kid(id)));
  handle('media:list', () => media.list());
  handle('media:add', (video, keywordId) => media.add(video && typeof video === 'object' ? video : null, typeof keywordId === 'string' && ID.test(keywordId) ? keywordId : null));
  handle('media:remove', (key) => media.remove(videoKey(key)));
  handle('media:recall', (key, seed) => media.recallQuestions(videoKey(key), makeRng(`recall:${str(seed, 40)}`)));
  handle('media:watched', (key, answers = {}) => media.markWatched(videoKey(key), answers && typeof answers === 'object' ? answers : {}));
  handle('media:learned', () => media.learned());
  // Remote images come through the main process (the page can't reach the network):
  // only https, only hosts a provider is allowed to contact.
  handle('media:image', async (url) => {
    let u;
    try { u = new URL(String(url)); } catch { return null; }
    if (u.protocol !== 'https:') return null;
    const p = Object.values(providers).find((x) => x && Array.isArray(x.hosts) && x.hosts.includes(u.hostname));
    const hash = p ? await p.cacheImage(u.href) : null;
    return hash ? `mg-cache://img/${hash}` : null;
  });
  handle('channels:list', () => ({ curated: CHANNELS, settings: store.get().channels }));

  // --- optional API keys (values never leave the main process)
  handle('secrets:status', () => secrets.status());
  handle('secrets:set', (name, value) => secrets.set(str(name, 20), str(value, 200)));

  // --- spaced repetition (FSRS)
  const cardId = (id) => (typeof id === 'string' && /^c[a-z0-9]{1,30}$/.test(id) ? id : '');
  // --- Claude (optional): the topic's summary comes from the session cache, never from the page
  const aiTopic = async (id) => {
    if (!ID.test(id || '')) throw new Error('Unknown keyword');
    const k = sessions.keyword(id);
    let summary = null;
    try { summary = (await sessions.learn(id)).summary?.extract || null; } catch { /* term only */ }
    return { term: k.term, domain: k.domainLabel || k.domain, summary };
  };
  handle('ai:status', () => ai.status());
  handle('ai:grade', async (id, text) => ai.grade({ ...(await aiTopic(id)), explanation: str(text, 4000) }));
  handle('ai:socratic', async (id, history) => ai.socratic({
    ...(await aiTopic(id)),
    history: (Array.isArray(history) ? history : []).slice(-20).map((t) => ({ who: t?.who === 'tutor' ? 'tutor' : 'you', text: str(t?.text, 1200) })),
  }));
  handle('ai:riddle', async (id) => ai.riddle(await aiTopic(id)));
  handle('ai:questions', async (id, count) => ai.questions({ ...(await aiTopic(id)), count: num(count, 1, 6, 4) }));

  handle('srs:queue', (limit) => srs.queue(num(limit, 1, 200, 50)));
  handle('srs:review', (id, grade, elapsedMs) => {
    const r = srs.review(cardId(id), num(grade, 1, 4, 3), num(elapsedMs, 0, 3600000, 0));
    stats.recordReview(Number(elapsedMs) || 0);
    return r;
  });
  handle('srs:stats', () => srs.stats());
  handle('srs:cards', () => learning.allCards().map((c) => ({ id: c.id, front: c.front, back: c.back, createdAt: c.createdAt, due: c.fsrs?.due || null, keywordId: c.keywordId })).reverse());
  handle('srs:delete', (id) => learning.deleteCard(cardId(id)));

  // --- adaptivity: what the Daily Mix planner needs, streaks, the curiosity map
  handle('mix:context', () => {
    const now = Date.now();
    const since = now - 7 * 24 * 3600 * 1000;
    const recent = stats.history().filter((h) => h.at >= since).map((h) => ({ gameId: h.gameId, at: h.at }));
    const explored = stats.data.keywords;
    const recentDomains = [...new Set(Object.values(explored).filter((k) => k.last >= now - 3 * 24 * 3600 * 1000).map((k) => k.domain))];
    const s = store.get();
    return { now, recent, ratings: ratings.all(), reviewsDue: srs.stats().dueNow, hasCards: learning.cardCount() > 0, recentDomains, offline: s.offlineMode, minutes: s.sessionMinutes };
  });
  handle('stats:days', (n) => stats.recentDays(num(n, 7, 365, 30)));
  handle('stats:extra', () => ({ gameCounts: stats.gameCounts(), watched: media.list().filter((v) => v.watchedAt).length, recalled: media.list().filter((v) => v.recall?.main).length, queued: media.list().filter((v) => !v.watchedAt).length }));
  handle('stats:streak', () => stats.streak(store.get().restDaysPerWeek));
  handle('stats:curiosity', () => curiosityMap({ bank, explored: stats.data.keywords, now: Date.now() }));

  handle('engine:status', () => engines.status());
  ipcMain.handle('engine:install', async (e) => {
    let last = 0;
    return engines.install((p) => {
      const now = Date.now();
      if (now - last < 100 && p.received < p.total) return;
      last = now;
      if (!e.sender.isDestroyed()) e.sender.send('engine:progress', p);
    });
  });
  handle('engine:remove', () => engines.remove());
  handle('providers:list', () => ({ offline: store.get().offlineMode, providers: providers.list() }));
  handle('cache:size', () => cache.sizeBytes());
  handle('cache:clear', () => {
    cache.clear();
    return true;
  });

  // --- games, stats, ratings
  handle('rating:suggest', (skills) => ratings.suggest(Array.isArray(skills) ? skills : [], store.get().difficultyBias));
  handle('rating:all', () => ratings.all());
  handle('stats:record', (result, meta) => {
    if (validateMeta(meta).length) throw new Error('Invalid game meta');
    const r = normalizeResult(result || {}, meta);
    const { newBest } = stats.record(r);
    const changes = ratings.record(r);
    return { result: r, newBest, changes };
  });
  handle('stats:summary', () => ({ ...stats.summary(), ratings: ratings.all() }));
  handle('stats:reset', () => {
    stats.reset();
    ratings.reset();
    return true;
  });
  handle('stats:export', async (format) => {
    const csv = format === 'csv';
    const { canceled, filePath } = await dialog.showSaveDialog(getWindow(), {
      title: 'Export Mind Gym stats',
      defaultPath: `mind-gym-${dateKey()}.${csv ? 'csv' : 'json'}`,
      filters: [csv ? { name: 'CSV', extensions: ['csv'] } : { name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return null;
    const body = csv ? stats.exportCsv() : JSON.stringify({ ...stats.exportJson(ratings.all()), cards: learning.allCards(), reviews: srs.log(), watch: media.list(), learnedSessions: learning.sessions() }, null, 2);
    await fs.promises.writeFile(filePath, body);
    return filePath;
  });

  // --- app
  handle('app:info', () => ({ version: app.getVersion(), packaged: app.isPackaged, platform: process.platform }));
  handle('app:openExternal', (url) => {
    if (!isAllowedLink(url)) return false;
    shell.openExternal(url);
    return true;
  });
  handle('updater:state', () => updater.state());
  handle('updater:check', () => updater.check());
  handle('updater:install', () => updater.install());
  handle('window:fullscreen', (on) => guard.setFullscreen(Boolean(on)));
  handle('window:toggleMaximize', () => guard.toggleMaximize());
}

module.exports = { registerIpc };
