// Builds assets/packs/countries.json from data/countries.txt: the 193 UN members plus the two
// observer states. Replaces the REST Countries API (v3.1 was switched off on 2026-09-10 and v5
// needs an API key). Flags come from flag-icons (MIT); capitals are checked against Wikidata by
// scripts/verify-providers.js.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];

function build() {
  const errors = [];
  const countries = [];
  fs.readFileSync(path.join(ROOT, 'data', 'countries.txt'), 'utf8').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const f = line.split('|').map((x) => x.trim());
    const [iso2, name, capital, continent, alt = '', note = ''] = f;
    const where = `countries.txt:${i + 1}`;
    if (!/^[A-Z]{2}$/.test(iso2)) errors.push(`${where}: bad code ${iso2}`);
    if (!name || !capital) errors.push(`${where}: missing name or capital`);
    if (!CONTINENTS.includes(continent)) errors.push(`${where}: unknown continent ${continent}`);
    if (note && !['disputed', 'no-official'].includes(note)) errors.push(`${where}: unknown note ${note}`);
    const flag = path.join(ROOT, 'node_modules', 'flag-icons', 'flags', '4x3', `${iso2.toLowerCase()}.svg`);
    if (!fs.existsSync(flag)) errors.push(`${where}: no flag for ${iso2}`);
    countries.push({
      iso2, name, capital, continent,
      otherCapitals: alt.split(';').map((x) => x.trim()).filter(Boolean),
      capitalQuiz: !note, // skip capital questions for contested or unofficial capitals
      note: note || null,
    });
  });
  const codes = new Set();
  for (const c of countries) {
    if (codes.has(c.iso2)) errors.push(`duplicate ${c.iso2}`);
    codes.add(c.iso2);
  }
  if (countries.length !== 195) errors.push(`expected 195 countries, found ${countries.length}`);
  return { errors, countries };
}

if (require.main === module) {
  const { errors, countries } = build();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  const out = { source: 'data/countries.txt; flags from flag-icons (MIT)', countries };
  fs.writeFileSync(path.join(ROOT, 'assets', 'packs', 'countries.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(`Wrote ${countries.length} countries.`);
}

module.exports = { build, CONTINENTS };
