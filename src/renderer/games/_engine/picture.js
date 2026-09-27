// The image (and its credit line) shown above a picture-quiz question. Images come from the local
// cache (mg-cache://), fetched by the main process.
import { h, extLink } from '../../ui.js';

export function picture(q) {
  return h('figure', { class: 'quiz-pic' },
    h('img', { src: q.image, alt: 'The picture for this question' }),
    h('figcaption', { class: 'muted small' }, q.caption || '', q.url ? [' · ', extLink(q.url, 'source')] : ''));
}
