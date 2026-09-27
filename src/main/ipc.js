// Every IPC handler in one place. Arguments from the renderer are validated here.
const fs = require('fs');
const { normalizeResult, validateMeta } = require('../shared/game-contract.js');
const { isAllowedLink } = require('./links');

const str = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
const ID = /^[a-z0-9-]{1,80}$/;

/**
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain
 */
function registerIpc({
  ipcMain, app, shell, dialog, store, stats, ratings, bank, updater, dateKey, getWindow, guard, engines, knowledge,
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
    const body = csv ? stats.exportCsv() : JSON.stringify(stats.exportJson(ratings.all()), null, 2);
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
