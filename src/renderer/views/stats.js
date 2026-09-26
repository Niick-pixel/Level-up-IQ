import { h, fmtMinutes, pct, toast } from '../ui.js';
import { SKILLS, SKILL_LABELS } from '../../shared/game-contract.js';
import { GAMES } from '../games/registry.js';

const SVG = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  el.append(...kids);
  return el;
};

/** Skill radar: ratings 800..2000 mapped onto the radius. */
function radar(ratings) {
  const size = 340, c = size / 2, R = 105;
  const norm = (r) => Math.min(1, Math.max(0.04, (r - 800) / 1200));
  const pt = (i, f) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / SKILLS.length;
    return [c + Math.cos(a) * R * f, c + Math.sin(a) * R * f];
  };
  const svg = s('svg', { viewBox: `0 0 ${size} ${size}`, class: 'radar', width: size, height: size, role: 'img', 'aria-label': 'Skill ratings radar chart' });
  for (const f of [0.25, 0.5, 0.75, 1]) {
    svg.append(s('polygon', { class: 'ring', points: SKILLS.map((_, i) => pt(i, f).join(',')).join(' ') }));
  }
  svg.append(s('polygon', { class: 'area', points: SKILLS.map((k, i) => pt(i, norm(ratings[k].r)).join(',')).join(' ') }));
  SKILLS.forEach((k, i) => {
    const [x, y] = pt(i, 1.22);
    svg.append(s('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, SKILL_LABELS[k]));
  });
  return svg;
}

export async function renderStats(el) {
  const sum = await window.api.statsSummary();
  const max = Math.max(1, ...sum.recent.map((d) => d.ms));
  const nameOf = (id) => GAMES.find((g) => g.meta.id === id)?.meta.name || id;
  const exp = async (format) => {
    const file = await window.api.exportStats(format);
    if (file) toast(`Saved ${file}`);
  };

  el.append(h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('h1', {}, 'Stats'),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', type: 'button', onclick: () => exp('json') }, 'Export JSON'),
        h('button', { class: 'btn small', type: 'button', onclick: () => exp('csv') }, 'Export CSV'))),
    h('p', { class: 'muted small' }, 'Everything stays on this computer.'),

    h('div', { class: 'stat-row' },
      stat(fmtMinutes(sum.today.ms), 'today'),
      stat(String(sum.today.games), 'rounds today'),
      stat(fmtMinutes(sum.totals.ms), 'thinking without AI, all time'),
      stat(String(sum.totals.keywords), 'keywords explored')),

    h('div', { class: 'grid', style: { gridTemplateColumns: '1.4fr 1fr', marginTop: '14px', alignItems: 'start' } },
      h('div', { class: 'card' },
        h('h3', {}, 'Last 14 days'),
        h('div', { class: 'bars' }, sum.recent.map((d) => h('div', { class: 'bar', title: `${d.date}: ${fmtMinutes(d.ms)}, ${d.games} rounds` },
          h('div', { class: 'fill', style: { height: `${(d.ms / max) * 100}%` } }),
          h('div', { class: 'lbl' }, d.date.slice(8)))))),
      h('div', { class: 'card', style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
        h('h3', { style: { alignSelf: 'flex-start' } }, 'Skills'),
        radar(sum.ratings))),

    h('div', { class: 'card', style: { marginTop: '14px' } },
      h('h3', {}, 'Personal bests'),
      Object.keys(sum.bests).length
        ? h('table', {},
          h('thead', {}, h('tr', {}, ['Game', 'Score', 'Accuracy', 'Level', 'When'].map((t) => h('th', {}, t)))),
          h('tbody', {}, Object.entries(sum.bests).map(([id, b]) => h('tr', {},
            h('td', {}, nameOf(id)), h('td', {}, String(b.score)), h('td', {}, pct(b.accuracy)),
            h('td', {}, String(b.difficulty)), h('td', {}, new Date(b.at).toLocaleDateString())))))
        : h('p', { class: 'muted' }, 'Play a round to set your first personal best.')),

    h('div', { class: 'card', style: { marginTop: '14px' } },
      h('h3', {}, 'Ratings'),
      h('table', {},
        h('thead', {}, h('tr', {}, ['Skill', 'Rating', 'Rounds'].map((t) => h('th', {}, t)))),
        h('tbody', {}, SKILLS.map((k) => h('tr', {},
          h('td', {}, SKILL_LABELS[k]), h('td', {}, String(sum.ratings[k].r)), h('td', {}, String(sum.ratings[k].n)))))))));
}

function stat(num, label) {
  return h('div', { class: 'card stat' }, h('div', { class: 'num' }, num), h('div', { class: 'muted small' }, label));
}
