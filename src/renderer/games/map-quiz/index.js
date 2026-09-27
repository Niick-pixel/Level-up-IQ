import { meta, makeQuestions, continentBox, worldBox } from './logic.js';
import { h, clear, fill } from '../../ui.js';
import { clock, loadPack } from '../_engine/common.js';

export { meta };

const SVG = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}) => {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

export function start(root, ctx) {
  const time = clock();
  let destroyed = false;
  let onKey = null;
  const card = h('div', { class: 'quiz-card wide' }, h('p', { class: 'muted' }, 'Loading the map…'));
  root.append(card);

  Promise.all([loadPack('world-map'), loadPack('countries')]).then(([map, info]) => {
    if (!destroyed) run(map, info.countries);
  }).catch((err) => fill(card, h('p', { class: 'g-msg bad' }, `Couldn't load the map: ${err.message}`)));

  function run(map, info) {
    const qs = makeQuestions(ctx.rng, ctx.difficulty, map.countries, info);
    let i = 0;
    let correct = 0;
    let answered = false;

    const svg = s('svg', { class: 'world-map', viewBox: worldBox(map.width, map.height).join(' '), role: 'img', 'aria-label': 'World map' });
    svg.append(s('path', { d: map.other, class: 'wm-other' }));
    const paths = new Map();
    const sizeOf = (iso) => map.countries.find((c) => c.iso2 === iso)?.size ?? 0;
    for (const c of map.countries) {
      const g = s('g', { 'data-iso': c.iso2 });
      g.append(s('path', { d: c.d, class: 'wm-land' }));
      if (c.size < 5) g.append(s('circle', { cx: c.x, cy: c.y, r: 4, class: 'wm-dot' })); // tiny places get a clickable dot
      svg.append(g);
      paths.set(c.iso2, g);
    }
    svg.addEventListener('click', (e) => {
      const g = e.target.closest('g[data-iso]');
      if (g) clicked(g.dataset.iso);
    });

    const prompt = h('h3', { class: 'quiz-prompt' });
    const options = h('div', { class: 'options' });
    const msg = h('div', { class: 'g-msg', 'aria-live': 'polite' });
    const count = h('div', { class: 'muted small' });
    const next = h('button', { class: 'btn primary', type: 'button', hidden: true, onclick: advance }, 'Next (Enter)');
    fill(card, count, prompt, h('div', { class: 'map-frame' }, svg), options, msg, next);

    function show() {
      answered = false;
      const q = qs[i];
      count.textContent = `${i + 1} / ${qs.length}`;
      msg.textContent = '';
      next.hidden = true;
      paths.forEach((g) => g.classList.remove('target', 'right', 'wrong'));
      clear(options);
      if (q.kind === 'find') {
        prompt.textContent = `Click ${q.name}`;
        const zoom = ctx.difficulty >= 4 && sizeOf(q.iso2) < 200;
        svg.setAttribute('viewBox', (zoom ? continentBox(map.countries, info, q.continent, map.width, map.height) : worldBox(map.width, map.height)).join(' '));
        svg.classList.add('clickable');
      } else {
        prompt.textContent = 'Which country is highlighted?';
        svg.setAttribute('viewBox', (sizeOf(q.iso2) < 200 ? continentBox(map.countries, info, q.continent, map.width, map.height) : worldBox(map.width, map.height)).join(' '));
        svg.classList.remove('clickable');
        paths.get(q.iso2).classList.add('target');
        q.options.forEach((o, k) => options.append(h('button', { class: 'btn option', type: 'button', onclick: () => choose(k) }, h('kbd', {}, String(k + 1)), ' ', o)));
      }
    }

    function clicked(iso) {
      const q = qs[i];
      if (answered || q.kind !== 'find') return;
      mark(iso === q.iso2, () => {
        paths.get(q.iso2).classList.add('right');
        if (iso !== q.iso2) paths.get(iso)?.classList.add('wrong');
        const name = info.find((c) => c.iso2 === iso)?.name;
        return iso === q.iso2 ? 'Correct.' : `That's ${name}. ${q.name} is shown in green.`;
      });
    }

    function choose(k) {
      const q = qs[i];
      if (answered || q.kind !== 'name') return;
      const buttons = [...options.children];
      mark(k === q.answer, () => {
        buttons.forEach((b, j) => { b.disabled = true; if (j === q.answer) b.classList.add('right'); else if (j === k) b.classList.add('wrong'); });
        return k === q.answer ? 'Correct.' : `It's ${q.name}.`;
      });
    }

    function mark(ok, paint) {
      answered = true;
      if (ok) correct += 1;
      msg.textContent = paint();
      msg.className = `g-msg ${ok ? 'ok' : 'bad'}`;
      next.hidden = false;
      next.focus();
    }

    function advance() {
      i += 1;
      if (i < qs.length) return show();
      destroyed = true;
      time.pause();
      const accuracy = correct / qs.length;
      ctx.onFinish({ score: Math.round(correct * 100 * (1 + ctx.difficulty / 10)), accuracy, performance: accuracy, timeMs: time.ms(), difficulty: ctx.difficulty });
    }

    onKey = (e) => {
      const n = Number(e.key);
      if (!answered && qs[i]?.kind === 'name' && n >= 1 && n <= 4) choose(n - 1);
    };
    document.addEventListener('keydown', onKey);
    show();
  }

  return {
    pause() { time.pause(); card.style.visibility = 'hidden'; },
    resume() { time.resume(); card.style.visibility = ''; },
    destroy() { destroyed = true; if (onKey) document.removeEventListener('keydown', onKey); },
  };
}
