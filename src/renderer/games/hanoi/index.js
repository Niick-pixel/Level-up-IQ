import { meta, discsFor, optimalMoves, move, solved } from './logic.js';
import { h, fill } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };

export function start(root, ctx) {
  const n = discsFor(ctx.difficulty);
  let pegs = [[...Array(n)].map((_, i) => n - i), [], []];
  let held = null;
  let moves = 0;
  let over = false;
  let paused = false;
  const time = clock();
  const board = h('div', { class: 'hanoi' });
  const info = h('div', { class: 'g-tally muted' });
  root.append(h('div', { class: 'g-center' }, h('p', { class: 'muted' }, `${n} discs · best possible: ${optimalMoves(n)} moves`), board, info));

  function draw() {
    fill(board, ...pegs.map((stack, i) => h('button', {
      class: `peg-col${held === i ? ' held' : ''}`, type: 'button', 'aria-label': `Peg ${i + 1}: ${stack.length} discs`, onclick: () => pick(i),
    }, h('div', { class: 'rod' }), ...stack.map((d) => h('div', { class: 'disc', style: { width: `${30 + (d / n) * 70}%` } })).reverse(), h('span', { class: 'peg-label' }, String(i + 1)))));
    info.textContent = `${moves} moves`;
  }

  function pick(i) {
    if (over || paused) return;
    if (held === null) {
      if (pegs[i].length) held = i;
    } else {
      const next = move(pegs, held, i);
      if (next) {
        pegs = next;
        moves += 1;
      }
      held = null;
    }
    draw();
    if (solved(pegs, n)) {
      over = true;
      time.pause();
      const performance = Math.min(1, optimalMoves(n) / moves);
      info.textContent = `Done in ${moves} moves (best ${optimalMoves(n)}).`;
      setTimeout(() => ctx.onFinish({ score: Math.round(performance * 200 * n), accuracy: performance, performance, timeMs: time.ms(), difficulty: ctx.difficulty }), 900);
    }
  }

  const onKey = (e) => { if (['1', '2', '3'].includes(e.key)) pick(Number(e.key) - 1); };
  document.addEventListener('keydown', onKey);
  draw();
  return {
    pause() { paused = true; time.pause(); },
    resume() { paused = false; time.resume(); },
    destroy() { over = true; document.removeEventListener('keydown', onKey); },
  };
}
