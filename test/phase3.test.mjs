// Phase 3 games: every generator makes valid, solvable, unique-answer puzzles at every level.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Chess } from 'chess.js';
import { makeRng } from '../src/shared/rng.js';
import { validateMeta } from '../src/shared/game-contract.js';
import { GAMES } from '../src/renderer/games/registry.js';
import * as zebra from '../src/renderer/games/zebra/logic.js';
import * as knights from '../src/renderer/games/knights/logic.js';
import * as kakuro from '../src/renderer/games/kakuro/logic.js';
import * as g24 from '../src/renderer/games/game-24/logic.js';
import * as cdn from '../src/renderer/games/countdown-numbers/logic.js';
import * as sequences from '../src/renderer/games/sequences/logic.js';
import * as syllogism from '../src/renderer/games/syllogism/logic.js';
import * as crossword from '../src/renderer/games/crossword/logic.js';
import { evaluate, usesOnly, value } from '../src/renderer/games/_engine/arith.js';
import * as digits from '../src/renderer/games/digit-span/logic.js';
import { staircase, scoreSpan, SPAN_TRIALS } from '../src/renderer/games/_engine/span.js';
import * as corsi from '../src/renderer/games/corsi/logic.js';
import * as pairs from '../src/renderer/games/card-pairs/logic.js';
import * as kim from '../src/renderer/games/kims-game/logic.js';
import * as palace from '../src/renderer/games/memory-palace/logic.js';
import * as flanker from '../src/renderer/games/flanker/logic.js';
import * as gonogo from '../src/renderer/games/go-no-go/logic.js';
import * as search from '../src/renderer/games/visual-search/logic.js';
import * as rsvp from '../src/renderer/games/rsvp/logic.js';
import { PASSAGES } from '../src/renderer/games/_data/passages.js';
import * as rotation from '../src/renderer/games/mental-rotation/logic.js';
import * as fifteen from '../src/renderer/games/fifteen/logic.js';
import * as rush from '../src/renderer/games/rush-hour/logic.js';
import * as mapQuiz from '../src/renderer/games/map-quiz/logic.js';
import * as puzzles from '../src/renderer/games/chess-puzzles/logic.js';
import * as c4 from '../src/renderer/games/connect-four/logic.js';
import * as nim from '../src/renderer/games/nim/logic.js';
import * as trivia from '../src/renderer/games/trivia/logic.js';
import { TRIVIA } from '../src/renderer/games/_data/trivia.js';
import * as chrono from '../src/renderer/games/chronology/logic.js';
import { EVENTS } from '../src/renderer/games/_data/events.js';
import * as flags from '../src/renderer/games/flags/logic.js';
import * as capitals from '../src/renderer/games/capitals/logic.js';
import * as noAi from '../src/renderer/games/no-ai-challenge/logic.js';
import { RIDDLE_ITEMS, SITUATION_ITEMS, REBUS_ITEMS } from '../src/renderer/games/_data/riddles.js';
import { pickTiered } from '../src/renderer/games/_engine/tiered.js';
import { matches } from '../src/renderer/games/_engine/common.js';

const LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);
const json = (p) => JSON.parse(fs.readFileSync(new URL(`../${p}`, import.meta.url)));
const countries = json('assets/packs/countries.json');
const worldMap = json('assets/packs/world-map.json');
const rushPack = json('assets/packs/rush-hour.json');
const keywords = json('assets/keywords.json');

test('catalog: 60+ game types, unique ids, every meta valid', () => {
  assert.ok(GAMES.length >= 60, `${GAMES.length} games`);
  const ids = GAMES.map((g) => g.meta.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const g of GAMES) assert.deepEqual(validateMeta(g.meta), [], g.meta.id);
});

test('zebra: every grid has exactly one solution', () => {
  for (const d of LEVELS) {
    for (let s = 0; s < 3; s++) {
      const p = zebra.generate(makeRng(`z${d}-${s}`), d);
      assert.equal(zebra.countSolutions(p.n, p.k, p.clues), 1, `level ${d}`);
    }
  }
});

