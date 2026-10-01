// 1.1: new games, named difficulty, the check-in planner, the changelog parser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/shared/rng.js';
import { validateMeta } from '../src/shared/game-contract.js';
import { levelName, applyMode } from '../src/shared/difficulty.js';
import { planCheckin, estimateSec } from '../src/shared/mix-plan.js';
import * as setGame from '../src/renderer/games/set-game/logic.js';
import * as simon from '../src/renderer/games/simon/logic.js';
import * as trail from '../src/renderer/games/trail-making/logic.js';
import * as ts from '../src/renderer/games/task-switch/logic.js';
import * as dots from '../src/renderer/games/dot-compare/logic.js';
import * as rat from '../src/renderer/games/remote-associates/logic.js';

const LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);

test('new games: valid metas', () => {
  for (const m of [setGame, simon, trail, ts, dots, rat].map((x) => x.meta)) assert.deepEqual(validateMeta(m), [], m.id);
});

test('set: rule, deck sizes, every dealt board and refill has a set', () => {
  assert.ok(setGame.isSet([0, 0, 0, 0], [1, 1, 1, 1], [2, 2, 2, 2]));
  assert.ok(setGame.isSet([0, 1, 2, 0], [0, 1, 2, 1], [0, 1, 2, 2]));
  assert.ok(!setGame.isSet([0, 0, 0, 0], [0, 0, 0, 1], [0, 0, 0, 1]));
  assert.equal(setGame.deck(2).length, 27);
  assert.equal(setGame.deck(8).length, 81);
  for (const d of LEVELS) {
    const rng = makeRng(`set${d}`);
    const pile = rng.shuffle(setGame.deck(d));
    let board = setGame.dealBoard(rng, pile, setGame.boardSize(d));
    assert.equal(board.length, setGame.boardSize(d));
    for (let round = 0; round < setGame.target(d); round++) {
      const sets = setGame.findSets(board);
      assert.ok(sets.length > 0, `level ${d}, round ${round}`);
      board = setGame.refill(rng, board, sets[0], pile);
    }
  }
  assert.equal(setGame.describe([1, 2, 0, 1]), '2 solid orange waves');
});

test('simon: pads, no triple repeats, sensible scoring', () => {
  for (const d of LEVELS) {
    const seq = simon.makeSequence(makeRng(`s${d}`), d);
    assert.ok(seq.every((p) => p >= 0 && p < simon.pads(d)));
    for (let i = 2; i < seq.length; i++) assert.ok(!(seq[i] === seq[i - 1] && seq[i] === seq[i - 2]));
  }
  assert.equal(simon.scoreRound({ d: 5, best: 0, mistakes: 1 }).performance, 0);
  assert.equal(simon.scoreRound({ d: 5, best: 20, mistakes: 1 }).performance, 1);
});

test('trail making: labels alternate from level 4; circles never overlap', () => {
  assert.deepEqual(trail.labels(2).slice(0, 4), ['1', '2', '3', '4']);
  assert.deepEqual(trail.labels(5).slice(0, 6), ['1', 'A', '2', 'B', '3', 'C']);
  for (const d of LEVELS) {
    const n = trail.count(d);
    assert.equal(trail.labels(d).length, n);
    const pts = trail.layout(makeRng(`t${d}`), n);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) assert.ok(Math.hypot(pts[i].x - pts[j].x, (pts[i].y - pts[j].y) * 1.2) > 4, `level ${d}`);
  }
});

test('task switching: answers follow the cue; switches get more frequent', () => {
  assert.equal(ts.answer({ task: 'parity', digit: 7 }), 0);
  assert.equal(ts.answer({ task: 'parity', digit: 8 }), 1);
  assert.equal(ts.answer({ task: 'magnitude', digit: 3 }), 0);
  assert.equal(ts.answer({ task: 'magnitude', digit: 9 }), 1);
  const switches = (d) => {
    const t = ts.makeTrials(makeRng(`ts${d}`), d);
    return t.filter((x, i) => i && x.task !== t[i - 1].task).length;
  };
  assert.ok(switches(10) > switches(1));
  assert.ok(ts.makeTrials(makeRng('x'), 5).every((t) => t.digit !== 5));
});

