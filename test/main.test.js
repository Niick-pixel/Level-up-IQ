// Main-process modules that don't need Electron: store, stats, ratings, protocol paths, links,
// window guard.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store, DEFAULTS } = require('../src/main/store');
const { Stats } = require('../src/main/stats');
const { Ratings, expected } = require('../src/main/rating');
const { resolvePath } = require('../src/main/protocol');
const { isAllowedLink } = require('../src/main/links');
const { coversMonitor, safeBounds } = require('../src/main/window-guard');
const { localDateKey } = require('../src/shared/rng.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mindgym-'));

test('store: defaults, sanitizing and persistence', () => {
  const dir = tmp();
  const s = new Store(dir);
  assert.deepEqual(s.get(), DEFAULTS);
  assert.equal(DEFAULTS.trayIcon, false);
  assert.equal(DEFAULTS.launchAtLogin, false);
  assert.equal(DEFAULTS.dailyReminder, false);
  assert.equal(DEFAULTS.allowFullscreen, false);
  s.set({ theme: 'sand', thinkingTimerSec: 9999, bogus: 1, theme2: 'x', difficultyBias: '1', dailyReminderTime: '25:00' });
  const again = new Store(dir).get();
  assert.equal(again.theme, 'sand');
  assert.equal(again.thinkingTimerSec, 300);
  assert.equal(again.difficultyBias, 1);
  assert.equal(again.dailyReminderTime, '19:00');
  assert.ok(!('bogus' in again));
  s.set({ theme: 'neon' });
  assert.equal(s.get().theme, 'sand');
});

test('store: survives a corrupt file', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'settings.json'), '{oops');
  assert.deepEqual(new Store(dir).get(), DEFAULTS);
});

function statsAt(dir) {
  let now = new Date(2026, 8, 21, 9, 0).getTime();
  const stats = new Stats(dir, { now: () => now, dateKey: localDateKey });
  return { stats, advance: (ms) => { now += ms; } };
}
const result = (over = {}) => ({
  gameId: 'stroop', skills: ['attention'], difficulty: 3, score: 100, accuracy: 0.9, performance: 0.8, timeMs: 60000, seed: 'x', ...over,
});

test('stats: per-day totals, sessions and personal bests', () => {
  const { stats, advance } = statsAt(null);
  assert.equal(stats.record(result()).newBest, true);
  advance(5 * 60000);
  assert.equal(stats.record(result({ score: 50 })).newBest, false);
  advance(2 * 3600000); // long gap → new session
  assert.equal(stats.record(result({ score: 150, gameId: 'nback', skills: ['memory', 'attention'] })).newBest, true);
  const today = stats.summary().today;
  assert.equal(today.games, 3);
  assert.equal(today.sessions, 2);
  assert.equal(today.ms, 180000);
  assert.equal(today.noAiMs, 180000);
  assert.deepEqual(today.bySkill, { attention: 3, memory: 1 });
  assert.equal(stats.summary().bests.stroop.score, 100);
  assert.equal(stats.history().length, 3);
});

test('stats: history and aggregates persist; CSV export escapes', () => {
  const dir = tmp();
  const { stats } = statsAt(dir);
  stats.record(result({ seed: 'a,"b"' }));
  stats.exploreKeyword('entropy', 'physics');
  stats.exploreKeyword('entropy', 'physics');
  const { stats: again } = statsAt(dir);
  assert.equal(again.history().length, 1);
  assert.deepEqual(again.domainCounts(), { physics: 1 });
  const csv = again.exportCsv().split('\n');
  assert.match(csv[0], /^at,date,gameId/);
  assert.match(csv[1], /"a,""b"""/);
  again.reset();
  assert.equal(again.history().length, 0);
});

test('stats: recent days cover 14 calendar days ending today', () => {
  const { stats } = statsAt(null);
  const days = stats.recentDays(14);
  assert.equal(days.length, 14);
  assert.equal(days.at(-1).date, '2026-09-21');
  assert.equal(days[0].date, '2026-09-08');
});

