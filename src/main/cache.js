// Disk cache for online content: %APPDATA%/Mind Gym/cache/
//   json/<sha1>.json   { key, storedAt, expiresAt, value }
//   img/<sha1>         image bytes, with img/<sha1>.meta { key, type, storedAt }
// Entries past their TTL are still returned (marked stale) so the app keeps working offline.
// When the folder grows past maxBytes, the least recently used files go first.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');
const HASH = /^[0-9a-f]{40}$/;

class DiskCache {
  /** @param {string|null} dir null keeps everything in memory (tests) */
  constructor(dir, { now = Date.now, maxBytes = 200 * 1024 * 1024 } = {}) {
    this.dir = dir;
    this.now = now;
    this.maxBytes = maxBytes;
    this.mem = new Map();
    this.writesSincePrune = 0;
  }

  #file(kind, hash) {
    return path.join(this.dir, kind, hash + (kind === 'json' ? '.json' : ''));
  }

  /** @returns {{ value: any, storedAt: number, stale: boolean } | null} */
  get(key) {
    const hash = sha1(key);
    let entry = this.mem.get('json:' + hash);
    if (!entry && this.dir) {
      try {
        entry = JSON.parse(fs.readFileSync(this.#file('json', hash), 'utf8'));
        if (entry.key !== key) entry = null;
        else this.#touch(this.#file('json', hash));
      } catch {
        entry = null;
      }
    }
    if (!entry) return null;
    return { value: entry.value, storedAt: entry.storedAt, stale: this.now() > entry.expiresAt };
  }

  set(key, value, ttlMs) {
    const hash = sha1(key);
    const entry = { key, storedAt: this.now(), expiresAt: this.now() + ttlMs, value };
    if (!this.dir) {
      this.mem.set('json:' + hash, entry);
      return;
    }
    this.#write(this.#file('json', hash), JSON.stringify(entry));
  }

  /** Stores image bytes; returns the hash used by the mg-cache:// protocol. */
  setImage(key, buffer, type) {
    const hash = sha1(key);
    if (!this.dir) {
      this.mem.set('img:' + hash, { buffer, type });
      return hash;
    }
    this.#write(this.#file('img', hash), buffer);
    this.#write(this.#file('img', hash) + '.meta', JSON.stringify({ key, type, storedAt: this.now() }));
    return hash;
  }

  hasImage(key) {
    const hash = sha1(key);
    if (!this.dir) return this.mem.has('img:' + hash) ? hash : null;
    return fs.existsSync(this.#file('img', hash)) ? hash : null;
  }

  /** @returns {{ buffer: Buffer, type: string } | null} */
  getImage(hash) {
    if (!HASH.test(hash)) return null;
    if (!this.dir) return this.mem.get('img:' + hash) || null;
    try {
      const buffer = fs.readFileSync(this.#file('img', hash));
      const meta = JSON.parse(fs.readFileSync(this.#file('img', hash) + '.meta', 'utf8'));
      this.#touch(this.#file('img', hash));
      return { buffer, type: meta.type };
    } catch {
      return null;
    }
  }

  #write(file, data) {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file + '.tmp', data);
      fs.renameSync(file + '.tmp', file);
    } catch (err) {
      console.error('Cache write failed:', err.message);
    }
    if (++this.writesSincePrune >= 50) {
      this.writesSincePrune = 0;
      this.prune();
    }
  }

  #touch(file) {
    const t = new Date(this.now());
    try { fs.utimesSync(file, t, t); } catch { /* ignore */ }
  }

  #files() {
    if (!this.dir) return [];
    const out = [];
    for (const kind of ['json', 'img']) {
      let names = [];
      try { names = fs.readdirSync(path.join(this.dir, kind)); } catch { continue; }
      for (const n of names) {
        const file = path.join(this.dir, kind, n);
        try {
          const st = fs.statSync(file);
          out.push({ file, size: st.size, mtime: st.mtimeMs });
        } catch { /* gone */ }
      }
    }
    return out;
  }

  sizeBytes() {
    if (!this.dir) return [...this.mem.values()].reduce((a, e) => a + (e.buffer?.length || JSON.stringify(e.value ?? '').length), 0);
    return this.#files().reduce((a, f) => a + f.size, 0);
  }

  /** Deletes least recently used files until the cache fits in maxBytes. */
  prune() {
    const files = this.#files().sort((a, b) => a.mtime - b.mtime);
    let total = files.reduce((a, f) => a + f.size, 0);
    for (const f of files) {
      if (total <= this.maxBytes) break;
      try { fs.rmSync(f.file, { force: true }); } catch { /* ignore */ }
      total -= f.size;
    }
  }

  clear() {
    this.mem.clear();
    if (this.dir) {
      for (const kind of ['json', 'img']) fs.rmSync(path.join(this.dir, kind), { recursive: true, force: true });
    }
  }
}

module.exports = { DiskCache, sha1 };
