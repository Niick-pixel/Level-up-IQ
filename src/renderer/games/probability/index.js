import { meta, SCENARIOS, scoreGuess } from './logic.js';
import { h, clear } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };

const ROUNDS = 3;
const TRIALS = 10000;

export function start(root, ctx) {
  const time = clock();
  const scenarios = ctx.rng.shuffle(SCENARIOS).slice(0, ROUNDS).map((make) => make(ctx.rng, ctx.difficulty));
  let i = 0;
  let total = 0;
  let paused = false;
  let raf = 0;
  const card = h('div', { class: 'quiz-card' });
  root.append(card);

  function show() {
    const s = scenarios[i];
    let guess = 0.5;
    const out = h('output', { class: 'g-big' }, '50%');
    const slider = h('input', { type: 'range', min: '0', max: '100', value: '50', class: 'prob-slider', 'aria-label': 'Your prediction in percent' });
    slider.addEventListener('input', () => { guess = Number(slider.value) / 100; out.textContent = `${slider.value}%`; });
    const lock = h('button', { class: 'btn primary', type: 'button', onclick: run }, 'Lock in my prediction');
    const sim = h('div', { class: 'sim' });
    clear(card).append(
      h('div', { class: 'muted small' }, `${i + 1} / ${ROUNDS} · ${s.title}`),
      h('p', { class: 'riddle' }, s.text),
      h('div', { class: 'row' }, slider, out), lock, sim);
    slider.focus();

    function run() {
      lock.remove();
      slider.disabled = true;
      const r = ctx.rng.fork(`sim${i}`);
      let n = 0, hits = 0;
      const bar = h('div', { class: 'sim-bar' }, h('div', { class: 'sim-fill' }), h('div', { class: 'sim-mark', style: { left: `${guess * 100}%` }, title: 'your prediction' }));
      const label = h('div', { class: 'g-tally' });
      sim.append(bar, label);
      const step = () => {
        if (!paused) {
          const batch = Math.max(20, Math.round(n / 8));
          for (let k = 0; k < batch && n < TRIALS; k++) { n++; if (s.trial(r)) hits++; }
          const est = hits / n;
          bar.firstChild.style.width = `${est * 100}%`;
          label.textContent = `${n.toLocaleString('en')} trials: ${(est * 100).toFixed(1)}%`;
        }
        if (n < TRIALS) raf = requestAnimationFrame(step);
        else done();
      };
      raf = requestAnimationFrame(step);
    }
    function done() {
      const score = scoreGuess(guess, s.exact);
      total += score;
      sim.append(
        h('p', {}, h('strong', {}, `Exact answer: ${(s.exact * 100).toFixed(1)}%`), ` · you said ${Math.round(guess * 100)}%`),
        h('p', { class: 'muted small' }, s.explain),
        h('button', { class: 'btn primary', type: 'button', onclick: next }, i + 1 < ROUNDS ? 'Next scenario' : 'Finish'));
      sim.querySelector('button').focus();
    }
  }
  function next() {
    i += 1;
    if (i < ROUNDS) return show();
    const performance = total / ROUNDS;
    ctx.onFinish({ score: Math.round(performance * 600), accuracy: performance, performance, timeMs: time.ms(), difficulty: ctx.difficulty });
  }

  show();
  return {
    pause() { paused = true; time.pause(); },
    resume() { paused = false; time.resume(); },
    destroy() { cancelAnimationFrame(raf); },
  };
}
