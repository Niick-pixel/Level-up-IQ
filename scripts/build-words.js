// Builds assets/packs/words-en.json for the word games.
//   common3 / common4  hand-picked common words; ladders are generated from these only
//   valid3 / valid4    every dictionary word of that length; accepted when you type them
// The dictionary is an-array-of-english-words (MIT), filtered to lowercase a–z.
const fs = require('fs');
const path = require('path');
const words = require('an-array-of-english-words');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, 'data', 'words', f), 'utf8')
  .split('\n').filter((l) => !l.startsWith('#')).join(' ').split(/\s+/).filter(Boolean);

const valid = { 3: new Set(), 4: new Set() };
for (const w of words) if (/^[a-z]+$/.test(w) && valid[w.length]) valid[w.length].add(w);

const out = {};
let problems = 0;
for (const n of [3, 4]) {
  const common = [...new Set(read(`common-en-${n}.txt`))].sort();
  for (const w of common) {
    if (w.length !== n || !valid[n].has(w)) {
      console.error(`common-en-${n}.txt: "${w}" is not a valid ${n}-letter word`);
      problems++;
    }
  }
  for (const w of common) valid[n].add(w); // common words are always accepted
  out[`common${n}`] = common;
  out[`valid${n}`] = [...valid[n]].sort();
}
if (problems) process.exit(1);
out.source = 'an-array-of-english-words (MIT) + hand-picked common words';
fs.writeFileSync(path.join(ROOT, 'assets', 'packs', 'words-en.json'), JSON.stringify(out));
console.log(`common3 ${out.common3.length}, common4 ${out.common4.length}, valid3 ${out.valid3.length}, valid4 ${out.valid4.length}`);
