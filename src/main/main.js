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
let lastReminderDay = null;

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

function applyTray(enabled) {
  if (enabled && !tray) {
    const icon = nativeImage.createFromPath(path.join(ASSETS, 'tray.png'));
    tray = new Tray(icon);
    tray.setToolTip('Mind Gym');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open Mind Gym', click: showWindow },
      { label: 'Daily Mix', click: () => { showWindow(); broadcast('navigate', '#/mix'); } },
      { type: 'separator' },
      { label: 'Quit', click: () => { quitting = true; app.quit(); } },
    ]));
    tray.on('click', showWindow);
  } else if (!enabled && tray) {
    tray.destroy();
    tray = null;
  }
}

function applyLoginItem(enabled) {
  if (!app.isPackaged) return; // don't register the dev electron binary
  app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] });
}

function checkReminder() {
  const s = store.get();
  if (!s.dailyReminder) return;
  const now = new Date();
  const today = dateKey(now.getTime());
  const [h, m] = s.dailyReminderTime.split(':').map(Number);
  if (lastReminderDay === today || now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
  lastReminderDay = today;
  if ((stats.summary().today.games || 0) > 0) return; // already trained today
  if (!Notification.isSupported()) return;
  const n = new Notification({ title: 'Mind Gym', body: 'Ten minutes for your brain? Your Daily Mix is ready.', silent: true });
  n.on('click', () => { showWindow(); broadcast('navigate', '#/mix'); });
  n.show();
}

function onSettingsChanged(next) {
  applyTheme(next.theme);
  applyTray(next.trayIcon);
  applyLoginItem(next.launchAtLogin);
  if (!next.allowFullscreen && win && win.isFullScreen()) win.setFullScreen(false);
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

  updater = createUpdater({ app, getSettings: () => store.get(), onChange: (s) => broadcast('updater:state', s) });

  registerIpc({
    ipcMain, app, shell, dialog, store, stats, ratings, bank, updater, dateKey, cache, providers, learning, sessions, engines, knowledge, secrets, media, srs, ai, guard: {
      setFullscreen: (on) => guard?.setFullscreen(on),
      toggleMaximize: () => guard?.toggleMaximize(),
    },
    getWindow: () => win,
    onSettingsChanged,
  });

  createWindow();
  const s = store.get();
  applyTray(s.trayIcon);
  applyLoginItem(s.launchAtLogin);
  reminderTimer = setInterval(checkReminder, 60 * 1000);
  updater.start();
});

app.on('before-quit', () => {
  quitting = true;
  clearInterval(reminderTimer);
});

app.on('window-all-closed', () => {
  if (!store?.get().trayIcon) app.quit();
});
