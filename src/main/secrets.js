// Optional API keys (YouTube Data API, NASA), encrypted with Electron's safeStorage (DPAPI on
// Windows) in <userData>/secrets.bin. Never written to settings.json, never sent to the page:
// the UI only learns whether a key is set.
const fs = require('fs');
const path = require('path');

const NAMES = {
  youtube: { label: 'YouTube Data API key', test: /^[A-Za-z0-9_-]{30,60}$/ },
  nasa: { label: 'NASA API key', test: /^[A-Za-z0-9]{20,60}$/ },
};

class Secrets {
  /**
   * @param {string|null} dir
   * @param {{ isEncryptionAvailable(): boolean, encryptString(s): Buffer, decryptString(b): string }} safeStorage
   */
  constructor(dir, safeStorage) {
    this.file = dir ? path.join(dir, 'secrets.bin') : null;
    this.safe = safeStorage;
    this.mem = {};
    this.values = null; // decrypted lazily, kept in memory in the main process only
  }

  available() {
    try {
      return Boolean(this.safe?.isEncryptionAvailable());
    } catch {
      return false;
    }
  }

  #load() {
    if (this.values) return this.values;
    this.values = {};
    let stored = this.mem;
    if (this.file) {
      try { stored = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { stored = {}; }
    }
    for (const [name, b64] of Object.entries(stored)) {
      if (!NAMES[name]) continue;
      try { this.values[name] = this.safe.decryptString(Buffer.from(b64, 'base64')); } catch { /* unreadable: treat as unset */ }
    }
    return this.values;
  }

  #save() {
    const out = {};
    for (const [name, value] of Object.entries(this.values)) out[name] = this.safe.encryptString(value).toString('base64');
    if (this.file) {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(out), { mode: 0o600 });
    } else this.mem = out;
  }

  get(name) {
    return this.available() ? this.#load()[name] || null : null;
  }

  /** Sets (or with an empty value, removes) a key. Refuses when encryption isn't available. */
  set(name, value) {
    if (!NAMES[name]) throw new Error('Unknown key');
    if (!this.available()) throw new Error('This system can’t encrypt secrets, so keys can’t be stored.');
    const v = String(value || '').trim();
    this.#load();
    if (!v) delete this.values[name];
    else {
      if (!NAMES[name].test.test(v)) throw new Error(`That doesn’t look like a ${NAMES[name].label}.`);
      this.values[name] = v;
    }
    this.#save();
    return this.status();
  }

  /** What the UI may know: which keys exist, never their values. */
  status() {
    const ok = this.available();
    const vals = ok ? this.#load() : {};
    return { available: ok, keys: Object.fromEntries(Object.entries(NAMES).map(([n, m]) => [n, { label: m.label, set: Boolean(vals[n]) }])) };
  }
}

module.exports = { Secrets, NAMES };
