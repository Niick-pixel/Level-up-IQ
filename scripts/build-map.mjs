// Builds assets/packs/world-map.json: SVG paths for every country, projected once at build time
// (Equal Earth projection) from world-atlas 50m (Natural Earth, public domain; package ISC).
// The app then draws the map with plain SVG, with no map library at runtime.
//   node scripts/build-map.mjs          build
//   node scripts/build-map.mjs --check  fail if a country in countries.json has no shape
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const topo = require('topojson-client');
const atlas = require('world-atlas/countries-50m.json');
const { countries } = JSON.parse(fs.readFileSync(new URL('../assets/packs/countries.json', import.meta.url)));

// Natural Earth short names → the names in data/countries.txt
const ALIAS = {
  'United States of America': 'United States', 'Dem. Rep. Congo': 'Democratic Republic of the Congo',
  Congo: 'Republic of the Congo', 'Central African Rep.': 'Central African Republic', 'Dominican Rep.': 'Dominican Republic',
  'Eq. Guinea': 'Equatorial Guinea', eSwatini: 'Eswatini', 'S. Sudan': 'South Sudan', Macedonia: 'North Macedonia',
  'Bosnia and Herz.': 'Bosnia and Herzegovina', Turkey: 'Türkiye', 'Solomon Is.': 'Solomon Islands', 'Marshall Is.': 'Marshall Islands',
  'São Tomé and Principe': 'São Tomé and Príncipe', 'St. Vin. and Gren.': 'Saint Vincent and the Grenadines',
  'St. Kitts and Nevis': 'Saint Kitts and Nevis', 'Antigua and Barb.': 'Antigua and Barbuda', Vatican: 'Vatican City',
};

const W = 1000;
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
function equalEarth([lon, lat]) {
  const l = (lon * Math.PI) / 180, p = (lat * Math.PI) / 180;
  const t = Math.asin(M * Math.sin(p)), t2 = t * t, t6 = t2 * t2 * t2;
  const x = (l * Math.cos(t)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
  const y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
  return [x, y];
}
const XMAX = equalEarth([180, 0])[0];
const YMAX = equalEarth([0, 90])[1];
const S = W / (2 * XMAX);
const H = Math.round(2 * YMAX * S);
const project = ([lon, lat]) => {
  // past 180°E (unwrapped rings) keep going east instead of jumping back to the west edge
  const [x, y] = equalEarth([Math.min(lon, 180), lat]);
  const extra = lon > 180 ? equalEarth([lon - 180, lat])[0] : 0;
  return [(x + extra + XMAX) * S, (YMAX - y) * S];
};

/** Rings that cross the antimeridian (Fiji, Chukotka) are shifted east so they don't streak across. */
function unwrap(ring) {
  const lons = ring.map((p) => p[0]);
  if (Math.max(...lons) - Math.min(...lons) <= 180) return ring;
  return ring.map(([lon, lat]) => [lon < 0 ? lon + 360 : lon, lat]);
}

function ringPath(ring) {
  const pts = [];
  for (const p of unwrap(ring)) {
    const [x, y] = project(p);
    const last = pts[pts.length - 1];
    if (last && Math.abs(last[0] - x) < 0.35 && Math.abs(last[1] - y) < 0.35) continue; // below a pixel: drop
    pts.push([x, y]);
  }
  if (pts.length < 3) return '';
  return `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`;
}

function geomPath(g) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  return polys.flatMap((poly) => poly.map(ringPath)).join('');
}

/** Centre of the largest polygon's bounding box, for drawing a marker on tiny countries. */
function anchor(g) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  let best = null;
  for (const poly of polys) {
    const pts = unwrap(poly[0]).map(project);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const area = (box[2] - box[0]) * (box[3] - box[1]);
    if (!best || area > best.area) best = { area, box };
  }
  const [x0, y0, x1, y1] = best.box;
  return { x: +((x0 + x1) / 2).toFixed(1), y: +((y0 + y1) / 2).toFixed(1), size: +Math.max(x1 - x0, y1 - y0).toFixed(1) };
}

const byName = new Map(countries.map((c) => [c.name, c]));
const shapes = [];
const other = [];
for (const f of topo.feature(atlas, atlas.objects.countries).features) {
  if (f.properties.name === 'Antarctica') continue;
  const d = geomPath(f.geometry);
  if (!d) continue;
  const c = byName.get(ALIAS[f.properties.name] || f.properties.name);
  if (c) shapes.push({ iso2: c.iso2, d, ...anchor(f.geometry) });
  else other.push(d); // territories and disputed areas: drawn, not asked about
}
const found = new Set(shapes.map((s) => s.iso2));
// Microstates too small for a 1:50m map; the map quiz simply leaves them out.
const TOO_SMALL = ['MV', 'MC', 'NR', 'SM', 'TV', 'VA'];
const missing = countries.filter((c) => !found.has(c.iso2) && !TOO_SMALL.includes(c.iso2)).map((c) => c.name);

if (process.argv.includes('--check')) {
  if (missing.length) { console.error('No map shape for:', missing.join(', ')); process.exit(1); }
  console.log(`map ok: ${shapes.length} countries`);
} else {
  const out = { source: 'world-atlas 2.0.2 (Natural Earth 1:50m, public domain), Equal Earth projection', width: W, height: H, countries: shapes, other: other.join('') };
  fs.writeFileSync(new URL('../assets/packs/world-map.json', import.meta.url), JSON.stringify(out));
  if (missing.length) { console.error('No map shape for:', missing.join(', ')); process.exit(1); }
  console.log(`${shapes.length} countries, ${other.length} other shapes`);
}
