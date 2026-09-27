import { meta, pickPuzzles, themeLabel, scoreRound } from './logic.js';
import { Chess } from '../../vendor/chess/chess.js';
import { chessBoard, checkedKing, parseUci } from '../_engine/chessboard.js';
import { h, extLink, fill } from '../../ui.js';
import { clock, loadPack } from '../_engine/common.js';

export { meta };

const SHOW_THEMES = new Set(['fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck', 'sacrifice', 'deflection', 'decoy', 'interference', 'xRayAttack', 'zugzwang', 'quietMove', 'intermezzo', 'clearance', 'attraction', 'backRankMate', 'smotheredMate', 'mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'promotion', 'underPromotion', 'hangingPiece', 'trappedPiece', 'capturingDefender', 'exposedKing', 'enPassant', 'castling']);

export function start(root, ctx) {
  const time = clock();
  const results = [];
  let destroyed = false;
  let board = null;
  let timers = [];
  const card = h('div', { class: 'quiz-card wide' }, h('p', { class: 'muted' }, 'Loading puzzles…'));
  root.append(card);
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  loadPack('lichess-puzzles').then((pack) => {
    if (destroyed) return;
    const puzzles = pickPuzzles(ctx.rng, ctx.difficulty, pack);
    let i = 0;
    const next = () => (i < puzzles.length ? play(puzzles[i++], i, puzzles.length, next) : finish());
    next();
  }).catch(() => fill(card, 
    h('p', { class: 'g-msg bad' }, 'The chess puzzle pack is missing from this build.'),
    h('p', { class: 'muted' }, 'It is built from the Lichess puzzle database by a CI job. Reinstall the app, or try another game.')));

  function play(pz, n, total, done) {
    board?.destroy();
    const chess = new Chess(pz.fen);
    const player = chess.turn() === 'w' ? 'b' : 'w'; // the first move is the opponent's
    let k = 0;
    let mistakes = 0;
    let revealed = false;
    let over = false;

    const status = h('div', { class: 'g-msg', 'aria-live': 'polite' });
    const lockLeft = () => Math.ceil(ctx.hints.lockedFor() / 1000);
    const solveBtn = h('button', { class: 'btn small', type: 'button', onclick: reveal }, 'Show solution');
    const nextBtn = h('button', { class: 'btn primary', type: 'button', hidden: true, onclick: () => done() }, n < total ? 'Next puzzle' : 'Finish');
    const themes = pz.themes.filter((t) => SHOW_THEMES.has(t)).map(themeLabel);
    board = chessBoard({
      orientation: player,
      legalFrom: (sq) => (over || chess.turn() !== player ? [] : chess.moves({ square: sq, verbose: true })),
      onMove: tryMove,
    });
    const tick = setInterval(() => {
      const left = lockLeft();
      solveBtn.disabled = left > 0 || over;
      solveBtn.textContent = left > 0 ? `Show solution (${left}s)` : 'Show solution';
    }, 250);
    timers.push({ clear: () => clearInterval(tick) });

    fill(card, h('div', { class: 'chess-layout' }, board.el, h('div', { class: 'chess-side' },
      h('div', { class: 'muted small' }, `Puzzle ${n} / ${total} · rated ${pz.rating}`),
      h('h3', { class: 'quiz-prompt' }, `${player === 'w' ? 'White' : 'Black'} to play`),
      status,
      h('div', { class: 'row' }, solveBtn, nextBtn),
      h('details', { class: 'muted small' }, h('summary', {}, 'Hint: themes'), themes.length ? themes.join(', ') : 'none listed'),
      h('p', { class: 'muted small' }, 'From the ', extLink(`https://lichess.org/training/${pz.id}`, `Lichess puzzle database (#${pz.id})`), ', CC0.'))));

    const render = (m) => {
      board.set(chess.board());
      board.last(m?.from, m?.to);
      board.check(checkedKing(chess));
    };
    render();
    board.lock(true);
    later(() => { render(chess.move(parseUci(pz.moves[k++]))); board.lock(false); status.textContent = 'Your move.'; }, 700);

    function tryMove(from, to, promotion) {
      if (over) return;
      const want = parseUci(pz.moves[k]);
      const trial = new Chess(chess.fen());
      const m = trial.move({ from, to, promotion: promotion || 'q' });
      const isLast = k === pz.moves.length - 1;
      const ok = (from === want.from && to === want.to && (promotion || 'q') === (want.promotion || 'q')) || (isLast && trial.isCheckmate());
      if (!ok) {
        mistakes += 1;
        board.flash(to, 'bad');
        status.textContent = `${m.san} isn't it. Try again.`;
        status.className = 'g-msg bad';
        return;
      }
      render(chess.move(m.san));
      board.flash(to, 'good');
      k += 1;
      status.textContent = '✓ Best move.';
      status.className = 'g-msg ok';
      if (k >= pz.moves.length) return solved();
      board.lock(true);
      later(() => { render(chess.move(parseUci(pz.moves[k++]))); board.lock(false); status.textContent = 'Keep going: your move.'; status.className = 'g-msg'; }, 500);
    }

    function reveal() {
      if (over || ctx.hints.lockedFor() > 0) return;
      revealed = true;
      board.lock(true);
      const stepOut = () => {
        if (k >= pz.moves.length) return solved();
        render(chess.move(parseUci(pz.moves[k++])));
        later(stepOut, 650);
      };
      stepOut();
    }

    function solved() {
      over = true;
      board.lock(true);
      const outcome = revealed ? 'revealed' : mistakes ? 'mistakes' : 'clean';
      results.push({ outcome, rating: pz.rating });
      status.textContent = revealed ? 'That was the solution.' : mistakes ? `Solved, after ${mistakes} wrong ${mistakes === 1 ? 'try' : 'tries'}.` : 'Solved first time!';
      status.className = `g-msg ${outcome === 'clean' ? 'ok' : ''}`;
      solveBtn.hidden = true;
      nextBtn.hidden = false;
      nextBtn.focus();
    }
  }

  function finish() {
    destroyed = true;
    time.pause();
    ctx.onFinish({ ...scoreRound(results, ctx.difficulty), timeMs: time.ms(), difficulty: ctx.difficulty });
  }

  return {
    pause() { time.pause(); card.style.visibility = 'hidden'; },
    resume() { time.resume(); card.style.visibility = ''; },
    destroy() {
      destroyed = true;
      timers.forEach((t) => (typeof t === 'object' ? t.clear() : clearTimeout(t)));
      board?.destroy();
    },
  };
}
