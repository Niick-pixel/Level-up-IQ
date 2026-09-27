// Creates the providers with shared dependencies and exposes the list for Settings.
const { Wikipedia } = require('./wikipedia');
const { Wikidata } = require('./wikidata');
const { OpenTdb } = require('./opentdb');
const { Lichess } = require('./lichess');
const { TriviaApi } = require('./triviaapi');
const { YouTubeRss } = require('./youtube-rss');
const { YouTubeApi } = require('./youtube-api');
const { Archive } = require('./archive');
const { Met } = require('./met');
const { Aic } = require('./aic');
const { INaturalist } = require('./inaturalist');
const { Apod } = require('./apod');

const PROVIDER_IDS = ['wikipedia', 'wikidata', 'opentdb', 'triviaapi', 'lichess', 'youtube', 'youtubeapi', 'archive', 'met', 'aic', 'inaturalist', 'apod'];

/**
 * @param {{ fetch, cache, userAgent, isOnline?, now?, sleep?, getSettings, getSecret? }} deps
 */
function createProviders(deps) {
  const shared = {
    ...deps,
    isEnabled: (id) => {
      const s = deps.getSettings();
      return !s.offlineMode && s.providers?.[id] !== false;
    },
  };
  const all = {
    wikipedia: new Wikipedia(shared),
    wikidata: new Wikidata(shared),
    opentdb: new OpenTdb(shared),
    triviaapi: new TriviaApi(shared),
    lichess: new Lichess(shared),
    youtube: new YouTubeRss(shared),
    youtubeapi: new YouTubeApi(shared),
    archive: new Archive(shared),
    met: new Met(shared),
    aic: new Aic(shared),
    inaturalist: new INaturalist(shared),
    apod: new Apod(shared),
  };
  return {
    ...all,
    list: () => PROVIDER_IDS.map((id) => all[id].status()),
    /** Every host any provider may contact (for the network allowlist). */
    hosts: () => [...new Set(PROVIDER_IDS.flatMap((id) => all[id].hosts))],
  };
}

module.exports = { createProviders, PROVIDER_IDS };
