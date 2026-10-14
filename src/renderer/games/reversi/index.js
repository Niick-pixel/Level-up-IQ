import { meta, initial, legal, play, flips, count, isOver, aiMove, scoreGame } from './logic.js';
import { h } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };

export function start(root, ctx) {
  const d = ctx.difficulty;
  const time = clock();
  let s = initial();
  let busy = false;
  let done = false;
  let paused = false;
  let lastMove = -1;
  let cursor = 19;
  const timers = [];

  const cells = Array.from({ length: 64 }, (_, i) => h('button', { type: 'button', class: 'rv-cell', tabindex: '-1', onclick: () => human(i) }));
  const board = h('div', { class: 'rv-board', role: 'grid', 'aria-label': 'Reversi board' }, cells);
  const score = h('div', { class: 'rv-score' });
  const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
  root.append(h('div', { class: 'g-center' }, score, board, msg, h('p', { class: 'muted small' }, 'Arrows + Enter also work. Corners can never be flipped.')));

  function draw() {
    const moves = s.p === 1 && !busy && !done ? legal(s) : [];
    cells.forEach((el, i) => {
      el.className = `rv-cell${moves.includes(i) ? ' legal' : ''}${i === lastMove ? ' last' : ''}${i === cursor ? ' cursor' : ''}`;
      el.replaceChildren(s.b[i] ? h('span', { class: `rv-disc ${s.b[i] === 1 ? 'black' : 'white'}` }) : '');
      el.setAttribute('aria-label', `${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}: ${s.b[i] === 1 ? 'black' : s.b[i] === 2 ? 'white' : moves.includes(i) ? 'legal move' : 'empty'}`);
    });
    score.replaceChildren(h('span', {}, h('span', { class: 'rv-disc black small' }), ` You ${count(s.b, 1)}`), h('span', {}, h('span', { class: 'rv-disc white small' }), ` Computer ${count(s.b, 2)}`));
  }

  function human(i) {
    if (busy || done || paused || s.p !== 1) return;
    if (!flips(s.b, i, 1).length) { msg.textContent = 'That square doesn’t outflank anything.'; return; }
    s = play(s, i);
    lastMove = i;
    msg.textContent = '';
    next();
  }

  function next() {
    draw();
    if (isOver(s)) return finish();
    if (!legal(s).length) {
      msg.textContent = s.p === 1 ? 'You have no legal move: you pass.' : 'The computer has no move and passes. Your turn again.';
      s = play(s, -1);
      timers.push(setTimeout(next, 900));
      return;
    }
    if (s.p === 2) {
      busy = true;
      msg.textContent = 'Thinking…';
      draw();
      timers.push(setTimeout(() => {
        if (done) return;
        const m = aiMove(s, d, ctx.rng);
        s = play(s, m);
        lastMove = m;
        busy = false;
        msg.textContent = '';
        next();
      }, 350));
    }
  }

  function finish() {
    done = true;
    draw();
    const you = count(s.b, 1);
    const them = count(s.b, 2);
    const r = scoreGame({ you, them, d });
    msg.textContent = r.outcome === 'win' ? `You win, ${you}–${them}!` : r.outcome === 'loss' ? `The computer wins, ${them}–${you}.` : `A draw, ${you}–${them}.`;
    msg.className = `g-msg ${r.outcome === 'win' ? 'ok' : r.outcome === 'loss' ? 'bad' : ''}`;
    timers.push(setTimeout(() => ctx.onFinish({ score: r.score, accuracy: r.accuracy, performance: r.performance, timeMs: time.ms(), difficulty: d }), 1600));
  }

  function onKey(e) {
    if (paused || done) return;
    const mv = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }[e.key];
    if (mv) { e.preventDefault(); cursor = (cursor + mv + 64) % 64; draw(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); human(cursor); }
  }
  document.addEventListener('keydown', onKey);
  draw();

  return {
    pause() { paused = true; time.pause(); board.style.visibility = 'hidden'; },
    resume() { paused = false; time.resume(); board.style.visibility = ''; },
    destroy() { done = true; timers.forEach(clearTimeout); document.removeEventListener('keydown', onKey); },
  };
}
