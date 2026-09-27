// NASA Astronomy Picture of the Day. The legacy api.nasa.gov endpoint (DEMO_KEY, or your own key)
// works until 2026-12-01; after that the new science.nasa.gov endpoint is used. Copyright varies
// per image, so each keeps its credit line.
const { Provider, ProviderError } = require('./provider');

const DAY = 24 * 3600 * 1000;
const INFO = {
  id: 'apod',
  name: 'NASA APOD',
  hosts: ['api.nasa.gov', 'science.nasa.gov', 'apod.nasa.gov'],
  license: 'Per image (NASA images are public domain; others keep their copyright)',
  licenseUrl: 'https://apod.nasa.gov/apod/lib/about_apod.html',
  attribution: 'Astronomy Picture of the Day (NASA / Michigan Tech); each image shows its credit.',
  homepage: 'https://apod.nasa.gov/',
  minIntervalMs: 2000,
  concurrency: 1,
  ttlMs: 365 * DAY,
};
const LEGACY_END = Date.UTC(2026, 11, 1);

const strip = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&#8217;|&rsquo;/g, '’').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** Legacy API entry → our shape (images only). Pure; exported for tests. */
function normalizeLegacy(e) {
  if (!e || e.media_type !== 'image' || !e.url || !e.title) return null;
  return {
    id: `apod:${e.date}`,
    source: 'apod',
    date: e.date,
    title: e.title.trim(),
    explanation: strip(e.explanation),
    imageUrl: e.url,
    credit: e.copyright ? `© ${strip(e.copyright)}` : 'NASA (public domain)',
    url: `https://apod.nasa.gov/apod/ap${String(e.date).slice(2).replace(/-/g, '')}.html`,
  };
}

/** New WordPress endpoint entry → our shape. Its schema isn't documented yet, so this is defensive. */
function normalizeWp(e) {
  if (!e) return null;
  const title = strip(e.title?.rendered ?? e.title);
  const html = String(e.content?.rendered ?? e.content ?? '');
  const img = e.apod_image_url || e.image_url || e.featured_image_url || e.jetpack_featured_media_url || (/<img[^>]+src="([^"]+)"/i.exec(html) || [])[1];
  const date = String(e.apod_date || e.date || '').slice(0, 10);
  if (!title || !img || !/^https:\/\/(apod|science)\.nasa\.gov\//.test(img)) return null;
  return {
    id: `apod:${date}`,
    source: 'apod',
    date,
    title,
    explanation: strip(e.apod_explanation || e.excerpt?.rendered || html).slice(0, 1200),
    imageUrl: img,
    credit: e.apod_copyright ? `© ${strip(e.apod_copyright)}` : strip(e.apod_credit) || 'NASA',
    url: e.link || 'https://apod.nasa.gov/',
  };
}

class Apod extends Provider {
  constructor(deps) {
    super(INFO, deps);
  }

  /** `count` random past pictures (images only). */
  async random(count = 12, rng) {
    if (this.now < LEGACY_END) {
      try {
        return await this.#legacy(count, rng);
      } catch (err) {
        if (err.code === 'offline' || err.code === 'disabled') throw err;
      }
    }
    return this.#wp(count, rng);
  }

  async #legacy(count, rng) {
    const key = this.deps.getSecret?.('nasa') || 'DEMO_KEY';
    // a fixed cache key per seed batch, so replays are stable and DEMO_KEY's 50/day isn't wasted
    const batch = rng ? rng.int(0, 19) : 0;
    const url = `https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(key)}&count=${Math.min(30, count * 2)}&thumbs=true`;
    const { data } = await this.getJson(url, { key: `apod:legacy:batch${batch}`, accept: Array.isArray });
    const out = data.map(normalizeLegacy).filter(Boolean);
    if (!out.length) throw new ProviderError('No images in this APOD batch', 'parse');
    return out.slice(0, count);
  }

  async #wp(count, rng) {
    const page = rng ? rng.int(1, 40) : 1;
    const url = `https://science.nasa.gov/wp-json/wp/v2/apod-basic?per_page=${Math.min(30, count * 2)}&page=${page}`;
    const { data } = await this.getJson(url, { accept: Array.isArray });
    return data.map(normalizeWp).filter(Boolean).slice(0, count);
  }
}

module.exports = { Apod, normalizeLegacy, normalizeWp, LEGACY_END, INFO };