test('ratings: winning raises, losing lowers, and suggestions follow', () => {
  const r = new Ratings(null, { now: () => 0, dateKey: () => '2026-09-21' });
  const d0 = r.suggest(['attention']);
  for (let i = 0; i < 15; i++) r.record({ skills: ['attention'], difficulty: 5, performance: 1 });
  assert.ok(r.get('attention') > 1400);
  assert.ok(r.suggest(['attention']) > d0);
  for (let i = 0; i < 30; i++) r.record({ skills: ['attention'], difficulty: 5, performance: 0 });
  assert.ok(r.get('attention') < 1200);
  assert.equal(r.all().attention.history.length, 1); // one point per day
});

test('ratings: secondary skills move half as much; bias shifts difficulty', () => {
  const r = new Ratings(null, { now: () => 0, dateKey: () => 'd' });
  const c = r.record({ skills: ['memory', 'attention'], difficulty: 3, performance: 1 });
  const dm = c.memory.after - c.memory.before;
  const da = c.attention.after - c.attention.before;
  assert.ok(Math.abs(dm - 2 * da) <= 1);
  assert.ok(r.suggest(['math'], 2) > r.suggest(['math'], -2));
  // the suggested level aims near 75 % expected success
  const d = r.suggest(['math'], 0);
  assert.ok(Math.abs(expected(r.get('math'), d) - 0.75) < 0.15);
});

test('protocol: only files inside the mounted folders are served', () => {
  const root = path.join(__dirname, '..');
  assert.equal(resolvePath('/'), path.join(root, 'src', 'renderer', 'index.html'));
  assert.equal(resolvePath('/views/home.js'), path.join(root, 'src', 'renderer', 'views', 'home.js'));
  assert.equal(resolvePath('/shared/rng.js'), path.join(root, 'src', 'shared', 'rng.js'));
  assert.equal(resolvePath('/assets/keywords.json'), path.join(root, 'assets', 'keywords.json'));
  assert.equal(resolvePath('/../package.json'), null);
  assert.equal(resolvePath('/%2e%2e/%2e%2e/package.json'), null);
  assert.equal(resolvePath('/shared/..%2f..%2fmain/main.js'), null);
  assert.equal(resolvePath('/%E0%A4%A'), null);
});

test('links: only https to known sites', () => {
  assert.ok(isAllowedLink('https://en.wikipedia.org/wiki/Entropy'));
  assert.ok(isAllowedLink('https://es.wikipedia.org/wiki/Entrop%C3%ADa'));
  assert.ok(isAllowedLink('https://projecteuler.net/'));
  assert.ok(!isAllowedLink('http://en.wikipedia.org/wiki/Entropy'));
  assert.ok(!isAllowedLink('https://evilwikipedia.org/'));
  assert.ok(!isAllowedLink('https://wikipedia.org.evil.com/'));
  assert.ok(!isAllowedLink('file:///C:/Windows'));
  assert.ok(!isAllowedLink('https://user:pw@github.com/'));
  assert.ok(!isAllowedLink('not a url'));
});

test('window guard: detects displays where maximized = fullscreen for Focus Point', () => {
  const withTaskbar = { bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1032 } };
  const autoHide = { bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1080 } };
  const second = { bounds: { x: 1920, y: 0, width: 2560, height: 1440 }, workArea: { x: 1920, y: 0, width: 2560, height: 1440 } };
  assert.equal(coversMonitor(withTaskbar), false);
  assert.equal(coversMonitor(autoHide), true);
  assert.equal(coversMonitor(second), true);
  const b = safeBounds(autoHide);
  assert.equal(b.height, 1079);
  // Focus Point's check: window rect covers the monitor rect
  const fpFullscreen = (w, m) => w.x <= m.x && w.y <= m.y && w.x + w.width >= m.x + m.width && w.y + w.height >= m.y + m.height;
  assert.equal(fpFullscreen(b, autoHide.bounds), false);
});