test('knights and knaves: one consistent assignment, and it is the answer', () => {
  for (const d of LEVELS) {
    for (let s = 0; s < 5; s++) {
      const p = knights.generate(makeRng(`k${d}-${s}`), d);
      const sols = knights.solutions(p.n, p.statements);
      assert.equal(sols.length, 1);
      assert.deepEqual(sols[0], p.answer);
    }
  }
});

test('kakuro: unique solution, run sums match, no repeated digits in a run', () => {
  for (const d of [1, 4, 7, 10]) {
    const p = kakuro.generate(makeRng(`kk${d}`), d);
    assert.equal(kakuro.countSolutions(p.white, p.runs, p.givens), 1);
    for (const run of p.runs) {
      const vals = run.cells.map(([r, c]) => p.solution[`${r},${c}`]);
      assert.equal(vals.reduce((a, b) => a + b, 0), run.sum);
      assert.equal(new Set(vals).size, vals.length);
    }
  }
});

test('24 and Countdown: the stored solution really works', () => {
  for (const d of LEVELS) {
    const p = g24.genPuzzle(makeRng(`24-${d}`), d);
    const r = evaluate(p.solution);
    assert.equal(value(r.value), 24, p.solution);
    assert.ok(usesOnly(r.numbers, p.numbers));
    assert.equal(r.numbers.length, 4);
    const c = cdn.genPuzzle(makeRng(`cd-${d}`), d);
    const rc = evaluate(c.solution);
    assert.equal(value(rc.value), c.target, c.solution);
    assert.ok(usesOnly(rc.numbers, c.numbers));
  }
});

test('sequences: every item accepts its own answer', () => {
  for (const d of LEVELS) for (const it of sequences.makeItems(makeRng(`sq${d}`), d)) assert.ok(it.check(it.answerText), it.prompt);
});

test('syllogisms: invalid ones come with a counterexample', () => {
  for (const d of LEVELS) {
    for (const q of syllogism.makeQuestions(makeRng(`sy${d}`), d)) {
      assert.ok(q.answer === 0 || q.answer === 1);
      if (q.answer === 1) assert.match(q.explain, /counterexample/);
    }
  }
});

test('crossword: every entry is written in the grid', () => {
  for (const d of [2, 5, 9]) {
    const p = crossword.generate(makeRng(`xw${d}`), d, keywords.keywords);
    assert.ok(p.entries.length >= 5);
    for (const e of p.entries) {
      [...e.word].forEach((ch, i) => {
        const r = e.r + (e.dir === 'down' ? i : 0), c = e.c + (e.dir === 'across' ? i : 0);
        assert.equal(p.grid[r][c], ch);
      });
    }
  }
});

test('memory: digit lists, spans, Corsi layouts, decks, trays, palaces', () => {
  for (const d of LEVELS) {
    const list = digits.genDigits(makeRng(`ds${d}`), digits.startSpan(d) + 3);
    list.forEach((x, i) => { if (i) assert.notEqual(x, list[i - 1]); });
    assert.equal(digits.expected([1, 2, 3], true), '321');
    const pos = corsi.layout(makeRng(`co${d}`));
    for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) assert.ok(Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y) >= 19);
    const deck = pairs.genDeck(makeRng(`cp${d}`), pairs.pairsFor(d));
    const counts = {};
    deck.forEach((c) => { counts[c.glyph] = (counts[c.glyph] || 0) + 1; });
    assert.ok(Object.values(counts).every((n) => n === 2));
    const r = kim.genRound(makeRng(`kim${d}`), d);
    assert.equal(r.options[r.answer], r.gone);
    assert.ok(!r.left.includes(r.gone));
    assert.equal(new Set(r.options.map((o) => o.name)).size, r.options.length);
    const p = palace.genRound(makeRng(`mp${d}`), d);
    assert.deepEqual(palace.checkRecall(p.pairs, p.pairs.map((x) => `${x.word}s`), matches), p.pairs.map(() => true));
  }
  const st = staircase(4);
  for (let i = 0; i < SPAN_TRIALS; i++) st.record(i % 3 !== 2);
  assert.ok(st.done);
  const s = scoreSpan(st.results, 4, 5);
  assert.ok(s.best >= 5 && s.performance > 0 && s.performance <= 1);
});

