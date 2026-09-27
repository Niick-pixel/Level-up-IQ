// Flags of the world. Flag images: flag-icons (MIT). Distractors come from the same continent,
// so you can't just guess the region.
export const meta = {
  id: 'flags',
  name: 'Flags',
  blurb: 'Which country does this flag belong to?',
  howTo: ['Pick the country (number keys).', 'Higher levels: less famous flags and more options.'],
  skills: ['knowledge'],
  durationRange: [45, 120],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

export const COUNT = 10;
// Famous, big or distinctive flags come first at low levels.
const EASY = new Set('US GB FR DE IT ES JP CN IN BR CA MX RU AU AR KR ZA EG TR GR SE NO CH NL PT IE CO JM KE NG IL SA NZ CL PE CU UA PL DK FI BE AT'.split(' '));
export const optionCount = (d) => (d >= 7 ? 6 : 4);

export function makeQuestions(rng, d, data) {
  const all = data.countries;
  const pool = d <= 3 ? all.filter((c) => EASY.has(c.iso2)) : d <= 6 ? all : all.filter((c) => !EASY.has(c.iso2));
  return rng.shuffle(pool).slice(0, COUNT).map((c) => {
    const same = all.filter((o) => o.continent === c.continent && o.iso2 !== c.iso2);
    const others = rng.shuffle(same.length >= optionCount(d) - 1 ? same : all.filter((o) => o.iso2 !== c.iso2)).slice(0, optionCount(d) - 1);
    const options = rng.shuffle([c.name, ...others.map((o) => o.name)]);
    return { iso2: c.iso2, prompt: 'Whose flag is this?', options, answer: options.indexOf(c.name), explain: `${c.name} · capital ${c.capital}` };
  });
}
