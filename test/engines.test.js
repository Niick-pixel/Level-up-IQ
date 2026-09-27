// The Stockfish downloader: files are verified by SHA-256 and only allowed hosts are contacted.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Engines, STOCKFISH, HOSTS, sha256 } = require('../src/main/engines');

const A = Buffer.from('engine code');
const B = Buffer.from('engine weights '.repeat(100));
const spec = {
  id: 'fake', version: '1.0.0', name: 'Fake', license: 'GPL-3.0', licenseFile: 'LICENSE.txt',
  files: [{ name: 'a.js', size: A.length, sha256: sha256(A) }, { name: 'a.wasm', size: B.length, sha256: sha256(B) }],
  urls: (name) => [`https://github.com/x/releases/${name}`, `https://cdn.jsdelivr.net/npm/x/${name}`],
};

function response(buf, url, status = 200) {
  let sent = false;
  return {
    ok: status === 200, status, url,
    body: { getReader: () => ({ read: async () => (sent ? { done: true } : (sent = true, { done: false, value: new Uint8Array(buf) })) }) },
  };
}

function setup(fetchImpl, settings = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-eng-'));
  const license = path.join(dir, 'GPL.txt');
  fs.writeFileSync(license, 'GPL text');
  const calls = [];
  const engines = new Engines(path.join(dir, 'engines'), {
    spec,
    fetch: async (url) => { calls.push(url); return fetchImpl(url); },
    isOnline: () => true,
    getSettings: () => ({ offlineMode: false, ...settings }),
    bundledLicense: license,
  });
  return { engines, calls, dir };
}

const good = (url) => response(url.endsWith('.js') ? A : B, url);

test('engine: pinned Stockfish files and hosts look right', () => {
  assert.equal(STOCKFISH.files.length, 2);
  for (const f of STOCKFISH.files) assert.match(f.sha256, /^[0-9a-f]{64}$/);
  for (const f of STOCKFISH.files) for (const u of STOCKFISH.urls(f.name)) assert.ok(HOSTS.includes(new URL(u).hostname), u);
});

test('engine: downloads, verifies and installs; the license goes alongside', async () => {
  const { engines, dir } = setup(good);
  assert.equal(engines.status().installed, false);
  const progress = [];
  const st = await engines.install((p) => progress.push(p));
  assert.equal(st.installed, true);
  assert.equal(st.url, '/engines/fake-1.0.0/a.js');
  assert.ok(progress.length && progress.at(-1).received === progress.at(-1).total);
  assert.equal(fs.readFileSync(path.join(dir, 'engines', 'fake-1.0.0', 'LICENSE.txt'), 'utf8'), 'GPL text');
  assert.equal(engines.remove().installed, false);
});

test('engine: a tampered file is rejected (falls back to the mirror, then fails)', async () => {
  const { engines, calls } = setup((url) => response(Buffer.from('evil'), url));
  await assert.rejects(engines.install(), /integrity/);
  assert.equal(calls.length, 2); // both mirrors tried for the first file
  assert.equal(engines.status().installed, false);
});

test('engine: the mirror is used when the first host fails', async () => {
  const { engines } = setup((url) => (url.includes('github.com') ? response(Buffer.alloc(0), url, 503) : good(url)));
  assert.equal((await engines.install()).installed, true);
});

test('engine: a redirect to a host outside the allowlist is refused', async () => {
  const { engines } = setup((url) => good('https://evil.example.com/a'));
  await assert.rejects(engines.install(), /may not contact/);
});

test('engine: offline mode means no download at all', async () => {
  const { engines, calls } = setup(good, { offlineMode: true });
  await assert.rejects(engines.install(), /Offline mode/);
  assert.equal(calls.length, 0);
});
