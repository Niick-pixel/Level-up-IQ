const path = require('path');
const {
  app, BrowserWindow, Tray, Menu, screen, ipcMain, protocol, shell, dialog, session, net, Notification, nativeImage, safeStorage,
} = require('electron');
const { Store } = require('./store');
const { Stats } = require('./stats');
const { Ratings } = require('./rating');
const { KeywordBank } = require('./keywords');
const { createUpdater } = require('./updater');
const { guardWindow } = require('./window-guard');
const { registerSchemes, handleProtocol, handleCacheProtocol, addMount, appUrl, SCHEME, CACHE_SCHEME, ROOT } = require('./protocol');
const { DiskCache } = require('./cache');
const { createProviders } = require('./providers/registry');
const { Learning } = require('./learning');
const { KeywordSessions } = require('./session');
const { isAllowedLink } = require('./links');
const { registerIpc } = require('./ipc');
const { Engines } = require('./engines');
const { Knowledge } = require('./knowledge');
const { Secrets } = require('./secrets');
const { Media } = require('./media');
const { Srs } = require('./srs');
const { Ai } = require('./ai');
const { Reminders } = require('./reminders');
const { localDateKey } = require('../shared/rng.js');

const ASSETS = path.join(__dirname, '..', '..', 'assets');
const START_HIDDEN = process.argv.includes('--hidden');

// Title-bar colors for each theme (must match src/renderer/theme.css).
const THEMES = {
  night:  { bg: '#12131f', fg: '#c9c6e8' },
  dusk:   { bg: '#1c1426', fg: '#e4c9e0' },
  forest: { bg: '#0f1a17', fg: '#bfdccd' },
  sand:   { bg: '#f3eee6', fg: '#5a4f45' },
};
const TITLEBAR_HEIGHT = 40;

if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}

app.setAppUserModelId('com.mindgym.app');
// Development and tests can point the data folder somewhere else.
if (process.env.MIND_GYM_DATA_DIR) app.setPath('userData', process.env.MIND_GYM_DATA_DIR);
registerSchemes(protocol);

let store;
let stats;
let ratings;
let bank;
let updater;
let cache;
let providers;
let learning;
let sessions;
let win = null;
let guard = null;
let tray = null;
let quitting = false;
let reminderTimer = null;
let reminders = null;

const dateKey = (ms = Date.now()) => localDateKey(ms);

function broadcast(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

// ---------------------------------------------------------------------------
// Window

function visibleOnSomeDisplay(b) {
  return screen.getAllDisplays().some(({ workArea: w }) =>
    b.x < w.x + w.width - 80 && b.x + b.width > w.x + 80 && b.y >= w.y - 10 && b.y < w.y + w.height - 80);
}

function createWindow() {
  const settings = store.get();
  const theme = THEMES[settings.theme] || THEMES.night;
  const saved = settings.windowBounds;
  const bounds = saved && visibleOnSomeDisplay(saved) ? saved : { width: 1280, height: 820 };

  win = new BrowserWindow({
    ...bounds,
    minWidth: 900,
    minHeight: 620,
    show: false,
    title: 'Mind Gym',
    icon: path.join(ASSETS, 'icon.png'),
    backgroundColor: theme.bg,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: theme.bg, symbolColor: theme.fg, height: TITLEBAR_HEIGHT },
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      autoplayPolicy: 'no-user-gesture-required', // reminder sounds play even when the window is hidden
      backgroundThrottling: false,
    },
  });
  win.removeMenu();
  guard = guardWindow(win, { screen, getSettings: () => store.get() });

  // No navigation away from the app, no new windows; allowed links open in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedLink(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`${SCHEME}://`)) e.preventDefault();
  });

  win.loadURL(appUrl('/index.html'));
  win.once('ready-to-show', () => {
    if (!START_HIDDEN) win.show();
  });

  let saveTimer = null;
  const saveBounds = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (win && !win.isDestroyed() && !win.isMaximized() && !win.isFullScreen() && !guard.isPseudoMaximized()) {
        store.set({ windowBounds: win.getBounds() });
      }
    }, 500);
  };
  win.on('resize', saveBounds);
  win.on('move', saveBounds);
  win.on('blur', () => broadcast('window:blur'));
  win.on('focus', () => broadcast('window:focus'));

  win.on('close', (e) => {
    // With the tray icon on, closing hides the window; otherwise closing quits.
    if (!quitting && store.get().trayIcon) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => { win = null; });
}

