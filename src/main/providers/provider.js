// Common base for every online source.
//
// A provider declares the hosts it may contact, its license and attribution, a rate limit and a
// cache TTL. Every request goes through the same pipeline:
//   host allowlist → fresh cache hit? → offline / disabled / locked out? → rate limiter →
//   fetch with our User-Agent and a timeout → 429 lockout → cache → result
// If the network fails, a stale cached copy is returned when there is one.
const { Limiter } = require('./limiter');

class ProviderError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code; // 'offline' | 'disabled' | 'locked' | 'http' | 'host' | 'parse' | 'network'
  }
}

class Provider {
  /**
   * @param {object} info  { id, name, hosts, license, licenseUrl, attribution, homepage,
   *                         minIntervalMs, concurrency, ttlMs, lockoutMs }
   * @param {object} deps  { fetch, cache, now, sleep, userAgent, isOnline, isEnabled }
   */
  constructor(info, deps) {
    Object.assign(this, {
      concurrency: 1, minIntervalMs: 1000, ttlMs: 24 * 3600 * 1000, lockoutMs: 60 * 1000, timeoutMs: 20000,
    }, info);
    this.deps = deps;
    this.limiter = new Limiter({ minIntervalMs: this.minIntervalMs, concurrency: this.concurrency, now: deps.now, sleep: deps.sleep });
    this.lockedUntil = 0;
    this.lastError = null;
    this.requests = 0;
  }

  get now() {
    return (this.deps.now || Date.now)();
  }

  enabled() {
    return this.deps.isEnabled ? this.deps.isEnabled(this.id) : true;
  }

  online() {
    return this.deps.isOnline ? this.deps.isOnline() : true;
  }

  /** Can we reach the network for this provider right now? */
  isAvailable() {
    return this.enabled() && this.online() && this.now >= this.lockedUntil;
  }

  status() {
    return {
      id: this.id,
      name: this.name,
      enabled: this.enabled(),
      available: this.isAvailable(),
      lockedFor: Math.max(0, this.lockedUntil - this.now),
      lastError: this.lastError,
      requests: this.requests,
      license: this.license,
      licenseUrl: this.licenseUrl,
      attribution: this.attribution,
      homepage: this.homepage,
    };
  }

  checkHost(url) {
    const host = new URL(url).hostname;
    if (!this.hosts.includes(host)) throw new ProviderError(`${this.name} may not contact ${host}`, 'host');
  }

  /**
   * Fetches JSON through the cache.
   * @param {string} url
   * @param {{ ttlMs?: number, key?: string, headers?: object, cache?: boolean, accept?: (json) => boolean }} opts
   * @returns {Promise<{ data: any, fromCache: boolean, stale: boolean }>}
   */
  async getJson(url, opts = {}) {
    this.checkHost(url);
    const key = opts.key || `${this.id}:${url}`;
    const useCache = opts.cache !== false;
    const cached = useCache ? this.deps.cache.get(key) : null;
    if (cached && !cached.stale) return { data: cached.value, fromCache: true, stale: false };

    const fallback = (err) => {
      if (cached) return { data: cached.value, fromCache: true, stale: true };
      throw err;
    };
    if (!this.enabled()) return fallback(new ProviderError(`${this.name} is turned off`, 'disabled'));
    if (!this.online()) return fallback(new ProviderError('Offline', 'offline'));
    if (this.now < this.lockedUntil) return fallback(new ProviderError(`${this.name} asked us to slow down`, 'locked'));

    try {
      const res = await this.#request(url, { headers: { Accept: 'application/json', ...opts.headers } });
      let data;
      try {
        data = await res.json();
      } catch {
        throw new ProviderError(`${this.name} sent something that isn't JSON`, 'parse');
      }
      if (opts.accept && !opts.accept(data)) throw new ProviderError(`${this.name} sent an unexpected answer`, 'parse');
      if (useCache) this.deps.cache.set(key, data, opts.ttlMs ?? this.ttlMs);
      this.lastError = null;
      return { data, fromCache: false, stale: false };
    } catch (err) {
      this.lastError = err.message;
      return fallback(err instanceof ProviderError ? err : new ProviderError(err.message, 'network'));
    }
  }

  /** Downloads an image into the cache. Returns its hash (for mg-cache://img/<hash>) or null. */
  async cacheImage(url) {
    try {
      this.checkHost(url);
    } catch {
      return null;
    }
    const existing = this.deps.cache.hasImage(url);
    if (existing) return existing;
    if (!this.isAvailable()) return null;
    try {
      const res = await this.#request(url, { headers: { Accept: 'image/*' } });
      const type = (res.headers.get('content-type') || '').split(';')[0];
      if (!/^image\/(jpeg|png|gif|webp|svg\+xml)$/.test(type)) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > 8 * 1024 * 1024) return null;
      return this.deps.cache.setImage(url, buffer, type);
    } catch (err) {
      this.lastError = err.message;
      return null;
    }
  }

  async #request(url, { headers }) {
    return this.limiter.schedule(async () => {
      if (this.now < this.lockedUntil) throw new ProviderError(`${this.name} asked us to slow down`, 'locked');
      this.requests += 1;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      let res;
      try {
        res = await this.deps.fetch(url, {
          headers: { 'User-Agent': this.deps.userAgent, ...this.extraHeaders, ...headers },
          signal: ctrl.signal,
          redirect: 'follow',
        });
      } catch (err) {
        throw new ProviderError(err.name === 'AbortError' ? `${this.name} took too long` : `Network error: ${err.message}`, 'network');
      } finally {
        clearTimeout(timer);
      }
      if (res.url) this.checkHost(res.url); // redirects must stay on allowed hosts
      if (res.status === 429 || res.status === 503) {
        const retry = Number(res.headers.get('retry-after'));
        this.lockedUntil = this.now + (Number.isFinite(retry) && retry > 0 ? retry * 1000 : this.lockoutMs);
        throw new ProviderError(`${this.name} asked us to slow down`, 'locked');
      }
      if (!res.ok) throw new ProviderError(`${this.name} answered ${res.status}`, 'http');
      return res;
    });
  }
}

module.exports = { Provider, ProviderError };
