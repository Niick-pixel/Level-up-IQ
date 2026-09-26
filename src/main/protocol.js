// The app:// protocol. Pages load from app://mind-gym/… instead of file://, which gives them a
// real origin (ES modules, CSP 'self', fetch of bundled packs) and makes it impossible for a page
// to read files outside the folders listed here.
const fs = require('fs');
const path = require('path');

const SCHEME = 'app';
const HOST = 'mind-gym';
const ROOT = path.join(__dirname, '..', '..');

// URL prefix → folder on disk. Anything else is a 404.
const MOUNTS = [
  ['/shared/', path.join(ROOT, 'src', 'shared')],
  ['/assets/', path.join(ROOT, 'assets')],
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

const appUrl = (p = '/index.html') => `${SCHEME}://${HOST}${p}`;

module.exports = { registerSchemes, handleProtocol, resolvePath, appUrl, SCHEME, HOST };
