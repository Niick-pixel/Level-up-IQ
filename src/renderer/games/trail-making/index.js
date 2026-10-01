import { meta, labels, layout, scoreRound } from './logic.js';
import { h } from '../../ui.js';
import { clock } from '../_engine/common.js';

export { meta };

const svgNs = 'http://www.w3.org/2000/svg';

export function start(root, ctx) {
  const d = ctx.difficulty;
  const names = labels(d);
  const pts = layout(ctx.rng, names.length);
  let next = 0;
  let mistakes = 0;
  let done = false;
  const time = clock();

  const lines = document.createElementNS(svgNs, 'svg');
  lines.setAttribute('class', 'trail-lines');
  lines.setAttribute('viewBox', '0 0 100 64');
  lines.setAttribute('preserveAspectRatio', 'none');
  const status = h('div', { class: 'muted', 'aria-live': 'polite' });
  // DOM order is shuffled too, so tabbing through doesn't give the order away
  const order = ctx.rng.shuffle(names.map((_, i) => i));
  const buttons = names.map((name, i) => h('button', {
    type: 'button', class: 'trail-node', style: { left: `${pts[i].x}%`, top: `${(pts[i].y / 64) * 100}%` },
    'aria-label': name, onclick: () => pick(i),
  }, name));
  const field = h('div', { class: 'trail-field' }, lines, order.map((i) => buttons[i]));
  root.append(h('div', { class: 'g-center' }, status, field));

  const say = () => { status.textContent = next < names.length ? `Next: ${names[next]}` : ''; };
  function pick(i) {
    if (done) return;
    if (i !== next) {
      mistakes += 1;
      buttons[i].classList.add('wrong');
      setTimeout(() => buttons[i].classList.remove('wrong'), 300);
      return;
    }
    buttons[i].classList.add('found');
    if (i > 0) {
      const l = document.createElementNS(svgNs, 'line');
      for (const [k, v] of Object.entries({ x1: pts[i - 1].x, y1: pts[i - 1].y, x2: pts[i].x, y2: pts[i].y })) l.setAttribute(k, v);
      lines.append(l);
    }
    next += 1;
    say();
    if (next === names.length) {
      done = true;
      const timeMs = time.ms();
      ctx.onFinish({ ...scoreRound({ d, timeMs, mistakes }), timeMs, difficulty: d });
    }
  }
  say();
  return {
    pause() { time.pause(); field.style.visibility = 'hidden'; },
    resume() { time.resume(); field.style.visibility = ''; },
    destroy() { done = true; },
  };
}
