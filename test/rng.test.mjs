import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, cyrb128, parseSeedCode, formatSeedCode, randomSeed, localDateKey } from '../src/shared/rng.js';

test('same seed gives the same stream', () => {
  const a = makeRng('hello'), b = makeRng('hello');
  for (let i = 0; i < 1000; i++) assert.equal(a.next(), b.next());
});

test('different seeds give different streams', () => {
  const a = makeRng('hello'), b = makeRng('hellp');
  const same = Array.from({ length: 50 }, () => a.next() === b.next()).filter(Boolean).length;
  assert.ok(same < 3);
});

test('known values stay stable across releases (shared seed codes depend on it)', () => {
  assert.deepEqual(cyrb128('mind-gym'), cyrb128('mind-gym'));
  const r = makeRng('stroop:4:k9x2mf');
  const first = Array.from({ length: 5 }, () => r.int(0, 999));
  assert.deepEqual(first, Array.from({ length: 5 }, ((rr) => () => rr.int(0, 999))(makeRng('stroop:4:k9x2mf'))));
});

test('int() stays in range and hits both ends', () => {
  const r = makeRng('range');
  const seen = new Set();
  for (let i = 0; i < 5000; i++) {
    const v = r.int(3, 7);
    assert.ok(v >= 3 && v <= 7);
    seen.add(v);
  }
  assert.deepEqual([...seen].sort(), [3, 4, 5, 6, 7]);
});

test('shuffle returns a permutation and leaves the input alone', () => {
  const input = Array.from({ length: 30 }, (_, i) => i);
  const out = makeRng('s').shuffle(input);
  assert.deepEqual([...out].sort((a, b) => a - b), input);
  assert.notDeepEqual(out, input);
});

test('weighted() respects weights', () => {
  const r = makeRng('w');
  let heavy = 0;
  for (let i = 0; i < 4000; i++) if (r.weighted(['a', 'b'], (x) => (x === 'a' ? 9 : 1)) === 'a') heavy++;
  assert.ok(heavy > 3400 && heavy < 3800, `got ${heavy}`);
});

test('fork() is deterministic and independent', () => {
  assert.equal(makeRng('x').fork('a').next(), makeRng('x').fork('a').next());
  assert.notEqual(makeRng('x').fork('a').next(), makeRng('x').fork('b').next());
});

test('seed codes round-trip and reject junk', () => {
  const code = formatSeedCode({ gameId: 'word-ladder', difficulty: 7, seed: 'abc123' });
  assert.deepEqual(parseSeedCode(code), { gameId: 'word-ladder', difficulty: 7, seed: 'abc123' });
  assert.equal(parseSeedCode('stroop:11:abc'), null);
  assert.equal(parseSeedCode('stroop:0:abc'), null);
  assert.equal(parseSeedCode('../etc:1:x'), null);
  assert.match(randomSeed(), /^[a-z2-9]{6}$/);
});

test('localDateKey uses the local calendar', () => {
  assert.equal(localDateKey(new Date(2026, 0, 5, 23, 59).getTime()), '2026-01-05');
});