function showWindow() {
  if (!win) createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function applyTheme(themeName) {
  const theme = THEMES[themeName] || THEMES.night;
  if (win && !win.isDestroyed()) {
    win.setBackgroundColor(theme.bg);
    try {
      win.setTitleBarOverlay({ color: theme.bg, symbolColor: theme.fg, height: TITLEBAR_HEIGHT });
    } catch { /* not supported on this platform */ }
  }
}

// ---------------------------------------------------------------------------
// Optional extras (all off by default: Focus Point owns the tray and interruptions)

function trayMenu() {
  const st = reminders?.status();
  return Menu.buildFromTemplate([
    { label: 'Open Mind Gym', click: showWindow },
    { label: st?.due ? `Start the ${st.due.time} check-in` : 'Quick check-in', click: () => { showWindow(); broadcast('navigate', '#/checkin'); } },
    { label: 'Daily Mix', click: () => { showWindow(); broadcast('navigate', '#/mix'); } },
    { label: 'Review cards', click: () => { showWindow(); broadcast('navigate', '#/review'); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]);
}

function applyTray(enabled) {
  if (enabled && !tray) {
    const icon = nativeImage.createFromPath(path.join(ASSETS, 'tray.png'));
    tray = new Tray(icon);
    tray.setToolTip('Mind Gym');
    tray.setContextMenu(trayMenu());
    tray.on('click', showWindow);
    refreshPresence();
  } else if (!enabled && tray) {
    tray.destroy();
    tray = null;
  }
}

// A small orange dot for the taskbar button when a check-in is due (BGRA pixels, no file needed).
let dueBadgeImage = null;
function dueBadge() {
  if (dueBadgeImage) return dueBadgeImage;
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      const a = Math.max(0, Math.min(1, 7.5 - d)); // anti-aliased edge
      const ring = d > 5.5; // white ring so it reads on any taskbar colour
      const i = (y * size + x) * 4;
      buf[i] = ring ? 255 : 0x1c; buf[i + 1] = ring ? 255 : 0x72; buf[i + 2] = ring ? 255 : 0xcb; buf[i + 3] = Math.round(a * 255);
    }
  }
  dueBadgeImage = nativeImage.createFromBitmap(buf, { width: size, height: size });
  return dueBadgeImage;
}

/** Taskbar progress toward today's goal, a badge when a check-in is due, and the tray tooltip. */
function refreshPresence() {
  if (!store || !reminders) return;
  const s = store.get();
  const todayMs = stats.summary().today.ms || 0;
  const goalMs = s.dailyGoalMinutes * 60 * 1000;
  const st = reminders.status();
  if (win && !win.isDestroyed()) {
    try {
      if (s.taskbarProgress && todayMs < goalMs) win.setProgressBar(Math.max(0.03, todayMs / goalMs), { mode: st.due ? 'paused' : 'normal' });
      else win.setProgressBar(-1);
      win.setOverlayIcon(st.due ? dueBadge() : null, st.due ? 'Check-in due' : '');
    } catch { /* not supported on this platform */ }
  }
  if (tray) {
    const mins = Math.floor(todayMs / 60000);
    const extra = st.due ? ` · ${st.due.time} check-in due` : st.next ? ` · next check-in ${st.next.time}` : '';
    tray.setToolTip(`Mind Gym · ${mins} of ${s.dailyGoalMinutes} min today${extra}`);
    tray.setContextMenu(trayMenu());
  }
}

/** Fires a reminder: a notification, Mind Gym's own sound, and in mandatory mode the check-in. */
function fireReminder(f, { test = false } = {}) {
  const s = store.get();
  const body = f.mandatory
    ? `Time for your ${f.time} check-in: ${s.checkinMinutes} minutes.${f.repeat ? ' It’s still waiting.' : ''}`
    : `Ten minutes for your brain? Your ${f.time} check-in is ready (${s.checkinMinutes} min).`;
  if (Notification.isSupported()) {
    const n = new Notification({ title: test ? 'Mind Gym (test)' : f.mandatory ? 'Check-in time' : 'Mind Gym', body, silent: true });
    n.on('click', () => { showWindow(); broadcast('navigate', '#/checkin'); });
    n.show();
  }
  broadcast('reminder:fire', { ...f, sound: s.reminderSound, volume: s.reminderVolume, minutes: s.checkinMinutes, open: false });
  if (f.mandatory && !test) {
    showWindow();
    win?.flashFrame(true);
  }
}

function tickReminders() {
  if (!reminders) return;
  const { fire } = reminders.tick();
  if (fire) fireReminder(fire);
  refreshPresence();
}

function applyLoginItem(enabled) {
  if (!app.isPackaged) return; // don't register the dev electron binary
  app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] });
}

function onSettingsChanged(next) {
  applyTheme(next.theme);
  applyTray(next.trayIcon);
  applyLoginItem(next.launchAtLogin);
  if (!next.allowFullscreen && win && win.isFullScreen()) win.setFullScreen(false);
  tickReminders();
  broadcast('settings:changed', next);
}

