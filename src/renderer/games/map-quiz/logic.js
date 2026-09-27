// Map geography: find a country on the map, or name the highlighted one.
// Map shapes: world-atlas (Natural Earth, public domain), projected at build time.
export const meta = {
  id: 'map-quiz',
  name: 'Map geography',
  blurb: 'Find countries on the world map, or name the one that lights up.',
  howTo: ['"Find": click the country on the map.', '"Name": pick the highlighted country (1–4).', 'Higher levels bring smaller countries.'],
  skills: ['spatial', 'knowledge'],
  durationRange: [60, 180],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

export const QUESTIONS = 10;
/** Smallest country (map units across) that can be asked about at each level. */
export const minSize = (d) => [60, 40, 28, 20, 14, 10, 7, 4, 2, 0][Math.min(9, d - 1)];
/** Share of "find it" questions (the rest are "name it"). */
export const findShare = (d) => Math.min(0.8, 0.2 + d * 0.06);

/**
 * @param shapes  world-map.json countries [{ iso2, d, x, y, size }]
 * @param info    countries.json countries [{ iso2, name, continent }]
 */
export function makeQuestions(rng, d, shapes, info) {
  const byIso = new Map(info.map((c) => [c.iso2, c]));
  const pool = shapes.filter((s) => s.size >= minSize(d) && byIso.has(s.iso2));
  const picked = rng.shuffle(pool).slice(0, QUESTIONS);
  const finds = Math.round(picked.length * findShare(d));
  return rng.shuffle(picked.map((s, i) => {
    const c = byIso.get(s.iso2);
    if (i < finds) return { kind: 'find', iso2: s.iso2, name: c.name, continent: c.continent };
    const near = shapes.filter((o) => o.iso2 !== s.iso2 && byIso.get(o.iso2)?.continent === c.continent);
    const others = rng.shuffle(near.length >= 3 ? near : shapes.filter((o) => o.iso2 !== s.iso2)).slice(0, 3).map((o) => byIso.get(o.iso2).name);
    const options = rng.shuffle([c.name, ...others]);
    return { kind: 'name', iso2: s.iso2, name: c.name, continent: c.continent, options, answer: options.indexOf(c.name) };
  }));
}

/** A view box around every country of a continent (a padded bounding box of their anchors). */
export const ASPECT = 1.6;
/** The whole world, framed at the same aspect ratio as the zoomed views. */
export const worldBox = (width, height) => [0, Math.round((height - width / ASPECT) / 2), width, Math.round(width / ASPECT)];

export function continentBox(shapes, info, continent, width, height, aspect = ASPECT) {
  const inIt = new Set(info.filter((c) => c.continent === continent).map((c) => c.iso2));
  // giants (Russia spans two continents) and far-flung Pacific islands would stretch the view
  const members = shapes.filter((s) => inIt.has(s.iso2) && s.size < 200);
  const mid = members.map((s) => s.x).sort((a, b) => a - b)[Math.floor(members.length / 2)];
  const pts = members.filter((s) => Math.abs(s.x - mid) < 400); // Kiribati sits on the far side of the date line
  if (!pts.length) return worldBox(width, height);
  let x0 = Math.min(...pts.map((s) => s.x - s.size / 2)), x1 = Math.max(...pts.map((s) => s.x + s.size / 2));
  let y0 = Math.min(...pts.map((s) => s.y - s.size / 2)), y1 = Math.max(...pts.map((s) => s.y + s.size / 2));
  const pad = 20;
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  // a fixed aspect ratio, so the frame doesn't jump in size between questions
  const w = x1 - x0, h = y1 - y0;
  if (w / h > aspect) { const nh = w / aspect; y0 -= (nh - h) / 2; y1 = y0 + nh; } else { const nw = h * aspect; x0 -= (nw - w) / 2; x1 = x0 + nw; }
  // stay on the map: slide the box back inside the edges where there's room
  const bw = x1 - x0, bh = y1 - y0;
  if (bw < width) x0 = Math.min(Math.max(0, x0), width - bw);
  if (bh < height) y0 = Math.min(Math.max(0, y0), height - bh);
  return [x0, y0, bw, bh].map((v) => Math.round(v));
}
