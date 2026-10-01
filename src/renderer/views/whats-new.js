// What's new: the bundled CHANGELOG.md, newest version first. Shown once after an update
// (Home links here until you've seen it), and any time from Settings.
import { h } from '../ui.js';

/** Splits the changelog into versions: [{ title, body: string[] }]. Pure; exported for tests. */
export function parseChangelog(md) {
  const out = [];
  for (const line of String(md || '').split('\n')) {
    const m = /^## (.+)$/.exec(line);
    if (m) out.push({ title: m[1].trim(), body: [] });
    else if (out.length) out.at(-1).body.push(line);
  }
  return out;
}

/** Inline markdown: **bold**, *italic* and `code`; everything else is plain text (never HTML). */
function inline(text) {
  const parts = [];
  const re = /\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|`([^`]+)`/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(m[1] ? h('strong', {}, m[1]) : m[2] ? h('em', {}, m[2]) : h('code', {}, m[3]));
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return parts;
}

/** Bullets (nested by indentation), bold-only lines as small headings, paragraphs. */
export function renderBody(lines) {
  const root = h('div', { class: 'changelog' });
  const stack = [{ indent: -1, el: root }];
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const b = /^(\s*)- (.*)$/.exec(raw);
    if (b) {
      const indent = b[1].length;
      while (stack.length > 1 && stack.at(-1).indent > indent) stack.pop();
      let top = stack.at(-1);
      if (top.indent < indent) {
        const ul = h('ul', {});
        const host = top.el.tagName === 'UL' ? top.el.lastElementChild || top.el : top.el;
        host.append(ul);
        stack.push({ indent, el: ul });
        top = stack.at(-1);
      }
      top.el.append(h('li', {}, inline(b[2])));
      continue;
    }
    stack.length = 1;
    const head = /^\*\*(.+)\*\*$/.exec(raw.trim());
    root.append(head ? h('h3', {}, head[1]) : h('p', {}, inline(raw.trim())));
  }
  return root;
}

export async function renderWhatsNew(el) {
  const [md, info] = await Promise.all([window.api.changelog(), window.api.info()]);
  const versions = parseChangelog(md);
  window.api.setSettings({ lastSeenVersion: info.version });
  el.append(h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('h1', {}, 'What’s new'), h('span', { class: 'muted small' }, `You have Mind Gym ${info.version}`)),
    versions.length ? null : h('p', { class: 'muted' }, 'The changelog isn’t available.'),
    versions.slice(0, 1).map((v) => h('div', { class: 'card hero' }, h('h2', {}, v.title), renderBody(v.body))),
    versions.length > 1 ? h('details', { style: { marginTop: '16px' } },
      h('summary', {}, 'Earlier versions'),
      versions.slice(1).map((v) => h('div', { class: 'card', style: { marginTop: '10px' } }, h('h2', {}, v.title), renderBody(v.body)))) : null));
}
