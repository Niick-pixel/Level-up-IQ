// The Daily Mix planner: follows the arc, fits the time, favours weak skills, avoids recent games.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planMix, nextMarathonGame, weakness, gameWeight, estimateSec } from '../src/shared/mix-plan.js';
import { GAMES } from '../src/renderer/games/registry.js';
import { makeRng } from '../src/shared/rng.js';

const metas = GAMES.map((g) => g.meta);
const byId = Object.fromEntries(metas.map((m) => [m.id, m]));
const now = Date.UTC(2026, 8, 28, 12);
const base = { metas, ratings: {}, recent: [], now, hasCards: true };

test('mix: the arc is warm-up → logic → memory → … → keyword → (think) → videos', () => {
  for (let i = 0; i < 30; i++) {
    const { steps } = planMix({ ...base, rng: makeRng(`arc${i}`), minutes: 10 });
    const kinds = steps.map((s) => (s.kind === 'game' ? byId[s.gameId].skills[0] : s.kind));
    assert.deepEqual(kinds.slice(0, 3), ['attention', 'logic', 'memory']);
    assert.equal(kinds.at(-1), 'videos');
    assert.ok(kinds.includes('keyword'));
    assert.equal(new Set(steps.filter((s) => s.gameId).map((s) => s.gameId)).size, steps.filter((s) => s.gameId).length, 'no game twice');
    assert.ok(!steps.some((s) => s.gameId === 'explain-back'), 'the keyword step already explains it back');
  }
});

test('mix: longer sessions get more rounds, and the estimate stays close to the setting', () => {
  const avg = (minutes) => {
    let sec = 0, rounds = 0;
    for (let i = 0; i < 40; i++) {
      const p = planMix({ ...base, rng: makeRng(`t${minutes}-${i}`), minutes });
      sec += p.estimatedSec;
      rounds += p.steps.filter((s) => s.kind === 'game').length;
    }
    return { min: sec / 40 / 60, rounds: rounds / 40 };
  };
  const ten = avg(10), thirty = avg(30);
  assert.ok(thirty.rounds > ten.rounds + 2);
  assert.ok(Math.abs(ten.min - 10) < 2.5, `10 → ${ten.min.toFixed(1)} min`);
  assert.ok(Math.abs(thirty.min - 30) < 3, `30 → ${thirty.min.toFixed(1)} min`);
});

test('mix: reviews come first when cards are due; offline skips online-only games and videos', () => {
  const p = planMix({ ...base, rng: makeRng('r'), minutes: 10, reviewsDue: 25 });
  assert.deepEqual(p.steps[0], { kind: 'review', label: 'Review', count: 10 });
  for (let i = 0; i < 20; i++) {
    const off = planMix({ ...base, rng: makeRng(`off${i}`), minutes: 30, offline: true });
    assert.ok(off.steps.every((s) => s.kind !== 'videos' && (!s.gameId || byId[s.gameId].offline !== false)));
  }
  const noCards = planMix({ ...base, hasCards: false, rng: makeRng('nc'), minutes: 60 });
  assert.ok(!noCards.steps.some((s) => s.gameId === 'yesterday'));
});

test('mix: weaker skills are favoured and recent games avoided', () => {
  const ratings = { math: { r: 900, n: 20 }, language: { r: 1500, n: 20 }, logic: { r: 1200, n: 20 } };
  assert.ok(weakness(ratings, 'math') > 1 && weakness(ratings, 'language') < 1);
  assert.equal(weakness(ratings, 'spatial'), 1.5);
  let math = 0, language = 0;
  for (let i = 0; i < 60; i++) {
    const { steps } = planMix({ ...base, ratings, rng: makeRng(`w${i}`), minutes: 20 });
    math += steps.filter((s) => s.skill === 'math').length;
    language += steps.filter((s) => s.skill === 'language').length;
  }
  assert.ok(math > language * 1.5, `math ${math} vs language ${language}`);
  const fresh = gameWeight(byId.stroop, { ratings: {}, recent: [], now });
  const played = gameWeight(byId.stroop, { ratings: {}, recent: [{ gameId: 'stroop', at: now - 3600e3 }], now });
  assert.ok(played < fresh / 5);
  const tatham = gameWeight(byId['tatham-solo'], { ratings: {}, recent: [], now });
  assert.ok(tatham < gameWeight(byId.zebra, { ratings: {}, recent: [], now }) / 5);
});

test('marathon: never repeats the last few games; same seed, same plan', () => {
  const rng = makeRng('m');
  const played = [];
  for (let i = 0; i < 25; i++) {
    const id = nextMarathonGame({ ...base, rng, lastIds: played });
    assert.ok(!played.slice(-5).includes(id));
    played.push(id);
  }
  const a = planMix({ ...base, rng: makeRng('same'), minutes: 15 });
  const b = planMix({ ...base, rng: makeRng('same'), minutes: 15 });
  assert.deepEqual(a, b);
  assert.ok(estimateSec(byId.stroop) >= byId.stroop.durationRange[0]);
});
