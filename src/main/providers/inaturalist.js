// iNaturalist: research-grade species with openly licensed photos (CC0, CC BY, CC BY-NC), each
// shown with its photographer's attribution. Costa Rica by default (a setting).
const { Provider } = require('./provider');

const DAY = 24 * 3600 * 1000;
const INFO = {
  id: 'inaturalist',
  name: 'iNaturalist',
  hosts: ['api.inaturalist.org', 'inaturalist-open-data.s3.amazonaws.com', 'static.inaturalist.org'],
  license: 'Per photo (CC0, CC BY or CC BY-NC only)',
  licenseUrl: 'https://www.inaturalist.org/pages/terms',
  attribution: 'Species photos from iNaturalist observers; each photo shows its author and license.',
  homepage: 'https://www.inaturalist.org/',
  minIntervalMs: 1100, // well under 60 requests a minute
  concurrency: 1,
  ttlMs: 30 * DAY,
};
const PLACE_COSTA_RICA = 6924;
const LICENSES = ['cc0', 'cc-by', 'cc-by-nc'];
const GROUPS = ['Aves', 'Mammalia', 'Reptilia', 'Amphibia', 'Insecta', 'Plantae', 'Fungi', 'Arachnida', 'Actinopterygii', 'Mollusca'];

/** Pure; exported for tests. */
function normalizeSpecies(r) {
  const t = r?.taxon;
  const p = t?.default_photo;
  if (!t || !p || !LICENSES.includes(String(p.license_code || '').toLowerCase())) return null;
  const url = p.medium_url || p.url?.replace('/square.', '/medium.');
  if (!url) return null;
  return {
    id: `inat:${t.id}`,
    source: 'inaturalist',
    name: t.preferred_common_name || t.name,
    scientific: t.name,
    group: t.iconic_taxon_name || 'Other',
    observations: r.count || 0,
    imageUrl: url,
    credit: p.attribution || 'iNaturalist observer',
    license: String(p.license_code).toUpperCase(),
    url: `https://www.inaturalist.org/taxa/${t.id}`,
  };
}

class INaturalist extends Provider {
  constructor(deps) {
    super(INFO, deps);
  }

  /** The most-observed species in a group (and place), with usable photos. */
  async species({ group, costaRica = true, perPage = 100 }) {
    const place = costaRica ? `&place_id=${PLACE_COSTA_RICA}` : '';
    const url = `https://api.inaturalist.org/v1/observations/species_counts?quality_grade=research&photo_license=${LICENSES.join(',')}&iconic_taxa=${encodeURIComponent(group)}${place}&per_page=${perPage}`;
    const { data } = await this.getJson(url, { accept: (d) => Array.isArray(d?.results) });
    return data.results.map(normalizeSpecies).filter(Boolean);
  }
}

module.exports = { INaturalist, normalizeSpecies, PLACE_COSTA_RICA, GROUPS, INFO };
