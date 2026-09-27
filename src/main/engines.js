// Downloadable engines (for now: Stockfish for "Play vs Stockfish").
//
// Stockfish is GPL-3.0, so it is not bundled with Mind Gym (MIT). The first time you play, the
// app downloads the unmodified official stockfish.js release files, checks their SHA-256
// against the values pinned below, and stores them in <userData>/engines. The page runs them in
// a separate Web Worker, talking to it only through the UCI text protocol.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STOCKFISH = {
  id: 'stockfish',
  name: 'Stockfish 19 (lite, single-threaded WebAssembly build)',
  version: '19.0.0',
  license: 'GPL-3.0',
  licenseFile: 'GPL-3.0.txt',
  credit: 'Stockfish by the Stockfish developers (stockfishchess.org); stockfish.js WebAssembly port by Nathan Rugg and Chess.com.',
  sourceUrl: 'https://github.com/nmrugg/stockfish.js/tree/v19.0.0',
  upstreamUrl: 'https://github.com/official-stockfish/Stockfish',
  files: [
    {
      name: 'stockfish-19-lite-single.js',
      size: 21415,
      sha256: 'd3344124ab067fb0b90ee77873bb8e9fbf5fc01bc525fe714b0f942581e889e6',
    },
    {
      name: 'stockfish-19-lite-single.wasm',
      size: 1787571,
      sha256: '57ac2d72312aba346760e3f173f687a8c211208e97a87268436f7f0e10bb5387',
    },
  ],
  // Official GitHub release first, the npm package (same bytes) through jsDelivr as a fallback.
  urls: (name) => [
    `https://github.com/nmrugg/stockfish.js/releases/download/v19.0.0/${name}`,
    `https://cdn.jsdelivr.net/npm/stockfish@19.0.0/bin/${name}`,
  ],
};

const HOSTS = ['github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com', 'cdn.jsdelivr.net'];

class Engines {
  /**
   * @param {string|null} dir  <userData>/engines
   * @param {{ fetch, isOnline, getSettings, bundledLicense: string }} deps
   */
  constructor(dir, deps) {
    this.dir = dir;
    this.deps = deps;
    this.installing = null;
  }

  folder() {
    return path.join(this.dir, `${STOCKFISH.id}-${STOCKFISH.version}`);
  }

  info() {
    const { urls, files, ...rest } = STOCKFISH;
    return { ...rest, bytes: files.reduce((s, f) => s + f.size, 0), hosts: HOSTS };
  }

  /** Installed = every file present with the pinned hash (checked once per run, then cached). */
  status() {
    if (this.verified === undefined) this.verified = this.#verifyAll();
    return {
      ...this.info(),
      installed: this.verified,
      installing: Boolean(this.installing),
      url: this.verified ? `/engines/${STOCKFISH.id}-${STOCKFISH.version}/${STOCKFISH.files[0].name}` : null,
    };
  }

  #verifyAll() {
    try {
      return STOCKFISH.files.every((f) => sha256(fs.readFileSync(path.join(this.folder(), f.name))) === f.sha256);
    } catch {
      return false;
    }
  }

  /** Downloads and verifies the engine. onProgress({ received, total }). */
  install(onProgress = () => {}) {
    if (this.installing) return this.installing;
    this.installing = this.#install(onProgress).finally(() => { this.installing = null; });
    return this.installing;
  }

  async #install(onProgress) {
    if (this.status().installed) return this.status();
    if (this.deps.getSettings().offlineMode) throw new Error('Offline mode is on. Turn it off in Settings to download the engine.');
    if (!this.deps.isOnline()) throw new Error('You seem to be offline.');
    const total = STOCKFISH.files.reduce((s, f) => s + f.size, 0);
    let before = 0;
    const tmp = `${this.folder()}.part`;
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    for (const f of STOCKFISH.files) {
      let lastErr = null;
      let buf = null;
      for (const url of STOCKFISH.urls(f.name)) {
        try {
          buf = await this.#download(url, f, (n) => onProgress({ received: before + n, total }));
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!buf) throw lastErr || new Error('Download failed');
      fs.writeFileSync(path.join(tmp, f.name), buf);
      before += f.size;
    }
    if (this.deps.bundledLicense) fs.writeFileSync(path.join(tmp, STOCKFISH.licenseFile), fs.readFileSync(this.deps.bundledLicense)); // (works inside asar too)
    fs.rmSync(this.folder(), { recursive: true, force: true });
    fs.renameSync(tmp, this.folder());
    this.verified = undefined;
    return this.status();
  }

  async #download(url, file, progress) {
    checkHost(url);
    const res = await this.deps.fetch(url, { redirect: 'follow' });
    if (res.url) checkHost(res.url);
    if (!res.ok) throw new Error(`Download answered ${res.status}`);
    const chunks = [];
    let n = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.length;
      if (n > file.size * 2) throw new Error('Download is larger than expected');
      chunks.push(Buffer.from(value));
      progress(n);
    }
    const buf = Buffer.concat(chunks);
    if (sha256(buf) !== file.sha256) throw new Error(`${file.name} failed its integrity check`);
    return buf;
  }

  remove() {
    fs.rmSync(this.folder(), { recursive: true, force: true });
    this.verified = undefined;
    return this.status();
  }
}

function checkHost(url) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !HOSTS.includes(u.hostname)) throw new Error(`Engine download may not contact ${u.hostname}`);
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

module.exports = { Engines, STOCKFISH, HOSTS, sha256 };