// ---------------------------------------------------------------------------

app.on('second-instance', showWindow);

app.whenReady().then(() => {
  const dir = app.getPath('userData'); // %APPDATA%/Mind Gym
  store = new Store(dir);
  stats = new Stats(dir, { dateKey });
  ratings = new Ratings(dir, { dateKey });
  bank = KeywordBank.load();
  learning = new Learning(dir);
  for (const k of learning.userKeywords()) bank.add(k);

  // Online content is fetched only here in the main process, through the providers, on a
  // separate network session. The pages themselves can't reach the network at all.
  cache = new DiskCache(path.join(dir, 'cache'));
  const userAgent = `MindGym/${app.getVersion()} (+https://github.com/Niick-pixel/Level-up-IQ)`;
  const netSession = session.fromPartition('mind-gym-net');
  netSession.setUserAgent(userAgent); // Wikimedia asks every client to identify itself
  const secrets = new Secrets(dir, safeStorage);
  providers = createProviders({
    fetch: (url, opts) => netSession.fetch(url, opts),
    cache,
    userAgent,
    isOnline: () => net.isOnline(),
    getSettings: () => store.get(),
    getSecret: (name) => secrets.get(name),
  });
  sessions = new KeywordSessions({ bank, providers, learning, stats, ratings, dateKey });
  // Downloaded engines (Stockfish, GPL-3.0) live outside the app folder and are served read-only.
  const engines = new Engines(path.join(dir, 'engines'), {
    fetch: (url, opts) => netSession.fetch(url, opts),
    isOnline: () => net.isOnline(),
    getSettings: () => store.get(),
    bundledLicense: path.join(ROOT, 'assets', 'licenses', 'GPL-3.0.txt'),
  });
  addMount('/engines/', path.join(dir, 'engines'));
  const knowledge = new Knowledge({ bank, providers, cache, dir, getSettings: () => store.get() });
  const media = new Media(dir, { providers, bank, learning, getSettings: () => store.get() });
  const srs = new Srs(dir, { learning, getSettings: () => store.get(), dateKey });
  // Optional Claude features: off unless turned on in Settings with your own key.
  const ai = new Ai({
    fetch: (url, opts) => netSession.fetch(url, opts),
    getSecret: (name) => secrets.get(name),
    getSettings: () => store.get(),
    isOnline: () => net.isOnline(),
    dateKey,
  });

  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  session.defaultSession.webRequest.onBeforeRequest((details, cb) => {
    const ok = [`${SCHEME}://`, `${CACHE_SCHEME}://`, 'devtools://', 'data:'].some((p) => details.url.startsWith(p));
    cb({ cancel: !ok });
  });
  handleProtocol(protocol);
  handleCacheProtocol(protocol, cache);

  reminders = new Reminders(dir, { dateKey, getSettings: () => store.get(), todayMs: () => stats.summary().today.ms || 0 });
  let updateNotified = null;
  updater = createUpdater({
    app,
    getSettings: () => store.get(),
    onChange: (s) => {
      broadcast('updater:state', s);
      // one quiet notification per downloaded version; it installs when you quit
      if (s.status === 'ready' && updateNotified !== s.version && Notification.isSupported()) {
        updateNotified = s.version;
        const n = new Notification({ title: `Mind Gym ${s.version} is ready`, body: 'It installs when you quit, or click to restart now.', silent: true });
        n.on('click', () => updater.install());
        n.show();
      }
    },
  });

  registerIpc({
    ipcMain, app, shell, dialog, store, stats, ratings, bank, updater, dateKey, cache, providers, learning, sessions, engines, knowledge, secrets, media, srs, ai, reminders, guard: {
      setFullscreen: (on) => guard?.setFullscreen(on),
      toggleMaximize: () => guard?.toggleMaximize(),
    },
    getWindow: () => win,
    onSettingsChanged,
    onActivity: (x) => { Promise.resolve(x).finally(() => setTimeout(tickReminders, 50)); return x; },
    testReminder: () => fireReminder({ time: new Date().toTimeString().slice(0, 5), mandatory: false, repeat: false }, { test: true }),
  });

  createWindow();
  const s = store.get();
  applyTray(s.trayIcon);
  applyLoginItem(s.launchAtLogin);
  reminderTimer = setInterval(tickReminders, 30 * 1000);
  win.webContents.once('did-finish-load', () => setTimeout(tickReminders, 1500));
  updater.start();
});

app.on('before-quit', () => {
  quitting = true;
  clearInterval(reminderTimer);
});

app.on('window-all-closed', () => {
  if (!store?.get().trayIcon) app.quit();
});
