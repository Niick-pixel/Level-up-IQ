// Phase 2: cache, rate limiter, provider pipeline, the four providers (against recorded
// fixtures), quiz building, explain-it-back and the keyword session. The network is always mocked.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DiskCache } = require('../src/main/cache');
const { Limiter } = require('../src/main/providers/limiter');
const { Provider } = require('../src/main/providers/provider');
const { createProviders } = require('../src/main/providers/registry');
const { mapQids } = require('../src/main/providers/wikipedia');
const { parseFacts, yearOf, factsQuery } = require('../src/main/providers/wikidata');
const { decodeQuestion, CATEGORY } = require('../src/main/providers/opentdb');
const { buildQuiz, sentences, yearDistractors } = require('../src/main/quiz');
const { compareExplanation, stem } = require('../src/main/explain');
const { KeywordSessions } = require('../src/main/session');
const { Learning } = require('../src/main/learning');
const { Stats } = require('../src/main/stats');
const { Ratings } = require('../src/main/rating');
const { KeywordBank } = require('../src/main/keywords');
const { DOMAINS } = require('../scripts/build-keywords');
const { makeRng, localDateKey } = require('../src/shared/rng.js');

const fixture = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mindgym-'));

/** A fake fetch: routes by substring, records calls. */
function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    for (const [match, reply] of routes) {
      if (url.includes(match)) {
        const r = typeof reply === 'function' ? reply(url) : reply;
        if (r instanceof Error) throw r;
        const status = r.status ?? 200;
        const headers = new Map(Object.entries(r.headers || { 'content-type': 'application/json' }));
        return {
          ok: status >= 200 && status < 300,
          status,
          url: r.url || url,
          headers: { get: (k) => headers.get(k.toLowerCase()) ?? null },
          json: async () => (typeof r.body === 'string' ? JSON.parse(r.body) : r.body),
          arrayBuffer: async () => (r.bytes || Buffer.from('')).buffer,
        };
      }
    }
    throw new Error(`no route for ${url}`);
  };
  fn.calls = calls;
  return fn;
}

function deps(over = {}) {
  let now = 1_000_000;
  return {
    cache: new DiskCache(null, { now: () => now }),
    now: () => now,
    advance: (ms) => { now += ms; },
    sleep: async (ms) => { now += ms; },
    userAgent: 'MindGym/test (+https://github.com/Niick-pixel/Level-up-IQ)',
    isOnline: () => true,
    getSettings: () => ({ offlineMode: false, providers: {} }),
    ...over,
  };
}

// ---------------------------------------------------------------- cache

test('cache: fresh, stale and missing entries', () => {
  let now = 0;
  const c = new DiskCache(tmp(), { now: () => now });
  assert.equal(c.get('a'), null);
  c.set('a', { x: 1 }, 1000);
  assert.deepEqual(c.get('a'), { value: { x: 1 }, storedAt: 0, stale: false });
  now = 1500;
  assert.equal(c.get('a').stale, true); // still served, marked stale
  const again = new DiskCache(c.dir, { now: () => now });
  assert.deepEqual(again.get('a').value, { x: 1 }); // survives a restart
});

test('cache: images round-trip and bad hashes are refused', () => {
  const c = new DiskCache(tmp());
  const hash = c.setImage('https://upload.wikimedia.org/x.png', Buffer.from([1, 2, 3]), 'image/png');
  assert.match(hash, /^[0-9a-f]{40}$/);
  assert.deepEqual([...c.getImage(hash).buffer], [1, 2, 3]);
  assert.equal(c.getImage('../../etc/passwd'), null);
  assert.equal(c.hasImage('https://upload.wikimedia.org/x.png'), hash);
});

test('cache: pruning drops the least recently used files first', () => {
  let now = 1_700_000_000_000;
  const c = new DiskCache(tmp(), { now: () => now, maxBytes: 2500 });
  for (let i = 0; i < 5; i++) {
    c.set(`k${i}`, 'x'.repeat(900), 1e9);
    now += 1000;
  }
  c.prune();
  assert.ok(c.sizeBytes() <= 2500);
  assert.equal(c.get('k0'), null);
  assert.ok(c.get('k4'));
  c.clear();
  assert.equal(c.sizeBytes(), 0);
});

