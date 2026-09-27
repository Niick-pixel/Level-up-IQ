// The app:// protocol. Pages load from app://mind-gym/… instead of file://, which gives them a
// real origin (ES modules, CSP 'self', fetch of bundled packs) and makes it impossible for a page
// to read files outside the folders listed here.
const fs = require('fs');
const path = require('path');

const SCHEME = 'app';
const CACHE_SCHEME = 'mg-cache'; // cached images: mg-cache://img/<sha1>
const HOST = 'mind-gym';
const ROOT = path.join(__dirname, '..', '..');

// URL prefix → folder on disk. Anything else is a 404.
const MOUNTS = [
  ['/shared/', path.join(ROOT, 'src', 'shared')],
  ['/assets/', path.join(ROOT, 'assets')],
  ['/vendor/flags/', path.join(ROOT, 'node_modules', 'flag-icons', 'flags')],
  ['/vendor/chess/', path.join(ROOT, 'node_modules', 'chess.js', 'dist', 'esm')],
  ['/', path.join(ROOT, 'src', 'renderer')],
];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

/** Adds a folder outside the app (e.g. downloaded engines in userData). Checked before '/'. */
function addMount(prefix, dir) {
  MOUNTS.splice(MOUNTS.length - 1, 0, [prefix, path.resolve(dir)]);
}

/** Maps a URL path to a file inside one of the mounts, or null. Exported for tests. */
function resolvePath(urlPath) {
  let p;
  try {
    p = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (p === '/' || p === '') p = '/index.html';
  for (const [prefix, dir] of MOUNTS) {
    if (!p.startsWith(prefix)) continue;
    const file = path.resolve(dir, '.' + p.slice(prefix.length - 1));
    if (file !== dir && !file.startsWith(dir + path.sep)) return null; // ../ escape
    return file;
  }
  return null;
}

function registerSchemes(protocol) {
  protocol.registerSchemesAsPrivileged([
    { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
    { scheme: CACHE_SCHEME, privileges: { standard: true, secure: true } },
  ]);
}

function handleProtocol(protocol) {
  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url);
    const file = url.host === HOST ? resolvePath(url.pathname) : null;
    if (!file) return new Response('Not found', { status: 404 });
    try {
      const body = await fs.promises.readFile(file);
      const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
      return new Response(body, { headers: { 'content-type': type, 'x-content-type-options': 'nosniff' } });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

/** Serves images the main process downloaded into the cache (never fetches anything itself). */
function handleCacheProtocol(protocol, cache) {
  protocol.handle(CACHE_SCHEME, (request) => {
    const url = new URL(request.url);
    const hash = url.host === 'img' ? url.pathname.slice(1) : '';
    const img = cache.getImage(hash);
    if (!img) return new Response('Not found', { status: 404 });
    return new Response(img.buffer, { headers: { 'content-type': img.type, 'x-content-type-options': 'nosniff' } });
  });
}

const appUrl = (p = '/index.html') => `${SCHEME}://${HOST}${p}`;

module.exports = { registerSchemes, handleProtocol, handleCacheProtocol, resolvePath, addMount, appUrl, SCHEME, CACHE_SCHEME, HOST, ROOT };
