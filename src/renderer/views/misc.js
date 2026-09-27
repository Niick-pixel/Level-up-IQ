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
          row('Simon Tatham’s Portable Puzzle Collection', 'MIT', 'https://www.chiark.greenend.org.uk/~sgtatham/puzzles/', '24 logic puzzles (built to WebAssembly from the unmodified source)'),
          row('chess.js', 'BSD-2-Clause', 'https://github.com/jhlywa/chess.js', 'Chess rules for the chess games'),
          row('flag-icons', 'MIT', 'https://github.com/lipis/flag-icons', 'Flag images'),
          row('world-atlas / Natural Earth', 'ISC / public domain', 'https://github.com/topojson/world-atlas', 'Country shapes for the map game (baked into the app when it’s built)'),
          row('Lichess puzzle database', 'CC0 1.0', 'https://database.lichess.org/#puzzles', 'The bundled chess puzzles'),
          row('Okabe–Ito colour palette', '—', null, 'Colour-blind-safe colours in Stroop'),
          row('Focus Point themes', 'MIT', 'https://github.com/Niick-pixel/Focus-purpose', 'Night, Dusk, Forest and Sand colours'),
        ))),
    h('h2', { style: { marginTop: '22px' } }, 'Online sources'),
    h('p', { class: 'muted' }, 'Content fetched from these sources stays in a local cache and is shown with its credit and license. Each can be turned off in Settings.'),
    h('div', { class: 'card' },
      h('table', {},
        h('thead', {}, h('tr', {}, ['Source', 'License', 'Used for'].map((t) => h('th', {}, t)))),
        h('tbody', {},
          row('Wikipedia', 'CC BY-SA 4.0', 'https://en.wikipedia.org/', 'Keyword summaries, images, “On this day”, topic search'),
          row('Wikidata', 'CC0 1.0', 'https://www.wikidata.org/', 'Key facts and dated quiz questions'),
          row('Open Trivia DB', 'CC BY-SA 4.0', 'https://opentdb.com/', 'Bonus trivia questions'),
          row('The Trivia API', 'CC BY-NC 4.0', 'https://the-trivia-api.com/', 'Trivia questions (non-commercial use; Mind Gym is free)'),
          row('Lichess', 'CC0 (puzzle database)', 'https://lichess.org/', 'Daily chess puzzle'),
        ))),
    h('h2', { style: { marginTop: '22px' } }, 'Downloaded on first use'),
    engineCard(),
    h('p', { class: 'muted small', style: { marginTop: '14px' } },
      'Quiz questions built from Wikipedia text are adaptations of CC BY-SA material and link back to the article they came from. Images shown with a summary are the article\'s own lead image, served by Wikimedia.')));
}

/** Stockfish (GPL-3.0) isn't bundled; this card says whether it's installed and shows its license. */
function engineCard() {
  const status = h('p', { class: 'muted' }, 'Checking…');
  const remove = h('button', { class: 'btn small', type: 'button', hidden: true, onclick: async () => {
    remove.disabled = true;
    show(await window.api.removeEngine());
  } }, 'Remove engine');
  const license = h('pre', { class: 'license-text' });
  const details = h('details', { ontoggle: async () => {
    if (!details.open || license.textContent) return;
    license.textContent = await fetch('assets/licenses/GPL-3.0.txt').then((r) => r.text()).catch(() => 'Could not load the license text.');
  } }, h('summary', {}, 'GNU General Public License v3 (full text)'), license);
  function show(st) {
    status.textContent = st.installed
      ? `Installed: ${st.name}, ${(st.bytes / 1e6).toFixed(1)} MB, verified by SHA-256.`
      : `Not installed. “Play vs Stockfish” offers to download it (${(st.bytes / 1e6).toFixed(1)} MB).`;
    remove.hidden = !st.installed;
    remove.disabled = false;
  }
  window.api.engineStatus().then(show).catch(() => { status.textContent = 'Engine status unavailable.'; });
  return h('div', { class: 'card' },
    h('h3', {}, 'Stockfish chess engine'),
    h('p', {}, 'Stockfish is free software under the GNU GPL v3, by the Stockfish developers; the WebAssembly build is stockfish.js by Nathan Rugg and Chess.com. Mind Gym downloads the unmodified official release files the first time you play, checks their fingerprints, and runs them separately from the app. Source code: ',
      extLink('https://github.com/nmrugg/stockfish.js/tree/v19.0.0', 'stockfish.js v19.0.0'), ' and ', extLink('https://github.com/official-stockfish/Stockfish', 'Stockfish'), '.'),
    status, h('div', { class: 'row' }, remove), details);
}

export function renderComingSoon(title, text) {
  return (el) => el.append(h('div', { class: 'page' }, h('h1', {}, title), h('div', { class: 'card hero' }, h('p', { class: 'muted' }, text))));
}

export async function renderReview(el) {
  const [count, cards] = await Promise.all([window.api.cardCount(), window.api.recentCards()]);
  el.append(h('div', { class: 'page' },
    h('h1', {}, 'Review queue'),
    h('div', { class: 'card hero' },
      h('p', {}, count ? `${count} card${count === 1 ? '' : 's'} saved from your keyword sessions.` : 'No cards yet. Finish a keyword session and its key facts land here.'),
      h('p', { class: 'muted' }, 'Spaced repetition (FSRS) arrives in Phase 5: each card comes back right before you would forget it.')),
    cards.length ? h('div', { class: 'card', style: { marginTop: '14px' } },
      h('h3', {}, 'Most recent'),
      h('ul', { class: 'cards-list' }, cards.map((c) => h('li', {},
        h('a', { href: `#/keyword/${c.keywordId}` }, c.front),
        h('div', { class: 'muted' }, c.back))))) : null));
}
