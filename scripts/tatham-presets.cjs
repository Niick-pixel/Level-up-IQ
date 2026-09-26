// After the Tatham puzzles are built into assets/tatham/, this opens each one headless through
// Mind Gym's own host page, walks its preset menu, and records the exact parameter string of
// every preset (read back from the puzzle's own permalink) plus how long a puzzle takes to
// generate. Output: assets/tatham/presets.json, used to map Mind Gym levels 1–10 to presets.
//
//   node scripts/tatham-presets.cjs      (needs `playwright` with Chromium installed)
const fs = require('fs');
const path = require('path');
const http = require('http');
const { resolvePath } = require('../src/main/protocol');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'tatham', 'presets.json');
const PUZZLES = ['solo', 'keen', 'towers', 'unequal', 'pattern', 'loopy', 'lightup', 'bridges', 'net', 'tents',
  'range', 'galaxies', 'magnets', 'signpost', 'dominosa', 'filling', 'palisade', 'undead', 'mines', 'pearl',
  'tracks', 'unruly', 'map', 'mosaic'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json' };

function serve() {
  const server = http.createServer((req, res) => {
    const file = resolvePath(new URL(req.url, 'http://x').pathname);
    if (!file || !fs.existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

(async () => {
  const { chromium } = require('playwright');
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  let page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const out = {};

  const open = async (name) => {
    await page.goto(`${base}/tatham/host.html?p=${name}&t=night`);
    await page.waitForFunction(() => document.getElementById('puzzle').style.display === '', null, { timeout: 60000 });
  };

  for (const name of PUZZLES) {
    await open(name);
    const hasStatus = await page.evaluate(() => typeof Module._mg_status === 'function');
    if (!hasStatus) throw new Error(`${name}: mg_status export missing (patch not applied?)`);
    const presets = await page.evaluate(() => window.mgPresets());
    const list = [];
    for (const p of presets) {
      const before = await page.evaluate(() => window.mgPermalink());
      const t = Date.now();
      try {
        await page.evaluate((v) => window.mgPickPreset(v), p.value);
        await page.waitForFunction((b) => window.mgPermalink() !== b, before, { timeout: 15000 });
      } catch {
        // Too slow to generate (the page is busy): note it, reload, carry on.
        console.log(`${name.padEnd(9)} ${p.name.padEnd(28)} (too slow, skipped)`);
        list.push({ name: p.name, params: null, generateMs: 99999 });
        await page.close();
        page = await browser.newPage();
        page.on('pageerror', (e) => errors.push(e.message));
        await open(name);
        continue;
      }
      const ms = Date.now() - t;
      const link = await page.evaluate(() => window.mgPermalink());
      const params = link.split('#')[0];
      list.push({ name: p.name, params, generateMs: ms });
      console.log(`${name.padEnd(9)} ${p.name.padEnd(28)} ${params.padEnd(22)} ${ms} ms`);
    }
    out[name] = list;
  }
  await browser.close();
  server.close();
  if (errors.length) console.warn('Page errors:\n' + errors.join('\n'));
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`Wrote presets for ${Object.keys(out).length} puzzles.`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
