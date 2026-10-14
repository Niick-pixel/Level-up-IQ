import { meta, initial, legal, play, isOver, aiMove, scoreGame, STORE, PITS } from './logic.js';
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
  const timers = [];

  const pit = (i) => h('button', { type: 'button', class: 'mc-pit', onclick: () => human(i) });
  const els = Array.from({ length: 14 }, (_, i) => (i === 6 || i === 13 ? h('div', { class: 'mc-store' }) : pit(i)));
  // layout: computer's pits 12..7 on top (right to left), yours 0..5 at the bottom
  const board = h('div', { class: 'mc-board' },
    h('div', { class: 'mc-side left' }, els[13]),
    h('div', { class: 'mc-rows' },
      h('div', { class: 'mc-row' }, [12, 11, 10, 9, 8, 7].map((i) => els[i])),
      h('div', { class: 'mc-row' }, [0, 1, 2, 3, 4, 5].map((i) => els[i]))),
    h('div', { class: 'mc-side right' }, els[6]));
  const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
  root.append(h('div', { class: 'g-center' },
    h('div', { class: 'muted small' }, 'Computer’s store on the left · your store on the right'),
    board, msg, h('p', { class: 'muted small' }, 'Keys 1–6 pick your pits, left to right.')));

  function draw(highlight = -1) {
    const mine = s.p === 1 && !busy && !done ? legal(s) : [];
    els.forEach((el, i) => {
      el.replaceChildren(h('span', { class: 'mc-count' }, String(s.b[i])), h('span', { class: 'mc-seeds' }, '•'.repeat(Math.min(s.b[i], 12))));
      el.classList.toggle('playable', mine.includes(i));
      el.classList.toggle('last', i === highlight);
      if (el.tagName === 'BUTTON') {
        el.disabled = !mine.includes(i);
        el.setAttribute('aria-label', `${PITS[1].includes(i) ? `Your pit ${i + 1}` : 'Computer pit'}: ${s.b[i]} seeds`);
      } else el.setAttribute('aria-label', `${i === 6 ? 'Your' : 'Computer'} store: ${s.b[i]}`);
    });
  }

  function human(i) {
    if (busy || done || paused || s.p !== 1 || !legal(s).includes(i)) return;
    s = play(s, i);
    msg.textContent = s.p === 1 && !isOver(s) ? 'Last seed in your store: go again!' : '';
    next(s.last);
  }

  function next(last) {
    draw(last);
    if (isOver(s)) return finish();
    if (s.p === 2) {
      busy = true;
      draw(last);
      timers.push(setTimeout(() => {
        if (done) return;
        const m = aiMove(s, d, ctx.rng);
        s = play(s, m);
        busy = false;
        if (s.p === 2 && !isOver(s)) msg.textContent = 'The computer gets another turn…';
        else msg.textContent = 'Your turn.';
        next(s.last);
      }, 700));
    }
  }

  function finish() {
    done = true;
    draw();
    const you = s.b[STORE[1]];
    const them = s.b[STORE[2]];
    const r = scoreGame({ you, them, d });
    msg.textContent = r.outcome === 'win' ? `You win, ${you}–${them}!` : r.outcome === 'loss' ? `The computer wins, ${them}–${you}.` : `A draw, ${you}–${them}.`;
    msg.className = `g-msg ${r.outcome === 'win' ? 'ok' : r.outcome === 'loss' ? 'bad' : ''}`;
    timers.push(setTimeout(() => ctx.onFinish({ score: r.score, accuracy: r.accuracy, performance: r.performance, timeMs: time.ms(), difficulty: d }), 1600));
  }

  function onKey(e) {
    const n = Number(e.key);
    if (n >= 1 && n <= 6) { e.preventDefault(); human(n - 1); }
  }
  document.addEventListener('keydown', onKey);
  draw();

  return {
    pause() { paused = true; time.pause(); board.style.visibility = 'hidden'; },
    resume() { paused = false; time.resume(); board.style.visibility = ''; },
    destroy() { done = true; timers.forEach(clearTimeout); document.removeEventListener('keydown', onKey); },
  };
}
