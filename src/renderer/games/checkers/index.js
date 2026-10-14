import { meta, initial, legal, play, owner, isKing, aiMove, scoreGame, GAME } from './logic.js';
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
  let sel = -1;
  let last = [];
  let cursor = 42;
  const timers = [];

  const cells = Array.from({ length: 64 }, (_, i) => h('button', {
    type: 'button', tabindex: '-1', class: `ck-sq ${(Math.floor(i / 8) + (i % 8)) % 2 ? 'dark' : 'light'}`, onclick: () => click(i),
  }));
  const board = h('div', { class: 'ck-board', role: 'grid', 'aria-label': 'Checkers board' }, cells);
  const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
  const tally = h('div', { class: 'muted small' });
  root.append(h('div', { class: 'g-center' }, tally, board, msg));

  const myMoves = () => (s.p === 1 && !busy && !done ? legal(s) : []);

  function draw() {
    const moves = myMoves();
    const from = new Set(moves.map((m) => m.path[0]));
    const targets = new Set(moves.filter((m) => m.path[0] === sel).map((m) => m.path[m.path.length - 1]));
    cells.forEach((el, i) => {
      el.classList.toggle('sel', i === sel);
      el.classList.toggle('movable', from.has(i) && sel < 0);
      el.classList.toggle('target', targets.has(i));
      el.classList.toggle('last', last.includes(i));
      el.classList.toggle('cursor', i === cursor);
      const x = s.b[i];
      el.replaceChildren(x ? h('span', { class: `ck-piece p${owner(x)}${isKing(x) ? ' king' : ''}` }, isKing(x) ? '♛' : '') : '');
      el.setAttribute('aria-label', `${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}${x ? `: ${owner(x) === 1 ? 'your' : 'computer'} ${isKing(x) ? 'king' : 'man'}` : ''}`);
    });
    const n = (p) => s.b.filter((x) => owner(x) === p).length;
    tally.textContent = `You ${n(1)} pieces · Computer ${n(2)} pieces`;
    if (!done && !busy && s.p === 1) msg.textContent = moves.some((m) => m.caps.length) ? 'You must capture.' : msg.textContent === 'You must capture.' ? '' : msg.textContent;
  }

  function click(i) {
    if (busy || done || paused || s.p !== 1) return;
    cursor = i;
    const moves = myMoves();
    if (sel >= 0) {
      const options = moves.filter((m) => m.path[0] === sel && m.path[m.path.length - 1] === i);
      if (options.length) {
        // two capture chains can end on the same square: take the one capturing more
        const m = options.sort((a, b) => b.caps.length - a.caps.length)[0];
        s = play(s, m);
        last = m.path;
        sel = -1;
        msg.textContent = m.caps.length > 1 ? `Multi-jump: ${m.caps.length} pieces!` : '';
        return next();
      }
    }
    sel = moves.some((m) => m.path[0] === i) ? i : -1;
    if (sel < 0 && owner(s.b[i]) === 1) msg.textContent = moves.some((m) => m.caps.length) ? 'You must capture with another piece.' : 'That piece can’t move.';
    draw();
  }

  function next() {
    draw();
    const end = GAME.over(s);
    if (end != null) return finish(end === 0 ? 'draw' : s.p === 1 ? 'loss' : 'win');
    if (s.p === 2) {
      busy = true;
      msg.textContent = 'Thinking…';
      draw();
      timers.push(setTimeout(() => {
        if (done) return;
        const m = aiMove(s, d, ctx.rng);
        s = play(s, m);
        last = m.path;
        busy = false;
        msg.textContent = m.caps.length ? `The computer captured ${m.caps.length === 1 ? 'a piece' : `${m.caps.length} pieces`}.` : '';
        next();
      }, 350));
    }
  }

  function finish(outcome) {
    done = true;
    draw();
    const material = s.b.reduce((a, x) => a + (owner(x) === 1 ? (isKing(x) ? 175 : 100) : owner(x) === 2 ? -(isKing(x) ? 175 : 100) : 0), 0);
    const r = scoreGame({ outcome, d, material });
    msg.textContent = outcome === 'win' ? 'You win!' : outcome === 'loss' ? 'The computer wins.' : 'A draw (40 moves with no progress).';
    msg.className = `g-msg ${outcome === 'win' ? 'ok' : outcome === 'loss' ? 'bad' : ''}`;
    timers.push(setTimeout(() => ctx.onFinish({ ...r, timeMs: time.ms(), difficulty: d }), 1600));
  }

  function onKey(e) {
    if (paused || done) return;
    const mv = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }[e.key];
    if (mv) { e.preventDefault(); cursor = (cursor + mv + 64) % 64; draw(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(cursor); }
    else if (e.key === 'Escape') { sel = -1; draw(); }
  }
  document.addEventListener('keydown', onKey);
  draw();

  return {
    pause() { paused = true; time.pause(); board.style.visibility = 'hidden'; },
    resume() { paused = false; time.resume(); board.style.visibility = ''; },
    destroy() { done = true; timers.forEach(clearTimeout); document.removeEventListener('keydown', onKey); },
  };
}
