// Phase 5: spaced repetition (FSRS), streaks with rest days, the curiosity map, settings.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Srs, cardType, fmtInterval } = require('../src/main/srs');
const { Learning } = require('../src/main/learning');
const { streak } = require('../src/main/stats');
const { curiosityMap } = require('../src/main/curiosity');
const { KeywordBank } = require('../src/main/keywords');
const { Store } = require('../src/main/store');
const { localDateKey } = require('../src/shared/rng.js');

const DAY = 24 * 3600 * 1000;

function setup(settings = {}) {
  let now = Date.UTC(2026, 8, 28, 9);
  const learning = new Learning(null, { now: () => now });
  const srs = new Srs(null, { learning, getSettings: () => ({ srsRetention: 0.9, srsNewPerDay: 3, ...settings }), now: () => now, dateKey: localDateKey });
  const advance = (ms) => { now += ms; };
  return { learning, srs, advance, now: () => now };
}

test('srs: new cards are limited per day; reviews schedule further out when you know them', () => {
  const { learning, srs, advance } = setup();
  learning.addCards(Array.from({ length: 5 }, (_, i) => ({ keywordId: 'entropy', front: `Q${i}`, back: `A${i}` })));
  let q = srs.queue();
  assert.equal(q.length, 3, 'only 3 new cards a day');
  assert.equal(q[0].state, 'new');
  assert.ok(q[0].next[1] && q[0].next[4]);
  const good = srs.review(q[0].id, 3);
  srs.review(q[1].id, 1); // forgot
  srs.review(q[2].id, 4); // easy
  q = srs.queue();
  assert.equal(q.filter((c) => c.state === 'new').length, 0, 'no more new cards today');
  const st = srs.stats();
  assert.equal(st.byState.new, 2);
  assert.equal(st.reviews, 3);
  // the easy card comes back later than the good one, which comes back later than the forgotten one
  const due = Object.fromEntries(learning.allCards().filter((c) => c.fsrs).map((c) => [c.front, Date.parse(c.fsrs.due)]));
  assert.ok(due.Q2 > due.Q0 && due.Q0 > due.Q1, JSON.stringify(due));
  assert.ok(good.in);
  advance(2 * DAY);
  q = srs.queue();
  assert.ok(q.some((c) => c.front === 'Q1'), 'the forgotten card is due again');
  assert.equal(q.filter((c) => c.state === 'new').length, 2, 'a new day brings new cards');
});

test('srs: a well-known card grows its interval with each good review', () => {
  const { learning, srs, advance } = setup({ srsNewPerDay: 10 });
  learning.addCards([{ keywordId: 'k', front: 'F', back: 'B' }]);
  const id = learning.allCards()[0].id;
  let last = 0;
  for (let i = 0; i < 5; i++) {
    srs.review(id, 3);
    const gap = Date.parse(learning.allCards()[0].fsrs.due) - Date.parse(learning.allCards()[0].fsrs.last_review);
    assert.ok(gap >= last, `review ${i}: ${gap} < ${last}`);
    last = gap;
    advance(gap);
  }
  assert.ok(last > 20 * DAY, `after five good reviews the gap is ${Math.round(last / DAY)} days`);
});

test('srs: higher target recall means shorter intervals; bad grades are refused', () => {
  const at = (retention) => {
    const { learning, srs } = setup({ srsRetention: retention, srsNewPerDay: 10 });
    learning.addCards([{ keywordId: 'k', front: 'F', back: 'B' }]);
    const id = learning.allCards()[0].id;
    srs.review(id, 3);
    srs.review(id, 3);
    return Date.parse(learning.allCards()[0].fsrs.due);
  };
  assert.ok(at(0.95) < at(0.8));
  const { srs } = setup();
  assert.throws(() => srs.review('cnope', 3), /No such card/);
  assert.throws(() => srs.review('cnope', 7), /1–4/);
});

test('srs: card types and interval labels', () => {
  assert.equal(cardType({ keywordId: 'video:youtube:x', front: 'From the video “X”' }), 'video');
  assert.equal(cardType({ keywordId: 'entropy', front: 'What is entropy?' }), 'fact');
  assert.equal(fmtInterval(10 * 60000), '10 min');
  assert.equal(fmtInterval(3 * DAY), '3 days');
  assert.equal(fmtInterval(62 * DAY), '2 months');
});

test('streaks: rest days allowed, today never breaks it, a second rest in a week does', () => {
  const d = (ks) => Object.fromEntries(ks.map((k) => [k, { games: 1 }]));
  assert.equal(streak({}, '2026-09-28').current, 0);
  assert.deepEqual(streak(d(['2026-09-26', '2026-09-27']), '2026-09-28'), { current: 2, best: 2, trainedToday: false, restLeft: 1, restDays: [] });
  const withRest = streak(d(['2026-09-24', '2026-09-26', '2026-09-27', '2026-09-28']), '2026-09-28');
  assert.equal(withRest.current, 4);
  assert.deepEqual(withRest.restDays, ['2026-09-25']);
  assert.equal(streak(d(['2026-09-22', '2026-09-24', '2026-09-26', '2026-09-28']), '2026-09-28').current, 2);
  assert.equal(streak(d(['2026-09-24', '2026-09-26']), '2026-09-28', 0).current, 0);
  // reviews count as training too
  assert.equal(streak({ '2026-09-27': { reviews: 5 } }, '2026-09-28').current, 1);
  // across a month boundary
  assert.equal(streak(d(['2026-08-30', '2026-08-31', '2026-09-01']), '2026-09-01').current, 3);
});

test('curiosity map: explored nodes, related edges, a frontier of unexplored neighbours, weekly growth', () => {
  const bank = KeywordBank.load();
  const now = Date.UTC(2026, 8, 28);
  const explored = {
    entropy: { first: now - 20 * DAY, count: 2, domain: 'physics', sessions: 1, bestQuiz: 0.8 },
    'heat-death-of-the-universe': { first: now - 2 * DAY, count: 1, domain: 'physics' },
  };
  const map = curiosityMap({ bank, explored, now });
  assert.equal(map.nodes.length, 2);
  assert.ok(map.edges.some(([a, b]) => [a, b].includes('entropy') && [a, b].includes('heat-death-of-the-universe')));
  assert.ok(map.frontier.length > 0 && map.frontier.every((f) => !explored[f.id]));
  assert.equal(map.growth.length, 12);
  assert.equal(map.growth.at(-1).total, 2);
  assert.ok(map.growth[0].total <= 1);
  assert.equal(map.domains.find((x) => x.id === 'physics').explored, 2);
});

test('settings: review, streak and playlist settings are validated', () => {
  const store = new Store(null);
  store.set({ srsRetention: 2, srsNewPerDay: -4, restDaysPerWeek: 9, playlists: [{ id: 'mine', name: ' Morning ', games: ['stroop', 'bad id!', 'zebra'] }, { nope: true }] });
  const s = store.get();
  assert.equal(s.srsRetention, 0.97);
  assert.equal(s.srsNewPerDay, 0);
  assert.equal(s.restDaysPerWeek, 3);
  assert.deepEqual(s.playlists, [{ id: 'mine', name: 'Morning', games: ['stroop', 'zebra'] }]);
});
