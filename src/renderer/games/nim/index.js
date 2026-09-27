import { meta, GAMES, setup, computerMove, HINTS, EXPLAIN_SINGLE, EXPLAIN_NIM } from './logic.js';
import { h, clear, fill } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };

export function start(root, ctx) {
  const time = clock();
  let game = 0;
  let wins = 0;
  let timer = 0;
  let destroyed = false;
  const card = h('div', { class: 'quiz-card' });
  root.append(card);

  function newGame() {
    const state = setup(ctx.rng, ctx.difficulty);
    let turn = 'you';
    let over = false;
    const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
    const heapsEl = h('div', { class: 'nim-heaps' });
    const binary = h('div', { class: 'nim-binary muted small', hidden: game < 2 || state.maxTake !== Infinity });
    fill(card, 
      h('div', { class: 'muted small' }, `Game ${game + 1} of ${GAMES} · won ${wins}`),
      h('h3', { class: 'quiz-prompt' }, state.maxTake === Infinity ? 'Take any number from one heap. Take the last stone to win.' : `Take 1 to ${state.maxTake} stones. Take the last stone to win.`),
      h('p', { class: 'muted', hidden: !HINTS[game] }, HINTS[game] || ''),
      heapsEl, binary, msg);

    function draw() {
      clear(heapsEl);
      state.heaps.forEach((n, i) => {
        const row = h('div', { class: 'nim-heap' }, h('span', { class: 'muted small nim-count' }, String(n)));
        for (let k = 0; k < n; k++) {
          const take = n - k;
          const ok = turn === 'you' && !over && take <= state.maxTake;
          row.append(h('button', {
            class: 'nim-stone', type: 'button', disabled: !ok,
            'aria-label': `Take ${take} from heap ${i + 1}`,
            onclick: () => move(i, take),
            onmouseenter: (e) => { let s = e.target; while (s) { s.classList.add('hover'); s = s.nextElementSibling; } },
            onmouseleave: () => row.querySelectorAll('.hover').forEach((x) => x.classList.remove('hover')),
          }));
        }
        heapsEl.append(row);
      });
      if (!binary.hidden) {
        const width = Math.max(1, ...state.heaps.map((n) => n.toString(2).length));
        binary.textContent = state.heaps.map((n) => n.toString(2).padStart(width, '0')).join('   ');
      }
    }

    function move(i, take) {
      if (over || turn !== 'you') return;
      state.heaps[i] -= take;
      if (done('you')) return;
      turn = 'cpu';
      draw();
      msg.textContent = 'Computer’s turn…';
      timer = setTimeout(() => {
        const m = computerMove(state, ctx.difficulty, ctx.rng);
        state.heaps[m.heap] -= m.take;
        msg.textContent = `The computer took ${m.take} from heap ${m.heap + 1}.`;
        if (done('cpu')) return;
        turn = 'you';
        draw();
      }, 700);
    }

    function done(who) {
      if (state.heaps.some((n) => n > 0)) return false;
      over = true;
      if (who === 'you') wins += 1;
      draw();
      msg.textContent = who === 'you' ? 'You took the last stone. You win!' : 'The computer took the last stone.';
      msg.className = `g-msg ${who === 'you' ? 'ok' : 'bad'}`;
      game += 1;
      const next = h('button', { class: 'btn primary', type: 'button', onclick: () => (game < GAMES ? newGame() : finish(state)) }, game < GAMES ? 'Next game' : 'See the secret');
      card.append(next);
      next.focus();
      return true;
    }

    draw();
    msg.textContent = 'You move first.';
  }

  function finish(state) {
    time.pause();
    fill(card, 
      h('h3', {}, `You won ${wins} of ${GAMES}`),
      h('p', {}, state.maxTake === Infinity ? EXPLAIN_NIM : EXPLAIN_SINGLE),
      h('p', { class: 'muted small' }, 'Every start in this game was a winning position for you, so perfect play wins every time.'));
    destroyed = true;
    const accuracy = wins / GAMES;
    timer = setTimeout(() => ctx.onFinish({ score: Math.round(wins * 100 * (1 + ctx.difficulty / 5)), accuracy, performance: accuracy, timeMs: time.ms(), difficulty: ctx.difficulty }), 2500);
  }

  newGame();

  return {
    pause() { time.pause(); card.style.visibility = 'hidden'; },
    resume() { time.resume(); card.style.visibility = ''; },
    destroy() { if (!destroyed) clearTimeout(timer); destroyed = true; },
  };
}
