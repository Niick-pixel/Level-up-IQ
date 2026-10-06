// Settings kept in %APPDATA%/Mind Gym/settings.json.
const path = require('path');
const { readJson, writeJson } = require('./json-file');

const THEMES = ['night', 'dusk', 'forest', 'sand'];
const SOUNDS = ['chime', 'bell', 'marimba', 'soft', 'none'];
const DIFFICULTY_MODES = ['adaptive', 'easy', 'medium', 'hard', 'expert'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const CLOSE_ACTIONS = ['minimize', 'tray', 'quit'];
// Bumped when the defaults for staying around change; older settings files get them once.
const HABIT_DEFAULTS = 2;

const DEFAULTS = {
  theme: 'night',
  sessionMinutes: 10, // Daily Mix length
  difficultyBias: 0, // -2 (easier) .. +2 (harder); shifts the target success rate
  wordLanguage: 'en', // Spanish arrives later
  thinkingTimerSec: 20, // hints and "reveal" stay locked this long
  colorblind: false, // Stroop uses the spatial variant instead of colors
  sound: false,

  // Staying around (on by default since 1.2: Mind Gym is meant to be a daily habit)
  trayIcon: true,
  dailyReminder: true, // reminders on/off (several times a day since 1.1)
  dailyReminderTime: '19:00', // kept for older settings files; reminderTimes replaces it
  launchAtLogin: true, // starts minimized on the taskbar (or hidden in the tray)
  closeAction: 'minimize', // the window's X: minimize (stay on the taskbar) | tray (hide) | quit
  persistNotice: true, // one-time note on Home explaining the above
  trayNoticeShown: false, // "still running in the tray" shown once
  relaunchHidden: false, // set before an idle-time update so the restarted app comes back minimized

  // Reminders and check-ins (1.1)
  reminderTimes: ['10:00', '15:00', '20:00'], // up to 6 a day, "HH:MM"
  reminderDays: [0, 1, 2, 3, 4, 5, 6], // 0 = Sunday
  reminderSound: 'chime', // chime | bell | marimba | soft | none
  reminderVolume: 0.7,
  checkinMinutes: 5, // a check-in is done after this much training
  checkinMandatory: false, // bring the window forward and keep reminding until it's done
  snoozeMinutes: 10, // mandatory mode reminds again this often
  maxSnoozes: 2, // snoozes allowed per check-in in mandatory mode
  quietStart: '22:30', // no reminders between these (empty = no quiet hours)
  quietEnd: '07:00',
  dailyGoalMinutes: 10, // shown on the taskbar button and in the tray
  taskbarProgress: true,
  gameSounds: true, // tones in games like Simon

  // Difficulty (1.1): 'adaptive' follows your ratings; the others keep levels in a band
  difficultyMode: 'adaptive', // adaptive | easy | medium | hard | expert

  lastSeenVersion: '', // for "What's new" after an update

  // Focus Point coexistence
  safeMaximize: true, // keep Focus Point breaks working when maximized without a visible taskbar
  allowFullscreen: false, // opt-in; true fullscreen can delay Focus Point breaks

  // Online sources (all optional; the app works fully offline)
  offlineMode: false,
  providers: {
    wikipedia: true, wikidata: true, opentdb: true, triviaapi: true, lichess: true,
    youtube: true, youtubeapi: true, archive: true, met: true, aic: true, inaturalist: true, apod: true,
  },
  channels: { disabled: [], custom: [] }, // curated YouTube channels switched off; your own additions
  speciesCostaRica: true, // species quiz: Costa Rica only (off = the whole world)

  // Spaced repetition and streaks (Phase 5)
  srsRetention: 0.9, // aim to remember 90 % of cards when they come back
  srsNewPerDay: 15, // new cards introduced per day
  showStreaks: true,
  restDaysPerWeek: 1, // days off that don't break a streak (rolling 7 days)
  playlists: [], // your own game lists: [{ id, name, games: [gameId] }]

  // Claude features (Phase 6): off by default, and they also need your own API key
  aiEnabled: false,

  autoUpdate: true,
  windowBounds: null, // { x, y, width, height }
};

function sanitize(partial) {
  const out = {};
  for (const [k, v] of Object.entries(partial || {})) {
    if (!(k in DEFAULTS)) continue;
    switch (k) {
      case 'theme': if (THEMES.includes(v)) out[k] = v; break;
      case 'sessionMinutes': out[k] = clampInt(v, 3, 60); break;
      case 'difficultyBias': out[k] = clampInt(v, -2, 2); break;
      case 'thinkingTimerSec': out[k] = clampInt(v, 0, 300); break;
      case 'wordLanguage': if (v === 'en') out[k] = v; break;
      case 'dailyReminderTime': if (TIME.test(v)) out[k] = v; break;
      case 'reminderTimes':
        if (Array.isArray(v)) out[k] = [...new Set(v.filter((t) => TIME.test(t)))].sort().slice(0, 6);
        break;
      case 'reminderDays':
        if (Array.isArray(v)) out[k] = [...new Set(v.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
        break;
      case 'reminderSound': if (SOUNDS.includes(v)) out[k] = v; break;
      case 'reminderVolume': { const n = Number(v); if (Number.isFinite(n)) out[k] = Math.min(1, Math.max(0, Math.round(n * 100) / 100)); break; }
      case 'checkinMinutes': out[k] = clampInt(v, 1, 60); break;
      case 'snoozeMinutes': out[k] = clampInt(v, 2, 60); break;
      case 'maxSnoozes': out[k] = clampInt(v, 0, 10); break;
      case 'quietStart': case 'quietEnd': if (v === '' || TIME.test(v)) out[k] = v; break;
      case 'dailyGoalMinutes': out[k] = clampInt(v, 1, 240); break;
      case 'difficultyMode': if (DIFFICULTY_MODES.includes(v)) out[k] = v; break;
      case 'closeAction': if (CLOSE_ACTIONS.includes(v)) out[k] = v; break;
      case 'lastSeenVersion': if (typeof v === 'string' && /^[0-9a-z.+-]{0,40}$/i.test(v)) out[k] = v; break;
      case 'providers':
        if (v && typeof v === 'object') {
          out[k] = { ...DEFAULTS.providers };
          for (const id of Object.keys(DEFAULTS.providers)) if (typeof v[id] === 'boolean') out[k][id] = v[id];
        }
        break;
      case 'srsRetention': { const n = Number(v); if (Number.isFinite(n)) out[k] = Math.min(0.97, Math.max(0.7, Math.round(n * 100) / 100)); break; }
      case 'srsNewPerDay': out[k] = clampInt(v, 0, 100); break;
      case 'restDaysPerWeek': out[k] = clampInt(v, 0, 3); break;
      case 'playlists':
        if (Array.isArray(v)) {
          out[k] = v.filter((p) => p && typeof p.name === 'string' && Array.isArray(p.games)).slice(0, 30).map((p, i) => ({
            id: /^[a-z0-9-]{1,40}$/.test(p.id) ? p.id : `list-${i + 1}`,
            name: p.name.trim().slice(0, 60) || 'My playlist',
            games: p.games.filter((g) => /^[a-z0-9-]{1,40}$/.test(g)).slice(0, 30),
          }));
        }
        break;
      case 'channels':
        if (v && typeof v === 'object') {
          const id = /^UC[A-Za-z0-9_-]{22}$/;
          out[k] = {
            disabled: [...new Set((Array.isArray(v.disabled) ? v.disabled : []).filter((x) => id.test(x)))].slice(0, 200),
            custom: (Array.isArray(v.custom) ? v.custom : [])
              .filter((c) => c && id.test(c.id))
              .slice(0, 50)
              .map((c) => ({ id: c.id, name: String(c.name || c.id).slice(0, 80), domains: (Array.isArray(c.domains) ? c.domains : []).filter((d) => /^[a-z-]{2,30}$/.test(d)).slice(0, 8) })),
          };
        }
        break;
      case 'windowBounds':
        if (v === null || (v && ['x', 'y', 'width', 'height'].every((p) => Number.isFinite(v[p])))) out[k] = v;
        break;
      default:
        if (typeof v === typeof DEFAULTS[k]) out[k] = v;
    }
  }
  return out;
}

function pickBooleans(obj) {
  const out = {};
  for (const id of Object.keys(DEFAULTS.providers)) if (typeof obj?.[id] === 'boolean') out[id] = obj[id];
  return out;
}

function clampInt(v, min, max) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

class Store {
  /** @param {string|null} dir app-data folder; null keeps everything in memory (tests) */
  constructor(dir) {
    this.file = dir ? path.join(dir, 'settings.json') : null;
    const raw = readJson(this.file, {});
    const saved = sanitize(raw);
    // settings from 1.0 had one reminder time
    if (!raw.reminderTimes && raw.dailyReminder && saved.dailyReminderTime) saved.reminderTimes = [saved.dailyReminderTime];
    const migrate = Object.keys(raw).length > 0 && (Number(raw.habitDefaults) || 0) < HABIT_DEFAULTS;
    if (migrate) {
      // 1.0 and 1.1 shipped with all of this off, so closing the window quit Mind Gym and no
      // reminder could ever fire. Turn it on once; you can switch any of it off again.
      Object.assign(saved, { trayIcon: true, launchAtLogin: true, dailyReminder: true, persistNotice: true });
      delete saved.closeAction;
      const times = saved.reminderTimes;
      if (!times || !raw.dailyReminder || (times.length === 1 && times[0] === '19:00')) delete saved.reminderTimes;
    }
    this.data = { ...structuredClone(DEFAULTS), ...saved, habitDefaults: HABIT_DEFAULTS };
    if (migrate) writeJson(this.file, this.data);
  }

  get() {
    return structuredClone(this.data);
  }

  set(partial) {
    const clean = sanitize(partial);
    if (clean.providers) clean.providers = { ...this.data.providers, ...pickBooleans(partial.providers) };
    this.data = { ...this.data, ...clean };
    writeJson(this.file, this.data);
    return this.get();
  }

  reset() {
    const bounds = this.data.windowBounds;
    this.data = { ...structuredClone(DEFAULTS), windowBounds: bounds, habitDefaults: HABIT_DEFAULTS };
    writeJson(this.file, this.data);
    return this.get();
  }
}

module.exports = { Store, DEFAULTS, THEMES, SOUNDS, DIFFICULTY_MODES, CLOSE_ACTIONS, HABIT_DEFAULTS };
