// Builds assets/packs/lichess-puzzles.json: an offline set of ~30,000 chess puzzles from the
// Lichess puzzle database (CC0, https://database.lichess.org/#puzzles), spread evenly across
// ratings 400–3000 and limited to popular, well-tested puzzles. Streams the ~250 MB download;
// nothing is written to disk but the result. Needs Node 22.15+ (zstd support). Run from CI.
//
// CSV columns: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const { Readable } = require('stream');
const pkg = require('../package.json');

const URL_DB = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
const OUT = path.join(__dirname, '..', 'assets', 'packs', 'lichess-puzzles.json');
const MIN = 400, MAX = 3000, BUCKET = 100;
const PER_BUCKET = Math.ceil(30000 / ((MAX - MIN) / BUCKET));

// Deterministic reservoir sampling, so a rebuild from the same file gives the same set.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

(async () => {
  if (typeof zlib.createZstdDecompress !== 'function') throw new Error('Needs Node 22.15+ for zstd');
  const res = await fetch(URL_DB, { headers: { 'User-Agent': `MindGym/${pkg.version} (+https://github.com/Niick-pixel/Level-up-IQ)` } });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const lines = readline.createInterface({ input: Readable.fromWeb(res.body).pipe(zlib.createZstdDecompress()), crlfDelay: Infinity });
  const random = rng(20260926);
  const buckets = new Map();
  let seen = 0;
  let header = true;
  for await (const line of lines) {
    if (header) { header = false; continue; }
    const [id, fen, moves, rating, , popularity, plays, themes] = line.split(',');
    const r = Number(rating);
    if (!(r >= MIN && r < MAX) || Number(popularity) < 85 || Number(plays) < 500) continue;
    const b = Math.floor((r - MIN) / BUCKET);
    const bucket = buckets.get(b) || { n: 0, items: [] };
    buckets.set(b, bucket);
    bucket.n += 1;
    const row = [id, fen, moves, r, themes];
    if (bucket.items.length < PER_BUCKET) bucket.items.push(row);
    else {
      const j = Math.floor(random() * bucket.n);
      if (j < PER_BUCKET) bucket.items[j] = row;
    }
    if (++seen % 500000 === 0) console.log(`${seen} candidate puzzles read…`);
  }
  const puzzles = [...buckets.keys()].sort((a, b) => a - b).flatMap((b) => buckets.get(b).items).sort((a, b) => a[3] - b[3]);
  fs.writeFileSync(OUT, JSON.stringify({
    source: 'Lichess puzzle database (https://database.lichess.org/#puzzles)',
    license: 'CC0 1.0',
    builtAt: new Date().toISOString(),
    columns: ['id', 'fen', 'moves', 'rating', 'themes'],
    puzzles,
  }));
  console.log(`Wrote ${puzzles.length} puzzles to ${path.relative(process.cwd(), OUT)}.`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
