// YouTube channel RSS feeds (no key): the latest ~15 videos per curated channel. We only list and
// link out to youtube.com; nothing is downloaded or embedded (YouTube Terms of Service).
const { XMLParser } = require('fast-xml-parser');
const { Provider, ProviderError } = require('./provider');

const HOUR = 3600 * 1000;
const INFO = {
  id: 'youtube',
  name: 'YouTube (channel feeds)',
  hosts: ['www.youtube.com', 'i.ytimg.com'],
  license: 'YouTube Terms of Service',
  licenseUrl: 'https://www.youtube.com/t/terms',
  attribution: 'Video titles and thumbnails from the channels’ public YouTube feeds; videos open on YouTube.',
  homepage: 'https://www.youtube.com/',
  minIntervalMs: 700,
  concurrency: 2,
  ttlMs: 6 * HOUR, // stale copies are kept and used when a feed fails (intermittent 404s)
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@' });
const arr = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);

/** Parses a channel's Atom feed into videos. Pure; exported for tests. */
function parseFeed(xml, channel = {}) {
  const doc = parser.parse(xml);
  const feed = doc?.feed;
  if (!feed) throw new ProviderError('Not a YouTube feed', 'parse');
  const title = String(feed.title ?? '');
  const videos = arr(feed.entry).map((e) => {
    const id = String(e['yt:videoId'] ?? '');
    const links = arr(e.link).map((l) => l['@href']).filter(Boolean);
    const group = e['media:group'] || {};
    return {
      id,
      source: 'youtube',
      title: String(e.title ?? '').trim(),
      channelId: String(e['yt:channelId'] ?? channel.id ?? ''),
      channel: channel.name || String(e.author?.name ?? title),
      published: String(e.published ?? ''),
      description: String(group['media:description'] ?? '').slice(0, 600),
      thumbnail: group['media:thumbnail']?.['@url'] || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null),
      url: `https://www.youtube.com/watch?v=${id}`,
      short: links.some((l) => l.includes('/shorts/')),
      domains: channel.domains || [],
    };
  }).filter((v) => /^[A-Za-z0-9_-]{11}$/.test(v.id) && !v.short);
  return { title, videos };
}

class YouTubeRss extends Provider {
  constructor(deps) {
    super(INFO, deps);
  }

  async channel(ch) {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(ch.id)}`;
    const { data, stale } = await this.getText(url, { accept: (t) => typeof t === 'string' && t.includes('<feed') });
    return { ...parseFeed(data, ch), stale };
  }

  /** Latest videos from many channels; channels that fail are skipped (reported in `failed`). */
  async latest(channels) {
    const results = await Promise.all(channels.map((c) => this.channel(c).then((r) => ({ c, r })).catch((err) => ({ c, err }))));
    const videos = results.flatMap(({ r }) => (r ? r.videos : []));
    videos.sort((a, b) => b.published.localeCompare(a.published));
    return { videos, failed: results.filter((x) => x.err).map((x) => x.c.name) };
  }
}

module.exports = { YouTubeRss, parseFeed, INFO };
