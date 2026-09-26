// Typed-answer rounds. A game supplies:
//   makeItems(rng, difficulty, data) → [{ prompt, detail?, check(answer) → true | false | number 0..1,
//                                         answerText, explain?, placeholder?, inputmode? }]
// A number from check() is partial credit (e.g. how close a Fermi estimate was).
import { h, clear } from '../../ui.js';
import { clock, clamp01 } from './common.js';

export function inputGame({ meta, makeItems, load, attempts = 1, hintFor }) {
  return {
    meta,
    start(root, ctx) {
      let destroyed = false;
      let paused = false;
      let items = null;
      let i = 0;
      let credit = 0;
      let full = 0;
      let hints = 0;
      const time = clock();
      const card = h('div', { class: 'quiz-card' }, h('p', { class: 'muted' }, 'Loading…'));
      root.append(card);
      let lockTick = 0;

      (async () => {
        const data = load ? await load() : null;
        if (destroyed) return;
        items = makeItems(ctx.rng, ctx.difficulty, data);
        show();
      })().catch((err) => clear(card).append(h('p', { class: 'g-msg bad' }, `Couldn't start: ${err.message}`)));

      function show() {
        const it = items[i];
        let tries = 0;
        let done = false;
        const input = h('input', { type: 'text', class: 'g-answer wide', autocomplete: 'off', spellcheck: 'false', placeholder: it.placeholder || 'Your answer', inputmode: it.inputmode || null, 'aria-label': 'Your answer' });
        const feedback = h('div', { class: 'g-msg', 'aria-live': 'polite' });
        const explain = h('p', { class: 'muted small', hidden: true });
        const next = h('button', { class: 'btn primary', type: 'button', hidden: true, onclick: advance }, i + 1 < items.length ? 'Next (Enter)' : 'Finish (Enter)');
        const giveUp = h('button', { class: 'btn small', type: 'button', onclick: () => finishItem(0, true) }, 'Show answer');
        const hintBtn = hintFor ? h('button', { class: 'btn small', type: 'button', onclick: () => {
          if (ctx.hints.lockedFor() > 0) return;
          hints += 1;
          feedback.textContent = hintFor(it);
          feedback.className = 'g-msg';
        } }, 'Hint') : null;
        clear(card).append(
          h('div', { class: 'muted small' }, `${i + 1} / ${items.length}`),
          h('h3', { class: 'quiz-prompt' }, it.prompt),
          it.detail ? h('blockquote', {}, it.detail) : null,
          h('div', { class: 'row' }, input, hintBtn, giveUp),
          feedback, explain, next);
        input.focus();

        const updateLocks = () => {
          const left = Math.ceil(ctx.hints.lockedFor() / 1000);
          for (const [b, label] of [[giveUp, 'Show answer'], [hintBtn, 'Hint']]) {
            if (!b) continue;
            b.disabled = left > 0 || done;
            b.textContent = left > 0 ? `${label} (${left}s)` : label;
          }
        };
        clearInterval(lockTick);
        lockTick = setInterval(updateLocks, 250);
        updateLocks();

        function finishItem(score, revealed) {
          done = true;
          input.disabled = true;
          updateLocks();
          credit += score;
          if (score >= 0.999) full += 1;
          feedback.textContent = revealed ? `Answer: ${it.answerText}` : score >= 0.999 ? 'Correct.' : score > 0 ? `Close. Answer: ${it.answerText}` : `Answer: ${it.answerText}`;
          feedback.className = `g-msg ${score >= 0.999 ? 'ok' : score > 0 ? '' : 'bad'}`;
          if (it.explain) {
            explain.textContent = it.explain;
            explain.hidden = false;
          }
          next.hidden = false;
          next.focus();
        }

        input.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' || paused || done) return;
          e.preventDefault();
          if (!input.value.trim()) return;
          const r = it.check(input.value.trim());
          const score = r === true ? 1 : r === false ? 0 : clamp01(r);
          tries += 1;
          if (score >= 0.999 || tries >= attempts || typeof r === 'number') return finishItem(score, false);
          feedback.textContent = `Not that. ${attempts - tries} more ${attempts - tries === 1 ? 'try' : 'tries'}.`;
          feedback.className = 'g-msg bad';
          input.select();
        });
      }

      function advance() {
        i += 1;
        if (i < items.length) return show();
        destroyed = true;
        clearInterval(lockTick);
        const accuracy = full / items.length;
        const performance = clamp01(credit / items.length - hints * 0.05);
        ctx.onFinish({ score: Math.round(credit * 100 * (1 + ctx.difficulty / 10)), accuracy, performance, timeMs: time.ms(), difficulty: ctx.difficulty });
      }

      return {
        pause() { paused = true; time.pause(); card.style.visibility = 'hidden'; },
        resume() { paused = false; time.resume(); card.style.visibility = ''; card.querySelector('input:not([disabled])')?.focus(); },
        destroy() { destroyed = true; clearInterval(lockTick); },
      };
    },
  };
}
