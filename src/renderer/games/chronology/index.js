import { meta, makeRounds, orderScore, ROUNDS } from './logic.js';
import { fmtYear } from '../_data/events.js';
import { h, clear, extLink, fill } from '../../ui.js';
import { clock, clamp01 } from '../_engine/common.js';

export { meta };

export function start(root, ctx) {
  const time = clock();
  let destroyed = false;
  const scores = [];
  const card = h('div', { class: 'quiz-card' }, h('p', { class: 'muted' }, 'Gathering events…'));
  root.append(card);

  window.api.onThisDay({ seed: ctx.seed }).catch(() => null).then((otd) => {
    if (destroyed) return;
    const rounds = makeRounds(ctx.rng, ctx.difficulty, otd?.events);
    const today = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
    let r = 0;
    show();

    function show() {
      const list = rounds[r].slice();
      const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
      const ol = h('ol', { class: 'chrono' });
      const check = h('button', { class: 'btn primary', type: 'button', onclick: grade }, 'Check');
      fill(card, 
        h('div', { class: 'muted small' }, `Set ${r + 1} of ${ROUNDS}`),
        h('h3', { class: 'quiz-prompt' }, otd ? `On ${today} in history. Oldest first:` : 'Oldest first:'),
        ol, h('div', { class: 'row' }, check), msg,
        h('p', { class: 'muted small', hidden: !otd }, ...(otd ? ['Events from ', extLink(otd.source.url, otd.source.name), ', CC BY-SA 4.0.'] : [])));

      function draw(focusIdx = -1) {
        clear(ol);
        list.forEach((e, i) => {
          const up = h('button', { class: 'btn small', type: 'button', 'aria-label': 'Move up', disabled: i === 0, onclick: () => move(i, -1) }, '▲');
          const down = h('button', { class: 'btn small', type: 'button', 'aria-label': 'Move down', disabled: i === list.length - 1, onclick: () => move(i, 1) }, '▼');
          const li = h('li', { class: 'chrono-item', tabindex: '0', onkeydown: (ev) => {
            if (!ev.altKey) return;
            if (ev.key === 'ArrowUp') { ev.preventDefault(); move(i, -1); }
            if (ev.key === 'ArrowDown') { ev.preventDefault(); move(i, 1); }
          } }, h('span', { class: 'chrono-text' }, e.text), h('span', { class: 'chrono-year muted', hidden: true }, fmtYear(e.year)), h('span', { class: 'chrono-btns' }, up, down));
          ol.append(li);
          if (i === focusIdx) li.focus();
        });
      }
      function move(i, d) {
        const j = i + d;
        if (j < 0 || j >= list.length || check.disabled) return;
        [list[i], list[j]] = [list[j], list[i]];
        draw(j);
      }
      function grade() {
        check.disabled = true;
        const s = orderScore(list);
        scores.push(s);
        const sorted = list.slice().sort((a, b) => a.year - b.year);
        [...ol.children].forEach((li, i) => {
          li.querySelector('.chrono-year').hidden = false;
          li.querySelectorAll('.chrono-btns button').forEach((b) => { b.disabled = true; });
          li.classList.add(list[i] === sorted[i] ? 'right' : 'wrong');
        });
        msg.textContent = s === 1 ? 'Perfect order!' : `${Math.round(s * 100)}% of pairs in the right order.`;
        msg.className = `g-msg ${s === 1 ? 'ok' : ''}`;
        const next = h('button', { class: 'btn primary', type: 'button', onclick: () => { r += 1; if (r < ROUNDS) show(); else finish(); } }, r + 1 < ROUNDS ? 'Next set' : 'Finish');
        check.replaceWith(next);
        next.focus();
      }
      draw();
    }
  });

  function finish() {
    destroyed = true;
    time.pause();
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const perfect = scores.filter((s) => s === 1).length;
    ctx.onFinish({ score: Math.round(avg * 300 * (1 + ctx.difficulty / 10)), accuracy: perfect / scores.length, performance: clamp01(avg * avg), timeMs: time.ms(), difficulty: ctx.difficulty });
  }

  return {
    pause() { time.pause(); card.style.visibility = 'hidden'; },
    resume() { time.resume(); card.style.visibility = ''; },
    destroy() { destroyed = true; },
  };
}
