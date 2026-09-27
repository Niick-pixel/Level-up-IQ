// Short original passages for RSVP speed reading, each with three comprehension questions
// (answer = index of the right option). Facts checked against standard references.
export const PASSAGES = [
  {
    title: 'Octopus bodies',
    text: 'An octopus has three hearts. Two pump blood through the gills, and the third sends it around the rest of the body. Its blood is blue, because it carries oxygen with a copper-based molecule called hemocyanin instead of the iron-based hemoglobin that makes our blood red. Octopuses are also unusual thinkers: about two thirds of their neurons sit in their arms rather than in the brain, so each arm can taste, touch and react partly on its own.',
    questions: [
      { q: 'How many hearts does an octopus have?', options: ['One', 'Two', 'Three', 'Eight'], answer: 2 },
      { q: 'Why is octopus blood blue?', options: ['It carries oxygen with a copper-based molecule', 'It contains no oxygen', 'It is full of iron', 'It reflects sea water'], answer: 0 },
      { q: 'Where are most of an octopus’s neurons?', options: ['In the brain', 'In the arms', 'In the gills', 'In the hearts'], answer: 1 },
    ],
  },
  {
    title: 'The waggle dance',
    text: 'A honeybee that finds good flowers returns to the hive and performs a waggle dance on the vertical comb. The angle of the straight waggle run, measured from straight up, matches the angle between the sun and the food. The longer the waggle run lasts, the farther away the food is. The Austrian scientist Karl von Frisch decoded this language, and in 1973 he shared the Nobel Prize in Physiology or Medicine for his work on animal behaviour.',
    questions: [
      { q: 'What does the angle of the waggle run show?', options: ['How sweet the nectar is', 'The direction of the food relative to the sun', 'How many bees should follow', 'The time of day'], answer: 1 },
      { q: 'What does a longer waggle run mean?', options: ['The food is farther away', 'The food is closer', 'There is danger', 'The queen is hungry'], answer: 0 },
      { q: 'Who decoded the dance?', options: ['Charles Darwin', 'Konrad Lorenz', 'Karl von Frisch', 'Jane Goodall'], answer: 2 },
    ],
  },
  {
    title: 'Measuring the Earth with a stick',
    text: 'Around 240 BC, Eratosthenes, the librarian of Alexandria, heard that at noon on the summer solstice the sun shone straight down a well in Syene, far to the south. At the same moment in Alexandria, a vertical stick cast a shadow at about seven degrees, roughly one fiftieth of a full circle. If the sun’s rays arrive parallel, the distance between the two cities must be one fiftieth of the Earth’s circumference. His estimate was remarkably close to the modern value.',
    questions: [
      { q: 'What happened in Syene at noon on the solstice?', options: ['A stick cast a long shadow', 'The sun shone straight down a well', 'There was an eclipse', 'The sun did not rise'], answer: 1 },
      { q: 'The shadow angle in Alexandria was about what share of a circle?', options: ['One tenth', 'One quarter', 'One fiftieth', 'One thousandth'], answer: 2 },
      { q: 'What assumption did the method rely on?', options: ['The Earth is flat', 'The sun’s rays arrive parallel', 'The sun orbits the Earth', 'The wells were the same depth'], answer: 1 },
    ],
  },
  {
    title: 'Tardigrades',
    text: 'Tardigrades, or water bears, are animals about half a millimetre long that live in moss, soil and the sea. When their home dries out, they pull in their legs, lose almost all their water and curl into a dry state called a tun. In that state their metabolism nearly stops, and they can survive extreme cold, heat and radiation. In 2007, tardigrades were carried into orbit and exposed to the vacuum of space; some survived and later had healthy offspring.',
    questions: [
      { q: 'What is the dried-out tardigrade state called?', options: ['A cyst', 'A tun', 'A spore', 'A husk'], answer: 1 },
      { q: 'About how long is a tardigrade?', options: ['Half a millimetre', 'Five centimetres', 'One metre', 'A few nanometres'], answer: 0 },
      { q: 'What happened to tardigrades in 2007?', options: ['They were found on the Moon', 'They were exposed to space and some survived', 'They were cloned', 'They were declared extinct'], answer: 1 },
    ],
  },
  {
    title: 'A lucky mould',
    text: 'In 1928 Alexander Fleming came back from holiday to find a mould growing on one of his dishes of Staphylococcus bacteria. Around the mould, the bacteria had died. He named the active substance penicillin, but he could not purify it in useful amounts. More than a decade later, Howard Florey and Ernst Chain at Oxford worked out how to produce it as a drug, and in 1945 the three men shared the Nobel Prize.',
    questions: [
      { q: 'What did Fleming notice around the mould?', options: ['The bacteria had died', 'The bacteria had multiplied', 'The dish had cracked', 'The mould glowed'], answer: 0 },
      { q: 'Who turned penicillin into a usable drug?', options: ['Pasteur and Koch', 'Florey and Chain', 'Watson and Crick', 'Curie and Becquerel'], answer: 1 },
      { q: 'When was the Nobel Prize for penicillin awarded?', options: ['1928', '1935', '1945', '1962'], answer: 2 },
    ],
  },
  {
    title: 'Venus runs backwards',
    text: 'Venus spins so slowly that one turn on its axis takes about 243 Earth days, longer than its year of about 225 days. It also spins in the opposite direction to most planets, so on Venus the sun would rise in the west. Although Mercury is closer to the sun, Venus is the hottest planet, with surface temperatures around 465 degrees Celsius, because its thick carbon dioxide atmosphere traps heat in a runaway greenhouse effect.',
    questions: [
      { q: 'Which is longer on Venus?', options: ['Its year', 'One turn on its axis', 'They are equal', 'Neither can be measured'], answer: 1 },
      { q: 'Where would the sun rise on Venus?', options: ['In the east', 'In the west', 'In the north', 'It never rises'], answer: 1 },
      { q: 'Why is Venus hotter than Mercury?', options: ['It is closer to the sun', 'Its core is molten', 'A thick CO₂ atmosphere traps heat', 'It has no atmosphere'], answer: 2 },
    ],
  },
  {
    title: 'The Rosetta Stone',
    text: 'In 1799 French soldiers rebuilding a fort near the town of Rashid, or Rosetta, in Egypt found a broken slab of dark stone. It carried the same decree three times: in hieroglyphs, in Demotic script and in ancient Greek. Because scholars could read the Greek, the stone became a key to the other two. Building on work by Thomas Young, Jean-François Champollion announced in 1822 that he had cracked the hieroglyphic system.',
    questions: [
      { q: 'How many versions of the text are on the stone?', options: ['Two', 'Three', 'Four', 'Five'], answer: 1 },
      { q: 'Which script could scholars already read?', options: ['Hieroglyphs', 'Demotic', 'Ancient Greek', 'Latin'], answer: 2 },
      { q: 'Who announced the decipherment in 1822?', options: ['Napoleon', 'Thomas Young', 'Howard Carter', 'Jean-François Champollion'], answer: 3 },
    ],
  },
  {
    title: 'Anchors in the mind',
    text: 'In a famous 1974 experiment, Amos Tversky and Daniel Kahneman spun a wheel of fortune that was rigged to stop at either 10 or 65. Participants were then asked what percentage of African countries were members of the United Nations. People who had seen 10 gave a median guess of 25 percent; those who had seen 65 guessed 45 percent. A number that was obviously random still pulled their estimates toward it. This is called the anchoring effect.',
    questions: [
      { q: 'What was special about the wheel?', options: ['It was rigged to stop at 10 or 65', 'It had no numbers', 'It was spun by participants', 'It always stopped at 50'], answer: 0 },
      { q: 'What was the median guess after seeing 65?', options: ['25 percent', '45 percent', '65 percent', '10 percent'], answer: 1 },
      { q: 'What is the effect called?', options: ['Priming', 'Framing', 'Anchoring', 'Hindsight bias'], answer: 2 },
    ],
  },
  {
    title: 'Roman concrete',
    text: 'Some Roman harbour walls have stood in sea water for two thousand years, while modern concrete in the sea can crumble within decades. The Romans mixed lime with volcanic ash. Sea water seeping into the structure reacts with the ash and grows new minerals, such as aluminous tobermorite, that strengthen it over time. Researchers have also found small lumps of lime in Roman concrete that can dissolve and refill cracks when water gets in, a kind of self-healing.',
    questions: [
      { q: 'What did the Romans mix with lime?', options: ['Sand from rivers', 'Volcanic ash', 'Crushed marble', 'Iron filings'], answer: 1 },
      { q: 'What does sea water do to Roman harbour concrete?', options: ['Dissolves it quickly', 'Grows minerals that strengthen it', 'Turns it green', 'Has no effect'], answer: 1 },
      { q: 'What can the lime lumps do?', options: ['Glow in the dark', 'Refill cracks when water gets in', 'Repel water entirely', 'Make it lighter'], answer: 1 },
    ],
  },
  {
    title: 'The year without a summer',
    text: 'In April 1815, Mount Tambora in Indonesia exploded in the largest volcanic eruption in recorded history. Its ash and sulphur spread through the upper atmosphere and reflected sunlight, and 1816 became known in Europe and North America as the year without a summer, with snow in June and failed harvests. Kept indoors by the gloomy weather at Lake Geneva that summer, the nineteen-year-old Mary Shelley began writing Frankenstein.',
    questions: [
      { q: 'Where is Mount Tambora?', options: ['Iceland', 'Italy', 'Indonesia', 'Japan'], answer: 2 },
      { q: 'Why was 1816 so cold?', options: ['Volcanic sulphur and ash reflected sunlight', 'The sun dimmed on its own', 'An asteroid impact', 'A change in ocean currents'], answer: 0 },
      { q: 'What book was started that summer?', options: ['Dracula', 'Frankenstein', 'Pride and Prejudice', 'Moby-Dick'], answer: 1 },
    ],
  },
  {
    title: 'A slime mould plans a railway',
    text: 'In 2010, researchers in Japan placed oat flakes on a wet surface in the pattern of cities around Tokyo and let a yellow slime mould called Physarum polycephalum grow out from the spot representing Tokyo. The single-celled organism, which has no brain, spread out, then pruned its tubes until only efficient connections between the food sources remained. The network it made looked strikingly like the real Tokyo rail system, balancing cost, speed and resilience.',
    questions: [
      { q: 'What stood in for the cities?', options: ['Drops of sugar', 'Oat flakes', 'Small lights', 'Pebbles'], answer: 1 },
      { q: 'What is unusual about the slime mould?', options: ['It is a single cell with no brain', 'It is a plant', 'It can fly', 'It only grows in the dark'], answer: 0 },
      { q: 'What did its network resemble?', options: ['The London Underground', 'The Tokyo rail system', 'The Internet', 'A spider’s web'], answer: 1 },
    ],
  },
  {
    title: 'Monarch migration',
    text: 'Each autumn, monarch butterflies from eastern North America fly up to about four thousand kilometres to spend the winter in fir forests in the mountains of central Mexico. No single butterfly makes the round trip. The generation that flies south lives around eight months, far longer than the few weeks of its parents, while the journey north in spring is completed by its children and grandchildren. The butterflies navigate using the sun and an internal clock.',
    questions: [
      { q: 'Where do eastern monarchs spend the winter?', options: ['Florida', 'Central Mexico', 'Brazil', 'Cuba'], answer: 1 },
      { q: 'How long does the southbound generation live?', options: ['A few days', 'A few weeks', 'About eight months', 'About three years'], answer: 2 },
      { q: 'What do they use to navigate?', options: ['The sun and an internal clock', 'Only smell', 'The Moon', 'Following birds'], answer: 0 },
    ],
  },
  {
    title: 'The Ship of Theseus',
    text: 'The Greek writer Plutarch told of the ship of the hero Theseus, kept in Athens for centuries. As its planks rotted, they were replaced one by one, until perhaps no original wood was left. Philosophers asked whether it was still the same ship. Thomas Hobbes later added a twist: suppose someone collected all the old planks and rebuilt them into a second ship. Which of the two would then be the ship of Theseus?',
    questions: [
      { q: 'Who first told the story?', options: ['Plato', 'Plutarch', 'Homer', 'Aristotle'], answer: 1 },
      { q: 'What was replaced over time?', options: ['The sails', 'The planks', 'The crew', 'The name'], answer: 1 },
      { q: 'What twist did Hobbes add?', options: ['The ship sank', 'The old planks are rebuilt into a second ship', 'Theseus returned', 'The ship was painted'], answer: 1 },
    ],
  },
  {
    title: 'Why the sky is blue',
    text: 'Sunlight contains every colour. As it passes through the atmosphere, it bounces off molecules of nitrogen and oxygen far smaller than its wavelength. This Rayleigh scattering is much stronger for short wavelengths, so blue light is scattered across the sky far more than red. At sunset, light travels through much more air to reach you; most of the blue is scattered away along the path, leaving the reds and oranges.',
    questions: [
      { q: 'What scatters the sunlight?', options: ['Dust from deserts', 'Molecules of nitrogen and oxygen', 'Water in the oceans', 'The ozone layer only'], answer: 1 },
      { q: 'Which light is scattered most?', options: ['Short wavelengths, like blue', 'Long wavelengths, like red', 'All colours equally', 'Infrared'], answer: 0 },
      { q: 'Why are sunsets red?', options: ['The sun cools down', 'Light crosses more air and loses its blue', 'Clouds are red', 'The Earth reflects red light'], answer: 1 },
    ],
  },
];
