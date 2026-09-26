const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { KeywordBank } = require('../src/main/keywords');
const { build, DOMAINS } = require('../scripts/build-keywords');
const { makeRng } = require('../src/shared/rng.js');

const bank = KeywordBank.load();

test('the shards build cleanly and keywords.json is up to date', () => {
  const { errors, bank: built } = build();
  assert.deepEqual(errors, []);
  const onDisk = fs.readFileSync(path.join(__dirname, '..', 'assets', 'keywords.json'), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(onDisk, JSON.stringify(built, null, 1) + '\n', 'run: npm run keywords:build');
});

test('bank size and shape', () => {
  assert.ok(bank.keywords.length >= 500, `only ${bank.keywords.length}`);
  assert.equal(bank.domains.length, 33);
  for (const d of DOMAINS) assert.ok(bank.keywords.filter((k) => k.domain === d.id).length >= 12, d.id);
  for (const k of bank.keywords) {
    assert.match(k.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(k.difficulty >= 1 && k.difficulty <= 5);
    assert.ok(k.term && k.wikipedia);
    for (const r of k.related) assert.ok(bank.get(r), `${k.id} → ${r}`);
  }
});

test('search finds terms, aliases and typos', () => {
  assert.equal(bank.search('entropy')[0].id, 'entropy');
  assert.equal(bank.search('entorpy')[0].id, 'entropy');
  assert.ok(bank.search('spooky action').some((k) => k.id === 'quantum-entanglement'));
  assert.ok(bank.search('Genghis').some((k) => k.id === 'mongol-empire'));
  assert.ok(bank.search('costa rica').some((k) => k.domain === 'latin-america'));
});

test('search filters by domain and tag', () => {
  const r = bank.search('', { domain: 'music', limit: 100 });
  assert.ok(r.length > 10 && r.every((k) => k.domain === 'music'));
  const t = bank.search('', { tag: 'fallacies', limit: 100 });
  assert.ok(t.length >= 5 && t.every((k) => k.tags.includes('fallacies')));
});

test('random modes', () => {
  const rng = makeRng('kw');
  assert.equal(bank.random({ mode: 'domain', domain: 'film', rng }).domain, 'film');
  const next = bank.random({ mode: 'rabbit', fromId: 'entropy', rng });
  assert.ok(bank.get('entropy').related.includes(next.id));
  // comfort zone: with physics explored a lot, physics should be rare
  const counts = { physics: 50 };
  let physics = 0;
  for (let i = 0; i < 300; i++) if (bank.random({ mode: 'comfort', domainCounts: counts, rng }).domain === 'physics') physics++;
  assert.ok(physics < 5, `physics picked ${physics} times`);
});

test('keyword of the day is stable per date and varies across dates', () => {
  assert.equal(bank.ofTheDay('2026-09-26').id, bank.ofTheDay('2026-09-26').id);
  const week = new Set(['01', '02', '03', '04', '05', '06', '07'].map((d) => bank.ofTheDay(`2026-10-${d}`).id));
  assert.ok(week.size >= 5);
});

test('neighbours include both directions of the related graph', () => {
  const n = bank.neighbours('dark-energy').map((k) => k.id);
  assert.ok(n.includes('dark-matter'));
  assert.ok(bank.neighbours('hubbles-law').some((k) => k.id === 'big-bang')); // big-bang lists hubbles-law
});
