// YouTube Data API v3 search (optional): only with your own API key, stored encrypted. Searches
// are cached for 7 days and capped at 20 a day to stay far inside the quota.
const { Provider, ProviderError } = require('./provider');

const DAY = 24 * 3600 * 1000;
const INFO = {
  id: 'youtubeapi',
  name: 'YouTube search (your API key)',
  hosts: ['www.googleapis.com', 'i.ytimg.com'],
  license: 'YouTube API Services Terms of Service',
  licenseUrl: 'https://developers.google.com/youtube/terms/api-services-terms-of-service',
  attribution: 'Search results from the YouTube Data API; videos open on YouTube.',
  homepage: 'https://developers.google.com/youtube/v3',
  minIntervalMs: 1000,
  concurrency: 1,
  ttlMs: 7 * DAY,
};
const DAILY_LIMIT = 20;

/** Pure; exported for tests. */
function parseSearch(data) {
  return (data.items || []).filter((it) => it.id?.videoId).map((it) => ({
    id: it.id.videoId,
    source: 'youtube',
    title: decodeEntities(it.snippet?.title || ''),
    channel: decodeEntities(it.snippet?.channelTitle || ''),
    channelId: it.snippet?.channelId || '',
    published: it.snippet?.publishedAt || '',
    description: decodeEntities(it.snippet?.description || ''),
    thumbnail: it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.default?.url || null,
    url: `https://www.youtube.com/watch?v=${it.id.videoId}`,
  }));
}
const decodeEntities = (s) => s.replace(/&(#39|quot|amp|lt|gt);/g, (_, e) => ({ '#39': "'", quot: '"', amp: '&', lt: '<', gt: '>' })[e]);

class YouTubeApi extends Provider {
  constructor(deps) {
    super(INFO, deps);
    this.day = '';
    this.count = 0;
  }

  hasKey() {
    return Boolean(this.deps.getSecret?.('youtube'));
  }

  enabled() {
    return super.enabled() && this.hasKey();
  }

  async search(query) {
    const key = this.deps.getSecret?.('youtube');
    if (!key) throw new ProviderError('No YouTube API key set', 'disabled');
    const q = String(query).trim().slice(0, 100);
    const cacheKey = `youtubeapi:search:${q.toLowerCase()}`;
    const today = new Date(this.now).toISOString().slice(0, 10);
    if (today !== this.day) { this.day = today; this.count = 0; }
    const cached = this.deps.cache.get(cacheKey);
    if (!cached && this.count >= DAILY_LIMIT) throw new ProviderError('Daily search limit reached', 'locked');
    if (!cached) this.count += 1;
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=6&safeSearch=strict&videoDuration=medium&relevanceLanguage=en&q=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}`;
    const { data } = await this.getJson(url, { key: cacheKey, accept: (d) => Array.isArray(d?.items) });
    return parseSearch(data);
  }
}

module.exports = { YouTubeApi, parseSearch, DAILY_LIMIT, INFO };
