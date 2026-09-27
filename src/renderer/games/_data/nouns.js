// Concrete, easy-to-picture nouns for the memory-palace trainer (vivid images stick best).
export const NOUNS = `anchor apple balloon banana barrel basket bell bicycle blanket boot bottle bucket
cactus cake camel candle cannon carrot castle cat chair cheese clock cloud coin comb crab crown cup
diamond dog dolphin donkey dragon drum duck eagle egg elephant envelope feather fence fish flag
flute fork fox frog ghost giraffe glove goat guitar hammer harp hat helmet honey horse igloo iron
jacket jar jellyfish kettle key kite ladder lamp lemon lion lizard lobster lock magnet map mask
monkey moon mushroom nail necklace needle nest octopus onion orange owl paintbrush panda
parrot peach pear pencil penguin piano pig pillow pineapple pirate pizza plate potato pumpkin
pyramid rabbit robot rocket rope saddle sandwich saxophone scarf scissors shark sheep shell shoe
skateboard skull snail snake snowman sock spider spoon squirrel stamp statue strawberry submarine
suitcase sun swan sword teapot telescope tent tiger toaster tomato tooth tractor trumpet turtle
umbrella unicorn vase violin volcano wagon wallet watermelon whale wheel whistle windmill wolf zebra`
  .split(/\s+/).filter(Boolean);

// A walk through an ordinary home: the "palace". Use the same route every time; that's the point.
export const LOCI = [
  'the front gate', 'the doormat', 'the front door', 'the coat hooks', 'the hallway mirror', 'the stairs',
  'the living-room sofa', 'the television', 'the bookshelf', 'the fireplace', 'the kitchen door', 'the fridge',
  'the kitchen sink', 'the oven', 'the dining table', 'the back door', 'the garden bench', 'the washing line',
];
