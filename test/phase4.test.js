// Phase 4: API keys, video sources, museums, iNaturalist, APOD, the watch list and recall.
// The network is always mocked.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Secrets } = require('../src/main/secrets');
const { DiskCache } = require('../src/main/cache');
const { createProviders } = require('../src/main/providers/registry');
const { parseFeed } = require('../src/main/providers/youtube-rss');
const { parseSearch: parseYt, DAILY_LIMIT } = require('../src/main/providers/youtube-api');
const { parseSearch: parseArchive } = require('../src/main/providers/archive');
const { normalizeObject } = require('../src/main/providers/met');
const { normalizeArtwork } = require('../src/main/providers/aic');
const { normalizeSpecies } = require('../src/main/providers/inaturalist');
const { normalizeLegacy, normalizeWp, LEGACY_END } = require('../src/main/providers/apod');
const { Media, matchScore } = require('../src/main/media');
const { Learning } = require('../src/main/learning');
const { KeywordBank } = require('../src/main/keywords');
const { CHANNELS, activeChannels } = require('../src/main/channels');
const { Store } = require('../src/main/store');
const { isAllowedLink } = require('../src/main/links');
const { makeRng } = require('../src/shared/rng.js');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
const json = (name) => JSON.parse(fixture(name));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mindgym-p4-'));

// A reversible stand-in for safeStorage.
const fakeSafe = (available = true) => ({
  isEncryptionAvailable: () => available,
  encryptString: (s) => Buffer.from(`enc:${Buffer.from(s).toString('base64')}`),
  decryptString: (b) => Buffer.from(String(b).slice(4), 'base64').toString(),
});

function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    for (const [match, reply] of routes) {
      if (!url.includes(match)) continue;
      const r = typeof reply === 'function' ? reply(url) : reply;
      const headers = new Map(Object.entries(r.headers || { 'content-type': 'application/json' }));
      return {
        ok: (r.status ?? 200) < 300, status: r.status ?? 200, url,
        headers: { get: (k) => headers.get(k.toLowerCase()) ?? null },
        json: async () => (typeof r.body === 'string' ? JSON.parse(r.body) : r.body),
        text: async () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)),
        arrayBuffer: async () => (r.bytes || Buffer.from('img')).buffer,
      };
    }
    throw new Error(`no route for ${url}`);
  };
  fn.calls = calls;
  return fn;
}

function providersWith(routes, over = {}) {
  const fetch = fakeFetch(routes);
  const providers = createProviders({
    fetch, cache: new DiskCache(null), userAgent: 'MindGymTest', isOnline: () => true, sleep: async () => {},
    getSettings: () => ({ offlineMode: false, providers: {} }), ...over,
  });
  return { providers, fetch };
}

// ---- secrets

test('secrets: stored encrypted, never exposed, removable', () => {
  const dir = tmp();
  const s = new Secrets(dir, fakeSafe());
  const key = 'AIzaSyA1234567890abcdefghijklmnopqrstu';
  const st = s.set('youtube', key);
  assert.equal(st.keys.youtube.set, true);
  assert.ok(!JSON.stringify(st).includes(key));
  const onDisk = fs.readFileSync(path.join(dir, 'secrets.bin'), 'utf8');
  assert.ok(!onDisk.includes(key));
  assert.equal(new Secrets(dir, fakeSafe()).get('youtube'), key);
  assert.throws(() => s.set('youtube', 'not a key!'), /doesn’t look like/);
  assert.throws(() => s.set('evil', 'x'), /Unknown key/);
  s.set('youtube', '');
  assert.equal(s.get('youtube'), null);
});

test('secrets: without system encryption, keys are refused (no plain-text fallback)', () => {
  const s = new Secrets(tmp(), fakeSafe(false));
  assert.throws(() => s.set('nasa', 'abcdefghijklmnopqrstuvwxyz'), /can’t encrypt/);
  assert.equal(s.status().available, false);
  assert.equal(s.get('nasa'), null);
});

// ---- YouTube

