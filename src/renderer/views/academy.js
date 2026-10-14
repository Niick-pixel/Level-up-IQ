// Chess Academy: a course from "how does the knight move?" to tactics, openings and endgames.
// The course itself is data (../academy/lessons.js); this file runs it on the shared board.
import { h, fill, toast } from '../ui.js';
import { state } from '../state.js';
import { Chess } from '../vendor/chess/chess.js';
import { chessBoard, checkedKing } from '../games/_engine/chessboard.js';
import { loadPack } from '../games/_engine/common.js';
import { makeRng } from '../../shared/rng.js';
import { UNITS, LESSONS, lessonById, nextLesson, starFen, starPar, whiteAgain, starsFor, puzzlesFor, defenderMove } from '../academy/lessons.js';

const progress = () => state.settings.chessProgress || {};
const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

export function renderAcademy(el) {
  const p = progress();
  const done = LESSONS.filter((l) => p[l.id]?.done).length;
  const next = LESSONS.find((l) => !p[l.id]?.done);
  el.append(h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('div', {}, h('h1', {}, 'Chess Academy'),
        h('p', { class: 'muted' }, `From the moves of the pieces to tactics, openings and endgames. ${done} of ${LESSONS.length} lessons done.`)),
      h('div', { class: 'row' },
        next ? h('a', { class: 'btn primary', href: `#/chess/${next.id}` }, done ? `Continue: ${next.title}` : 'Start the first lesson') : null)),
    h('div', { class: 'goal-bar', style: { maxWidth: '100%' } }, h('span', { style: { width: `${(100 * done) / LESSONS.length}%` } })),
    h('div', { class: 'grid', style: { marginTop: '16px' } },
      h('a', { class: 'card', href: '#/play/chess-engine' }, h('div', { class: 'eyebrow' }, 'Practice'), h('div', {}, 'Play Stockfish with a coach: hints, take-backs and a review of your game')),
      h('a', { class: 'card', href: '#/play/chess-puzzles' }, h('div', { class: 'eyebrow' }, 'Puzzles'), h('div', {}, 'Rated puzzles that get harder as you improve'))),
    UNITS.map((u, ui) => h('section', { class: 'academy-unit' },
      h('h2', {}, `${ui + 1}. ${u.title}`),
      h('p', { class: 'muted small' }, u.blurb),
      h('div', { class: 'academy-lessons' }, u.lessons.map((l) => {
        const r = p[l.id];
        return h('a', { class: `academy-lesson${r?.done ? ' done' : ''}${next?.id === l.id ? ' next' : ''}`, href: `#/chess/${l.id}` },
          h('span', { class: 'academy-icon', 'aria-hidden': 'true' }, l.icon),
          h('span', {}, h('span', { class: 'academy-title' }, l.title),
            h('span', { class: 'academy-stars', 'aria-label': r?.done ? `${r.stars} of 3 stars` : 'not done yet' }, r?.done ? starText(r.stars) : '')));
      })))),
  ));
}