test('more dots: the right side has more, by the level’s ratio', () => {
  for (const d of LEVELS) {
    for (const t of dots.makeTrials(makeRng(`d${d}`), d)) {
      const [more, less] = t.more === 0 ? [t.left, t.right] : [t.right, t.left];
      assert.ok(more.length > less.length, `level ${d}: ${more.length} vs ${less.length}`);
      assert.ok(less.length / more.length <= dots.ratio(d) + 0.08);
    }
  }
});

test('remote associates: every answer appears in each compound; enough items per tier', () => {
  for (const it of rat.ITEMS) {
    const cues = it.prompt.split('·').map((x) => x.trim().toLowerCase());
    assert.equal(cues.length, 3, it.prompt);
    const compounds = it.explain.toLowerCase().split(', ');
    assert.equal(compounds.length, 3, it.explain);
    compounds.forEach((c, i) => {
      assert.ok(c.includes(it.answerText), `${c} lacks ${it.answerText}`);
      assert.ok(c.includes(cues[i]), `${c} lacks ${cues[i]}`);
    });
  }
  for (const level of [1, 2, 3]) assert.ok(rat.ITEMS.filter((x) => x.level === level).length >= 20);
  assert.equal(new Set(rat.ITEMS.map((x) => x.prompt)).size, rat.ITEMS.length);
});

test('difficulty: named levels and mode bands', () => {
  assert.deepEqual(LEVELS.map(levelName), ['Easy', 'Easy', 'Easy', 'Medium', 'Medium', 'Hard', 'Hard', 'Expert', 'Expert', 'Genius']);
  assert.equal(applyMode(9, 'easy'), 3);
  assert.equal(applyMode(1, 'expert'), 8);
  assert.equal(applyMode(5, 'adaptive'), 5);
  assert.equal(applyMode(9, 'hard', [1, 6]), 6, 'never beyond the game’s own range');
  assert.equal(applyMode(2, 'nonsense'), 2);
});

test('check-in planner: short games from different skills, fits the minutes, reviews first', () => {
  const metas = [setGame, simon, trail, ts, dots, rat].map((x) => x.meta).concat([
    { id: 'long', name: 'Long', skills: ['strategy'], durationRange: [600, 1200], difficultyRange: [1, 10], offline: true },
    { id: 'think', name: 'Think', skills: ['deep-thinking'], durationRange: [60, 120], difficultyRange: [1, 10], offline: true },
  ]);
  for (const minutes of [3, 5, 10]) {
    const plan = planCheckin({ metas, ratings: {}, recent: [], now: 0, rng: makeRng(`c${minutes}`), minutes, reviewsDue: 3, hasCards: true });
    assert.equal(plan.steps[0].kind, 'review');
    const games = plan.steps.filter((s) => s.kind === 'game');
    assert.ok(games.length >= 1);
    assert.ok(!games.some((g) => g.gameId === 'long' || g.gameId === 'think'));
    assert.ok(plan.estimatedSec <= minutes * 60 + 60, `${minutes} min → ${plan.estimatedSec}s`);
    const skills = games.map((g) => g.skill);
    if (games.length <= 3) assert.equal(new Set(skills).size, skills.length, 'different skills');
  }
  assert.ok(estimateSec(simon.meta) > 0);
});

test('what’s new: the changelog splits into versions, newest first', async () => {
  const { parseChangelog } = await import('../src/renderer/views/whats-new.js');
  const v = parseChangelog('# Changelog\n\n## 1.1.0: x\n\n- a\n\n## 1.0.0: y\n- b\n');
  assert.deepEqual(v.map((x) => x.title), ['1.1.0: x', '1.0.0: y']);
});
