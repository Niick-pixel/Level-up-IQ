// Riddles and lateral-thinking puzzles: think, optionally type a guess (checked against the
// accepted answers), and reveal once the thinking timer allows. You can mark a revealed answer
// "I had it", because riddle answers are often phrased differently.
import { h, fill } from '../../ui.js';
import { clock, matches, clamp01 } from './common.js';

/**
 * items(rng, difficulty) → [{ prompt, answers: string[], answerText, explain?, hint? }]
 */
export function revealGame({ meta, makeItems, perRound = 5, guessable = true }) {
  return {
    meta,
    start(root, ctx) {
      let paused = false;
      let i = 0;
      let got = 0;
      let lockTick = 0;
      const time = clock();
      const items = makeItems(ctx.rng, ctx.difficulty).slice(0, perRound);
      const card = h('div', { class: 'quiz-card' });
      root.append(card);

      function show() {
        const it = items[i];
        let done = false;
        let hinted = false;
        const input = guessable ? h('input', { type: 'text', class: 'g-answer wide', autocomplete: 'off', placeholder: 'Your answer (optional)', 'aria-label': 'Your answer' }) : null;
        const feedback = h('div', { class: 'g-msg', 'aria-live': 'polite' });
        const answer = h('div', { class: 'reveal-answer', hidden: true });
        const reveal = h('button', { class: 'btn', type: 'button', onclick: () => showAnswer(false) }, 'Reveal');
        const hintBtn = it.hint ? h('button', { class: 'btn small', type: 'button', onclick: () => {
          if (ctx.hints.lockedFor() > 0 || done) return;
          hinted = true;
          feedback.textContent = `Hint: ${it.hint}`;
          feedback.className = 'g-msg';
        } }, 'Hint') : null;
        const selfGrade = h('div', { class: 'row', hidden: true },
          h('button', { class: 'btn primary', type: 'button', onclick: () => grade(hinted ? 0.7 : 1) }, 'I had it'),
          h('button', { class: 'btn', type: 'button', onclick: () => grade(0) }, 'I didn\'t'));
        fill(card, 
          h('div', { class: 'muted small' }, `${i + 1} / ${items.length}`),
          h('p', { class: 'riddle' }, it.prompt),
          input ? h('div', { class: 'row' }, input, hintBtn, reveal) : h('div', { class: 'row' }, hintBtn, reveal),
          feedback, answer, selfGrade);
        (input || reveal).focus();

        const updateLocks = () => {
          const left = Math.ceil(ctx.hints.lockedFor() / 1000);
          reveal.disabled = left > 0 || done;
          reveal.textContent = left > 0 ? `Reveal (${left}s)` : 'Reveal';
          if (hintBtn) {
            hintBtn.disabled = left > 0 || done;
            hintBtn.textContent = left > 0 ? `Hint (${left}s)` : 'Hint';
          }
        };
        clearInterval(lockTick);
        lockTick = setInterval(updateLocks, 250);
        updateLocks();

        function showAnswer(correct) {
          done = true;
          updateLocks();
          if (input) input.disabled = true;
          answer.hidden = false;
          fill(answer, h('strong', {}, it.answerText), it.explain ? h('p', { class: 'muted small' }, it.explain) : null);
          if (correct) {
            feedback.textContent = 'Correct!';
            feedback.className = 'g-msg ok';
            got += hinted ? 0.7 : 1;
            answer.append(h('button', { class: 'btn primary', type: 'button', onclick: next }, 'Next (Enter)'));
            answer.querySelector('button').focus();
          } else {
            selfGrade.hidden = false;
            selfGrade.querySelector('button').focus();
          }
        }
        function grade(v) {
          got += v;
          next();
        }
        input?.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' || paused || done || !input.value.trim()) return;
          if (matches(input.value, it.answers)) return showAnswer(true);
          feedback.textContent = 'Not what we had in mind. Keep thinking, or reveal.';
          feedback.className = 'g-msg bad';
          input.select();
        });
      }

      function next() {
        i += 1;
        if (i < items.length) return show();
        clearInterval(lockTick);
        const accuracy = clamp01(got / items.length);
        ctx.onFinish({ score: Math.round(got * 150), accuracy, performance: accuracy, timeMs: time.ms(), difficulty: ctx.difficulty });
      }

      show();
      return {
        pause() { paused = true; time.pause(); card.style.visibility = 'hidden'; },
        resume() { paused = false; time.resume(); card.style.visibility = ''; },
        destroy() { clearInterval(lockTick); },
      };
    },
  };
}