export async function renderLesson(el, params) {
  const lesson = lessonById(params.id);
  if (!lesson) { el.append(h('div', { class: 'page' }, h('p', {}, 'Lesson not found. '), h('a', { href: '#/chess' }, 'Chess Academy'))); return; }
  const page = h('div', { class: 'page' });
  el.append(page);

  let destroyed = false;
  let cleanup = () => {};
  let active = 0;
  let last = performance.now();
  const tick = setInterval(() => { const t = performance.now(); if (document.hasFocus()) active += t - last; last = t; }, 1000);

  // expand puzzle sets into single puzzles
  let steps = lesson.exercises;
  if (steps.some((x) => x.type === 'puzzles')) {
    page.append(h('p', { class: 'muted' }, 'Loading puzzles…'));
    const pack = await loadPack('lichess-puzzles');
    const rng = makeRng(`${lesson.id}:${Date.now()}`);
    steps = steps.flatMap((x) => (x.type === 'puzzles' ? puzzlesFor(pack, x, rng).map((p) => ({ type: 'puzzle', p })) : [x]));
  }
  if (destroyed) return;
  const results = [];

  const head = h('div', { class: 'page-head' },
    h('div', {}, h('div', { class: 'muted small' }, h('a', { href: '#/chess' }, 'Chess Academy'), ` · ${UNITS.find((u) => u.id === lesson.unit).title}`),
      h('h1', {}, lesson.title)),
    h('div', { class: 'academy-dots', 'aria-hidden': 'true' }));
  const body = h('div', {});
  fill(page, head, body);

  const dots = () => fill(head.querySelector('.academy-dots'), steps.map((_, i) => h('span', { class: i < results.length ? 'done' : i === results.length ? 'now' : '' })));

  function intro() {
    dots();
    fill(body, h('div', { class: 'card hero' },
      lesson.intro.map((t) => h('p', {}, t)),
      h('p', { class: 'muted small' }, `${steps.length} ${steps.length === 1 ? 'exercise' : 'exercises'}.`),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => run(0) }, 'Start'))));
    body.querySelector('.btn.primary').focus();
  }

  function run(i) {
    cleanup();
    cleanup = () => {};
    dots();
    if (i >= steps.length) return finish();
    const ex = steps[i];
    const done = (r) => { results.push(r); setTimeout(() => !destroyed && run(i + 1), 900); };
    const runner = { stars: runStars, goal: runGoal, quiz: runQuiz, line: runLine, puzzle: runPuzzle, mate: runMate }[ex.type];
    cleanup = runner(ex, done, `${i + 1} of ${steps.length}`) || (() => {});
  }

  // ---- shared layout: board on the left, prompt and feedback on the right
  function layout({ board, title, prompt, extra = [] }) {
    const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
    const side = h('div', { class: 'chess-side' }, h('div', { class: 'eyebrow' }, title), prompt ? h('h3', { class: 'quiz-prompt' }, prompt) : null, msg, ...extra);
    fill(body, h('div', { class: 'card hero' }, h('div', { class: 'chess-layout' }, board ? board.el : h('div'), side)));
    return { msg, side };
  }
  const say = (msg, text, cls = '') => { msg.textContent = text; msg.className = `g-msg ${cls}`; };

  // ---- collect the stars
  function runStars(ex, done, count) {
    const par = starPar(ex, Chess);
    let chess; let left; let moves;
    const board = chessBoard({
      orientation: 'w',
      legalFrom: (sq) => (left.length ? chess.moves({ square: sq, verbose: true }) : []),
      onMove: (from, to, promotion) => {
        chess.move({ from, to, promotion });
        moves += 1;
        left = left.filter((s) => s !== to);
        chess = new Chess(whiteAgain(chess.fen()), { skipValidation: true });
        draw(from, to);
        if (!left.length) {
          const stars = starsFor({ moves, par });
          say(ui.msg, `${starText(stars)} All stars in ${moves} ${moves === 1 ? 'move' : 'moves'}${moves > par ? ` (it can be done in ${par})` : ''}.`, 'ok');
          done({ stars });
        }
      },
    });
    const counter = h('div', { class: 'muted small' });
    const ui = layout({ board, title: `Exercise ${count}`, prompt: 'Collect all the stars.', extra: [counter, h('div', { class: 'row' }, h('button', { class: 'btn small', type: 'button', onclick: reset }, 'Start over'))] });
    function draw(from, to) {
      board.set(chess.board());
      board.last(from, to);
      board.mark(left, 'star');
      counter.textContent = `Moves: ${moves} · best possible: ${par}`;
    }
    function reset() { chess = new Chess(starFen(ex), { skipValidation: true }); left = ex.stars.slice(); moves = 0; say(ui.msg, ''); draw(); }
    reset();
    return () => board.destroy();
  }

  // ---- one move that achieves a goal
  const GOAL_TEXT = { capture: 'That doesn’t capture anything.', check: 'That isn’t check.', mate: 'Not checkmate: the king can still escape, block or capture.', castle: 'To castle, move the king two squares toward a rook.', enpassant: 'Capture the pawn that just moved two squares, diagonally, onto the square it skipped.', promote: 'Move the pawn to the last rank.', block: 'Put a piece between the attacker and your king.' };
  function reaches(goal, m, c) {
    return { capture: Boolean(m.captured), check: c.inCheck(), mate: c.isCheckmate(), castle: m.flags.includes('k') || m.flags.includes('q'), enpassant: m.flags.includes('e'), promote: Boolean(m.promotion), block: m.piece !== 'k' && !m.captured }[goal];
  }
  function runGoal(ex, done, count) {
    const chess = new Chess(ex.fen);
    let mistakes = 0; let hints = 0; let solved = false;
    const answers = chess.moves({ verbose: true }).filter((m) => { chess.move(m); const r = reaches(ex.goal, m, chess); chess.undo(); return r; });
    const board = chessBoard({
      orientation: chess.turn(),
      legalFrom: (sq) => (solved ? [] : chess.moves({ square: sq, verbose: true })),
      onMove: (from, to, promotion) => {
        const m = chess.move({ from, to, promotion });
        board.set(chess.board()); board.last(from, to); board.check(checkedKing(chess));
        if (reaches(ex.goal, m, chess)) {
          solved = true;
          board.flash(to, 'good');
          say(ui.msg, `Yes: ${m.san}.`, 'ok');
          return done({ stars: starsFor({ mistakes, hints }) });
        }
        mistakes += 1;
        board.flash(to, 'bad');
        say(ui.msg, GOAL_TEXT[ex.goal], 'bad');
        setTimeout(() => { chess.undo(); board.set(chess.board()); board.last(); board.check(checkedKing(chess)); }, 700);
      },
    });
    const hintBtn = h('button', { class: 'btn small', type: 'button', onclick: () => { hints += 1; const a = answers[0]; board.mark(hints === 1 ? [a.from] : [a.from, a.to], 'hint'); say(ui.msg, hints === 1 ? 'Try the highlighted piece.' : `The highlighted move: ${a.san}.`); } }, 'Hint');
    const ui = layout({ board, title: `Exercise ${count}`, prompt: ex.prompt, extra: [h('div', { class: 'row' }, hintBtn)] });
    board.set(chess.board()); board.check(checkedKing(chess));
    return () => board.destroy();
  }

  // ---- multiple choice
  function runQuiz(ex, done, count) {
    let board = null;
    if (ex.fen) {
      const chess = new Chess(ex.fen);
      board = chessBoard({ orientation: 'w', legalFrom: () => [], onMove: () => {} });
      board.set(chess.board()); board.check(checkedKing(chess)); board.lock(true);
    }
    let mistakes = 0;
    const buttons = ex.options.map((o, i) => h('button', { class: 'btn option', type: 'button', onclick: () => pick(i) }, o));
    const ui = layout({ board, title: `Question ${count}`, prompt: ex.question, extra: [h('div', { class: 'options' }, buttons)] });
    function pick(i) {
      if (i !== ex.answer) {
        mistakes += 1;
        buttons[i].classList.add('wrong'); buttons[i].disabled = true;
        say(ui.msg, 'Not quite. Try again.', 'bad');
        return;
      }
      buttons.forEach((b) => { b.disabled = true; });
      buttons[i].classList.add('right');
      say(ui.msg, ex.explain, 'ok');
      ui.side.append(h('button', { class: 'btn primary', type: 'button', onclick: () => done({ stars: starsFor({ mistakes }) }) }, 'Next'));
      ui.side.querySelector('.btn.primary').focus();
    }
    return () => board?.destroy();
  }

  // ---- play one side of an opening line
  function runLine(ex, done, count) {
    const chess = new Chess();
    let i = 0; let mistakes = 0; let misses = 0; let hints = 0;
    const notes = h('ul', { class: 'line-notes' });
    const num = () => { const ply = chess.history().length - 1; return `${Math.floor(ply / 2) + 1}${ply % 2 ? '…' : '.'} `; };
    const board = chessBoard({
      orientation: ex.side,
      legalFrom: (sq) => (chess.turn() === ex.side && i < ex.moves.length ? chess.moves({ square: sq, verbose: true }) : []),
      onMove: (from, to, promotion) => {
        const m = chess.move({ from, to, promotion });
        if (m.san === ex.moves[i]) {
          misses = 0;
          board.mark([], 'hint');
          notes.append(h('li', {}, num(), h('strong', {}, m.san), ` ${ex.notes[m.san] || ''}`));
          notes.scrollTop = notes.scrollHeight;
          say(ui.msg, '✓', 'ok');
          i += 1;
          return advance(m);
        }
        mistakes += 1; misses += 1;
        say(ui.msg, misses >= 3 ? `The move is ${ex.moves[i]}.` : misses === 2 ? 'Not this one. The highlighted piece moves next.' : `${m.san} is a move, but not this line’s. Try again.`, 'bad');
        setTimeout(() => {
          chess.undo(); board.set(chess.board()); board.last();
          if (misses >= 2) { const want = chess.moves({ verbose: true }).find((x) => x.san === ex.moves[i]); hints += 1; board.mark(misses >= 3 ? [want.from, want.to] : [want.from], 'hint'); }
        }, 600);
      },
    });
    const ui = layout({ board, title: `Line ${count}`, prompt: `You play ${ex.side === 'w' ? 'White' : 'Black'}. Play the moves of the line; the other side answers.`, extra: [notes] });
    function advance(m) {
      board.set(chess.board()); board.last(m?.from, m?.to); board.check(checkedKing(chess));
      if (i >= ex.moves.length) {
        say(ui.msg, 'You played the whole line.', 'ok');
        return done({ stars: starsFor({ mistakes: Math.max(0, mistakes - hints), hints }) });
      }
      if (chess.turn() !== ex.side) {
        board.lock(true);
        setTimeout(() => {
          if (destroyed) return;
          const r = chess.move(ex.moves[i]);
          notes.append(h('li', { class: 'muted' }, num(), r.san));
          i += 1;
          board.lock(false);
          advance(r);
        }, 600);
      }
    }
    board.set(chess.board());
    advance(null);
    return () => board.destroy();
  }

  // ---- a Lichess puzzle: the opponent's move, then the winning line
  function runPuzzle({ p }, done, count) {
    const chess = new Chess(p.fen);
    let i = 0; let mistakes = 0; let hints = 0; let over = false;
    const uci = (s) => ({ from: s.slice(0, 2), to: s.slice(2, 4), promotion: s[4] });
    const me = chess.turn() === 'w' ? 'b' : 'w'; // the puzzle starts with the opponent's move
    const board = chessBoard({
      orientation: me,
      legalFrom: (sq) => (!over && chess.turn() === me ? chess.moves({ square: sq, verbose: true }) : []),
      onMove: (from, to, promotion) => {
        const m = chess.move({ from, to, promotion });
        const want = uci(p.moves[i]);
        const ok = (m.from === want.from && m.to === want.to) || (i === p.moves.length - 1 && chess.isCheckmate());
        if (ok) {
          board.mark([], 'hint');
          board.flash(to, 'good');
          i += 1;
          return step(m);
        }
        mistakes += 1;
        board.flash(to, 'bad');
        say(ui.msg, 'Not the best move. Look for checks, captures and threats.', 'bad');
        setTimeout(() => { chess.undo(); board.set(chess.board()); board.last(); }, 600);
      },
    });
    const hintBtn = h('button', { class: 'btn small', type: 'button', onclick: () => { hints += 1; const w = uci(p.moves[i]); board.mark(hints % 2 ? [w.from] : [w.from, w.to], 'hint'); } }, 'Hint');
    const ui = layout({ board, title: `Puzzle ${count} · rated ${p.rating}`, prompt: `${me === 'w' ? 'White' : 'Black'} to move: find the best line.`, extra: [h('div', { class: 'row' }, hintBtn), h('p', { class: 'muted small' }, 'Puzzle from the Lichess database (CC0).')] });
    function step(m) {
      board.set(chess.board()); board.last(m?.from, m?.to); board.check(checkedKing(chess));
      if (i >= p.moves.length) {
        over = true;
        say(ui.msg, 'Solved!', 'ok');
        return done({ stars: starsFor({ mistakes, hints }) });
      }
      if (chess.turn() !== me) {
        board.lock(true);
        setTimeout(() => {
          if (destroyed) return;
          const r = chess.move(uci(p.moves[i]));
          i += 1;
          board.lock(false);
          step(r);
          if (i < p.moves.length) say(ui.msg, i === 1 ? 'Your move.' : 'Good. Keep going.');
        }, i === 0 ? 700 : 500);
      }
    }
    board.set(chess.board());
    step(null);
    return () => board.destroy();
  }

  // ---- mate a lone king within N moves
  function runMate(ex, done, count) {
    const rng = makeRng(`${lesson.id}:${Date.now()}`);
    let chess; let moves; let tries = 0; let over;
    const counter = h('div', { class: 'muted small' });
    const board = chessBoard({
      orientation: 'w',
      legalFrom: (sq) => (!over && chess.turn() === 'w' ? chess.moves({ square: sq, verbose: true }) : []),
      onMove: (from, to, promotion) => {
        const m = chess.move({ from, to, promotion });
        moves += 1;
        draw(m);
        if (chess.isCheckmate()) {
          over = true;
          say(ui.msg, `Checkmate in ${moves} moves!`, 'ok');
          return done({ stars: Math.max(1, 3 - tries) });
        }
        if (chess.isStalemate()) return fail('Stalemate! The king has no move but isn’t in check: that’s a draw. Leave it a square.');
        if (moves >= ex.within) return fail(`That’s ${ex.within} moves. Try a tighter plan.`);
        board.lock(true);
        setTimeout(() => {
          if (destroyed || over) return;
          const r = chess.move(defenderMove(chess, rng));
          board.lock(false);
          draw(r);
          if (chess.isInsufficientMaterial()) fail(`The king took your ${r.captured === 'q' ? 'queen' : 'rook'}. Keep your pieces protected or far from the king.`);
        }, 450);
      },
    });
    const ui = layout({ board, title: `Exercise ${count}`, prompt: ex.prompt, extra: [counter, h('div', { class: 'row' }, h('button', { class: 'btn small', type: 'button', onclick: reset }, 'Start over'))] });
    function draw(m) {
      board.set(chess.board()); board.last(m?.from, m?.to); board.check(checkedKing(chess));
      counter.textContent = `Moves used: ${moves} of ${ex.within}`;
    }
    function fail(text) { over = true; board.lock(true); tries += 1; say(ui.msg, `${text} Press “Start over”.`, 'bad'); }
    function reset() { chess = new Chess(ex.fen); moves = 0; over = false; board.lock(false); say(ui.msg, ''); draw(null); }
    reset();
    return () => board.destroy();
  }

  async function finish() {
    cleanup = () => {};
    const stars = Math.max(1, Math.round(results.reduce((a, r) => a + r.stars, 0) / Math.max(1, results.length)));
    const prev = progress()[lesson.id];
    const chessProgress = { ...progress(), [lesson.id]: { done: true, stars: Math.max(stars, prev?.stars || 0) } };
    state.settings = await window.api.setSettings({ chessProgress });
    window.api.recordPractice(Math.round(active)).catch(() => {});
    active = 0;
    const nxt = nextLesson(lesson.id);
    fill(body, h('div', { class: 'card hero' },
      h('h2', {}, `Lesson complete ${starText(stars)}`),
      h('p', { class: 'muted' }, stars === 3 ? 'Perfect.' : 'Repeat it any time for more stars.'),
      h('div', { class: 'row' },
        nxt ? h('a', { class: 'btn primary', href: `#/chess/${nxt.id}` }, `Next: ${nxt.title}`) : null,
        h('button', { class: 'btn', type: 'button', onclick: () => { results.length = 0; intro(); } }, 'Again'),
        h('a', { class: 'btn', href: '#/chess' }, 'All lessons'))));
    toast('Saved.');
  }

  intro();
  return () => {
    destroyed = true;
    clearInterval(tick);
    cleanup();
    if (active > 5000) window.api.recordPractice(Math.round(active)).catch(() => {});
  };
}
