import { meta, schedule, pivot, pickPassage, wpm } from './logic.js';
import { h, fill } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };

export function start(root, ctx) {
  const p = pickPassage(ctx.rng);
  const words = schedule(p.text, ctx.difficulty);
  const time = clock();
  let k = 0;
  let timer = 0;
  let phase = 'ready';
  let qi = 0;
  let correct = 0;
  let destroyed = false;
  const card = h('div', { class: 'quiz-card' });
  root.append(card);

  function ready() {
    const go = h('button', { class: 'btn primary', type: 'button', onclick: read }, 'Start reading');
    fill(card, 
      h('div', { class: 'eyebrow muted small' }, `${wpm(ctx.difficulty)} words per minute`),
      h('h3', { class: 'quiz-prompt' }, p.title),
      h('p', { class: 'muted' }, 'Keep your eyes on the red letter. You can only see each word once.'),
      h('div', { class: 'row' }, go));
    go.focus();
  }

  const word = h('div', { class: 'rsvp-word', 'aria-live': 'off' });
  function read() {
    phase = 'read';
    fill(card, h('div', { class: 'rsvp-frame' }, h('div', { class: 'rsvp-tick' }), word, h('div', { class: 'rsvp-tick' })));
    step();
  }
  function step() {
    if (destroyed || phase !== 'read') return;
    if (k >= words.length) { phase = 'quiz'; return question(); }
    const w = words[k].word;
    const at = pivot(w);
    fill(word, h('span', { class: 'rsvp-pre' }, w.slice(0, at)), h('span', { class: 'rsvp-pivot' }, w[at]), h('span', { class: 'rsvp-post' }, w.slice(at + 1)));
    timer = setTimeout(step, words[k].ms);
    k += 1;
  }

  function question() {
    const q = p.questions[qi];
    const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
    const buttons = q.options.map((o, j) => h('button', { class: 'btn option', type: 'button', onclick: () => choose(j) }, h('kbd', {}, String(j + 1)), ' ', o));
    fill(card, h('div', { class: 'muted small' }, `Question ${qi + 1} / ${p.questions.length}`), h('h3', { class: 'quiz-prompt' }, q.q), h('div', { class: 'options' }, buttons), msg);
    let answered = false;
    card.choose = (j) => {
      if (answered) return;
      answered = true;
      const ok = j === q.answer;
      if (ok) correct += 1;
      buttons.forEach((b, n) => { b.disabled = true; if (n === q.answer) b.classList.add('right'); else if (n === j) b.classList.add('wrong'); });
      msg.textContent = ok ? 'Correct.' : 'Not quite.';
      msg.className = `g-msg ${ok ? 'ok' : 'bad'}`;
      setTimeout(nextQ, ok ? 800 : 1500);
    };
  }
  const choose = (j) => card.choose?.(j);
  function nextQ() {
    qi += 1;
    if (qi < p.questions.length) return question();
    phase = 'done';
    time.pause();
    const accuracy = correct / p.questions.length;
    fill(card, h('h3', {}, p.title), h('p', {}, p.text));
    ctx.onFinish({ score: Math.round(correct * 60 * (wpm(ctx.difficulty) / 200)), accuracy, performance: accuracy, timeMs: time.ms(), difficulty: ctx.difficulty });
  }

  const onKey = (e) => {
    const n = Number(e.key);
    if (phase === 'quiz' && n >= 1 && n <= 4) choose(n - 1);
  };
  document.addEventListener('keydown', onKey);
  ready();

  return {
    pause() { time.pause(); clearTimeout(timer); card.style.visibility = 'hidden'; },
    resume() {
      time.resume();
      card.style.visibility = '';
      if (phase === 'read') { k = Math.max(0, k - 4); step(); } // back up a few words
    },
    destroy() { destroyed = true; clearTimeout(timer); document.removeEventListener('keydown', onKey); },
  };
}
