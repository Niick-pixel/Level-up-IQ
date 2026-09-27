import { meta, COLS, ROWS, empty, canDrop, drop, winLine, full, bestMove } from './logic.js';
import { h } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };

export function start(root, ctx) {
  const time = clock();
  const b = empty();
  const human = 1;
  const cpu = 2;
  let turn = ctx.rng.chance(0.5) ? human : cpu;
  let over = false;
  let moves = 0;
  let timer = 0;

  const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
  const cells = [];
  const cols = Array.from({ length: COLS }, (_, c) => {
    const col = h('button', { class: 'c4-col', type: 'button', 'aria-label': `Column ${c + 1}`, onclick: () => humanMove(c) });
    for (let r = 0; r < ROWS; r++) {
      const cell = h('span', { class: 'c4-cell' });
      cells[r * COLS + c] = cell;
      col.append(cell);
    }
    return col;
  });
  const grid = h('div', { class: 'c4' }, cols);
  root.append(h('div', { class: 'g-center' }, msg, grid, h('p', { class: 'muted small' }, 'You are ', h('span', { class: 'c4-chip p1' }), ', the computer is ', h('span', { class: 'c4-chip p2' }), '. Keys 1–7 drop a disc.')));

  function paint(r, c, p) {
    cells[r * COLS + c].classList.add(`p${p}`);
  }

  function place(c, p) {
    const r = drop(b, c, p);
    if (r < 0) return false;
    moves += 1;
    paint(r, c, p);
    const line = winLine(b, r, c);
    if (line) {
      line.forEach(([y, x]) => cells[y * COLS + x].classList.add('win'));
      return end(p === human ? 'win' : 'loss');
    }
    if (full(b)) return end('draw');
    turn = 3 - p;
    return true;
  }

  function humanMove(c) {
    if (over || turn !== human || !canDrop(b, c)) return;
    place(c, human);
    if (!over) cpuMove();
  }

  function cpuMove() {
    msg.textContent = 'Thinking…';
    grid.classList.add('waiting');
    timer = setTimeout(() => {
      place(bestMove(b, cpu, ctx.difficulty, ctx.rng), cpu);
      grid.classList.remove('waiting');
      if (!over) msg.textContent = 'Your turn.';
    }, 350);
  }

  function end(outcome) {
    over = true;
    grid.classList.remove('waiting');
    time.pause();
    msg.textContent = outcome === 'win' ? 'Four in a row: you win!' : outcome === 'loss' ? 'The computer connected four.' : 'Board full: a draw.';
    msg.className = `g-msg ${outcome === 'win' ? 'ok' : outcome === 'loss' ? 'bad' : ''}`;
    const performance = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : Math.min(0.2, moves / 200);
    setTimeout(() => ctx.onFinish({ score: Math.round(performance * 100 * ctx.difficulty), accuracy: outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0, performance, timeMs: time.ms(), difficulty: ctx.difficulty }), 1600);
    return true;
  }

  const onKey = (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= COLS) humanMove(n - 1);
  };
  document.addEventListener('keydown', onKey);
  if (turn === cpu) cpuMove(); else msg.textContent = 'You go first.';

  return {
    pause() { time.pause(); grid.style.visibility = 'hidden'; },
    resume() { time.resume(); grid.style.visibility = ''; },
    destroy() { over = true; clearTimeout(timer); document.removeEventListener('keydown', onKey); },
  };
}
