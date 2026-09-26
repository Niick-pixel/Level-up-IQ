import { meta, genProblem, SPRINT_MS, scoreRound } from './logic.js';
import { h } from '../../ui.js';

export { meta };

export function start(root, ctx) {
  let correct = 0;
  let attempted = 0;
  let elapsed = 0;
  let last = performance.now();
  let paused = false;
  let done = false;
  let problem = null;
  let raf = 0;

  const fill = h('div', { class: 'g-timefill' });
  const question = h('div', { class: 'g-big', 'aria-live': 'polite' });
  const input = h('input', { type: 'text', inputmode: 'numeric', class: 'g-answer', autocomplete: 'off', 'aria-label': 'Your answer' });
  const tally = h('div', { class: 'g-tally muted' });
  root.append(h('div', { class: 'g-center' }, h('div', { class: 'g-timebar' }, fill), question, input, tally));

  const next = () => {
    problem = genProblem(ctx.rng, ctx.difficulty);
    question.textContent = `${problem.text} = ?`;
    input.value = '';
  };
  const showTally = () => { tally.textContent = `${correct} correct · ${attempted - correct} missed`; };

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || paused || done) return;
    e.preventDefault();
    const raw = input.value.trim().replace(',', '.');
    const ok = raw !== '' && Number(raw) === problem.answer;
    attempted += 1;
    if (ok) correct += 1;
    input.classList.remove('ok', 'bad');
    void input.offsetWidth; // restart the flash
    input.classList.add(ok ? 'ok' : 'bad');
    setTimeout(() => input.classList.remove('ok', 'bad'), 260);
    showTally();
    next();
  });

  const finish = () => {
    done = true;
    cancelAnimationFrame(raf);
    input.disabled = true;
    ctx.onFinish({ ...scoreRound({ correct, attempted, difficulty: ctx.difficulty }), timeMs: SPRINT_MS, difficulty: ctx.difficulty });
  };

  const loop = (now) => {
    if (!paused) elapsed += now - last;
    last = now;
    fill.style.transform = `scaleX(${Math.max(0, 1 - elapsed / SPRINT_MS)})`;
    if (elapsed >= SPRINT_MS) return finish();
    raf = requestAnimationFrame(loop);
  };

  next();
  showTally();
  input.focus();
  raf = requestAnimationFrame(loop);

  return {
    pause() { paused = true; },
    resume() { paused = false; last = performance.now(); input.focus(); },
    destroy() { done = true; cancelAnimationFrame(raf); },
  };
}
