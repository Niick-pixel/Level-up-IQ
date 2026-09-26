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
  ipcMain, app, shell, dialog, store, stats, ratings, bank, updater, dateKey, getWindow, guard,
  onSettingsChanged,
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
