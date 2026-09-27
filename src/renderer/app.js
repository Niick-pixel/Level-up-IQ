import { h, clear, fill } from './ui.js';
import { state } from './state.js';
import { searchGames } from './games/registry.js';
import { renderHome } from './views/home.js';
import { renderMix } from './views/mix.js';
import { renderGames } from './views/games.js';
import { renderPlay } from './views/play.js';
import { renderKeywords } from './views/keywords.js';
import { renderSession } from './views/session.js';
import { renderStats } from './views/stats.js';
import { renderSettings } from './views/settings.js';
import { renderLicenses, renderReview } from './views/misc.js';
import { renderWatch, renderRecall, renderLearned } from './views/watch.js';

const view = document.getElementById('view');

// route pattern → [nav id, render(el, params) → optional cleanup]
const ROUTES = [
  [/^\/$/, 'home', renderHome],
  [/^\/mix$/, 'mix', renderMix],
  [/^\/games$/, 'games', renderGames],
  [/^\/play\/([a-z0-9-]+)$/, 'games', renderPlay],
  [/^\/keywords$/, 'keywords', renderKeywords],
  [/^\/keyword\/([a-z0-9-]+)$/, 'keywords', renderSession],
  [/^\/stats$/, 'stats', renderStats],
  [/^\/settings$/, 'settings', renderSettings],
  [/^\/licenses$/, 'settings', renderLicenses],
  [/^\/review$/, 'review', renderReview],
  [/^\/watch$/, 'watch', renderWatch],
  [/^\/watch\/recall\/([^/]+)$/, 'watch', renderRecall],
  [/^\/learned$/, 'learned', renderLearned],
];

let cleanup = null;
let renderId = 0;

async function route() {
  const raw = location.hash.slice(1) || '/';
  const [path, query = ''] = raw.split('?');
  const qs = new URLSearchParams(query);
  const found = ROUTES.map(([re, nav, fn]) => ({ m: re.exec(path), nav, fn })).find((r) => r.m);
  const id = ++renderId;

  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  clear(view);
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (found && a.dataset.nav === found.nav) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (!found) {
    view.append(h('div', { class: 'page' }, h('p', {}, 'Page not found. '), h('a', { href: '#/' }, 'Home')));
    return;
  }
  try {
    const params = { id: found.m[1], get: (k) => qs.get(k) };
    const c = await found.fn(view, params);
    if (id !== renderId) {
      if (typeof c === 'function') c(); // navigated away while loading
      return;
    }
    cleanup = c;
  } catch (err) {
    console.error(err);
    view.append(h('div', { class: 'page' }, h('p', { class: 'g-msg bad' }, `Something went wrong: ${err.message}`)));
  }
  view.focus({ preventScroll: true });
  view.scrollTop = 0;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

// ---- global search (keywords + games)
function setupSearch() {
  const input = document.getElementById('search');
  const list = document.getElementById('search-results');
  let items = [];
  let active = -1;
  let t = 0;

  const close = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    active = -1;
  };
  const go = (item) => {
    close();
    input.value = '';
    input.blur();
    location.hash = item.href;
  };
  const highlight = () => {
    [...list.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
  };

  async function update() {
    const q = input.value.trim();
    if (!q) return close();
    const games = searchGames(q).map(({ meta }) => ({ label: meta.name, kind: 'Game', href: `#/play/${meta.id}` }));
    const kws = (await window.api.searchKeywords(q, { limit: 8 }))
      .map((k) => ({ label: k.term, kind: k.domainLabel, href: `#/keyword/${k.id}` }));
    items = [...games, ...kws];
    active = items.length ? 0 : -1;
    fill(list, ...(items.length
      ? items.map((it, i) => h('li', { role: 'option', onmousedown: (e) => { e.preventDefault(); go(items[i]); } },
        h('span', {}, it.label), h('span', { class: 'kind' }, it.kind)))
      : [h('li', { class: 'muted' }, 'No matches')]));
    highlight();
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(update, 90); });
  input.addEventListener('blur', () => setTimeout(close, 100));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      highlight();
    } else if (e.key === 'Enter' && items[active]) {
      e.preventDefault();
      go(items[active]);
    } else if (e.key === 'Escape') {
      close();
      input.blur();
    }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });
}

async function main() {
  state.settings = await window.api.getSettings();
  applyTheme(state.settings.theme);
  window.api.onSettings((s) => {
    state.settings = s;
    applyTheme(s.theme);
  });
  window.api.onNavigate((hash) => { location.hash = hash; });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F11') {
      e.preventDefault();
      window.api.setFullscreen(!document.fullscreenElement && !window.__fullscreen).then((on) => { window.__fullscreen = on; });
    }
  });
  document.querySelector('.titlebar').addEventListener('dblclick', (e) => {
    if (e.target.closest('.search, .brand')) return;
    window.api.toggleMaximize();
  });
  setupSearch();
  window.addEventListener('hashchange', route);
  route();
}

main();
