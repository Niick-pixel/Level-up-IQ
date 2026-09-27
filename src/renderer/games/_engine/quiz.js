// Multiple-choice rounds. A game supplies meta and a question maker:
//   makeQuestions(rng, difficulty, data) → [{ prompt, detail?, options: string[], answer: index, explain? }]
// Optional: load() → data (async), secondsPerQuestion(difficulty), layout: 'list' | 'grid'.
import { h, fill } from '../../ui.js';
import { clock, clamp01 } from './common.js';

export function quizGame({ meta, makeQuestions, load, secondsPerQuestion, render }) {
  return {
    meta,
    start(root, ctx) {
      let destroyed = false;
      let paused = false;
      let qs = null;
      let i = 0;
      let correct = 0;
      let answered = false;
      let deadline = null;
      let timer = 0;
      const time = clock();
      const card = h('div', { class: 'quiz-card' }, h('p', { class: 'muted' }, 'Loading…'));
      root.append(card);

      const limit = secondsPerQuestion ? secondsPerQuestion(ctx.difficulty) * 1000 : null;

      (async () => {
        const data = load ? await load() : null;
        if (destroyed) return;
        qs = makeQuestions(ctx.rng, ctx.difficulty, data);
        if (!qs.length) throw new Error('No questions available');
        show();
      })().catch((err) => {
        fill(card, h('p', { class: 'g-msg bad' }, `Couldn't start: ${err.message}`));
      });

      function show() {
        answered = false;
        const q = qs[i];
        const feedback = h('div', { class: 'g-msg', 'aria-live': 'polite' });
        const explain = h('p', { class: 'muted small', hidden: true });
        const next = h('button', { class: 'btn primary', type: 'button', hidden: true, onclick: advance }, i + 1 < qs.length ? 'Next (Enter)' : 'Finish (Enter)');
        const buttons = q.options.map((opt, k) => h('button', { class: 'btn option', type: 'button', onclick: () => choose(k) },
          q.options.length <= 9 ? h('kbd', {}, String(k + 1)) : null, ' ', opt));
        const bar = limit ? h('div', { class: 'g-timebar' }, h('div', { class: 'g-timefill' })) : null;
        fill(card, 
          h('div', { class: 'muted small' }, `${i + 1} / ${qs.length}`),
          bar,
          render ? render(q) : null,
          h('h3', { class: 'quiz-prompt' }, q.prompt),
          q.detail ? h('blockquote', {}, q.detail) : null,
          h('div', { class: `options${q.options.length > 4 ? ' many' : ''}` }, buttons),
          feedback, explain, next);

        function choose(k) {
          if (answered || paused) return;
          answered = true;
          clearInterval(timer);
          const ok = k === q.answer;
          if (ok) correct += 1;
          buttons.forEach((b, j) => {
            b.disabled = true;
            if (j === q.answer) b.classList.add('right');
            else if (j === k) b.classList.add('wrong');
          });
          feedback.textContent = k < 0 ? `Time's up: “${q.options[q.answer]}”.` : ok ? 'Correct.' : `Not quite: “${q.options[q.answer]}”.`;
          feedback.className = `g-msg ${ok ? 'ok' : 'bad'}`;
          if (q.explain) {
            explain.textContent = q.explain;
            explain.hidden = false;
          }
          next.hidden = false;
          next.focus();
        }
        card.choose = choose;

        if (limit) {
          deadline = performance.now() + limit;
          const fill = bar.firstChild;
          timer = setInterval(() => {
            if (paused) return;
            const left = deadline - performance.now();
            fill.style.transform = `scaleX(${Math.max(0, left / limit)})`;
            if (left <= 0) choose(-1);
          }, 100);
        }
      }

      function advance() {
        i += 1;
        if (i < qs.length) return show();
        destroyed = true;
        const accuracy = correct / qs.length;
        ctx.onFinish({ score: Math.round(correct * 100 * (1 + ctx.difficulty / 10)), accuracy, performance: clamp01(accuracy), timeMs: time.ms(), difficulty: ctx.difficulty });
      }

      const onKey = (e) => {
        if (paused || !qs || e.target.tagName === 'INPUT') return;
        const n = Number(e.key);
        if (!answered && n >= 1 && n <= Math.min(9, qs[i].options.length)) card.choose(n - 1);
      };
      document.addEventListener('keydown', onKey);

      return {
        pause() { paused = true; time.pause(); if (deadline) deadline += 0; card.style.visibility = 'hidden'; this._pausedAt = performance.now(); },
        resume() {
          paused = false;
          time.resume();
          card.style.visibility = '';
          if (deadline && this._pausedAt) deadline += performance.now() - this._pausedAt;
        },
        destroy() { destroyed = true; clearInterval(timer); document.removeEventListener('keydown', onKey); },
      };
    },
  };
}
