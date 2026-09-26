import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeRng } from '../src/shared/rng.js';
import { validateMeta, normalizeResult } from '../src/shared/game-contract.js';
import * as mm from '../src/renderer/games/mental-math/logic.js';
import * as stroop from '../src/renderer/games/stroop/logic.js';
import * as nback from '../src/renderer/games/nback/logic.js';
import * as schulte from '../src/renderer/games/schulte/logic.js';
import * as ladder from '../src/renderer/games/word-ladder/logic.js';

const LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);
const pack = JSON.parse(fs.readFileSync(new URL('../assets/packs/words-en.json', import.meta.url)));

test('every game meta follows the contract', () => {
  for (const g of [mm, stroop, nback, schulte, ladder]) assert.deepEqual(validateMeta(g.meta), [], g.meta.id);
  const ids = [mm, stroop, nback, schulte, ladder].map((g) => g.meta.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('normalizeResult clamps what games report', () => {
  const r = normalizeResult({ score: -5, accuracy: 1.4, performance: NaN, timeMs: 1234.6, difficulty: 12 }, mm.meta);
  assert.deepEqual([r.score, r.accuracy, r.performance, r.timeMs, r.difficulty], [0, 1, 0, 1235, 10]);
});

test('mental math: every answer is correct, at every level', () => {
  for (const d of LEVELS) {
    const r = makeRng(`mm-${d}`);
    for (let i = 0; i < 300; i++) {
      const { text, answer } = mm.genProblem(r, d);
      assert.ok(Number.isInteger(answer), `${text} = ${answer} should be a whole number`);
      assert.ok(answer >= 0, `${text} should not be negative`);
      let expected;
      const pctMatch = /^(\d+)% of (\d+)$/.exec(text);
      if (pctMatch) expected = (Number(pctMatch[1]) * Number(pctMatch[2])) / 100;
      else expected = Function(`return (${text.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/(\d+)²/g, '($1*$1)')})`)();
      assert.equal(answer, expected, `level ${d}: ${text}`);
    }
  }
});

test('mental math: same seed, same problems', () => {
  const a = makeRng('same'), b = makeRng('same');
  for (let i = 0; i < 50; i++) assert.deepEqual(mm.genProblem(a, 6), mm.genProblem(b, 6));
});

test('stroop: congruent share, never the same answer twice in a row', () => {
  for (const d of LEVELS) {
    const trials = stroop.genTrials(makeRng(`st-${d}`), stroop.TRIALS, d);
    assert.equal(trials.length, stroop.TRIALS);
    const congruent = trials.filter((t) => t.congruent).length;
    assert.equal(congruent, Math.round(stroop.TRIALS * stroop.congruentRate(d)));
    for (const [i, t] of trials.entries()) {
      assert.equal(t.congruent, t.word === t.ink);
      if (i) assert.notEqual(t.ink, trials[i - 1].ink);
    }
  }
});

test('n-back: exactly the planned targets per stream, no accidental matches', () => {
  for (const d of LEVELS) {
    for (let s = 0; s < 20; s++) {
      const round = nback.genRound(makeRng(`nb-${d}-${s}`), d);
      assert.equal(round.trials, nback.SCORED_TRIALS + round.n);
      for (const seq of [round.positions, round.letters]) {
        const targets = seq.filter((_, i) => nback.isTarget(seq, round.n, i)).length;
        assert.equal(targets, nback.TARGETS);
      }
      assert.ok(round.positions.every((p) => p >= 0 && p < 9));
      assert.ok(round.letters.every((l) => l >= 0 && l < nback.LETTERS.length));
    }
  }
});

test('n-back scoring: perfect play scores 1, pressing everything scores 0', () => {
  const round = nback.genRound(makeRng('nb-score'), 4);
  const perfect = round.positions.map((_, i) => ({
    pos: nback.isTarget(round.positions, round.n, i),
    let: nback.isTarget(round.letters, round.n, i),
  }));
  assert.equal(nback.scoreRound(round, perfect, 4).performance, 1);
  const spam = round.positions.map(() => ({ pos: true, let: true }));
  assert.equal(nback.scoreRound(round, spam, 4).performance, 0);
});

test('schulte: the grid holds each number exactly once', () => {
  for (const d of LEVELS) {
    const size = schulte.gridSize(d);
    const grid = schulte.genGrid(makeRng(`sc-${d}`), size);
    assert.deepEqual([...grid].sort((a, b) => a - b), Array.from({ length: size * size }, (_, i) => i + 1));
  }
});

test('word ladder: word lists are clean', () => {
  for (const n of [3, 4]) {
    const valid = new Set(pack[`valid${n}`]);
    for (const w of pack[`common${n}`]) {
      assert.match(w, new RegExp(`^[a-z]{${n}}$`));
      assert.ok(valid.has(w), `${w} is common but not valid`);
    }
  }
});

test('word ladder: every generated puzzle is solvable in exactly the stated steps', () => {
  const cache = {};
  for (const d of LEVELS) {
    for (let s = 0; s < 15; s++) {
      const p = ladder.genLadder(makeRng(`wl-${d}-${s}`), d, pack, cache);
      const len = ladder.wordLength(d);
      const common = new Set(pack[`common${len}`]);
      assert.equal(p.solution.length, p.steps + 1);
      assert.equal(p.solution[0], p.start);
      assert.equal(p.solution.at(-1), p.end);
      for (let i = 1; i < p.solution.length; i++) {
        assert.ok(ladder.oneLetterApart(p.solution[i - 1], p.solution[i]), p.solution.join(' → '));
        assert.ok(common.has(p.solution[i]));
      }
      // it's a shortest path among common words
      const shortest = ladder.shortestPath(cache[len], p.start, p.end);
      assert.equal(shortest.length - 1, p.steps);
    }
  }
});

test('word ladder: same seed, same puzzle', () => {
  const a = ladder.genLadder(makeRng('wl-seed'), 6, pack);
  const b = ladder.genLadder(makeRng('wl-seed'), 6, pack);
  assert.deepEqual(a, b);
});

test('word ladder scoring', () => {
  assert.equal(ladder.scoreRound({ steps: 4, used: 4, hints: 0, gaveUp: false, difficulty: 5 }).performance, 1);
  assert.equal(ladder.scoreRound({ steps: 4, used: 8, hints: 0, gaveUp: false, difficulty: 5 }).accuracy, 0.5);
  assert.equal(ladder.scoreRound({ steps: 4, used: 4, hints: 0, gaveUp: true, difficulty: 5 }).performance, 0);
});
