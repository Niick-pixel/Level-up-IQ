// The Metropolitan Museum of Art Collection API. Only Open Access objects (isPublicDomain,
// CC0) with an image are used; each keeps its credit line and a link to the Met's page.
const { Provider } = require('./provider');

const DAY = 24 * 3600 * 1000;
const API = 'https://collectionapi.metmuseum.org/public/collection/v1';
const INFO = {
  id: 'met',
  name: 'The Met Collection',
  hosts: ['collectionapi.metmuseum.org', 'images.metmuseum.org'],
  license: 'CC0 (Open Access)',
  licenseUrl: 'https://www.metmuseum.org/hubs/open-access',
  attribution: 'Artworks from The Metropolitan Museum of Art, Open Access (CC0).',
  homepage: 'https://www.metmuseum.org/',
  minIntervalMs: 500,
  concurrency: 2,
  ttlMs: 30 * DAY,
};

// Departments with a good spread of eras and cultures for the art quiz.
const DEPARTMENTS = [11, 6, 10, 13, 1, 21, 9, 14, 17];

/** Pure; exported for tests. Returns null for objects we may not use. */
function normalizeObject(o) {
  if (!o || !o.isPublicDomain || !o.primaryImageSmall) return null;
  const begin = Number.isFinite(o.objectBeginDate) ? o.objectBeginDate : null;
  const end = Number.isFinite(o.objectEndDate) ? o.objectEndDate : begin;
  if (begin === null) return null;
  return {
    id: `met:${o.objectID}`,
    source: 'met',
    title: o.title || 'Untitled',
    artist: o.artistDisplayName || null,
    culture: o.culture || null,
    date: o.objectDate || String(begin),
    year: Math.round((begin + end) / 2),
    medium: o.medium || null,
    department: o.department || null,
    imageUrl: o.primaryImageSmall,
    credit: o.creditLine || 'The Metropolitan Museum of Art',
    url: o.objectURL || `https://www.metmuseum.org/art/collection/search/${o.objectID}`,
    license: 'CC0',
  };
}

class Met extends Provider {
  constructor(deps) {
    super(INFO, deps);
  }

  async objectIds(departmentId) {
    const { data } = await this.getJson(`${API}/search?departmentId=${departmentId}&hasImages=true&q=*`, { accept: (d) => d && 'objectIDs' in d });
    return data.objectIDs || [];
  }

  async object(id) {
    const { data } = await this.getJson(`${API}/objects/${id}`, { accept: (d) => d && d.objectID });
    return normalizeObject(data);
  }

  /** Up to n usable artworks, sampled with rng across departments. */
  async sample(rng, n) {
    const out = [];
    for (let tries = 0; out.length < n && tries < n * 4; tries++) {
      const ids = await this.objectIds(rng.pick(DEPARTMENTS)).catch(() => []);
      if (!ids.length) continue;
      const art = await this.object(rng.pick(ids)).catch(() => null);
      if (art && !out.some((a) => a.id === art.id)) out.push(art);
    }
    return out;
  }
}

module.exports = { Met, normalizeObject, DEPARTMENTS, INFO };
