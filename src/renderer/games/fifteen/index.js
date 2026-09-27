import { meta, sizeFor, scrambleFor, scramble, slide, isSolved, manhattan, scoreRound } from './logic.js';
import { h } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };

export function start(root, ctx) {
  const n = sizeFor(ctx.difficulty);
  const board = scramble(ctx.rng, n, scrambleFor(ctx.difficulty));
  // par: somewhere between the Manhattan lower bound and the scramble length
  const par = Math.max(manhattan(board, n), Math.round((manhattan(board, n) + scrambleFor(ctx.difficulty)) / 2));
  const time = clock();
  let moves = 0;
  let done = false;

  const tally = h('div', { class: 'muted small', 'aria-live': 'polite' });
  const tiles = board.map((_, i) => h('button', { class: 'fifteen-tile', type: 'button', onclick: () => press(i) }));
  const grid = h('div', { class: 'fifteen', style: { gridTemplateColumns: `repeat(${n}, 1fr)`, width: `${Math.min(440, n * 88)}px` } }, tiles);
  root.append(h('div', { class: 'g-center' }, tally, grid, h('p', { class: 'muted small' }, 'Goal: 1, 2, 3… in reading order, gap in the bottom-right corner.')));

  function draw() {
    board.forEach((v, i) => {
      tiles[i].textContent = v ? String(v) : '';
      tiles[i].classList.toggle('gap', !v);
      tiles[i].classList.toggle('home', v && v === i + 1);
      tiles[i].setAttribute('aria-label', v ? `Tile ${v}` : 'Gap');
    });
    tally.textContent = `Moves: ${moves}`;
  }

  function press(i) {
    if (done) return;
    const m = slide(board, n, i);
    if (!m) return;
    moves += m;
    draw();
    if (isSolved(board)) finish();
  }

  function finish() {
    done = true;
    time.pause();
    tally.textContent = `Solved in ${moves} moves.`;
    setTimeout(() => ctx.onFinish({ ...scoreRound({ moves, par, difficulty: ctx.difficulty, n }), timeMs: time.ms(), difficulty: ctx.difficulty }), 900);
  }

  function onKey(e) {
    if (done) return;
    const gap = board.indexOf(0);
    const [r, c] = [Math.floor(gap / n), gap % n];
    // the arrow moves a TILE in that direction, into the gap
    const from = { ArrowLeft: c < n - 1 ? gap + 1 : -1, ArrowRight: c > 0 ? gap - 1 : -1, ArrowUp: r < n - 1 ? gap + n : -1, ArrowDown: r > 0 ? gap - n : -1 }[e.key];
    if (from === undefined) return;
    e.preventDefault();
    if (from >= 0) press(from);
  }
  document.addEventListener('keydown', onKey);
  draw();

  return {
    pause() { time.pause(); grid.style.visibility = 'hidden'; },
    resume() { time.resume(); grid.style.visibility = ''; },
    destroy() { done = true; document.removeEventListener('keydown', onKey); },
  };
}
