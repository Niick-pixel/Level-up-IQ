// Etymology quiz: where do everyday words come from?
export const meta = {
  id: 'etymology',
  name: 'Word origins',
  blurb: 'Where do everyday words come from? Languages, myths and people hidden in English.',
  howTo: ['Pick the origin that fits.', 'The story behind each word shows after you answer.'],
  skills: ['language', 'knowledge'],
  durationRange: [60, 240],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

export function makeQuestions(rng, d, data) {
  const langs = [...new Set(data.map((e) => e.lang))];
  return rng.shuffle(data).slice(0, 8).map((e) => {
    // Easy levels ask for the language; harder ones for the origin story itself.
    if (d <= 4 || rng.chance(0.35)) {
      const options = rng.shuffle([e.lang, ...rng.shuffle(langs.filter((l) => l !== e.lang)).slice(0, 3)]);
      return { prompt: `Which language did “${e.word}” come from?`, options, answer: options.indexOf(e.lang), explain: `${e.word}: ${e.meaning}.` };
    }
    const others = rng.shuffle(data.filter((x) => x.word !== e.word)).slice(0, 3).map((x) => x.meaning);
    const options = rng.shuffle([e.meaning, ...others]);
    return { prompt: `What is the origin of “${e.word}”?`, options, answer: options.indexOf(e.meaning), explain: `From ${e.lang}.` };
  });
}
