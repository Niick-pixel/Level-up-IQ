import { h, toast, fill } from '../ui.js';
import { state } from '../state.js';
import { playSound, SOUND_NAMES } from '../sounds.js';
import { MODE_LABELS } from '../../shared/difficulty.js';

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
    type: 'checkbox', class: 'switch', checked: Boolean(state.settings[key]), role: 'switch',
    onchange: async (e) => { await save({ [key]: e.target.checked }); onChange?.(e.target.checked); },
  });
  const number = (key, min, max, step = 1) => h('input', {
    type: 'number', min, max, step, value: state.settings[key], style: { width: '90px' },
    onchange: (e) => save({ [key]: Number(e.target.value) }),
  });
  const field = (label, hint, control, cls = '') =>
    h('div', { class: `field ${cls}` }, h('div', {}, h('div', {}, label), hint ? h('div', { class: 'hint' }, hint) : null), h('div', {}, control));

  const updaterLine = h('span', { class: 'muted small' });
  const restartBtn = h('button', { class: 'btn small primary', type: 'button', hidden: true, onclick: () => window.api.installUpdate() }, 'Restart to update');
  const showUpdater = (u) => {
    restartBtn.hidden = u.status !== 'ready';
    updaterLine.textContent = {
      dev: 'Running from source: no updates.',
      idle: 'Checks GitHub Releases every few hours.',
      checking: 'Checking…',
      'up-to-date': 'You have the latest version.',
      downloading: `Downloading ${u.version} (${u.progress} %)…`,
      ready: `Version ${u.version} is downloaded. It installs when you quit, or restart now.`,
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
      field('Daily Mix length', 'Minutes. The mix adds rounds for your weakest skills until it’s full. The shortest mix is about 9 minutes.', number('sessionMinutes', 3, 60)),
      field('Difficulty', 'Adaptive follows your skill ratings across all 10 levels. Easy, Medium, Hard and Expert keep levels in that band and still adjust to you inside it. You can always change the level before a game.',
        select('difficultyMode', Object.entries(MODE_LABELS))),
      field('Difficulty bias', 'Levels aim for about 75 % success. Harder aims lower, easier aims higher.',
        select('difficultyBias', [[-2, 'Much easier'], [-1, 'Easier'], [0, 'Balanced'], [1, 'Harder'], [2, 'Much harder']], Number)),
      field('Thinking timer', 'Seconds before hints and "show solution" unlock in a puzzle.', number('thinkingTimerSec', 0, 300, 5)),
      field('Word games language', 'Spanish support comes later.', select('wordLanguage', [['en', 'English']])),
      field('Review: target recall', 'How much of what you review you want to remember. Higher means more frequent reviews.',
        select('srsRetention', [[0.8, '80 %'], [0.85, '85 %'], [0.9, '90 % (recommended)'], [0.95, '95 %']], Number)),
      field('Review: new cards per day', 'New cards introduced each day; the rest wait for tomorrow.', number('srsNewPerDay', 0, 100)),
      field('Show streaks', 'Days trained in a row, on Home and in Stats.', toggle('showStreaks')),
      field('Rest days per week', 'Days off that don’t break a streak (rolling 7 days). Rest is part of training.', select('restDaysPerWeek', [[0, 'None'], [1, 'One'], [2, 'Two'], [3, 'Three']], Number)),
      field('Colour-blind mode', 'Stroop switches to a spatial version that never relies on colour.', toggle('colorblind')),
      field('Game sounds', 'Tones in games like Simon.', toggle('gameSounds'))),

    h('h2', { style: { marginTop: '22px' } }, 'Online sources'),
    await onlineSection(save),
    h('div', { class: 'card', style: { marginTop: '10px' } },
      field('Species quiz: Costa Rica only', 'Off: species from anywhere in the world.', toggle('speciesCostaRica'))),

    h('h2', { style: { marginTop: '22px' } }, 'API keys (optional)'),
    await keysSection(),

    h('h2', { style: { marginTop: '22px' } }, 'Claude features (optional)'),
    await aiSection(save),

    h('h2', { style: { marginTop: '22px' } }, 'YouTube channels'),
    await channelsSection(save),

    h('h2', { style: { marginTop: '22px' } }, 'Window and Focus Point'),
    h('div', { class: 'card' },
      field('Keep Focus Point breaks working when maximized',
        'With an auto-hidden taskbar, a maximized window looks "fullscreen" to Focus Point and it would hold your breaks. This keeps Mind Gym one pixel short of that.',
        toggle('safeMaximize')),
      field('Allow fullscreen (F11)',
        'Warning: true fullscreen makes Focus Point postpone its breaks while you train. Mind Gym is screen time, not rest.',
        toggle('allowFullscreen'), 'warn')),

    h('h2', { style: { marginTop: '22px' } }, 'Habit: reminders and check-ins'),
    habitSection(save, field, toggle, number),
    h('h2', { style: { marginTop: '22px' } }, 'Data'),
    h('div', { class: 'card' },
      field('Updates', updaterLine, h('div', { class: 'row' },
        toggle('autoUpdate'),
        h('button', { class: 'btn small', type: 'button', onclick: () => window.api.checkForUpdates() }, 'Check now'),
        restartBtn)),
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
      field('What’s new', null, h('a', { class: 'btn small', href: '#/whats-new' }, 'Open')),
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
      const status = p.id === 'youtubeapi' && s.providers[p.id] !== false && !p.enabled ? 'Needs your API key (below)' : !p.enabled ? 'Off' : p.lockedFor ? 'Resting (asked us to slow down)' : p.lastError ? `Last try failed: ${p.lastError}` : p.requests ? 'Working' : 'Ready';
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

/** Keys are encrypted by the system (Windows DPAPI) and never shown again, only "set" / "not set". */
async function keysSection() {
  const box = h('div', { class: 'card' });
  const help = {
    youtube: ['Lets the Watch step search all of YouTube for a keyword (100 searches a day are free; Mind Gym uses at most 20). Without it, suggestions come from your channels and the Internet Archive.', 'https://developers.google.com/youtube/v3/getting-started'],
    nasa: ['Only needed if the shared demo key runs out (50 requests a day per computer) in the space quiz.', 'https://api.nasa.gov/'],
    anthropic: ['For the optional Claude features below. Billed to your own Anthropic account, pay per use.', 'https://platform.claude.com/'],
  };
  async function draw() {
    const st = await window.api.secretsStatus();
    if (!st.available) {
      fill(box, h('p', { class: 'muted' }, 'This system can’t encrypt secrets, so API keys can’t be stored. Everything else works without them.'));
      return;
    }
    fill(box, Object.entries(st.keys).map(([name, k]) => {
      const input = h('input', { type: 'password', placeholder: k.set ? '•••••••• (set)' : 'Paste your key', autocomplete: 'off', spellcheck: 'false', 'aria-label': k.label, style: { width: '220px' } });
      const saveKey = async (value) => {
        try {
          await window.api.setSecret(name, value);
          toast(value ? 'Key saved (encrypted).' : 'Key removed.');
          draw();
          window.dispatchEvent(new Event('mg:keys-changed'));
        } catch (err) {
          toast(String(err.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
        }
      };
      return h('div', { class: 'field' },
        h('div', {}, h('div', {}, k.label), h('div', { class: 'hint' }, help[name][0], ' ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); window.api.openExternal(help[name][1]); } }, 'How to get one'))),
        h('div', { class: 'row' }, input,
          h('button', { class: 'btn small', type: 'button', onclick: () => input.value.trim() && saveKey(input.value.trim()) }, 'Save'),
          k.set ? h('button', { class: 'btn small ghost', type: 'button', onclick: () => saveKey('') }, 'Remove') : ''));
    }));
  }
  await draw();
  return box;
}

/** Curated channels on/off, plus your own (by channel ID). */
async function channelsSection(save) {
  const box = h('div', { class: 'card' });
  const domains = await window.api.keywordDomains();
  async function draw() {
    const { curated } = await window.api.channels();
    const ch = state.settings.channels;
    const off = new Set(ch.disabled);
    const setChannels = async (next) => { await save({ channels: next }); draw(); };
    const rows = curated.map((c) => h('label', { class: 'check chan' },
      h('input', { type: 'checkbox', checked: !off.has(c.id), onchange: (e) => setChannels({ ...ch, disabled: e.target.checked ? ch.disabled.filter((x) => x !== c.id) : [...ch.disabled, c.id] }) }),
      ' ', c.name));
    const idInput = h('input', { type: 'text', placeholder: 'Channel ID (starts with UC…)', 'aria-label': 'Channel ID', style: { width: '260px' } });
    const nameInput = h('input', { type: 'text', placeholder: 'Name', 'aria-label': 'Channel name', style: { width: '160px' } });
    const domainSel = h('select', { 'aria-label': 'Topic' }, domains.map((d) => h('option', { value: d.id }, d.label)));
    fill(box,
      h('p', { class: 'muted small' }, 'Videos come from these channels’ public feeds. Untick the ones you don’t want.'),
      h('div', { class: 'chan-grid' }, rows),
      ch.custom.length ? h('div', { style: { marginTop: '12px' } }, h('div', {}, 'Your channels'), ch.custom.map((c) => h('div', { class: 'row' },
        h('span', {}, `${c.name} `, h('span', { class: 'muted small' }, c.id)),
        h('button', { class: 'btn small ghost', type: 'button', onclick: () => setChannels({ ...ch, custom: ch.custom.filter((x) => x.id !== c.id) }) }, 'Remove')))) : '',
      h('div', { class: 'row', style: { marginTop: '12px' } }, idInput, nameInput, domainSel,
        h('button', { class: 'btn small', type: 'button', onclick: () => {
          const id = idInput.value.trim();
          if (!/^UC[A-Za-z0-9_-]{22}$/.test(id)) { toast('A channel ID is 24 characters and starts with UC (find it in the channel’s page source or “About → Share channel”).'); return; }
          if (ch.custom.some((x) => x.id === id) || curated.some((x) => x.id === id)) { toast('Already in the list.'); return; }
          setChannels({ ...ch, custom: [...ch.custom, { id, name: nameInput.value.trim() || id, domains: [domainSel.value] }] });
        } }, 'Add channel')));
  }
  await draw();
  return box;
}

let redrawAi = () => {};
window.addEventListener('mg:keys-changed', () => redrawAi());

async function aiSection(save) {
  const box = h('div', { class: 'card' });
  async function draw() {
    const st = await window.api.aiStatus();
    const toggle = h('input', {
      type: 'checkbox', class: 'switch', role: 'switch', checked: st.turnedOn, 'aria-label': 'Claude features',
      onchange: async (e) => { await save({ aiEnabled: e.target.checked }); draw(); },
    });
    const line = !st.turnedOn ? 'Off. Everything in Mind Gym works without it.'
      : !st.keySet ? 'On, but no key yet: add your Anthropic API key above.'
        : !st.enabled ? 'On, but offline mode is on.'
          : `Ready · ${st.requestsToday} of ${st.dailyLimit} requests today${st.lastError ? ` · last error: ${st.lastError}` : ''}`;
    fill(box,
      h('div', { class: 'field' },
        h('div', {}, h('div', {}, 'Use Claude'), h('div', { class: 'hint' }, line)),
        h('div', {}, toggle)),
      h('ul', { class: 'muted small', style: { margin: '6px 0 0', paddingLeft: '18px' } },
        h('li', {}, 'Explain it back: Claude grades your explanation for understanding, not just matching words.'),
        h('li', {}, 'Socratic mode: talk a topic through with a tutor that only asks questions and never gives the answer.'),
        h('li', {}, 'Riddles and extra quiz questions written for any keyword, based on its Wikipedia summary.')),
      h('p', { class: 'muted small', style: { marginTop: '8px' } },
        'Privacy: only when you use one of these, Mind Gym sends the topic, its Wikipedia summary and what you wrote for that exercise to Anthropic (api.anthropic.com), with your key. Nothing else from your data, and nothing in the background. Anthropic\'s ',
        h('a', { href: '#', onclick: (e) => { e.preventDefault(); window.api.openExternal('https://www.anthropic.com/legal/privacy'); } }, 'privacy policy'),
        ' applies to what you send. Claude can make mistakes; its questions are marked.'));
  }
  await draw();
  redrawAi = () => box.isConnected && draw();
  return box;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Always-on mode, reminder times, days, sound, check-ins, quiet hours, goal, tray, startup. */
function habitSection(save, field, toggle, number) {
  const box = h('div', { class: 'card' });
  const draw = () => {
    const s = state.settings;
    const set = async (partial) => { await save(partial); draw(); };
    const allOn = s.dailyReminder && s.trayIcon && s.launchAtLogin;
    const master = h('input', {
      type: 'checkbox', class: 'switch', role: 'switch', checked: allOn, 'aria-label': 'Always on',
      onchange: (e) => set({ dailyReminder: e.target.checked, trayIcon: e.target.checked, launchAtLogin: e.target.checked }),
    });

    // reminder times
    const timeInput = h('input', { type: 'time', value: '12:00', 'aria-label': 'New reminder time' });
    const times = h('div', { class: 'time-list' },
      s.reminderTimes.map((t) => h('span', { class: 'chip' }, t,
        h('button', { class: 'btn small ghost', type: 'button', 'aria-label': `Remove ${t}`, onclick: () => set({ reminderTimes: s.reminderTimes.filter((x) => x !== t) }) }, '×'))),
      s.reminderTimes.length < 6 ? h('span', { class: 'row' }, timeInput,
        h('button', { class: 'btn small', type: 'button', onclick: () => timeInput.value && set({ reminderTimes: [...s.reminderTimes, timeInput.value] }) }, 'Add')) : null);
    const days = h('div', { class: 'weekdays', role: 'group', 'aria-label': 'Days' }, DAY_LABELS.map((label, d) => h('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(s.reminderDays.includes(d)),
      onclick: () => set({ reminderDays: s.reminderDays.includes(d) ? s.reminderDays.filter((x) => x !== d) : [...s.reminderDays, d] }),
    }, label)));

    const sound = h('select', { 'aria-label': 'Reminder sound', onchange: (e) => { set({ reminderSound: e.target.value }); playSound(e.target.value, s.reminderVolume); } },
      SOUND_NAMES.map((n) => h('option', { value: n, selected: n === s.reminderSound }, n === 'none' ? 'No sound' : n[0].toUpperCase() + n.slice(1))));
    const volume = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s.reminderVolume, 'aria-label': 'Volume', style: { width: '110px' },
      onchange: (e) => { set({ reminderVolume: Number(e.target.value) }); playSound(s.reminderSound, Number(e.target.value)); } });
    const timeField = (key) => h('input', { type: 'time', value: s[key], 'aria-label': key, onchange: (e) => set({ [key]: e.target.value }) });

    fill(box,
      field('Always on', 'One switch for reminders, the tray icon and start with Windows. Mind Gym then stays running all day and reminds you at your times. On by default.', master),
      field('Reminders', 'A notification with Mind Gym’s own sound at each time below. Training already done since the last reminder counts, so it only asks when you haven’t.', toggle('dailyReminder', draw)),
      s.dailyReminder ? h('div', {},
        field('Times', 'Up to 6 a day.', times),
        field('Days', null, days),
        field('Sound', 'Played by Mind Gym itself, so it’s different from other notifications.', h('div', { class: 'row' }, sound, volume,
          h('button', { class: 'btn small', type: 'button', onclick: () => window.api.testReminder() }, 'Test'))),
        field('Check-in length', 'Minutes of training that complete a check-in (any game, review or keyword session counts).', number('checkinMinutes', 1, 60)),
        field('Mandatory check-ins', 'Brings Mind Gym to the front and reminds you again every few minutes until the check-in is done, with a limited number of snoozes. Note: it can interrupt whatever you’re doing, including a Focus Point break.',
          toggle('checkinMandatory', draw), 'warn'),
        s.checkinMandatory ? field('Remind again every', 'Minutes, while a check-in is waiting.', number('snoozeMinutes', 2, 60)) : null,
        s.checkinMandatory ? field('Snoozes per check-in', null, number('maxSnoozes', 0, 10)) : null,
        field('Quiet hours', 'No reminders in this window. Clear both to turn quiet hours off.', h('div', { class: 'row' }, timeField('quietStart'), h('span', { class: 'muted' }, 'to'), timeField('quietEnd')))) : null,
      field('Daily goal', 'Minutes a day. Shown on Home, in the tray and as a progress bar on the taskbar button.', number('dailyGoalMinutes', 1, 240)),
      field('Progress on the taskbar button', 'Fills toward today’s goal; turns yellow with an orange dot when a check-in is waiting.', toggle('taskbarProgress')),
      field('When you close the window', 'Reminders only work while Mind Gym is running. “Minimize” keeps its button (and today’s progress) on the taskbar; “Hide in the tray” keeps only the tray icon.',
        h('select', { 'aria-label': 'When you close the window', onchange: (e) => set({ closeAction: e.target.value }) },
          [['minimize', 'Minimize to the taskbar'], ['tray', 'Hide in the tray'], ['quit', 'Quit (no reminders)']]
            .map(([v, label]) => h('option', { value: v, selected: s.closeAction === v }, label)))),
      field('Tray icon', 'Right-click it for a check-in, the Daily Mix or reviews. Windows 11 may tuck new tray icons behind the ^ arrow: drag it onto the taskbar to keep it visible.', toggle('trayIcon', draw)),
      field('Start with Windows', 'Starts minimized on the taskbar (or hidden in the tray), so reminders work from the moment you log in. To pin it, right-click Mind Gym on the taskbar and choose “Pin to taskbar” (Windows only lets you do that yourself).', toggle('launchAtLogin', draw)));
  };
  draw();
  return box;
}