test('attention: Flanker, Go/No-Go and visual search trials are balanced', () => {
  for (const d of LEVELS) {
    const f = flanker.makeTrials(makeRng(`fl${d}`), d);
    assert.equal(f.length, flanker.TRIALS);
    for (const t of f) {
      const s = flanker.stimulus(t);
      assert.equal(s[(s.length - 1) / 2], t.dir ? '>' : '<');
    }
    const g = gonogo.makeTrials(makeRng(`gn${d}`), d);
    assert.ok(g[0].go);
    assert.ok(g.filter((t) => !t.go).every((t) => t.letter === 'X') && g.filter((t) => t.go).every((t) => t.letter !== 'X'));
    const v = search.makeTrials(makeRng(`vs${d}`), d);
    for (const t of v) assert.equal(t.items.filter((x) => x.ch === 'T').length, t.present ? 1 : 0);
  }
  for (const p of PASSAGES) {
    assert.equal(p.questions.length, 3);
    for (const q of p.questions) assert.ok(q.answer >= 0 && q.answer < q.options.length);
  }
  assert.ok(rsvp.schedule(PASSAGES[0].text, 5).every((w) => w.ms > 0));
});

test('mental rotation: figures are chiral, so "mirror" is never also "same"', () => {
  for (const d of LEVELS) {
    for (const t of rotation.makeTrials(makeRng(`mr${d}`), d)) {
      assert.equal(rotation.sameUpToRotation(t.shape, t.other), !t.isMirror);
    }
  }
});

test('15-puzzle: scrambles are solvable, sliding keeps them solvable', () => {
  for (const d of LEVELS) {
    const n = fifteen.sizeFor(d);
    const b = fifteen.scramble(makeRng(`15-${d}`), n, fifteen.scrambleFor(d));
    assert.ok(fifteen.isSolvable(b, n));
    assert.ok(!fifteen.isSolved(b));
    fifteen.slide(b, n, 0);
    assert.ok(fifteen.isSolvable(b, n));
  }
  const b = fifteen.solved(3);
  assert.equal(fifteen.slide(b, 3, 6), 2); // slides two tiles along the bottom row
  assert.deepEqual(b.slice(6), [0, 7, 8]);
});

test('rush hour: pack move counts are exact minimums (spot check)', () => {
  assert.ok(rushPack.puzzles.length >= 300);
  const rng = makeRng('rh-test');
  for (const p of rng.shuffle(rushPack.puzzles).slice(0, 12)) {
    const { vehicles, start } = rush.fromBoard(p.board);
    assert.equal(rush.toBoard(vehicles, start), p.board);
    const a = rush.analyse(vehicles, start);
    const key = start.reduce((k, x) => k * rush.N + x, 0);
    assert.equal(a.dist.get(key), p.moves, p.board);
  }
  for (const d of LEVELS) {
    const p = rush.fromPack(makeRng(`rh${d}`), d, rushPack);
    assert.ok(p && Math.abs(p.optimal - rush.targetFor(d)) <= 4);
  }
});

test('map: every quiz country has a shape; views stay on the map', () => {
  for (const d of LEVELS) {
    const qs = mapQuiz.makeQuestions(makeRng(`map${d}`), d, worldMap.countries, countries.countries);
    assert.equal(qs.length, mapQuiz.QUESTIONS);
    for (const q of qs) {
      assert.ok(worldMap.countries.some((c) => c.iso2 === q.iso2));
      if (q.kind === 'name') assert.equal(q.options[q.answer], q.name);
    }
  }
  for (const cont of ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania']) {
    const [x, y, w, h] = mapQuiz.continentBox(worldMap.countries, countries.countries, cont, worldMap.width, worldMap.height);
    assert.ok(x >= 0 && y >= 0 && x + w <= worldMap.width + 1 && h > 0, cont);
  }
});

