import { meta, pads, startLength, stepMs, lives, makeSequence, scoreRound } from './logic.js';
import { h } from '../../ui.js';
import { clock } from '../_engine/common.js';
import { tone, buzz } from '../../sounds.js';
import { state } from '../../state.js';

export { meta };

export function start(root, ctx) {
  const d = ctx.difficulty;
  const n = pads(d);
  const seq = makeSequence(ctx.rng, d);
  const sound = state.settings?.gameSounds !== false;
  let length = startLength(d);
  let pos = 0;
  let best = 0;
  let mistakes = 0;
  let livesLeft = lives(d);
  let phase = 'show'; // show | input | done
  let timers = [];
  let paused = false;
  const time = clock();

  const status = h('div', { class: 'g-big', 'aria-live': 'polite' });
  const buttons = Array.from({ length: n }, (_, i) => h('button', {
    type: 'button', class: `simon-pad p${i}`, 'aria-label': `Pad ${i + 1}`, onclick: () => press(i),
  }, h('span', {}, String(i + 1))));
  const board = h('div', { class: `simon-board n${n}` }, buttons);
  root.append(h('div', { class: 'g-center' }, status, board));

  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  function flash(i, ms) {
    buttons[i].classList.add('lit');
    if (sound) tone(i, { len: Math.min(0.5, ms / 1000) });
    later(() => buttons[i].classList.remove('lit'), ms * 0.75);
  }

  function show() {
    phase = 'show';
    pos = 0;
    status.textContent = `Watch: ${length}`;
    board.classList.add('watching');
    const step = stepMs(d);
    for (let k = 0; k < length; k++) later(() => flash(seq[k], step), 500 + k * step);
    later(() => {
      phase = 'input';
      board.classList.remove('watching');
      status.textContent = `Your turn: ${length}`;
    }, 500 + length * step);
  }

  function press(i) {
    if (phase !== 'input' || paused) return;
    if (i === seq[pos]) {
      flash(i, 260);
      pos += 1;
      if (pos === length) {
        best = length;
        length += 1;
        phase = 'show';
        status.textContent = '✓';
        if (length > seq.length) return finish();
        later(show, 700);
      }
      return;
    }
    mistakes += 1;
    if (sound) buzz();
    buttons[i].classList.add('wrong');
    later(() => buttons[i].classList.remove('wrong'), 400);
    livesLeft -= 1;
    if (livesLeft <= 0) return finish();
    phase = 'show';
    status.textContent = 'Not quite. Again:';
    later(show, 900);
  }

  function finish() {
    phase = 'done';
    clearTimers();
    const timeMs = time.ms();
    ctx.onFinish({ ...scoreRound({ d, best, mistakes }), timeMs, difficulty: d });
  }

  function onKey(e) {
    const k = Number(e.key);
    if (k >= 1 && k <= n) { e.preventDefault(); press(k - 1); }
  }
  document.addEventListener('keydown', onKey);
  later(show, 300);

  return {
    pause() { paused = true; time.pause(); clearTimers(); board.style.visibility = 'hidden'; },
    resume() {
      paused = false; time.resume(); board.style.visibility = '';
      buttons.forEach((b) => b.classList.remove('lit'));
      if (phase !== 'done') later(show, 300); // replay the current sequence
    },
    destroy() { phase = 'done'; clearTimers(); document.removeEventListener('keydown', onKey); },
  };
}
