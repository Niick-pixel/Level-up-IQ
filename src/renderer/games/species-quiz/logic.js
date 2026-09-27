// Species ID: research-grade photos from iNaturalist (Costa Rica by default, see Settings).
// Low levels mix very different animals; higher levels ask within one group (which frog?).
export const meta = {
  id: 'species-quiz',
  name: 'Name that species',
  blurb: 'A real photo from iNaturalist observers: which species is it? Costa Rica by default.',
  howTo: ['Look at shape, colour and pattern.', 'Pick the species. Each photo credits its author.'],
  skills: ['knowledge'],
  durationRange: [60, 180],
  difficultyRange: [1, 10],
  offline: false,
  lang: ['en'],
};

export function makeQuestions(_rng, _d, data) {
  const qs = (data?.questions || []).filter((q) => q.image && q.options?.length === 4);
  if (qs.length < 3) throw new Error('This quiz uses photos from iNaturalist. Connect once and the ones you’ve seen are saved for offline play.');
  return qs.map((q) => ({
    prompt: 'Which species is this?',
    options: q.options,
    answer: q.options.indexOf(q.name),
    image: q.image,
    caption: `Photo: ${q.credit} (${q.license})`,
    url: q.url,
    explain: `${q.name} (${q.scientific}), group: ${q.group}. Seen in ${data.place}.`,
  }));
}
