import { h, clear, toast } from '../ui.js';

const errText = (err) => String(err?.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

const kwCard = (k) => h('a', { class: 'card', href: `#/keyword/${k.id}` },
  h('div', { class: 'kw-term' }, k.term),
  h('div', { class: 'kw-meta' }, `${k.domainLabel} · level ${k.difficulty}${k.user ? ' · yours' : ''}`));

/** "Add a keyword": search Wikipedia, pick an article and a domain. */
function addKeywordCard(domains) {
  const input = h('input', { type: 'text', placeholder: 'Any topic, e.g. “Tardigrade”', 'aria-label': 'Topic to add', style: { width: '280px' } });
  const domainSel = h('select', { 'aria-label': 'Domain' }, domains.map((d) => h('option', { value: d.id }, d.label)));
  const list = h('div', { class: 'chips', style: { marginTop: '10px' } });
  const msg = h('span', { class: 'muted small' });
  let t = 0;
  const add = async (title) => {
    msg.textContent = 'Adding…';
    try {
      const k = await window.api.addKeyword(title, domainSel.value);
      location.hash = `#/keyword/${k.id}`;
    } catch (err) {
      msg.textContent = errText(err);
    }
  };
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      if (!input.value.trim()) return clear(list);
      try {
        const results = await window.api.wikiSearch(input.value);
        msg.textContent = results.length ? 'Pick the article you mean:' : 'No Wikipedia articles found.';
        clear(list).append(...results.map((r) => h('button', { class: 'chip', type: 'button', title: r.description, onclick: () => add(r.title) }, `+ ${r.title}`)));
      } catch (err) {
        msg.textContent = `Needs Wikipedia (online): ${errText(err)}`;
      }
    }, 300);
  });
  const surprise = async () => {
    msg.textContent = 'Rolling…';
    try {
      const r = await window.api.wikiRandom();
      msg.textContent = r.description ? `${r.title}: ${r.description}` : r.title;
      clear(list).append(
        h('button', { class: 'chip', type: 'button', onclick: () => add(r.title) }, `+ Add “${r.title}”`),
        h('button', { class: 'chip', type: 'button', onclick: surprise }, 'Another'));
    } catch (err) {
      msg.textContent = `Needs Wikipedia (online): ${errText(err)}`;
    }
  };
  return h('div', { class: 'card', style: { marginBottom: '16px' } },
    h('h3', {}, 'Add a keyword'),
    h('div', { class: 'row' }, input, h('span', { class: 'muted small' }, 'in'), domainSel,
      h('button', { class: 'btn small', type: 'button', onclick: surprise }, 'Random Wikipedia article')),
    list, msg);
}

/** Keyword browser: search, domain filter, and the random modes. */
export async function renderKeywords(el) {
  const domains = await window.api.keywordDomains();
  let domain = null;
  const input = h('input', { type: 'text', placeholder: 'Search keywords, aliases, tags…', 'aria-label': 'Search keywords', style: { width: '320px' } });
  const list = h('div', { class: 'kw-list' });
  const count = h('span', { class: 'muted small' });

  async function refresh() {
    const results = await window.api.searchKeywords(input.value, { domain, limit: 100 });
    clear(list).append(...results.map(kwCard));
    count.textContent = results.length === 100 ? 'Showing the first 100' : `${results.length} keyword${results.length === 1 ? '' : 's'}`;
  }

  const chips = domains.map((d) => h('button', {
    class: 'chip',
    type: 'button',
    'aria-pressed': 'false',
    onclick: (e) => {
      domain = domain === d.id ? null : d.id;
      chips.forEach((c) => c.setAttribute('aria-pressed', 'false'));
      if (domain) e.currentTarget.setAttribute('aria-pressed', 'true');
      refresh();
    },
  }, `${d.label} ${d.count}`));

  const go = async (opts) => {
    const k = await window.api.randomKeyword(opts);
    location.hash = `#/keyword/${k.id}`;
  };

  let t = 0;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(refresh, 120); });

  el.append(h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('h1', {}, 'Keywords'), count),
    h('div', { class: 'row', style: { marginBottom: '12px' } },
      input,
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn small', type: 'button', onclick: () => go({ mode: 'any' }) }, 'Random'),
      h('button', { class: 'btn small', type: 'button', onclick: () => go(domain ? { mode: 'domain', domain } : { mode: 'any' }) }, 'Random in domain'),
      h('button', { class: 'btn small', type: 'button', onclick: () => go({ mode: 'comfort' }), title: 'Weighted toward domains you have explored least' }, 'Outside my comfort zone')),
    h('div', { class: 'chips', style: { marginBottom: '16px' } }, chips),
    addKeywordCard(domains),
    list));
  refresh();
}