test('chess puzzles: moves are legal from the stored position', () => {
  const pack = json('assets/packs/lichess-puzzles.json');
  for (const d of [1, 5, 10]) {
    const ps = puzzles.pickPuzzles(makeRng(`cp${d}`), d, pack);
    assert.equal(ps.length, puzzles.PER_ROUND);
    for (const p of ps) {
      const chess = new Chess(p.fen);
      for (const m of p.moves) chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
      assert.ok(Math.abs(p.rating - puzzles.targetRating(d)) <= 1200);
    }
  }
});

test('connect four: takes a win, blocks a loss', () => {
  const b = c4.empty();
  [0, 1, 2].forEach((c) => c4.drop(b, c, 2)); // computer (2) has three in a row
  [0, 1, 2].forEach((c) => c4.drop(b, c, 1));
  assert.equal(c4.bestMove(b, 2, 10, makeRng('w')), 3);
  const b2 = c4.empty();
  [0, 1, 2].forEach((c) => c4.drop(b2, c, 1)); // human threatens four
  assert.equal(c4.bestMove(b2, 2, 10, makeRng('b')), 3);
});

test('nim: the start is winnable and the winning move zeroes the nim-sum', () => {
  for (const d of LEVELS) {
    const s = nim.setup(makeRng(`nim${d}`), d);
    assert.ok(!nim.losing(s));
    const m = nim.winningMove(s);
    s.heaps[m.heap] -= m.take;
    assert.ok(nim.losing(s));
  }
});

test('knowledge: trivia, chronology, flags and capitals are well formed', () => {
  assert.ok(TRIVIA.length >= 100);
  assert.equal(new Set(TRIVIA.map((q) => q.q)).size, TRIVIA.length);
  for (const d of LEVELS) {
    const qs = trivia.makeQuestions(makeRng(`tr${d}`), d, []);
    assert.equal(qs.length, trivia.COUNT);
    for (const q of qs) assert.equal(new Set(q.options).size, 4);
    const rounds = chrono.makeRounds(makeRng(`ch${d}`), d);
    for (const r of rounds) assert.equal(new Set(r.map((e) => e.year)).size, r.length);
    for (const q of [...flags.makeQuestions(makeRng(`fl${d}`), d, countries), ...capitals.makeQuestions(makeRng(`cap${d}`), d, countries)]) {
      assert.ok(q.answer >= 0 && new Set(q.options).size === q.options.length, q.prompt);
    }
  }
  assert.equal(chrono.orderScore([...EVENTS].sort((a, b) => a.year - b.year).slice(0, 5)), 1);
  assert.equal(chrono.orderScore([...EVENTS].sort((a, b) => b.year - a.year).slice(0, 5)), 0);
  for (const c of countries.countries) assert.ok(fs.existsSync(new URL(`../node_modules/flag-icons/flags/4x3/${c.iso2.toLowerCase()}.svg`, import.meta.url)), c.iso2);
});

test('riddles: 200+, unique, every answer matches itself', () => {
  const all = [...RIDDLE_ITEMS, ...SITUATION_ITEMS, ...REBUS_ITEMS];
  assert.ok(all.length >= 200, `${all.length}`);
  assert.equal(new Set(all.map((x) => x.prompt)).size, all.length);
  for (const it of [...RIDDLE_ITEMS, ...REBUS_ITEMS]) assert.ok(matches(it.answerText, it.answers), it.prompt);
  for (const d of LEVELS) assert.equal(pickTiered(makeRng(`rd${d}`), RIDDLE_ITEMS, d, 5).length, 5);
});

test('no-AI challenge: the same challenge all day, different across days', () => {
  assert.equal(noAi.challengeFor('2026-09-27'), noAi.challengeFor('2026-09-27'));
  const week = new Set(['01', '02', '03', '04', '05', '06', '07'].map((d) => noAi.challengeFor(`2026-10-${d}`)));
  assert.ok(week.size >= 4);
});
