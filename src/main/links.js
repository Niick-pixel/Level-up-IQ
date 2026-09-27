// External links open in the default browser, and only to sites we know about.
const LINK_HOSTS = [
  'wikipedia.org', // any language subdomain
  'wikidata.org',
  'github.com',
  'projecteuler.net',
  'adventofcode.com',
  'khanacademy.org',
  'ocw.mit.edu',
  'brilliant.org',
  'lichess.org',
  'youtube.com',
  'archive.org',
  'metmuseum.org',
  'artic.edu',
  'inaturalist.org',
  'nasa.gov', // apod.nasa.gov, science.nasa.gov
  'opentdb.com',
  'the-trivia-api.com',
  'stockfishchess.org',
  'chiark.greenend.org.uk',
  'developers.google.com',
  'console.cloud.google.com',
  'creativecommons.org',
  'opensource.org',
  'gnu.org',
  'electronjs.org',
  'npmjs.com',
];

/** True for https URLs on an allowed host (or its subdomains). Exported for tests. */
function isAllowedLink(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return LINK_HOSTS.some((h) => host === h || host.endsWith('.' + h));
}

module.exports = { isAllowedLink, LINK_HOSTS };
