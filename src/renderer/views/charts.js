// A tiny chart kit for Stats (plain SVG, no library), following the data-viz rules:
// thin marks (bars ≤ 24px with a 4px rounded end, 2px lines), hairline grids, one axis,
// sparing direct labels, a tooltip on hover AND keyboard focus, and a table view for every chart.
// Colours come from the theme (--accent for data, --muted for a comparison series); text always
// uses text colours, never the series colour.
import { h } from '../ui.js';

const SVG = 'http://www.w3.org/2000/svg';
export const svg = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, String(v));
  el.append(...kids.flat(Infinity).filter((k) => k != null && k !== false));
  return el;
};

/** Clean tick values from 0 to at least max (1, 2, 2.5 or 5 × 10^n steps). */
export function niceTicks(max, count = 3) {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 1000) / 1000);
  if (ticks[ticks.length - 1] < max) ticks.push(Math.round((ticks[ticks.length - 1] + step) * 1000) / 1000);
  return ticks;
}

/** A path for a column with a 4px rounded top and square base. */
function columnPath(x, y, w, hgt, r = 4) {
  if (hgt <= 0) return '';
  const rr = Math.min(r, w / 2, hgt);
  return `M${x},${y + hgt}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + hgt}Z`;
}

function withTooltip(frame) {
  const tip = h('div', { class: 'chart-tip', role: 'status', hidden: true });
  frame.append(tip);
  return {
    show(target, value, label) {
      tip.replaceChildren(h('strong', {}, value), h('span', { class: 'muted small' }, label));
      tip.hidden = false;
      const fr = frame.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      tip.style.left = `${Math.min(fr.width - 150, Math.max(0, r.left - fr.left + r.width / 2 - 60))}px`;
      tip.style.top = `${Math.max(0, r.top - fr.top - 46)}px`;
    },
    hide() { tip.hidden = true; },
  };
}

/** A table view of the same data (always available, so nothing needs hovering). */
function tableToggle(frame, rows, headers) {
  const table = h('table', { class: 'chart-table', hidden: true },
    h('thead', {}, h('tr', {}, headers.map((t) => h('th', {}, t)))),
    h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c) => h('td', {}, String(c)))))));
  const btn = h('button', { class: 'btn small ghost chart-table-btn', type: 'button', onclick: () => {
    table.hidden = !table.hidden;
    btn.textContent = table.hidden ? 'Show as table' : 'Hide table';
  } }, 'Show as table');
  return h('div', {}, btn, table);
}

/**
 * Columns (one series).
 * @param data  [{ label, value, detail? }]
 * @param o     { height?, format(v) → string, name (for the table header), labelEvery? }
 */
