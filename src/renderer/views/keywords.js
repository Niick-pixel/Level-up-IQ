import { h, clear, extLink, wikipediaUrl } from '../ui.js';

const kwCard = (k) => h('a', { class: 'card', href: `#/keyword/${k.id}` },
  h('div', { class: 'kw-term' }, k.term),
  h('div', { class: 'kw-meta' }, `${k.domainLabel} · level ${k.difficulty}`));

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
    list));
  refresh();
}

/** One keyword. Full sessions (summary, quiz, videos) arrive with online content in Phase 2. */
export async function renderKeyword(el, params) {
  const k = await window.api.getKeyword(params.id);
  if (!k) {
    el.append(h('div', { class: 'page' }, h('p', {}, 'Keyword not found.')));
    return;
  }
  window.api.exploreKeyword(k.id);
  const rabbit = async () => {
    const next = await window.api.randomKeyword({ mode: 'rabbit', fromId: k.id });
    location.hash = `#/keyword/${next.id}`;
  };
  const predict = h('textarea', { placeholder: 'Predict first: in one sentence, what do you think this is? (Stays on this screen; nothing is saved yet.)', 'aria-label': 'Your prediction' });

  el.append(h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('div', {}, h('div', { class: 'eyebrow muted small' }, `${k.domainLabel} · level ${k.difficulty}`), h('h1', {}, k.term)),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', type: 'button', onclick: rabbit }, 'Rabbit hole →'),
        h('a', { class: 'btn small', href: '#/keywords' }, 'All keywords'))),
    k.aliases.length ? h('p', { class: 'muted' }, `Also: ${k.aliases.join(', ')}`) : null,
    h('div', { class: 'chips', style: { marginBottom: '16px' } }, k.tags.map((t) => h('span', { class: 'chip' }, t))),
    h('div', { class: 'card hero' },
      h('h3', {}, '1 · Predict first'),
      predict,
      h('p', { class: 'muted small', style: { marginTop: '10px' } },
        'The full keyword session (summary, quiz, puzzle tie-in, explain-it-back and videos) arrives in the next phase. For now, read about it on ',
        extLink(wikipediaUrl(k.wikipedia), 'Wikipedia'), ' after you\'ve made your prediction.')),
    k.neighbours.length ? [
      h('h2', { style: { marginTop: '22px' } }, 'Related'),
      h('div', { class: 'chips' }, k.neighbours.map((n) => h('a', { class: 'chip', href: `#/keyword/${n.id}` }, n.term))),
    ] : null));
}