// ---------------------------------------------------------------- limiter

test('limiter: spaces requests and caps concurrency', async () => {
  let now = 0;
  const starts = [];
  const lim = new Limiter({ minIntervalMs: 5000, concurrency: 1, now: () => now, sleep: async (ms) => { now += ms; } });
  await Promise.all([1, 2, 3].map(() => lim.schedule(async () => { starts.push(now); })));
  assert.deepEqual(starts, [0, 5000, 10000]);
});

test('limiter: concurrency 2 runs two at once', async () => {
  let active = 0, peak = 0;
  const lim = new Limiter({ minIntervalMs: 0, concurrency: 2 });
  await Promise.all(Array.from({ length: 6 }, () => lim.schedule(async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 5));
    active--;
  })));
  assert.equal(peak, 2);
});

// ---------------------------------------------------------------- provider pipeline

function testProvider(d, extra = {}) {
  return new Provider({ id: 'demo', name: 'Demo', hosts: ['api.example.org'], minIntervalMs: 0, ttlMs: 1000, ...extra }, d);
}

test('provider: sends our User-Agent, caches, and serves from cache', async () => {
  const d = deps();
  d.fetch = fakeFetch([['api.example.org', { body: { ok: 1 } }]]);
  const p = testProvider(d);
  const a = await p.getJson('https://api.example.org/x');
  const b = await p.getJson('https://api.example.org/x');
  assert.equal(a.fromCache, false);
  assert.equal(b.fromCache, true);
  assert.equal(d.fetch.calls.length, 1);
  assert.match(d.fetch.calls[0].opts.headers['User-Agent'], /^MindGym\/.+github\.com/);
});

test('provider: refuses hosts outside its allowlist, including after redirects', async () => {
  const d = deps();
  d.fetch = fakeFetch([['api.example.org', { body: {}, url: 'https://evil.example.com/x' }]]);
  const p = testProvider(d);
  await assert.rejects(p.getJson('https://evil.example.com/x'), /may not contact/);
  await assert.rejects(p.getJson('https://api.example.org/redirected'), /may not contact evil/);
});

test('provider: offline falls back to a stale copy, or fails clearly', async () => {
  let online = true;
  const d = deps({ isOnline: () => online });
  d.fetch = fakeFetch([['api.example.org', { body: { v: 1 } }]]);
  const p = testProvider(d);
  await p.getJson('https://api.example.org/a');
  d.advance(5000); // now stale
  online = false;
  const r = await p.getJson('https://api.example.org/a');
  assert.deepEqual([r.data.v, r.stale], [1, true]);
  await assert.rejects(p.getJson('https://api.example.org/never-cached'), (e) => e.code === 'offline');
  assert.equal(d.fetch.calls.length, 1);
});

test('provider: network errors fall back to stale data', async () => {
  const d = deps();
  let fail = false;
  d.fetch = fakeFetch([['api.example.org', () => (fail ? new Error('ECONNRESET') : { body: { v: 2 } })]]);
  const p = testProvider(d);
  await p.getJson('https://api.example.org/a');
  d.advance(5000);
  fail = true;
  assert.equal((await p.getJson('https://api.example.org/a')).stale, true);
  await assert.rejects(p.getJson('https://api.example.org/b'), (e) => e.code === 'network');
});

test('provider: a 429 locks it out for Retry-After (or the default) and requests stop', async () => {
  const d = deps();
  d.fetch = fakeFetch([['api.example.org', { status: 429, body: {}, headers: { 'retry-after': '30' } }]]);
  const p = testProvider(d, { lockoutMs: 60000 });
  await assert.rejects(p.getJson('https://api.example.org/a'), (e) => e.code === 'locked');
  assert.equal(p.isAvailable(), false);
  await assert.rejects(p.getJson('https://api.example.org/b'), (e) => e.code === 'locked');
  assert.equal(d.fetch.calls.length, 1); // didn't hammer it
  d.advance(31000);
  assert.equal(p.isAvailable(), true);
});

