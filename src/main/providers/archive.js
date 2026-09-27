// Internet Archive: public-domain and openly licensed documentaries. Items whose license we can't
// confirm (Public Domain Mark, CC0, CC BY, CC BY-SA, or the public-domain Prelinger collection)
// are left out. We link to archive.org; nothing is downloaded.
const { Provider } = require('./provider');

const DAY = 24 * 3600 * 1000;
const INFO = {
  id: 'archive',
  name: 'Internet Archive',
  hosts: ['archive.org'],
  license: 'Per item (public domain or Creative Commons only)',
  licenseUrl: 'https://archive.org/about/terms.php',
  attribution: 'Films from the Internet Archive (archive.org); each item’s license is shown.',
  homepage: 'https://archive.org/',
  minIntervalMs: 1500,
  concurrency: 1,
  ttlMs: 14 * DAY,
};

const OPEN = /creativecommons\.org\/(publicdomain\/(mark|zero)|licenses\/by(-sa)?\/)/i;
const OPEN_COLLECTIONS = ['prelinger_archives'];

function licenseLabel(url, collections) {
  if (!url && collections.some((c) => OPEN_COLLECTIONS.includes(c))) return 'Public domain (Prelinger Archives)';
  if (/publicdomain\/mark/i.test(url)) return 'Public Domain Mark';
  if (/publicdomain\/zero/i.test(url)) return 'CC0';
  const m = /licenses\/(by(?:-sa)?)\/([\d.]+)/i.exec(url || '');
  return m ? `CC ${m[1].toUpperCase()} ${m[2]}` : null;
}

/** Pure; exported for tests. */
function parseSearch(data) {
  const docs = data?.response?.docs || [];
  return docs.map((d) => {
    const collections = [].concat(d.collection || []);
    const license = licenseLabel(d.licenseurl, collections);
    return {
      id: String(d.identifier || ''),
      source: 'archive',
      title: String([].concat(d.title || '')[0]).trim(),
      channel: 'Internet Archive',
      published: d.year ? String(d.year) : '',
      description: String([].concat(d.description || '')[0]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600),
      thumbnail: d.identifier ? `https://archive.org/services/img/${encodeURIComponent(d.identifier)}` : null,
      url: `https://archive.org/details/${encodeURIComponent(d.identifier || '')}`,
      license,
      licenseUrl: d.licenseurl || null,
      open: Boolean(license) && (OPEN.test(d.licenseurl || '') || collections.some((c) => OPEN_COLLECTIONS.includes(c))),
    };
  }).filter((v) => v.id && v.title && v.open);
}

class Archive extends Provider {
  constructor(deps) {
    super(INFO, deps);
  }

  /** Films about a topic (documentaries first). */
  async films(topic, rows = 25) {
    const t = String(topic).replace(/["()\\:]/g, ' ').trim().slice(0, 80);
    const q = `(title:(${t}) OR subject:(${t})) AND mediatype:(movies)`;
    const fields = ['identifier', 'title', 'licenseurl', 'year', 'description', 'collection'].map((f) => `fl[]=${f}`).join('&');
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&${fields}&rows=${rows}&sort[]=downloads+desc&output=json`;
    const { data } = await this.getJson(url, { accept: (d) => Array.isArray(d?.response?.docs) });
    return parseSearch(data);
  }
}

module.exports = { Archive, parseSearch, licenseLabel, INFO };
