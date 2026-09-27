// Art Institute of Chicago API. Public-domain works only. Its IIIF image server answers 403
// unless an AIC-User-Agent header identifies the app, which is why images go through the main
// process (a page's <img> can't send it).
const { Provider } = require('./provider');

const DAY = 24 * 3600 * 1000;
const INFO = {
  id: 'aic',
  name: 'Art Institute of Chicago',
  hosts: ['api.artic.edu', 'www.artic.edu'],
  license: 'CC0 (public-domain works); descriptions CC BY 4.0',
  licenseUrl: 'https://www.artic.edu/open-access/open-access-images',
  attribution: 'Artworks from the Art Institute of Chicago (public domain).',
  homepage: 'https://www.artic.edu/',
  minIntervalMs: 1100, // 60 requests a minute
  concurrency: 1,
  ttlMs: 30 * DAY,
};
const FIELDS = 'id,title,artist_title,artist_display,date_display,date_start,date_end,image_id,place_of_origin,medium_display,credit_line,is_public_domain';

/** Pure; exported for tests. */
function normalizeArtwork(a) {
  if (!a || !a.is_public_domain || !a.image_id || !Number.isFinite(a.date_start)) return null;
  const end = Number.isFinite(a.date_end) ? a.date_end : a.date_start;
  return {
    id: `aic:${a.id}`,
    source: 'aic',
    title: a.title || 'Untitled',
    artist: a.artist_title || null,
    culture: a.place_of_origin || null,
    date: a.date_display || String(a.date_start),
    year: Math.round((a.date_start + end) / 2),
    medium: a.medium_display || null,
    imageUrl: `https://www.artic.edu/iiif/2/${a.image_id}/full/843,/0/default.jpg`,
    credit: a.credit_line || 'Art Institute of Chicago',
    url: `https://www.artic.edu/artworks/${a.id}`,
    license: 'CC0',
  };
}

class Aic extends Provider {
  constructor(deps) {
    super(INFO, deps);
    this.extraHeaders = { 'AIC-User-Agent': deps.userAgent || 'MindGym' };
  }

  async page(n) {
    const url = `https://api.artic.edu/api/v1/artworks/search?query[term][is_public_domain]=true&fields=${FIELDS}&limit=40&page=${n}`;
    const { data } = await this.getJson(url, { accept: (d) => Array.isArray(d?.data) });
    return data.data.map(normalizeArtwork).filter(Boolean);
  }

  async sample(rng, n) {
    const out = [];
    for (let tries = 0; out.length < n && tries < 3; tries++) {
      const list = await this.page(rng.int(1, 50)).catch(() => []);
      for (const a of rng.shuffle(list)) if (out.length < n && !out.some((x) => x.id === a.id)) out.push(a);
    }
    return out;
  }
}

module.exports = { Aic, normalizeArtwork, INFO };
