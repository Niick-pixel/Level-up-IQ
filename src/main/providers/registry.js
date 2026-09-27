// Creates the providers with shared dependencies and exposes the list for Settings.
const { Wikipedia } = require('./wikipedia');
const { Wikidata } = require('./wikidata');
const { OpenTdb } = require('./opentdb');
const { Lichess } = require('./lichess');
const { TriviaApi } = require('./triviaapi');

const PROVIDER_IDS = ['wikipedia', 'wikidata', 'opentdb', 'triviaapi', 'lichess'];

/**
 * @param {{ fetch, cache, userAgent, isOnline?, now?, sleep?, getSettings }} deps
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
  };
  return {
    ...all,
    list: () => PROVIDER_IDS.map((id) => all[id].status()),
    /** Every host any provider may contact (for the network allowlist). */
    hosts: () => [...new Set(PROVIDER_IDS.flatMap((id) => all[id].hosts))],
  };
}

module.exports = { createProviders, PROVIDER_IDS };