test('youtube rss: parses the feed, drops Shorts, links out only', () => {
  const { title, videos } = parseFeed(fixture('youtube-feed.xml'), { id: 'UCHnyfMqiRRG1u-2MsSQLbXA', name: 'Veritasium', domains: ['physics'] });
  assert.equal(title, 'Veritasium');
  assert.equal(videos.length, 2);
  assert.equal(videos[0].url, 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(videos[0].thumbnail, 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg');
  assert.deepEqual(videos[0].domains, ['physics']);
  assert.ok(!videos.some((v) => v.id === 'shortsShort'));
});

test('youtube rss: a failing feed falls back to its last good copy', async () => {
  let fail = false;
  let now = 1_000_000;
  const { providers } = providersWith([['feeds/videos.xml', () => (fail ? { status: 404, body: '' } : { body: fixture('youtube-feed.xml'), headers: { 'content-type': 'application/xml' } })]], {
    cache: new DiskCache(null, { now: () => now }), now: () => now,
  });
  const ch = CHANNELS[0];
  assert.equal((await providers.youtube.channel(ch)).videos.length, 2);
  fail = true;
  now += 7 * 3600 * 1000; // past the 6-hour freshness
  const again = await providers.youtube.channel(ch);
  assert.equal(again.videos.length, 2);
  assert.equal(again.stale, true);
});

test('youtube api: off without a key, daily cap, entities decoded', async () => {
  let key = null;
  const { providers, fetch } = providersWith([['googleapis.com/youtube', { body: json('youtube-search.json') }]], { getSecret: () => key });
  assert.equal(providers.youtubeapi.enabled(), false);
  await assert.rejects(providers.youtubeapi.search('entropy'), /No YouTube API key/);
  key = 'AIzaSyA1234567890abcdefghijklmnopqrstu';
  const r = await providers.youtubeapi.search('entropy');
  assert.equal(r[0].title, "What's entropy? & why it matters");
  assert.ok(fetch.calls[0].url.includes('safeSearch=strict'));
  providers.youtubeapi.count = DAILY_LIMIT;
  await providers.youtubeapi.search('entropy'); // cached: doesn't count
  await assert.rejects(providers.youtubeapi.search('something new'), /Daily search limit/);
  assert.equal(parseYt({ items: [{ id: { kind: 'youtube#channel' } }] }).length, 0);
});

// ---- Internet Archive

test('archive: only public-domain or CC items survive', () => {
  const films = parseArchive(json('archive-search.json'));
  assert.deepEqual(films.map((f) => f.id), ['pd_film', 'cc_by_film', 'prelinger_film']);
  assert.equal(films[0].license, 'Public Domain Mark');
  assert.equal(films[1].license, 'CC BY 4.0');
  assert.equal(films[2].license, 'Public domain (Prelinger Archives)');
  assert.equal(films[0].url, 'https://archive.org/details/pd_film');
});

// ---- museums, nature, space

test('met and aic: public-domain works with images only; AIC images send AIC-User-Agent', async () => {
  const met = json('met-object.json');
  assert.equal(normalizeObject(met).year, 1665);
  assert.equal(normalizeObject({ ...met, isPublicDomain: false }), null);
  assert.equal(normalizeObject({ ...met, primaryImageSmall: '' }), null);
  const aic = json('aic-search.json');
  const works = aic.data.map(normalizeArtwork).filter(Boolean);
  assert.equal(works.length, 1);
  assert.equal(works[0].imageUrl, 'https://www.artic.edu/iiif/2/abc-123/full/843,/0/default.jpg');
  const { providers, fetch } = providersWith([['artic.edu/iiif', { headers: { 'content-type': 'image/jpeg' }, bytes: Buffer.from('jpeg') }]]);
  assert.ok(await providers.aic.cacheImage(works[0].imageUrl));
  assert.equal(fetch.calls[0].opts.headers['AIC-User-Agent'], 'MindGymTest');
});

test('inaturalist: photos with restrictive licenses are skipped', () => {
  const list = json('inaturalist-species.json').results.map(normalizeSpecies).filter(Boolean);
  assert.deepEqual(list.map((s) => s.name), ['Resplendent Quetzal', 'Keel-billed Toucan']);
  assert.match(list[0].credit, /\(c\)/);
});

test('apod: images only, credit kept; new endpoint parsed defensively; legacy retired on 2026-12-01', async () => {
  const legacy = json('apod-legacy.json').map(normalizeLegacy).filter(Boolean);
  assert.equal(legacy.length, 1);
  assert.equal(legacy[0].credit, '© Jane Doe');
  assert.equal(legacy[0].url, 'https://apod.nasa.gov/apod/ap260101.html');
  assert.equal(normalizeWp({ title: { rendered: 'M31' }, content: { rendered: '<img src="https://apod.nasa.gov/apod/image/m31.jpg">' }, date: '2026-12-02T00:00:00' }).title, 'M31');
  assert.equal(normalizeWp({ title: 'x', content: '<img src="https://evil.example/x.jpg">' }), null);
  // the shape the new endpoint actually returns (checked live 2026-09-27)
  const live = normalizeWp({ date: '2026-09-26', post_id: 1, title: 'Green Aurora', permalink: 'https://science.nasa.gov/apod/x', media_type: 'image', explanation: 'An aurora.', credit: 'NASA', copyright: 'J. Smith', url: 'https://apod.nasa.gov/apod/image/aurora.jpg' });
  assert.equal(live.imageUrl, 'https://apod.nasa.gov/apod/image/aurora.jpg');
  assert.equal(live.credit, '© J. Smith');
  assert.equal(normalizeWp({ title: 'Clip', media_type: 'video', url: 'https://apod.nasa.gov/x.mp4' }), null);
  let now = LEGACY_END - 1000;
  const { providers, fetch } = providersWith([
    ['api.nasa.gov', { body: json('apod-legacy.json') }],
    ['science.nasa.gov', { body: [{ title: 'Aurora', media_type: 'image', url: 'https://apod.nasa.gov/apod/image/a.jpg', date: '2026-12-05' }] }],
  ], { now: () => now });
  assert.equal((await providers.apod.random(3)).length, 1);
  assert.ok(fetch.calls.at(-1).url.includes('DEMO_KEY'));
  now = LEGACY_END + 1000;
  assert.equal((await providers.apod.random(3))[0].title, 'Aurora');
});

// ---- watch list, recall, suggestions

function mediaFixture(routes = []) {
  const bank = KeywordBank.load();
  const learning = new Learning(null);
  const { providers } = providersWith([
    ['feeds/videos.xml', { body: fixture('youtube-feed.xml'), headers: { 'content-type': 'application/xml' } }],
    ['advancedsearch.php', { body: json('archive-search.json') }],
    ...routes,
  ]);
  let now = 5_000_000;
  const media = new Media(null, { providers, bank, learning, getSettings: () => ({ channels: { disabled: [], custom: [] } }), now: () => now });
  return { media, bank, learning };
}

test('media: match score prefers the full name in the title', () => {
  const k = { term: 'Entropy', aliases: ['second law'], domain: 'physics' };
  assert.ok(matchScore({ title: 'The Most Misunderstood Concept in Physics: Entropy', domains: ['physics'] }, k) >= 6);
  assert.ok(matchScore({ title: 'Cooking with sugar', description: 'nothing', domains: [] }, k) < 2);
  assert.ok(matchScore({ title: 'Something else', description: 'all about entropy and heat' }, k) >= 3);
});

test('media: add validates videos; recall has 3 questions; watching saves a card and a learned entry', () => {
  const { media, learning } = mediaFixture();
  const v = parseFeed(fixture('youtube-feed.xml'), { id: CHANNELS[0].id, name: 'Veritasium', domains: ['physics'] }).videos[0];
  assert.throws(() => media.add({ ...v, url: 'https://evil.example/watch' }), /Unexpected video link/);
  assert.throws(() => media.add({ ...v, source: 'tiktok' }), /Not a video/);
  const item = media.add(v, 'entropy');
  assert.equal(media.add(v).key, item.key); // no duplicates
  const { questions } = media.recallQuestions(item.key, makeRng('r'));
  assert.equal(questions.length, 3);
  const topic = questions.find((q) => q.kind === 'choice');
  assert.equal(topic.options[topic.answer], 'Entropy');
  const r = media.markWatched(item.key, { main: 'Entropy counts arrangements.', fact: 'Heat flows hot to cold.', topicCorrect: true, confidence: 3 });
  assert.equal(r.cards, 1);
  assert.match(learning.recentCards(1)[0].front, /From the video/);
  const learned = media.learned();
  assert.equal(learned[0].kind, 'video');
  assert.equal(learned[0].note, 'Entropy counts arrangements.');
  assert.ok(media.remove(item.key));
});

test('media: keyword suggestions mix matching channel videos and open archive films', async () => {
  const { media } = mediaFixture();
  const r = await media.suggestions('entropy');
  assert.ok(r.videos.some((v) => v.source === 'youtube' && /entropy/i.test(v.title)));
  assert.ok(r.videos.every((v) => v.source !== 'archive' || v.license));
  assert.match(r.searchUrl, /^https:\/\/www\.youtube\.com\/results\?search_query=/);
});

// ---- settings and links

test('channels: curated list is well formed; settings switch channels off and add your own', () => {
  assert.equal(CHANNELS.length, 36);
  assert.equal(new Set(CHANNELS.map((c) => c.id)).size, 36);
  const store = new Store(null);
  store.set({ channels: { disabled: [CHANNELS[0].id], custom: [{ id: 'UC' + 'a'.repeat(22), name: 'Mine', domains: ['physics'] }, { id: 'nope' }] } });
  const active = activeChannels(store.get());
  assert.equal(active.length, 36);
  assert.ok(!active.some((c) => c.id === CHANNELS[0].id));
  assert.ok(active.some((c) => c.custom && c.name === 'Mine'));
  assert.equal(store.get().providers.triviaapi, true); // every provider can be switched off in Settings
  store.set({ providers: { triviaapi: false, apod: false } });
  assert.equal(store.get().providers.triviaapi, false);
});

test('links: the new sources open in the browser, others still don’t', () => {
  for (const u of ['https://www.metmuseum.org/art/collection/search/1', 'https://www.artic.edu/artworks/2', 'https://www.inaturalist.org/taxa/3', 'https://apod.nasa.gov/apod/ap260101.html', 'https://archive.org/details/x']) assert.ok(isAllowedLink(u), u);
  assert.ok(!isAllowedLink('https://evil.example.com/'));
  assert.ok(!isAllowedLink('http://www.metmuseum.org/'));
});
