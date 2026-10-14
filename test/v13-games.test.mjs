// 1.3: Sudoku, Reversi, Checkers, Mancala and the chess coach's helpers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/shared/rng.js';
import { validateMeta } from '../src/shared/game-contract.js';
import * as S from '../src/renderer/games/sudoku/logic.js';
import * as R from '../src/renderer/games/reversi/logic.js';
import * as C from '../src/renderer/games/checkers/logic.js';
import * as M from '../src/renderer/games/mancala/logic.js';
import * as E from '../src/renderer/games/chess-engine/logic.js';
import { bestMove, WIN } from '../src/renderer/games/_engine/negamax.js';

test('1.3 games: valid metas', () => {
  for (const m of [S.meta, R.meta, C.meta, M.meta]) assert.deepEqual(validateMeta(m), [], m.id);
});

test('sudoku: unique solutions, tier per level, solution consistent with the givens', () => {
  for (const d of [1, 4, 5, 7, 9]) {
    const p = S.generate(makeRng(`sd${d}`), d);
    assert.equal(S.countSolutions(p.puzzle, 2), 1, `level ${d}`);
    assert.ok(p.puzzle.every((v, i) => !v || v === p.solution[i]));
    assert.equal(p.tier, S.target(d).tier, `level ${d}: tier ${p.tier}`);
    if (d <= 4) assert.ok(p.givens >= S.target(d).givens);
    assert.equal(S.rate(p.puzzle).solved, true);
  }
  assert.equal(S.countSolutions(new Array(81).fill(0), 2), 2);
  const bad = new Array(81).fill(0); bad[0] = 5; bad[1] = 5;
  assert.equal(S.countSolutions(bad, 2), 0);
});

test('sudoku: hint steps never contradict the solution, all the way through', () => {
  const rng = makeRng('hints');
  for (let k = 0; k < 40; k++) {
    const sol = S.fullGrid(rng);
    const p = sol.slice();
    for (const i of rng.shuffle([...Array(81).keys()])) { const v = p[i]; p[i] = 0; if (S.countSolutions(p, 2) !== 1) p[i] = v; }
    const g = p.slice(); const c = S.candidates(g);
    for (let st = S.nextStep(g, c); st; st = S.nextStep(g, c)) {
      if (st.kind === 'place') assert.equal(st.digit, sol[st.cell], st.technique);
      else for (const e of st.eliminations) assert.notEqual(sol[e.cell], e.digit, st.technique);
      assert.ok(st.text.length > 20 && S.TECHNIQUES[st.technique]);
      S.applyStep(g, c, st);
    }
  }
  assert.equal(S.scoreRound({ d: 5, timeMs: 1, mistakes: 0, hints: 0, solved: false }).performance, 0);
});

test('reversi: opening moves, flips, passes and the end', () => {
  const s = R.initial();
  assert.deepEqual(R.legal(s).sort((a, b) => a - b), [19, 26, 37, 44]);
  const s2 = R.play(s, 19);
  assert.equal(R.count(s2.b, 1), 4);
  assert.equal(R.count(s2.b, 2), 1);
  assert.equal(s2.p, 2);
  // a full board is over
  const full = { b: new Array(64).fill(1), p: 2, passes: 0 };
  assert.ok(R.isOver(full));
  assert.ok(R.GAME.over(full) < -WIN / 2, 'white to move with no discs has lost');
  // flips never wrap around the board edge
  const edge = { b: new Array(64).fill(0), p: 1, passes: 0 };
  edge.b[7] = 1; edge.b[8] = 2;
  assert.deepEqual(R.flips(edge.b, 9, 1), []);
});

