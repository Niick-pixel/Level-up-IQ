import { h, toast, fill } from '../ui.js';
import { state } from '../state.js';

export async function renderSettings(el) {
  const s = state.settings;
  const info = await window.api.info();
  const save = async (partial) => { state.settings = await window.api.setSettings(partial); };

  const select = (key, options, parse = (v) => v) => {
    const sel = h('select', { onchange: (e) => save({ [key]: parse(e.target.value) }) },
      options.map(([value, label]) => h('option', { value, selected: String(s[key]) === String(value) }, label)));
    return sel;
  };
  const toggle = (key, onChange) => h('input', {
    type: 'checkbox', class: 'switch', checked: Boolean(s[key]), role: 'switch',
    onchange: async (e) => { await save({ [key]: e.target.checked }); onChange?.(e.target.checked); },
  });
  const number = (key, min, max, step = 1) => h('input', {
    type: 'number', min, max, step, value: s[key], style: { width: '90px' },
    onchange: (e) => save({ [key]: Number(e.target.value) }),
  });
  const field = (label, hint, control, cls = '') =>
    h('div', { class: `field ${cls}` }, h('div', {}, h('div', {}, label), hint ? h('div', { class: 'hint' }, hint) : null), h('div', {}, control));

  const updaterLine = h('span', { class: 'muted small' });
  const showUpdater = (u) => {
    updaterLine.textContent = {
      dev: 'Running from source: no updates.',
      idle: 'Checks GitHub Releases every few hours.',
      checking: 'Checking…',
      'up-to-date': 'You have the latest version.',
      downloading: `Downloading ${u.version} (${u.progress} %)…`,
      ready: `Version ${u.version} will install when you quit.`,
      error: `Update check failed: ${u.error}`,
    }[u.status] || '';
  };
  showUpdater(await window.api.updaterState());
  const off = window.api.onUpdater(showUpdater);

  el.append(h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('h1', {}, 'Settings'), h('span', { class: 'muted small' }, `Mind Gym ${info.version}`)),

    h('h2', {}, 'Training'),
    h('div', { class: 'card' },
      field('Theme', 'The same four themes as Focus Point.', select('theme', [['night', 'Night'], ['dusk', 'Dusk'], ['forest', 'Forest'], ['sand', 'Sand']])),
      field('Daily Mix length', 'Minutes. The mix uses it to pick how many rounds (from Phase 5).', number('sessionMinutes', 3, 60)),
      field('Difficulty bias', 'Levels aim for about 75 % success. Harder aims lower, easier aims higher.',
        select('difficultyBias', [[-2, 'Much easier'], [-1, 'Easier'], [0, 'Balanced'], [1, 'Harder'], [2, 'Much harder']], Number)),
      field('Thinking timer', 'Seconds before hints and "show solution" unlock in a puzzle.', number('thinkingTimerSec', 0, 300, 5)),
      field('Word games language', 'Spanish support comes later.', select('wordLanguage', [['en', 'English']])),
      field('Colour-blind mode', 'Stroop switches to a spatial version that never relies on colour.', toggle('colorblind'))),

    h('h2', { style: { marginTop: '22px' } }, 'Online sources'),
    await onlineSection(save),

    h('h2', { style: { marginTop: '22px' } }, 'Window and Focus Point'),
    h('div', { class: 'card' },
      field('Keep Focus Point breaks working when maximized',
        'With an auto-hidden taskbar, a maximized window looks "fullscreen" to Focus Point and it would hold your breaks. This keeps Mind Gym one pixel short of that.',
        toggle('safeMaximize')),
      field('Allow fullscreen (F11)',
        'Warning: true fullscreen makes Focus Point postpone its breaks while you train. Mind Gym is screen time, not rest.',
        toggle('allowFullscreen'), 'warn')),

    h('h2', { style: { marginTop: '22px' } }, 'Extras (off by default)'),
    h('div', { class: 'card' },
      field('Tray icon', 'Closing the window keeps Mind Gym running in the tray.', toggle('trayIcon')),
      field('Daily reminder', 'One quiet notification if you haven\'t trained by this time.',
        h('div', { class: 'row' }, toggle('dailyReminder'),
          h('input', { type: 'time', value: s.dailyReminderTime, onchange: (e) => save({ dailyReminderTime: e.target.value }) }))),
      field('Start with Windows', 'Starts hidden.', toggle('launchAtLogin'))),

    h('h2', { style: { marginTop: '22px' } }, 'Data'),
    h('div', { class: 'card' },
      field('Updates', updaterLine, h('div', { class: 'row' },
        toggle('autoUpdate'),
        h('button', { class: 'btn small', type: 'button', onclick: () => window.api.checkForUpdates() }, 'Check now'))),
      field('Reset stats', 'Deletes your history, personal bests and skill ratings. Can\'t be undone.',
        h('button', {
          class: 'btn small',
          type: 'button',
          onclick: async () => {
            if (!confirm('Delete all stats, history and ratings?')) return;
            await window.api.resetStats();
            toast('Stats reset.');
          },
        }, 'Reset stats')),
      field('Reset settings', null, h('button', {
        class: 'btn small',
        type: 'button',
        onclick: async () => {
          state.settings = await window.api.resetSettings();
          location.reload();
        },
      }, 'Reset settings')),
      field('Attributions and licenses', null, h('a', { class: 'btn small', href: '#/licenses' }, 'Open'))),
  ));
  return off;
}

async function onlineSection(save) {
  const box = h('div', { class: 'card' });
  const fmtBytes = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
  async function draw() {
    const [{ offline, providers }, size] = await Promise.all([window.api.providers(), window.api.cacheSize()]);
    const s = state.settings;
    const offlineToggle = h('input', {
      type: 'checkbox', class: 'switch', role: 'switch', checked: offline,
      onchange: async (e) => { await save({ offlineMode: e.target.checked }); draw(); },
    });
    const rows = providers.map((p) => {
      const status = !p.enabled ? 'Off' : p.lockedFor ? 'Resting (asked us to slow down)' : p.lastError ? `Last try failed: ${p.lastError}` : p.requests ? 'Working' : 'Ready';
      const toggle = h('input', {
        type: 'checkbox', class: 'switch', role: 'switch', checked: s.providers[p.id] !== false, disabled: offline || null,
        onchange: async (e) => { await save({ providers: { [p.id]: e.target.checked } }); draw(); },
      });
      return h('div', { class: 'field' },
        h('div', {}, h('div', {}, p.name), h('div', { class: 'hint' }, `${p.license} · ${status}`)),
        h('div', {}, toggle));
    });
    fill(box, 
      h('div', { class: 'field' },
        h('div', {}, h('div', {}, 'Offline mode'), h('div', { class: 'hint' }, 'Never go online. Everything still works from the keyword bank and anything already cached.')),
        h('div', {}, offlineToggle)),
      ...rows,
      h('div', { class: 'field' },
        h('div', {}, h('div', {}, 'Cache'), h('div', { class: 'hint' }, `${fmtBytes(size)} of saved summaries, facts and images (kept for offline use).`)),
        h('div', {}, h('button', { class: 'btn small', type: 'button', onclick: async () => { await window.api.clearCache(); toast('Cache cleared.'); draw(); } }, 'Clear cache'))));
  }
  await draw();
  return box;
}
