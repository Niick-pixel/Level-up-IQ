// "What am I looking at?": NASA's Astronomy Picture of the Day. Pick the right title, then read
// the astronomer's explanation.
export const meta = {
  id: 'apod-quiz',
  name: 'What am I looking at?',
  blurb: 'A NASA Astronomy Picture of the Day: nebula, galaxy, aurora or eclipse? Pick its title.',
  howTo: ['Study the picture.', 'Pick its real title, then read what it shows.'],
  skills: ['knowledge'],
  durationRange: [60, 180],
  difficultyRange: [1, 10],
  offline: false,
  lang: ['en'],
};

const firstSentences = (s, n) => (String(s).match(/[^.!?]+[.!?]+/g) || [s]).slice(0, n).map((x) => x.trim()).join(' ');

export function makeQuestions(rng, d, data) {
  const items = (data?.items || []).filter((it) => it.image);
  const titles = [...new Set((data?.titles || []).concat(items.map((x) => x.title)))];
  if (items.length < 3 || titles.length < 4) throw new Error('This quiz uses NASA’s Astronomy Picture of the Day. Connect once and the pictures are saved for offline play.');
  return items.map((it) => {
    const others = rng.shuffle(titles.filter((t) => t !== it.title)).slice(0, 3);
    const options = rng.shuffle([it.title, ...others]);
    return {
      prompt: 'What am I looking at?',
      options,
      answer: options.indexOf(it.title),
      image: it.image,
      caption: `${it.credit} · APOD ${it.date}`,
      url: it.url,
      explain: firstSentences(it.explanation, d >= 6 ? 3 : 2),
    };
  });
}