test('checkers: compulsory captures, multi-jumps, crowning ends the move', () => {
  const s = C.initial();
  assert.equal(C.legal(s).length, 7, 'seven opening moves');
  // a capture is compulsory
  const b = new Array(64).fill(0);
  b[C.owner(1) && 44] = 1; b[35] = 2; b[60] = 1; b[0] = 2;
  const forced = C.legal({ b, p: 1, quiet: 0 });
  assert.ok(forced.length && forced.every((m) => m.caps.length), 'only captures');
  // double jump: 53 → 39 → 21 over 46 and 30? (rows: 53 = r6c5, 46 = r5c6, 39 = r4c7, 30 = r3c6, 21 = r2c5)
  const d = new Array(64).fill(0);
  d[53] = 1; d[46] = 2; d[30] = 2; d[7] = 2;
  const chain = C.legal({ b: d, p: 1, quiet: 0 });
  assert.deepEqual(chain.map((m) => m.path), [[53, 39, 21]]);
  assert.deepEqual(chain[0].caps, [46, 30]);
  // a man that reaches the last row is crowned and stops
  const k = new Array(64).fill(0);
  k[19] = 1; k[10] = 2; k[3] = 0; k[63] = 2;
  const crown = C.legal({ b: k, p: 1, quiet: 0 });
  const after = C.play({ b: k, p: 1, quiet: 0 }, crown[0]);
  assert.ok(C.isKing(after.b[crown[0].path.at(-1)]));
  // no pieces → the side to move has lost
  assert.equal(C.GAME.over({ b: new Array(64).fill(0), p: 1, quiet: 0 }), -WIN);
});

test('mancala: sowing, extra turn, capture, end of game, seeds conserved', () => {
  const s = M.initial();
  assert.equal(s.b.reduce((a, x) => a + x, 0), 48);
  const s1 = M.play(s, 2); // 4 seeds from pit 2 → 3, 4, 5, store: extra turn
  assert.equal(s1.b[6], 1);
  assert.equal(s1.p, 1, 'last seed in the store: go again');
  // capture: last seed lands in an empty pit of yours opposite a full one
  const c = { b: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0], p: 1 };
  const c1 = M.play(c, 0);
  assert.equal(c1.b[6], 8, 'captured 7 + 1');
  assert.equal(c1.b[11], 0);
  // skip the opponent's store
  const big = M.play({ b: [0, 0, 0, 0, 0, 13, 0, 1, 1, 1, 1, 1, 1, 0], p: 1 }, 5);
  assert.equal(big.b[13], 0);
  for (let k = 0; k < 20; k++) {
    let x = M.initial();
    const rng = makeRng(`mc${k}`);
    while (!M.isOver(x)) x = M.play(x, rng.pick(M.legal(x)));
    assert.equal(x.b[6] + x.b[13], 48);
  }
});

test('search: finds a forced win and never prefers a lost line', () => {
  // Mancala: pit 5 (one seed) lands in the store for an extra turn; then pit 4 drops into the empty
  // pit 5 and captures the 2 opposite: 24–20. Starting with pit 4 hands the computer the move.
  const s = { b: [0, 0, 0, 0, 1, 1, 20, 2, 0, 0, 0, 0, 0, 20], p: 1 };
  const r = bestMove(M.GAME, s, 6);
  assert.equal(r.move, 5);
  assert.ok(r.score > WIN / 2, `score ${r.score}`);
  const worse = r.scored.find((x) => x.move === 4);
  assert.ok(worse.score < r.score);
});

test('chess coach: scores, evaluation text and move labels', () => {
  assert.equal(E.parseScore('info depth 10 score cp 34 nodes 1'), 34);
  assert.equal(E.parseScore('info depth 10 score mate 3 pv e2e4'), 9997);
  assert.equal(E.parseScore('info depth 10 score mate -2'), -9998);
  assert.equal(E.parseScore('info depth 3 nodes 9'), null);
  assert.equal(E.fmtEval(130), '+1.3');
  assert.equal(E.fmtEval(-40), '−0.4');
  assert.equal(E.fmtEval(9997), 'M3');
  assert.equal(E.fmtEval(-9998), '−M2');
  assert.ok(Math.abs(E.whiteShare(0) - 0.5) < 1e-9 && E.whiteShare(800) > 0.85);
  assert.equal(E.classify(5, false), 'best');
  assert.equal(E.classify(300, true), 'best');
  assert.equal(E.classify(80, false), 'inaccuracy');
  assert.equal(E.classify(200, false), 'mistake');
  assert.equal(E.classify(900, false), 'blunder');
  const clean = E.scoreGame({ outcome: 'win', plies: 60, difficulty: 5 });
  const helped = E.scoreGame({ outcome: 'win', plies: 60, difficulty: 5, help: 3 });
  assert.equal(clean.performance, 1);
  assert.ok(helped.performance < 1 && helped.performance > 0.5);
});
