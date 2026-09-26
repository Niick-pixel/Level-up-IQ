import { h, extLink } from '../ui.js';

export function renderLicenses(el) {
  const row = (name, license, url, note) => h('tr', {},
    h('td', {}, url ? extLink(url, name) : name), h('td', {}, license), h('td', { class: 'muted' }, note || ''));
  el.append(h('div', { class: 'page' },
    h('h1', {}, 'Attributions and licenses'),
    h('p', { class: 'muted' }, 'Mind Gym is free software under the MIT license. It collects no telemetry; your data stays on this computer.'),
    h('div', { class: 'card' },
      h('table', {},
        h('thead', {}, h('tr', {}, ['Component', 'License', 'Used for'].map((t) => h('th', {}, t)))),
        h('tbody', {},
          row('Mind Gym', 'MIT', 'https://github.com/Niick-pixel/Level-up-IQ', 'This app'),
          row('Electron', 'MIT', 'https://www.electronjs.org/', 'Desktop shell'),
          row('electron-updater', 'MIT', 'https://www.npmjs.com/package/electron-updater', 'Updates from GitHub Releases'),
          row('Fuse.js', 'Apache-2.0', 'https://www.npmjs.com/package/fuse.js', 'Fuzzy keyword search'),
          row('an-array-of-english-words', 'MIT', 'https://www.npmjs.com/package/an-array-of-english-words', 'Word list for word games'),
          row('Okabe–Ito colour palette', '—', null, 'Colour-blind-safe colours in Stroop'),
          row('Focus Point themes', 'MIT', 'https://github.com/Niick-pixel/Focus-purpose', 'Night, Dusk, Forest and Sand colours'),
        ))),
    h('p', { class: 'muted small', style: { marginTop: '14px' } },
      'Keyword descriptions link to Wikipedia (text under CC BY-SA 4.0). Online sources such as Wikipedia, Wikidata, Open Trivia DB and Lichess will be credited here as they are added.')));
}

export function renderComingSoon(title, text) {
  return (el) => el.append(h('div', { class: 'page' }, h('h1', {}, title), h('div', { class: 'card hero' }, h('p', { class: 'muted' }, text))));
}
