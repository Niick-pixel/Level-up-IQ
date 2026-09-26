// Tiny DOM helpers. Text always goes in through textContent, never innerHTML.

/**
 * h('div', { class: 'card', onclick: fn }, 'text', child, [more])
 * Attributes starting with "on" become listeners; `dataset` and `style` objects are applied.
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'class') el.className = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) {
  el.replaceChildren();
  return el;
}

export function toast(message, ms = 2400) {
  const t = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}

export const fmtMinutes = (ms) => {
  if (ms > 0 && ms < 60000) return '<1 min';
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

export const fmtSeconds = (ms) => `${(ms / 1000).toFixed(1)} s`;

export const pct = (x) => `${Math.round(x * 100)} %`;

/** Link that opens in the default browser (main process checks the host). */
export function extLink(href, text) {
  return h('a', {
    href,
    onclick: (e) => {
      e.preventDefault();
      window.api.openExternal(href);
    },
  }, text);
}

export function wikipediaUrl(title, lang = 'en') {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
