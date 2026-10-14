// 1.3: the Chess Academy course is sound: every position is legal, every goal achievable,
// every quiz answer true, every opening line legal, every star exercise solvable.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Chess } from '../node_modules/chess.js/dist/esm/chess.js';
import { makeRng } from '../src/shared/rng.js';
import { UNITS, LESSONS, starFen, starPar, puzzlesFor, defenderMove, starsFor, nextLesson } from '../src/renderer/academy/lessons.js';

const pack = JSON.parse(fs.readFileSync(new URL('../assets/packs/lichess-puzzles.json', import.meta.url)));
const all = LESSONS.flatMap((l) => l.exercises.map((ex) => ({ l, ex })));
const reaches = (ex, m, c) => {
  switch (ex.goal) {
    case 'capture': return Boolean(m.captured);
    case 'check': return c.inCheck();
    case 'mate': return c.isCheckmate();
    case 'castle': return m.flags.includes('k') || m.flags.includes('q');
    case 'enpassant': return m.flags.includes('e');
    case 'promote': return Boolean(m.promotion);
    case 'block': return m.piece !== 'k' && !m.captured;
    default: throw new Error(`unknown goal ${ex.goal}`);
  }
};

test('academy: unique ids, every lesson has an intro and exercises', () => {
  const ids = LESSONS.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const l of LESSONS) {
    assert.ok(/^[a-z0-9-]{1,40}$/.test(l.id), l.id);
    assert.ok(l.intro.length && l.exercises.length, l.id);
  }
  assert.ok(UNITS.length >= 6 && LESSONS.length >= 30, `${LESSONS.length} lessons`);
  assert.equal(nextLesson('rook').id, 'bishop');
  assert.equal(nextLesson(LESSONS.at(-1).id), null);
});

test('academy: every star exercise is solvable, and par is the true minimum', () => {
  for (const { l, ex } of all.filter((x) => x.ex.type === 'stars')) {
    const par = starPar(ex, Chess);
    assert.ok(par >= ex.stars.length - 1 && par <= 8, `${l.id}: par ${par}`);
    new Chess(starFen(ex), { skipValidation: true }); // loads
  }
  assert.equal(starPar({ piece: 'R', start: 'a1', stars: ['a8', 'h8'], extra: '' }, Chess), 2);
  assert.equal(starPar({ piece: 'N', start: 'b1', stars: ['d2', 'f3', 'h4', 'g6'], extra: '' }, Chess), 4);
  assert.equal(starPar({ piece: 'P', start: 'c2', stars: ['d3', 'e4'], extra: 'd3e4' }, Chess), 2);
});

test('academy: goal positions are legal and their goal is achievable (and not already achieved)', () => {
  for (const { l, ex } of all.filter((x) => x.ex.type === 'goal')) {
    const c = new Chess(ex.fen);
    const ok = c.moves({ verbose: true }).filter((m) => { c.move(m); const r = reaches(ex, m, c); c.undo(); return r; });
    assert.ok(ok.length > 0, `${l.id}: no move reaches ${ex.goal}`);
    if (ex.goal === 'mate' || ex.goal === 'block') assert.ok(ok.length <= 3, `${l.id}: too many answers (${ok.length})`);
  }
  // the castling exercise really forbids one side
  const c = new Chess('4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1');
  assert.deepEqual(c.moves().filter((m) => m.startsWith('O-O')), ['O-O-O']);
});

test('academy: quiz answers about positions agree with the rules', () => {
  for (const { l, ex } of all.filter((x) => x.ex.type === 'quiz')) {
    assert.ok(ex.answer >= 0 && ex.answer < ex.options.length, l.id);
    if (!ex.fen) continue;
    const c = new Chess(ex.fen);
    const truth = c.isCheckmate() ? 0 : c.isStalemate() ? 1 : 2;
    assert.equal(ex.answer, truth, `${l.id}: ${ex.fen}`);
  }
});

test('academy: opening lines are legal and every move you play has its idea explained', () => {
  for (const { l, ex } of all.filter((x) => x.ex.type === 'line')) {
    const c = new Chess();
    ex.moves.forEach((san, i) => {
      const m = c.move(san); // throws if illegal
      assert.equal(m.san, san, `${l.id}: ${san}`);
      const mine = (i % 2 === 0) === (ex.side === 'w');
      if (mine) assert.ok(ex.notes[san], `${l.id}: no note for ${san}`);
    });
  }
});

test('academy: mate lessons start legal; the defender always has a sensible move', () => {
  for (const { l, ex } of all.filter((x) => x.ex.type === 'mate')) {
    const c = new Chess(ex.fen);
    assert.ok(!c.isGameOver(), l.id);
    c.move(c.moves()[0]);
    const m = defenderMove(c, makeRng('d'));
    assert.ok(m && m.piece === 'k', l.id);
  }
  // property: whenever Black has a move that doesn't allow mate in one, the defender picks one
  const allowsMate = (c, m) => {
    c.move(m);
    const r = c.moves({ verbose: true }).some((w) => { c.move(w); const x = c.isCheckmate(); c.undo(); return x; });
    c.undo();
    return r;
  };
  const rng = makeRng('prop');
  let checked = 0;
  for (const { ex } of all.filter((x) => x.ex.type === 'mate')) {
    for (let game = 0; game < 15; game++) {
      const c = new Chess(ex.fen);
      for (let ply = 0; ply < 30 && !c.isGameOver(); ply++) {
        if (c.turn() === 'w') { c.move(rng.pick(c.moves())); continue; }
        const safe = c.moves({ verbose: true }).filter((m) => !allowsMate(c, m));
        const m = defenderMove(c, rng);
        if (safe.length) { assert.ok(!allowsMate(c, m), `${c.fen()}: ${m.san} allows mate`); checked += 1; }
        c.move(m);
      }
    }
  }
  assert.ok(checked > 50, `${checked} positions checked`);
});

test('academy: every puzzle lesson finds enough puzzles of its theme', () => {
  for (const { l, ex } of all.filter((x) => x.ex.type === 'puzzles')) {
    const ps = puzzlesFor(pack, ex, makeRng(l.id));
    assert.equal(ps.length, ex.count, l.id);
    for (const p of ps) {
      assert.ok(p.themes.includes(ex.theme) && p.rating <= ex.maxRating, l.id);
      const c = new Chess(p.fen);
      for (const uci of p.moves) c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    }
  }
  assert.equal(starsFor({ moves: 3, par: 3 }), 3);
  assert.equal(starsFor({ moves: 6, par: 3 }), 1);
  assert.equal(starsFor({ mistakes: 0 }), 3);
  assert.equal(starsFor({ mistakes: 1, hints: 1 }), 1);
});
