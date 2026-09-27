// Art through time: public-domain works from The Met and the Art Institute of Chicago. When was
// it made, and (higher up) who made it? Pictures are saved as you play, so later rounds work offline.
export const meta = {
  id: 'art-quiz',
  name: 'Art through time',
  blurb: 'A real artwork from The Met or the Art Institute of Chicago: when was it made, and by whom?',
  howTo: ['Look closely: style, materials, clothing, technique.', 'Pick the era (or the artist). Number keys work.'],
  skills: ['knowledge'],
  durationRange: [60, 180],
  difficultyRange: [1, 10],
  offline: false, // needs the museums once; then plays from saved artworks
  lang: ['en'],
};

export const ERAS = [
  { label: 'Before 500 BC', to: -500 },
  { label: '500 BC – AD 500', to: 500 },
  { label: '500 – 1400', to: 1400 },
  { label: '1400 – 1600', to: 1600 },
  { label: '1600 – 1750', to: 1750 },
  { label: '1750 – 1850', to: 1850 },
  { label: '1850 – 1900', to: 1900 },
  { label: '1900 – 1950', to: 1950 },
  { label: 'After 1950', to: Infinity },
];
export const eraOf = (year) => ERAS.findIndex((e) => year < e.to);

const ordinal = (n) => `${n}${[, 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th'}`;
/** 1650 → 17 ; 1900 → 19 ; -300 → -3 (300–201 BC is the 3rd century BC). Year 0 doesn't exist. */
export const centuryOf = (year) => (year > 0 ? Math.floor((year - 1) / 100) + 1 : -(Math.floor((-year - 1) / 100) + 1));
export const centuryLabel = (c) => (c > 0 ? `${ordinal(c)} century` : `${ordinal(-c)} century BC`);

function eraQuestion(rng, it, d) {
  const e = eraOf(it.year);
  const minGap = d <= 2 ? 2 : 1;
  const others = rng.shuffle(ERAS.map((_, i) => i).filter((i) => Math.abs(i - e) >= minGap)).slice(0, 3);
  const options = rng.shuffle([e, ...others]).map((i) => ERAS[i].label);
  return { kind: 'era', prompt: 'When was this made?', options, answer: options.indexOf(ERAS[e].label) };
}

function centuryQuestion(rng, it) {
  const c = centuryOf(it.year);
  const shift = rng.int(0, 3);
  const cs = [0, 1, 2, 3].map((k) => c - shift + k).filter((x) => x !== 0);
  while (cs.length < 4) cs.push(cs[cs.length - 1] + 1 || 2);
  const options = cs.map(centuryLabel);
  return { kind: 'century', prompt: 'Which century is it from?', options, answer: options.indexOf(centuryLabel(c)) };
}

function artistQuestion(rng, it, items) {
  const others = [...new Set(items.map((x) => x.artist).filter((a) => a && a !== it.artist))];
  if (!it.artist || others.length < 3) return null;
  const options = rng.shuffle([it.artist, ...rng.shuffle(others).slice(0, 3)]);
  return { kind: 'artist', prompt: 'Who made this?', options, answer: options.indexOf(it.artist) };
}

export function makeQuestions(rng, d, data) {
  const items = (data?.items || []).filter((it) => Number.isFinite(it.year) && it.image);
  if (items.length < 4) throw new Error('This quiz uses artworks from online museums. Connect once and they’re saved for offline play.');
  return items.map((it, i) => {
    let q = null;
    if (d >= 5 && i % 3 === 2) q = artistQuestion(rng, it, items);
    if (!q) q = d >= 8 ? centuryQuestion(rng, it) : eraQuestion(rng, it, d);
    return {
      ...q,
      image: it.image,
      caption: `${it.credit} · ${it.license}`,
      explain: `${it.title}${it.artist ? `, ${it.artist}` : it.culture ? `, ${it.culture}` : ''} (${it.date}). ${it.source === 'met' ? 'The Metropolitan Museum of Art' : 'Art Institute of Chicago'}, public domain.`,
      url: it.url,
    };
  });
}
