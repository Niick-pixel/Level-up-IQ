// Capitals of the world, both ways round. Countries whose capital is disputed or unofficial are
// left out of the questions (see data/countries.txt).
export const meta = {
  id: 'capitals',
  name: 'Capitals',
  blurb: 'Name the capital, or the country a capital belongs to.',
  howTo: ['Pick the answer (number keys).', 'From level 5 some questions go the other way round.'],
  skills: ['knowledge'],
  durationRange: [45, 120],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

export const COUNT = 10;
const FAMOUS = new Set('US GB FR DE IT ES JP CN IN BR CA MX RU AU AR EG TR GR SE NO NL PT IE KE TH KR AT PL CU PE CO'.split(' '));
export const optionCount = (d) => (d >= 8 ? 6 : 4);

export function makeQuestions(rng, d, data) {
  const all = data.countries.filter((c) => c.capitalQuiz);
  const pool = d <= 2 ? all.filter((c) => FAMOUS.has(c.iso2)) : d <= 5 ? all : all.filter((c) => !FAMOUS.has(c.iso2));
  return rng.shuffle(pool).slice(0, COUNT).map((c, i) => {
    const same = all.filter((o) => o.continent === c.continent && o.iso2 !== c.iso2);
    const others = rng.shuffle(same.length >= optionCount(d) - 1 ? same : all.filter((o) => o.iso2 !== c.iso2)).slice(0, optionCount(d) - 1);
    const reverse = d >= 5 && i % 2 === 1;
    const right = reverse ? c.name : c.capital;
    const options = rng.shuffle([right, ...others.map((o) => (reverse ? o.name : o.capital))]);
    return {
      prompt: reverse ? `${c.capital} is the capital of…` : `What is the capital of ${c.name}?`,
      options,
      answer: options.indexOf(right),
      explain: c.otherCapitals.length ? `Also a seat of government: ${c.otherCapitals.join(', ')}.` : undefined,
    };
  });
}
