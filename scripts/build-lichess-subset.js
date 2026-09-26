// Builds assets/packs/lichess-puzzles.json: an offline set of ~30,000 chess puzzles from the
// Lichess puzzle database (CC0, https://database.lichess.org/#puzzles), spread evenly across
// ratings 400–3000 and limited to popular, well-tested puzzles. Reads the decompressed CSV
// from stdin. Run from CI:
//   curl -L --fail -o db.csv.zst https://database.lichess.org/lichess_db_puzzle.csv.zst
//   zstd -dc db.csv.zst | node scripts/build-lichess-subset.js
//
// CSV columns: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
const fs = require('fs');
const path = require('path');
const readline = require('readline');
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
  const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  const random = rng(20260926);
  const buckets = new Map();
  let seen = 0;
  let header = true;
  for await (const line of lines) {
    if (header) {
      header = false;
      if (!line.startsWith('PuzzleId,')) throw new Error(`Unexpected CSV header: ${line.slice(0, 80)}`);
      continue;
    }
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
  if (!seen) throw new Error('No puzzles read');
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