export function columnChart(data, { width = 560, height = 150, format = String, name = 'Value', labelEvery = 1, ariaLabel = 'Column chart', empty = null } = {}) {
  if (empty && !data.some((d) => d.value > 0)) return h('p', { class: 'muted chart-empty' }, empty);
  const W = width, H = height, padL = 34, padB = 20, padT = 8;
  const max = Math.max(0, ...data.map((d) => d.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const band = (W - padL) / Math.max(1, data.length);
  const bw = Math.min(24, band * 0.62);
  const y = (v) => padT + (H - padT - padB) * (1 - v / top);
  const frame = h('div', { class: 'chart' });
  const tt = withTooltip(frame);
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img', 'aria-label': ariaLabel },
    ticks.map((t) => [
      svg('line', { x1: padL, x2: W, y1: y(t), y2: y(t), class: t === 0 ? 'axis' : 'grid' }),
      svg('text', { x: padL - 6, y: y(t), class: 'tick', 'text-anchor': 'end', 'dominant-baseline': 'middle' }, format(t)),
    ]),
    data.map((d, i) => {
      const x = padL + band * i + (band - bw) / 2;
      const g = svg('g', { class: 'mark', tabindex: '0', role: 'img', 'aria-label': `${d.label}: ${format(d.value)}` },
        svg('rect', { x: padL + band * i, y: padT, width: band, height: H - padT - padB, class: 'hit' }),
        svg('path', { d: columnPath(x, y(d.value), bw, y(0) - y(d.value)), class: 'col' }),
        i % labelEvery === 0 || i === data.length - 1 ? svg('text', { x: x + bw / 2, y: H - 5, class: 'tick', 'text-anchor': 'middle' }, d.short ?? d.label) : null);
      const show = () => tt.show(g, format(d.value), d.detail || d.label);
      g.addEventListener('pointerenter', show);
      g.addEventListener('focus', show);
      g.addEventListener('pointerleave', tt.hide);
      g.addEventListener('blur', tt.hide);
      return g;
    }));
  frame.prepend(s);
  return h('div', {}, frame, tableToggle(frame, data.map((d) => [d.detail || d.label, format(d.value)]), ['', name]));
}

/**
 * A single line over time with a light area wash, an end dot and a crosshair.
 * @param data  [{ label, value }]
 */
export function lineChart(data, { width = 560, height = 150, format = String, name = 'Value', ariaLabel = 'Line chart' } = {}) {
  const W = width, H = height, padL = 34, padB = 20, padT = 10, padR = 10;
  const max = Math.max(0, ...data.map((d) => d.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const x = (i) => padL + ((W - padL - padR) * i) / Math.max(1, data.length - 1);
  const y = (v) => padT + (H - padT - padB) * (1 - v / top);
  const pts = data.map((d, i) => [x(i), y(d.value)]);
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px},${py}`).join('');
  const frame = h('div', { class: 'chart' });
  const tt = withTooltip(frame);
  const cross = svg('line', { y1: padT, y2: H - padB, class: 'crosshair', visibility: 'hidden' });
  const dot = svg('circle', { r: 4, class: 'dot', visibility: 'hidden' });
  const last = pts[pts.length - 1];
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img', 'aria-label': ariaLabel, tabindex: '0' },
    ticks.map((t) => [
      svg('line', { x1: padL, x2: W - padR, y1: y(t), y2: y(t), class: t === 0 ? 'axis' : 'grid' }),
      svg('text', { x: padL - 6, y: y(t), class: 'tick', 'text-anchor': 'end', 'dominant-baseline': 'middle' }, format(t)),
    ]),
    svg('path', { d: `${line}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z`, class: 'area' }),
    svg('path', { d: line, class: 'line' }),
    last ? svg('circle', { cx: last[0], cy: last[1], r: 4, class: 'dot' }) : null,
    last ? svg('text', { x: last[0] - 8, y: last[1] - 10, class: 'tick end-label', 'text-anchor': 'end' }, format(data[data.length - 1].value)) : null,
    [0, data.length - 1].map((i) => svg('text', { x: x(i), y: H - 5, class: 'tick', 'text-anchor': i ? 'end' : 'start' }, data[i]?.label ?? '')),
    cross, dot);
  let focusI = data.length - 1;
  const at = (i) => {
    focusI = Math.max(0, Math.min(data.length - 1, i));
    const [px, py] = pts[focusI];
    cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', px); dot.setAttribute('cy', py); dot.setAttribute('visibility', 'visible');
    tt.show(dot, format(data[focusI].value), data[focusI].label);
  };
  const off = () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tt.hide(); };
  s.addEventListener('pointermove', (e) => {
    const r = s.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    at(Math.round(((vx - padL) / (W - padL - padR)) * (data.length - 1)));
  });
  s.addEventListener('pointerleave', off);
  s.addEventListener('focus', () => at(focusI));
  s.addEventListener('blur', off);
  s.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); at(focusI - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); at(focusI + 1); }
  });
  frame.prepend(s);
  return h('div', {}, frame, tableToggle(frame, data.map((d) => [d.label, format(d.value)]), ['', name]));
}
