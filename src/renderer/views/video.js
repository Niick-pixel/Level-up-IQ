// A video card, shared by the Watch page and the keyword session's Watch step. Thumbnails come
// through the main process (window.api.remoteImage) and load only when they scroll into view.
import { h, toast } from '../ui.js';

const seen = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    seen.unobserve(e.target);
    const url = e.target.dataset.src;
    window.api.remoteImage(url).then((src) => { if (src) e.target.src = src; else e.target.classList.add('none'); }).catch(() => e.target.classList.add('none'));
  }
}, { rootMargin: '200px' });

export function thumb(url, alt = '') {
  const img = h('img', { class: 'vid-thumb', alt, loading: 'lazy' });
  if (url) {
    img.dataset.src = url;
    seen.observe(img);
  } else img.classList.add('none');
  return img;
}

const when = (iso) => {
  if (!iso) return '';
  if (/^\d{4}$/.test(iso)) return iso;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * @param v        video { key?, id, source, title, channel, url, thumbnail, published, license?, saved? }
 * @param options  { keywordId?, onWatched?(key), onRemove?(key), watched? }
 */
export function videoCard(v, { keywordId = null, onWatched = null, onRemove = null } = {}) {
  const key = v.key || `${v.source}:${v.id}`;
  const save = h('button', { class: 'btn small', type: 'button', disabled: v.saved || null, onclick: async () => {
    try {
      await window.api.addToWatch({ id: v.id, source: v.source, title: v.title, channel: v.channel, url: v.url, thumbnail: v.thumbnail, published: v.published, license: v.license, domains: v.domains }, keywordId);
      save.textContent = 'In your list';
      save.disabled = true;
      toast('Added to Watch later.');
    } catch (err) {
      toast(`Couldn't add it: ${String(err.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')}`);
    }
  } }, v.saved ? 'In your list' : 'Watch later');
  const open = h('button', { class: 'btn small primary', type: 'button', onclick: () => window.api.openExternal(v.url) }, v.source === 'archive' ? 'Open on archive.org' : 'Open on YouTube');
  return h('div', { class: 'card vid-card' },
    h('button', { class: 'vid-thumb-btn', type: 'button', 'aria-label': `Open “${v.title}”`, onclick: () => window.api.openExternal(v.url) }, thumb(v.thumbnail)),
    h('div', { class: 'vid-body' },
      h('div', { class: 'vid-title' }, v.title),
      h('div', { class: 'muted small' }, [v.channel, when(v.published), v.license].filter(Boolean).join(' · ')),
      h('div', { class: 'row vid-actions' },
        open,
        onWatched ? h('button', { class: 'btn small', type: 'button', onclick: () => onWatched(key) }, 'I watched it') : save,
        onRemove ? h('button', { class: 'btn small ghost', type: 'button', onclick: () => onRemove(key) }, 'Remove') : '')));
}
