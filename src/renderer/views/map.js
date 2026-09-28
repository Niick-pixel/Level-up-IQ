// The curiosity map: every domain on a ring, the keywords you've explored clustered at their
// domain, lines where the bank says two explored topics are related, and the frontier: topics one
// step from what you already know.
import { h, fill, plural } from '../ui.js';
import { svg } from './charts.js';

export async function renderMap(el) {
  const map = await window.api.curiosity();
  const W = 760, C = W / 2, R = 250;
  const n = map.domains.length;
  const anchor = new Map(map.domains.map((d, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [d.id, { a, x: C + Math.cos(a) * R, y: C + Math.sin(a) * R }];
  }));
  // explored keywords spiral out from their domain's anchor, towards the centre
  const pos = new Map();
  const perDomain = {};
  for (const node of map.nodes.slice().sort((a, b) => a.first - b.first)) {
    const k = (perDomain[node.domain] = (perDomain[node.domain] || 0) + 1) - 1;
    const an = anchor.get(node.domain);
    const t = k * 2.39996; // golden angle
    const r = 9 * Math.sqrt(k + 0.5);
    const inward = 16 + r;
    pos.set(node.id, {
      x: an.x - Math.cos(an.a) * inward + Math.cos(t) * r * 0.9,
      y: an.y - Math.sin(an.a) * inward + Math.sin(t) * r * 0.9,
    });
  }
  const tip = h('div', { class: 'chart-tip', hidden: true });
  const frame = h('div', { class: 'chart map-frame-c' });
  const showTip = (target, strong, small) => {
    tip.replaceChildren(h('strong', {}, strong), h('span', { class: 'muted small' }, small));
    tip.hidden = false;
    const fr = frame.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    tip.style.left = `${Math.min(fr.width - 180, Math.max(0, r.left - fr.left - 60))}px`;
    tip.style.top = `${Math.max(0, r.top - fr.top - 50)}px`;
  };
  const hide = () => { tip.hidden = true; };
  const s = svg('svg', { viewBox: `0 0 ${W} ${W}`, class: 'chart-svg curiosity', role: 'img', 'aria-label': `Curiosity map: ${map.nodes.length} explored keywords across ${n} domains` },
    svg('circle', { cx: C, cy: C, r: R, class: 'grid', fill: 'none' }),
    map.edges.map(([a, b]) => (pos.has(a) && pos.has(b) ? svg('line', { x1: pos.get(a).x, y1: pos.get(a).y, x2: pos.get(b).x, y2: pos.get(b).y, class: 'edge' }) : null)),
    map.domains.map((d) => {
      const an = anchor.get(d.id);
      const lx = C + Math.cos(an.a) * (R + 22), ly = C + Math.sin(an.a) * (R + 22);
      const anchorSide = Math.cos(an.a) > 0.2 ? 'start' : Math.cos(an.a) < -0.2 ? 'end' : 'middle';
      // only explored domains get a label (the rest are listed under Coverage), so labels don't collide
      return svg('g', { class: `domain${d.explored ? ' explored' : ''}` },
        svg('circle', { cx: an.x, cy: an.y, r: 3 + Math.min(9, d.explored), class: 'anchor' }, svg('title', {}, `${d.label}: ${d.explored} of ${d.total}`)),
        d.explored ? svg('text', { x: lx, y: ly, 'text-anchor': anchorSide, 'dominant-baseline': 'middle', class: 'tick domain-label' }, `${d.label} (${d.explored})`) : null);
    }),
    map.nodes.map((node) => {
      const p = pos.get(node.id);
      const g = svg('a', { href: `#/keyword/${node.id}`, class: 'node', tabindex: '0', 'aria-label': node.term },
        svg('circle', { cx: p.x, cy: p.y, r: 12, class: 'hit' }),
        svg('circle', { cx: p.x, cy: p.y, r: node.sessions ? 5 : 4, class: `dot${node.sessions ? '' : ' light'}` }));
      const show = () => showTip(g, node.term, node.sessions ? `full session · quiz ${Math.round(node.quiz * 100)} %` : 'looked at');
      g.addEventListener('pointerenter', show);
      g.addEventListener('focus', show);
      g.addEventListener('pointerleave', hide);
      g.addEventListener('blur', hide);
      return g;
    }));
  frame.append(s, tip);

  const coverage = h('table', {}, h('tbody', {}, map.domains.slice().sort((a, b) => b.explored / b.total - a.explored / a.total).map((d) => h('tr', {},
    h('td', {}, d.label),
    h('td', { class: 'meter-cell' }, h('div', { class: 'meter', role: 'img', 'aria-label': `${d.explored} of ${d.total}` }, h('div', { style: { width: `${Math.min(100, (100 * d.explored) / d.total)}%` } }))),
    h('td', { class: 'num-col muted small' }, `${d.explored} / ${d.total}`)))));

  el.append(h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('h1', {}, 'Curiosity map'), h('a', { class: 'btn small', href: '#/stats' }, '← Stats')),
    h('p', { class: 'muted' }, map.nodes.length
      ? `${plural(map.nodes.length, 'topic')} explored so far. Bigger dots are full sessions; lines connect related topics you’ve both explored.`
      : 'Explore keywords and they appear here, clustered by domain and linked when they’re related.'),
    h('div', { class: 'grid', style: { gridTemplateColumns: 'minmax(0, 1.6fr) minmax(260px, 1fr)', alignItems: 'start' } },
      h('div', { class: 'card' }, frame),
      h('div', {},
        h('div', { class: 'card' }, h('h3', {}, 'The frontier'),
          map.frontier.length
            ? h('ul', { class: 'frontier' }, map.frontier.map((f) => h('li', {}, h('a', { href: `#/keyword/${f.id}` }, f.term), h('div', { class: 'muted small' }, `next to ${f.via.join(', ')}`))))
            : h('p', { class: 'muted small' }, 'Topics one step from what you know will show up here.')),
        h('div', { class: 'card', style: { marginTop: '14px' } }, h('h3', {}, 'Coverage by domain'), coverage)))));
}
