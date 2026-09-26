// Generates the app and tray icons as PNGs with no external dependencies. Run: npm run icons
// The mark: three connected nodes (a tiny "curiosity graph") inside a soft violet orb.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const NODES = [[-0.34, 0.2], [0.02, -0.36], [0.36, 0.24]];
const EDGES = [[0, 1], [1, 2], [0, 2]];
function segDist(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

function render(size, { mono = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const ss = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const u = ((x + (sx + 0.5) / ss) / size) * 2 - 1;
          const v = ((y + (sy + 0.5) / ss) / size) * 2 - 1;
          const d = Math.hypot(u, v);
          const onNode = NODES.some(([nx, ny]) => Math.hypot(u - nx, v - ny) < 0.13);
          const onEdge = EDGES.some(([i, j]) => segDist(u, v, NODES[i], NODES[j]) < 0.04);
          if (mono) {
            if (onNode || onEdge) { r += 255; g += 255; b += 255; a += 255; }
            continue;
          }
          if (d > 0.96) continue;
          let cr, cg, cb;
          if (onNode || onEdge) { cr = 255; cg = 250; cb = 240; }
          else {
            const t = Math.min(1, d / 0.96);
            cr = 182 * (1 - t) + 58 * t; cg = 166 * (1 - t) + 44 * t; cb = 255 * (1 - t) + 125 * t;
          }
          r += cr; g += cg; b += cb; a += 255;
        }
      }
      const n = ss * ss, i = (y * size + x) * 4;
      const alpha = a / n;
      px[i] = alpha ? (r / n) * (255 / alpha) : 0;
      px[i + 1] = alpha ? (g / n) * (255 / alpha) : 0;
      px[i + 2] = alpha ? (b / n) * (255 / alpha) : 0;
      px[i + 3] = alpha;
    }
  }
  return encodePNG(size, px);
}

const ROOT = path.join(__dirname, '..');
fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'build', 'icon.png'), render(256));
fs.writeFileSync(path.join(ROOT, 'assets', 'icon.png'), render(256));
fs.writeFileSync(path.join(ROOT, 'assets', 'tray.png'), render(16, { mono: true }));
fs.writeFileSync(path.join(ROOT, 'assets', 'tray@2x.png'), render(32, { mono: true }));
console.log('Icons written.');
