import { meta, N, EXIT_ROW, generate, fromPack, isSolved, scoreRound } from './logic.js';
import { h, fill } from '../../ui.js';
import { clock, loadPack } from '../_engine/common.js';

export { meta };

const CELL = 64;

export function start(root, ctx) {
  const time = clock();
  let destroyed = false;
  let handlers = null;
  const holder = h('div', { class: 'g-center' }, h('p', { class: 'muted' }, 'Setting up the traffic…'));
  root.append(holder);

  loadPack('rush-hour')
    .then((pack) => fromPack(ctx.rng, ctx.difficulty, pack))
    .catch(() => null)
    .then((p) => {
      if (destroyed) return;
      const puzzle = p || generate(ctx.rng, ctx.difficulty);
      handlers = play(puzzle);
    });

  function play({ vehicles, start: st0, optimal }) {
    const st = st0.slice();
    let moves = 0;
    let lastMoved = -1;
    let selected = 0;
    let done = false;

    const tally = h('div', { class: 'muted small', 'aria-live': 'polite' });
    const board = h('div', { class: 'rh-board', style: { width: `${N * CELL}px`, height: `${N * CELL}px` } },
      h('div', { class: 'rh-exit', style: { top: `${EXIT_ROW * CELL}px`, height: `${CELL}px` }, 'aria-hidden': 'true' }, '→'));
    const els = vehicles.map((v, i) => {
      const el = h('button', {
        class: `rh-car${i === 0 ? ' red' : ''}${v.len === 3 ? ' truck' : ''}`,
        type: 'button',
        'aria-label': i === 0 ? 'Red car' : `${v.len === 3 ? 'Lorry' : 'Car'} ${i}, moves ${v.h ? 'left and right' : 'up and down'}`,
        style: { width: `${(v.h ? v.len : 1) * CELL - 8}px`, height: `${(v.h ? 1 : v.len) * CELL - 8}px` },
        onfocus: () => select(i),
      });
      el.addEventListener('pointerdown', (e) => drag(e, i));
      board.append(el);
      return el;
    });
    fill(holder, tally, board, h('p', { class: 'muted small' }, `Best possible: ${optimal} moves. Drag, or select a vehicle and use the arrow keys.`));

    const place = (i) => {
      const v = vehicles[i];
      const r = v.h ? v.fixed : st[i];
      const c = v.h ? st[i] : v.fixed;
      els[i].style.transform = `translate(${c * CELL + 4}px, ${r * CELL + 4}px)`;
    };
    vehicles.forEach((_, i) => place(i));
    const update = () => { tally.textContent = `Moves: ${moves}`; };
    update();

    function select(i) {
      els[selected].classList.remove('selected');
      selected = i;
      els[i].classList.add('selected');
    }

    /** How far vehicle i can slide from its current position: [min, max] positions. */
    function range(i) {
      const v = vehicles[i];
      const occupied = new Set();
      vehicles.forEach((w, j) => {
        if (j === i) return;
        for (let k = 0; k < w.len; k++) occupied.add(w.h ? `${w.fixed},${st[j] + k}` : `${st[j] + k},${w.fixed}`);
      });
      const free = (p) => !occupied.has(v.h ? `${v.fixed},${p}` : `${p},${v.fixed}`);
      let lo = st[i], hi = st[i];
      while (lo - 1 >= 0 && free(lo - 1)) lo--;
      while (hi + v.len < N && free(hi + v.len)) hi++;
      return [lo, hi];
    }

    function commit(i, pos) {
      if (pos === st[i] || done) return;
      st[i] = pos;
      if (i !== lastMoved) moves += 1; // sliding the same vehicle again continues the same move
      lastMoved = i;
      place(i);
      update();
      if (isSolved(st)) finish();
    }

    function drag(e, i) {
      if (done) return;
      select(i);
      e.preventDefault();
      const v = vehicles[i];
      const [lo, hi] = range(i);
      const origin = v.h ? e.clientX : e.clientY;
      const startPos = st[i];
      const el = els[i];
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
      const moveTo = (ev) => {
        const delta = ((v.h ? ev.clientX : ev.clientY) - origin) / CELL;
        const p = Math.min(hi, Math.max(lo, startPos + delta));
        const r = v.h ? v.fixed : p;
        const c = v.h ? p : v.fixed;
        el.style.transform = `translate(${c * CELL + 4}px, ${r * CELL + 4}px)`;
        return Math.round(p);
      };
      const up = (ev) => {
        el.removeEventListener('pointermove', moveTo);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        el.classList.remove('dragging');
        const p = moveTo(ev);
        place(i);
        commit(i, p);
        place(i);
      };
      el.addEventListener('pointermove', moveTo);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    }

    function onKey(e) {
      if (done) return;
      const v = vehicles[selected];
      const dir = v.h ? { ArrowLeft: -1, ArrowRight: 1 }[e.key] : { ArrowUp: -1, ArrowDown: 1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      const [lo, hi] = range(selected);
      commit(selected, Math.min(hi, Math.max(lo, st[selected] + dir)));
    }
    document.addEventListener('keydown', onKey);
    els[0].focus();

    function finish() {
      done = true;
      time.pause();
      els[0].classList.add('leaving');
      tally.textContent = `Out in ${moves} moves (best possible ${optimal}).`;
      setTimeout(() => ctx.onFinish({ ...scoreRound({ moves, optimal, difficulty: ctx.difficulty }), timeMs: time.ms(), difficulty: ctx.difficulty }), 1000);
    }

    return { board, destroy: () => { done = true; document.removeEventListener('keydown', onKey); } };
  }

  return {
    pause() { time.pause(); holder.style.visibility = 'hidden'; },
    resume() { time.resume(); holder.style.visibility = ''; },
    destroy() { destroyed = true; handlers?.destroy(); },
  };
}
