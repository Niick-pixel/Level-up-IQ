// Watch and learn: the latest videos from your channels, your watch-later list, and what you've
// watched. After watching: three recall questions, then a review card.
import { h, clear, fill, toast } from '../ui.js';
import { videoCard } from './video.js';

const errText = (err) => String(err?.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

export async function renderWatch(el, params) {
  const tab = ['latest', 'list', 'watched'].includes(params.get('tab')) ? params.get('tab') : 'list';
  const page = h('div', { class: 'page' });
  el.append(page);
  const domains = await window.api.keywordDomains();
  const tabs = h('div', { class: 'tabs', role: 'tablist' },
    [['list', 'My list'], ['latest', 'Latest from your channels'], ['watched', 'Watched']].map(([id, label]) =>
      h('a', { class: `tab${id === tab ? ' active' : ''}`, role: 'tab', 'aria-selected': String(id === tab), href: `#/watch?tab=${id}` }, label)));
  const body = h('div', {});
  fill(page,
    h('div', { class: 'page-head' }, h('h1', {}, 'Watch and learn'), h('a', { class: 'btn small', href: '#/learned' }, 'Things I’ve learned →')),
    h('p', { class: 'muted' }, 'Videos open in your browser. When you’ve watched one, come back and answer three quick recall questions: retrieving it once is what makes it stick.'),
    tabs, body);

  if (tab === 'latest') return latest();
  const all = await window.api.watchList();
  const items = all.filter((x) => (tab === 'watched' ? x.watchedAt : !x.watchedAt)).sort((a, b) => (b.watchedAt || b.addedAt) - (a.watchedAt || a.addedAt));
  if (!items.length) {
    body.append(h('div', { class: 'card hero' }, h('p', {}, tab === 'watched'
      ? 'Nothing watched yet. Mark a video as watched from your list to answer its recall questions.'
      : 'Your list is empty. Add videos from “Latest from your channels”, or from the Watch step of any keyword session.'),
    h('a', { class: 'btn primary', href: '#/watch?tab=latest' }, 'See the latest videos')));
    return;
  }
  const grid = h('div', { class: 'vid-grid' });
  body.append(grid);
  for (const v of items) {
    grid.append(tab === 'watched'
      ? h('div', {}, videoCard({ ...v, saved: true }), v.recall?.main ? h('p', { class: 'muted small vid-note' }, `Your summary: ${v.recall.main}`) : '')
      : videoCard(v, {
        onWatched: (key) => { location.hash = `#/watch/recall/${encodeURIComponent(key)}`; },
        onRemove: async (key) => { await window.api.removeFromWatch(key); toast('Removed.'); location.hash = '#/watch?tab=list'; renderAgain(); },
      }));
  }

  function renderAgain() {
    clear(el);
    renderWatch(el, params);
  }

  async function latest() {
    const select = h('select', { 'aria-label': 'Topic', onchange: () => load(select.value) },
      h('option', { value: '' }, 'All topics'), domains.filter((d) => d.count).map((d) => h('option', { value: d.id }, d.label)));
    const status = h('p', { class: 'muted small' });
    const grid = h('div', { class: 'vid-grid' });
    body.append(h('div', { class: 'row' }, select, h('a', { class: 'btn small ghost', href: '#/settings' }, 'Choose channels')), status, grid);
    async function load(domain) {
      status.textContent = 'Checking your channels…';
      clear(grid);
      try {
        const r = await window.api.latestVideos({ domain: domain || null });
        status.textContent = `${r.videos.length} recent videos from ${r.channels} channels${r.failed.length ? ` (couldn’t reach: ${r.failed.join(', ')})` : ''}.`;
        if (!r.videos.length) status.textContent = 'No videos right now. You may be offline, or the feeds are down; saved copies appear once they’ve loaded once.';
        for (const v of r.videos) grid.append(videoCard(v));
      } catch (err) {
        status.textContent = `Couldn’t load videos: ${errText(err)}`;
      }
    }
    load('');
  }
}

/** Three recall questions after watching. */
export async function renderRecall(el, params) {
  const key = decodeURIComponent(params.id || '');
  const page = h('div', { class: 'page' });
  el.append(page);
  let data;
  try {
    data = await window.api.recallQuestions(key, String(Date.now()));
  } catch (err) {
    fill(page, h('p', { class: 'g-msg bad' }, errText(err)), h('a', { href: '#/watch' }, 'Back'));
    return;
  }
  const { item, questions } = data;
  const answers = {};
  const blocks = questions.map((q, i) => {
    if (q.kind === 'text') {
      const box = h('textarea', { class: 'reflect-box short', 'aria-label': q.prompt, oninput: () => { answers[q.id] = box.value; } });
      return h('div', { class: 'recall-q' }, h('h3', {}, `${i + 1}. ${q.prompt}`), box);
    }
    const msg = h('div', { class: 'g-msg' });
    const buttons = q.options.map((o, k) => h('button', { class: 'btn option', type: 'button', onclick: () => {
      if (answers.topicCorrect !== undefined) return;
      answers.topicCorrect = k === q.answer;
      answers.keywordId = q.keywordId;
      buttons.forEach((b, j) => { b.disabled = true; if (j === q.answer) b.classList.add('right'); else if (j === k) b.classList.add('wrong'); });
      msg.textContent = k === q.answer ? 'Right.' : `It was “${q.options[q.answer]}”.`;
    } }, o));
    return h('div', { class: 'recall-q' }, h('h3', {}, `${i + 1}. ${q.prompt}`), h('div', { class: 'options' }, buttons), msg);
  });
  const conf = h('div', { class: 'row' }, h('span', { class: 'muted' }, 'How well do you remember it?'),
    [[1, 'Barely'], [2, 'Partly'], [3, 'Well']].map(([v, label]) => h('label', { class: 'check' }, h('input', { type: 'radio', name: 'conf', value: String(v), onchange: () => { answers.confidence = v; } }), ' ', label)));
  const save = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
    if (!(answers.main || '').trim()) { toast('Write the main idea first: that’s the one that matters.'); return; }
    save.disabled = true;
    try {
      const r = await window.api.markWatched(key, answers);
      toast(r.cards ? 'Saved, with a review card for later.' : 'Saved.');
      location.hash = '#/learned';
    } catch (err) {
      save.disabled = false;
      toast(errText(err));
    }
  } }, 'Save to Things I’ve learned');
  fill(page,
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Recall'), h('div', { class: 'muted' }, `${item.title} · ${item.channel}`))),
    h('div', { class: 'card hero' },
      h('p', { class: 'muted' }, 'Answer from memory, without rewatching. Short is fine.'),
      blocks, conf, h('div', { class: 'row', style: { marginTop: '12px' } }, save, h('a', { class: 'btn', href: '#/watch' }, 'Not now'))));
  page.querySelector('textarea')?.focus();
}

/** Things I've learned: watched videos and keyword sessions, newest first. */
export async function renderLearned(el) {
  const items = await window.api.learnedItems();
  const byDay = new Map();
  for (const it of items) {
    const day = new Date(it.at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(it);
  }
  el.append(h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('h1', {}, 'Things I’ve learned')),
    items.length ? '' : h('div', { class: 'card hero' }, h('p', {}, 'Finished keyword sessions and watched videos (with your own summaries) collect here.')),
    [...byDay].map(([day, list]) => [
      h('h2', { class: 'learned-day' }, day),
      h('ul', { class: 'learned-list' }, list.map((it) => h('li', {},
        h('span', { class: 'chip' }, it.kind === 'video' ? 'Video' : 'Keyword'), ' ',
        it.kind === 'keyword' || it.keywordId ? h('a', { href: `#/keyword/${it.keywordId}` }, it.title) : h('strong', {}, it.title),
        it.channel ? h('span', { class: 'muted small' }, ` · ${it.channel}`) : '',
        it.note ? h('div', { class: 'muted small' }, it.note) : ''))),
    ])));
}
