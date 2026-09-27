import { meta, PEGS, MAX_GUESSES, levelShape, makeCode, feedback } from './logic.js';
import { h, fill } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };

export function start(root, ctx) {
  const shape = levelShape(ctx.difficulty);
  const code = makeCode(ctx.rng, ctx.difficulty);
  const time = clock();
  let current = [];
  let guesses = 0;
  let over = false;
  let paused = false;

  const peg = (i) => h('span', { class: 'peg', style: { background: PEGS[i].css } }, PEGS[i].label);
  const history = h('div', { class: 'mm-history' });
  const row = h('div', { class: 'mm-row current' });
  const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
  const palette = h('div', { class: 'row' }, PEGS.slice(0, shape.colours).map((p, i) => h('button', { class: 'btn peg-btn', type: 'button', onclick: () => add(i), title: `Key ${i + 1}` }, peg(i))));
  const submitBtn = h('button', { class: 'btn primary', type: 'button', onclick: submit }, 'Guess (Enter)');
  root.append(h('div', { class: 'g-center' },
    h('p', { class: 'muted' }, `Code of ${shape.length} from ${shape.colours} colours${shape.repeats ? ', colours may repeat' : ', no repeats'}.`),
    history, row, palette,
    h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: back }, 'Remove (Backspace)'), submitBtn), msg));

  const drawRow = () => fill(row, ...[...Array(shape.length)].map((_, i) => (current[i] !== undefined ? peg(current[i]) : h('span', { class: 'peg empty' }, '·'))));
  drawRow();

  function add(i) {
    if (over || paused || current.length >= shape.length) return;
    if (!shape.repeats && current.includes(i)) {
      msg.textContent = 'No repeats at this level.';
      return;
    }
    current.push(i);
    msg.textContent = '';
    drawRow();
  }
  function back() {
    if (over || paused) return;
    current.pop();
    drawRow();
  }
  function submit() {
    if (over || paused) return;
    if (current.length < shape.length) {
      msg.textContent = `Pick ${shape.length} pegs.`;
      return;
    }
    guesses += 1;
    const f = feedback(code, current);
    history.append(h('div', { class: 'mm-row' },
      current.map(peg),
      h('span', { class: 'mm-fb', 'aria-label': `${f.exact} exact, ${f.elsewhere} elsewhere` },
        h('span', { class: 'exact' }, `● ${f.exact}`), ' ', h('span', { class: 'elsewhere' }, `○ ${f.elsewhere}`))));
    current = [];
    drawRow();
    if (f.exact === shape.length) return finish(true);
    if (guesses >= MAX_GUESSES) return finish(false);
  }
  function finish(won) {
    over = true;
    time.pause();
    msg.textContent = won ? `Cracked in ${guesses} guesses!` : 'Out of guesses.';
    msg.className = `g-msg ${won ? 'ok' : 'bad'}`;
    fill(row, ...code.map(peg));
    const performance = won ? Math.min(1, 0.45 + (MAX_GUESSES - guesses + 1) * 0.08) : 0;
    setTimeout(() => ctx.onFinish({ score: Math.round(performance * 800 * (1 + ctx.difficulty / 5)), accuracy: won ? 1 : 0, performance, timeMs: time.ms(), difficulty: ctx.difficulty }), 1200);
  }

  const onKey = (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= shape.colours) add(n - 1);
    else if (e.key === 'Backspace') back();
    else if (e.key === 'Enter') { e.preventDefault(); submit(); }
  };
  document.addEventListener('keydown', onKey);
  return {
    pause() { paused = true; time.pause(); root.style.visibility = 'hidden'; },
    resume() { paused = false; time.resume(); root.style.visibility = ''; },
    destroy() { over = true; document.removeEventListener('keydown', onKey); },
  };
}
