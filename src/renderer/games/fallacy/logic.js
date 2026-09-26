// Spot the fallacy: read a short argument and name what goes wrong.
export const meta = {
  id: 'fallacy',
  name: 'Spot the fallacy',
  blurb: 'Read a short argument and name the reasoning error in it. 46 fallacies to learn.',
  howTo: ['Pick the fallacy that best describes the argument.', 'The explanation shows after each answer.'],
  skills: ['logic', 'deep-thinking'],
  durationRange: [60, 300],
  difficultyRange: [1, 10],
  offline: true,
  lang: ['en'],
};

export function makeQuestions(rng, d, fallacies) {
  const count = d <= 3 ? 5 : 8;
  const optionCount = d <= 3 ? 3 : 4;
  return rng.shuffle(fallacies).slice(0, count).map((f) => {
    const others = rng.shuffle(fallacies.filter((x) => x.name !== f.name)).slice(0, optionCount - 1).map((x) => x.name);
    const options = rng.shuffle([f.name, ...others]);
    return {
      prompt: 'Which fallacy is this?',
      detail: rng.pick(f.ex),
      options,
      answer: options.indexOf(f.name),
      explain: `${f.name}: ${f.def}`,
    };
  });
}
