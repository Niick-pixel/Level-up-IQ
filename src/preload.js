// Safe bridge between the UI and the main process. Only these calls exist on window.api.
const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (cb) => {
  const handler = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};
const call = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('api', {
  // settings
  getSettings: call('settings:get'),
  setSettings: call('settings:set'),
  resetSettings: call('settings:reset'),
  onSettings: on('settings:changed'),

  // keywords
  keywordDomains: call('keywords:domains'),
  searchKeywords: call('keywords:search'),
  getKeyword: call('keywords:get'),
  keywordOfTheDay: call('keywords:today'),
  randomKeyword: call('keywords:random'),
  exploreKeyword: call('keywords:explore'),
  keywordCount: call('keywords:count'),
  userKeywords: call('keywords:user'),
  addKeyword: call('keywords:add'),
  removeKeyword: call('keywords:remove'),
  suggestKeywords: call('keywords:suggest'),
  wikiSearch: call('wiki:search'),
  wikiRandom: call('wiki:random'),

  // keyword sessions
  sessionLearn: call('session:learn'),
  sessionQuiz: call('session:quiz'),
  sessionPuzzle: call('session:puzzle'),
  sessionCompare: call('session:compare'),
  sessionFinish: call('session:finish'),
  homeExtras: call('home:extras'),
  cardCount: call('cards:count'),
  recentCards: call('cards:recent'),
  recallCards: call('cards:recall'),

  // knowledge games (online extras; each falls back to offline packs)
  triviaQuestions: call('knowledge:trivia'),
  guessArticle: call('knowledge:guess'),
  onThisDay: call('knowledge:onThisDay'),

  artRound: call('knowledge:art'),
  apodRound: call('knowledge:apod'),
  speciesRound: call('knowledge:species'),

  // watch and learn
  latestVideos: call('media:latest'),
  suggestVideos: call('media:suggest'),
  watchList: call('media:list'),
  addToWatch: call('media:add'),
  removeFromWatch: call('media:remove'),
  recallQuestions: call('media:recall'),
  markWatched: call('media:watched'),
  learnedItems: call('media:learned'),
  remoteImage: call('media:image'),
  channels: call('channels:list'),

  // optional API keys: you can set them and see whether they're set, never read them back
  secretsStatus: call('secrets:status'),
  setSecret: call('secrets:set'),

  // spaced repetition
  aiStatus: call('ai:status'),
  aiGrade: call('ai:grade'),
  aiSocratic: call('ai:socratic'),
  aiRiddle: call('ai:riddle'),
  aiQuestions: call('ai:questions'),
  reviewQueue: call('srs:queue'),
  reviewCard: call('srs:review'),
  srsStats: call('srs:stats'),
  allCards: call('srs:cards'),
  deleteCard: call('srs:delete'),

  // adaptivity
  mixContext: call('mix:context'),
  streak: call('stats:streak'),
  statsDays: call('stats:days'),
  statsExtra: call('stats:extra'),
  curiosity: call('stats:curiosity'),

  // downloadable engines (Stockfish)
  engineStatus: call('engine:status'),
  installEngine: call('engine:install'),
  removeEngine: call('engine:remove'),
  onEngineProgress: on('engine:progress'),

  // online sources
  providers: call('providers:list'),
  cacheSize: call('cache:size'),
  clearCache: call('cache:clear'),

  // games, stats, ratings
  suggestDifficulty: call('rating:suggest'),
  ratings: call('rating:all'),
  recordResult: call('stats:record'),
  statsSummary: call('stats:summary'),
  exportStats: call('stats:export'),
  resetStats: call('stats:reset'),

  // app
  info: call('app:info'),
  openExternal: call('app:openExternal'),
  updaterState: call('updater:state'),
  checkForUpdates: call('updater:check'),
  installUpdate: call('updater:install'),
  onUpdater: on('updater:state'),
  setFullscreen: call('window:fullscreen'),
  toggleMaximize: call('window:toggleMaximize'),
  onBlur: on('window:blur'),
  onFocus: on('window:focus'),
  onNavigate: on('navigate'),
  onReminder: on('reminder:fire'),
  reminderStatus: call('reminders:status'),
  snoozeReminder: call('reminders:snooze'),
  testReminder: call('reminders:test'),
  checkinContext: call('checkin:context'),
  changelog: call('app:changelog'),
});