test('provider: disabled in settings means no requests at all', async () => {
  const d = deps({ getSettings: () => ({ offlineMode: false, providers: { wikipedia: false } }) });
  d.fetch = fakeFetch([]);
  const ps = createProviders(d);
  await assert.rejects(ps.wikipedia.summary('Entropy'), (e) => e.code === 'disabled');
  const offline = createProviders({ ...deps({ getSettings: () => ({ offlineMode: true, providers: {} }) }), fetch: fakeFetch([]) });
  await assert.rejects(offline.lichess.daily(), (e) => e.code === 'disabled');
  assert.equal(d.fetch.calls.length, 0);
  assert.deepEqual(ps.hosts().sort(), ['en.wikipedia.org', 'lichess.org', 'opentdb.com', 'query.wikidata.org', 'upload.wikimedia.org']);
});

// ---------------------------------------------------------------- providers

test('wikipedia: summary is reduced to plain text fields', async () => {
  const d = deps();
  d.fetch = fakeFetch([['/page/summary/Entropy', { body: fixture('wikipedia-summary-entropy.json') }]]);
  const { wikipedia } = createProviders(d);
  const s = await wikipedia.summary('Entropy');
  assert.equal(s.title, 'Entropy');
  assert.equal(s.qid, 'Q45003');
  assert.equal(s.url, 'https://en.wikipedia.org/wiki/Entropy');
  assert.match(s.thumbnail, /^https:\/\/upload\.wikimedia\.org\//);
  assert.ok(!('extract_html' in s));
  assert.ok(!/</.test(s.extract));
});

test('wikipedia: titles with spaces and symbols are encoded safely', async () => {
  const d = deps();
  d.fetch = fakeFetch([['/page/summary/', { body: fixture('wikipedia-summary-entropy.json') }]]);
  const { wikipedia } = createProviders(d);
  await wikipedia.summary('Hilbert\'s paradox of the Grand Hotel');
  await wikipedia.summary('4′33″');
  await wikipedia.summary('AC/DC');
  const urls = d.fetch.calls.map((c) => c.url);
  assert.equal(urls[0], 'https://en.wikipedia.org/api/rest_v1/page/summary/Hilbert\'s_paradox_of_the_Grand_Hotel');
  assert.match(urls[1], /summary\/4%E2%80%B233%E2%80%B3$/);
  assert.match(urls[2], /summary\/AC%2FDC$/);
});

test('wikipedia: on this day, search and pageprops parsing', async () => {
  const d = deps();
  d.fetch = fakeFetch([
    ['/feed/onthisday/events/', { body: fixture('wikipedia-onthisday.json') }],
    ['action=opensearch', { body: fixture('wikipedia-opensearch.json') }],
  ]);
  const { wikipedia } = createProviders(d);
  const events = await wikipedia.onThisDay(new Date(2026, 8, 5));
  assert.equal(events.length, 2); // the malformed one is dropped
  assert.equal(events[0].year, 1977);
  assert.equal(events[0].pages[0].title, 'Voyager Golden Record');
  assert.match(d.fetch.calls[0].url, /onthisday\/events\/09\/05$/);
  const results = await wikipedia.search('tardi');
  assert.deepEqual(results.map((r) => r.title), ['Tardigrade', 'Tardiness', 'Tardis']);
  const q = mapQids(['entropy', 'Pangea', 'Not a real article xyz', 'Never asked'], fixture('wikipedia-pageprops.json'));
  assert.deepEqual(q, { entropy: 'Q45003', Pangea: 'Q36125', 'Not a real article xyz': null, 'Never asked': null });
});

test('wikidata: year facts respect precision, keep the earliest, and skip unlabelled items', () => {
  const facts = parseFacts(fixture('wikidata-facts.json'));
  const byProp = Object.fromEntries(facts.map((f) => [f.prop, f]));
  assert.equal(byProp.P577.year, 1605); // earliest of two
  assert.equal(byProp.P571, undefined); // century precision: skipped
  assert.equal(byProp.P50.display, 'Miguel de Cervantes');
  assert.equal(byProp.P17, undefined); // label was just a Q-id
  assert.equal(byProp.P585.display, '480 BC');
  assert.equal(yearOf('+2001-09-11T00:00:00Z'), 2001);
  assert.match(factsQuery('Q42'), /wd:Q42 \?claim/);
  assert.equal(facts.filter((f) => f.prop === 'P577').length, 1);
});

test('wikidata: invalid ids never reach the network', async () => {
  const d = deps();
  d.fetch = fakeFetch([]);
  const { wikidata } = createProviders(d);
  assert.deepEqual(await wikidata.facts('Q1 } DROP'), []);
  assert.deepEqual(await wikidata.facts(null), []);
  assert.equal(d.fetch.calls.length, 0);
});

test('opentdb: token, url3986 decoding, category map, and token refresh', async () => {
  const d = deps();
  let exhausted = true;
  d.fetch = fakeFetch([
    ['api_token.php', { body: fixture('opentdb-token.json') }],
    ['api.php', () => {
      if (exhausted) { exhausted = false; return { body: { response_code: 4, results: [] } }; }
      return { body: fixture('opentdb-questions.json') };
    }],
  ]);
  const { opentdb } = createProviders(d);
  const qs = await opentdb.questions('chemistry', 2);
  assert.equal(qs[0].question, 'What is the chemical symbol for "gold"?');
  assert.equal(qs[0].category, 'Science & Nature');
  assert.equal(qs[0].correct, 'Au');
  assert.equal(d.fetch.calls.filter((c) => c.url.includes('api_token')).length, 2); // new token after code 4
  assert.match(d.fetch.calls.find((c) => c.url.includes('api.php?')).url, /category=17/);
  for (const dom of DOMAINS) assert.ok(Number.isInteger(CATEGORY[dom.id]), dom.id);
  assert.deepEqual(decodeQuestion({ category: 'A%26B', difficulty: 'easy', type: 'multiple', question: 'Q', correct_answer: 'x', incorrect_answers: ['y%20z'] }).incorrect, ['y z']);
});

test('lichess: daily puzzle, one request at a time', async () => {
  const d = deps();
  d.fetch = fakeFetch([['/api/puzzle/daily', { body: fixture('lichess-daily.json') }]]);
  const { lichess } = createProviders(d);
  const p = await lichess.daily();
  assert.deepEqual([p.id, p.rating, p.url], ['K69di', 1873, 'https://lichess.org/training/K69di']);
  assert.equal(lichess.concurrency, 1);
  assert.equal(lichess.lockoutMs, 60000);
  assert.equal(await lichess.byId('../../x'), null);
});

// ---------------------------------------------------------------- quiz & explain

const bank = KeywordBank.load();
const summary = { ...fixture('wikipedia-summary-entropy.json'), url: 'https://en.wikipedia.org/wiki/Entropy', qid: 'Q45003' };

test('quiz: offline (bank only) still gives at least 5 valid questions for every keyword', () => {
  for (const k of bank.keywords) {
    const qs = buildQuiz({ keyword: k, bank, rng: makeRng(`q-${k.id}`), thisYear: 2026 });
    assert.ok(qs.length >= 5, `${k.id}: ${qs.length}`);
    for (const q of qs) {
      assert.equal(q.options.length, 4, `${k.id} ${q.kind}`);
      assert.equal(new Set(q.options.map((o) => o.toLowerCase())).size, 4, `${k.id} duplicate options`);
      assert.ok(q.answer >= 0 && q.answer < 4);
    }
  }
});

test('quiz: uses the summary, facts and trivia when available', () => {
  const k = bank.get('entropy');
  const facts = [{ prop: 'P575', label: 'Discovered', kind: 'year', year: 1865, display: '1865' }];
  const trivia = fixture('opentdb-questions.json').results.map(decodeQuestion);
  const qs = buildQuiz({ keyword: k, bank, summary, facts, trivia, rng: makeRng('q'), thisYear: 2026 });
  const kinds = qs.map((q) => q.kind);
  assert.ok(kinds.includes('definition'));
  assert.ok(kinds.includes('fact'));
  assert.ok(kinds.includes('trivia'));
  assert.ok(qs.length >= 5 && qs.length <= 8);
  const def = qs.find((q) => q.kind === 'definition');
  assert.ok(!/entropy/i.test(def.prompt), 'the answer must not appear in the prompt');
  assert.equal(def.options[def.answer], 'Entropy');
  const fact = qs.find((q) => q.kind === 'fact');
  assert.equal(fact.options[fact.answer], '1865');
  assert.ok(fact.options.every((o) => Number(o) <= 2026));
});

test('quiz: same seed, same quiz', () => {
  const k = bank.get('entropy');
  const a = buildQuiz({ keyword: k, bank, summary, rng: makeRng('same'), thisYear: 2026 });
  const b = buildQuiz({ keyword: k, bank, summary, rng: makeRng('same'), thisYear: 2026 });
  assert.deepEqual(a, b);
});

test('quiz helpers: sentences and year distractors', () => {
  assert.equal(sentences(summary.extract).length, 4);
  const ds = yearDistractors(makeRng('y'), 1865, 2026);
  assert.equal(new Set(ds).size, 3);
  assert.ok(!ds.includes(1865));
  assert.ok(yearDistractors(makeRng('y2'), 2025, 2026).every((y) => y <= 2026));
});

test('explain it back: rewards covering the key ideas, ignores the topic name itself', () => {
  const good = 'Entropy measures disorder and randomness in a system. It started in classical thermodynamics with Clausius and heat, and it also appears in statistical physics and information theory, describing uncertainty.';
  const weak = 'Entropy is entropy. It is a word.';
  const g = compareExplanation(good, summary.extract, ['Entropy']);
  const w = compareExplanation(weak, summary.extract, ['Entropy']);
  assert.ok(g.score > 0.3, `good ${g.score}`);
  assert.ok(w.score < 0.1, `weak ${w.score}`);
  assert.ok(g.matched.includes('thermodynamics') || g.matched.includes('thermodynamic'));
  assert.ok(!g.matched.concat(g.missed).includes('entropy'));
  assert.equal(stem('decays'), stem('decay'));
  assert.equal(stem('evolved'), stem('evolve'));
});

// ---------------------------------------------------------------- session

function sessionRig({ online = true } = {}) {
  const d = deps({ isOnline: () => online });
  d.fetch = fakeFetch([
    ['/page/summary/', { body: fixture('wikipedia-summary-entropy.json') }],
    ['upload.wikimedia.org', { bytes: Buffer.from([137, 80, 78, 71]), headers: { 'content-type': 'image/png' } }],
    ['query.wikidata.org', { body: fixture('wikidata-facts.json') }],
    ['api_token.php', { body: fixture('opentdb-token.json') }],
    ['opentdb.com/api.php', { body: fixture('opentdb-questions.json') }],
    ['/feed/onthisday/', { body: fixture('wikipedia-onthisday.json') }],
    ['/api/puzzle/daily', { body: fixture('lichess-daily.json') }],
    ['prop=links', { body: { query: { pages: [{ title: 'Entropy', links: [{ ns: 0, title: 'Heat death of the universe' }, { ns: 0, title: 'Boltzmann constant' }, { ns: 0, title: 'List of thermodynamic properties' }] }] } } }],
  ]);
  const providers = createProviders(d);
  const b = KeywordBank.load();
  const learning = new Learning(null, { now: d.now });
  const stats = new Stats(null, { now: d.now, dateKey: localDateKey });
  const ratings = new Ratings(null, { now: d.now, dateKey: localDateKey });
  const s = new KeywordSessions({ bank: b, providers, learning, stats, ratings, now: d.now });
  return { s, d, learning, stats, bank: b };
}

test('session: learn gathers summary, cached image and facts with attribution', async () => {
  const { s } = sessionRig();
  const r = await s.learn('entropy');
  assert.equal(r.summary.title, 'Entropy');
  assert.match(r.image, /^mg-cache:\/\/img\/[0-9a-f]{40}$/);
  assert.ok(r.facts.length >= 1);
  assert.deepEqual(r.attribution.map((a) => a.name), ['Wikipedia', 'Wikidata']);
});

test('session: fully offline still works end to end', async () => {
  const { s, d, learning } = sessionRig({ online: false });
  const r = await s.learn('pangaea');
  assert.equal(r.summary, null);
  assert.ok(r.notes.length);
  const { questions } = await s.quiz('pangaea', 'seed');
  assert.ok(questions.length >= 5);
  assert.equal(await s.compare('pangaea', 'some text here'), null);
  const done = await s.finish('pangaea', { quizCorrect: 3, quizTotal: 5, activeMs: 60000, predicted: true });
  assert.equal(done.result.accuracy, 0.6);
  assert.ok(learning.cardCount() >= 1); // the related-topics card
  assert.equal(d.fetch.calls.length, 0);
});

test('session: finish saves cards once, stats and ratings', async () => {
  const { s, learning, stats } = sessionRig();
  await s.learn('entropy');
  const done = await s.finish('entropy', { quizCorrect: 4, quizTotal: 5, explainScore: 0.5, activeMs: 300000, predicted: true, explained: true });
  assert.ok(done.cards.length >= 2);
  assert.ok(done.changes.knowledge && done.changes['deep-thinking']);
  assert.equal(stats.summary().today.games, 1);
  assert.equal(stats.data.keywords.entropy.bestQuiz, 0.8);
  const again = await s.finish('entropy', { quizCorrect: 5, quizTotal: 5 });
  assert.equal(again.cards.length, 0); // no duplicate cards
  assert.equal(learning.sessions().length, 2);
});

test('session: puzzle tie-ins, home extras and suggestions', async () => {
  const { s } = sessionRig();
  assert.equal(s.puzzleFor('entropy'), 'mental-math');
  assert.equal(s.puzzleFor('stroop-effect'), 'stroop');
  assert.equal(s.puzzleFor('mona-lisa'), 'schulte');
  const extras = await s.homeExtras('2026-09-05');
  assert.equal(extras.onThisDay.keywordId, 'voyager-golden-record'); // prefers events linked to the bank
  assert.equal(extras.dailyPuzzle.id, 'K69di');
  const sugg = await s.suggestions('entropy');
  assert.deepEqual(sugg, ['Boltzmann constant']); // known and "List of" pages filtered out
});

test('user keywords: added from Wikipedia, searchable, removable', () => {
  const learning = new Learning(tmp());
  const b = KeywordBank.load();
  const k = learning.addUserKeyword({ summary: { title: 'Pistol shrimp', description: 'Family of shrimp', qid: null, url: '' }, domain: 'nature', taken: (id) => Boolean(b.get(id)) });
  assert.equal(k.id, 'u-pistol-shrimp');
  b.add(k);
  assert.equal(b.search('Pistol shrimp')[0].id, 'u-pistol-shrimp');
  const reloaded = new Learning(learning.userFile.replace(/user-keywords\.json$/, ''));
  assert.equal(reloaded.userKeywords().length, 1);
  assert.equal(b.remove('u-pistol-shrimp'), true);
  assert.equal(b.remove('entropy'), false); // built-in keywords can't be removed
  assert.equal(learning.removeUserKeyword('u-pistol-shrimp'), true);
});

test('countries pack: 195 countries, flags served, contested capitals kept out of quizzes', () => {
  const { build } = require('../scripts/build-countries');
  const { errors, countries } = build();
  assert.deepEqual(errors, []);
  assert.equal(countries.length, 195);
  const onDisk = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'packs', 'countries.json'), 'utf8'));
  assert.deepEqual(onDisk.countries, countries, 'run: npm run countries:build');
  assert.equal(countries.find((c) => c.iso2 === 'CR').capital, 'San José');
  assert.equal(countries.find((c) => c.iso2 === 'IL').capitalQuiz, false);
  assert.equal(countries.find((c) => c.iso2 === 'NR').capitalQuiz, false);
  const { resolvePath } = require('../src/main/protocol');
  assert.ok(fs.existsSync(resolvePath('/vendor/flags/4x3/cr.svg')));
  assert.equal(resolvePath('/vendor/flags/../../package.json'), null);
});
