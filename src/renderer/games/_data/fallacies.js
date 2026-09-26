// Logical fallacies: name, what goes wrong, and two original example passages each.
export const FALLACIES = [
  { name: 'Ad hominem', def: 'Attacking the person making an argument instead of the argument itself.', ex: [
    '“Why should we listen to her plan for the budget? She can’t even keep her own garden tidy.”',
    '“He says smoking is harmful, but he used to smoke, so his opinion is worthless.”'] },
  { name: 'Straw man', def: 'Misrepresenting someone’s argument as a weaker one, then knocking that down.', ex: [
    '“You want fewer cars downtown? So you think nobody should be allowed to drive anywhere.”',
    '“My opponent wants to review the school menu. Apparently he wants our children to starve.”'] },
  { name: 'False dilemma', def: 'Presenting only two options when more exist.', ex: [
    '“Either you support this exact law or you don’t care about safety at all.”',
    '“We either cancel the whole festival or accept that it will be a disaster.”'] },
  { name: 'Slippery slope', def: 'Claiming a small step will inevitably lead to extreme consequences, without showing why.', ex: [
    '“If we let students retake one test, soon nobody will study and degrees will mean nothing.”',
    '“Allow one food truck in the park and next it will be a parking lot full of fast food.”'] },
  { name: 'Appeal to authority', def: 'Treating a claim as true because someone with status said it, especially outside their expertise.', ex: [
    '“A famous actor says this diet cures headaches, so it must work.”',
    '“My favourite footballer uses this investment app, so it’s obviously the smart choice.”'] },
  { name: 'Appeal to popularity (bandwagon)', def: 'Arguing that something is true or good because many people believe or do it.', ex: [
    '“Millions of people buy this supplement, so it must be effective.”',
    '“Everyone in the office thinks the new policy is bad, so it is.”'] },
  { name: 'Appeal to nature', def: 'Assuming that what is natural is good, or that what is unnatural is bad.', ex: [
    '“This remedy is made from plants, so it can’t have side effects.”',
    '“Vaccines aren’t natural, so they can’t be good for you.”'] },
  { name: 'Appeal to tradition', def: 'Arguing that something is right because it has always been done that way.', ex: [
    '“We’ve always held the meeting on Mondays, so changing it would be wrong.”',
    '“Our family has always voted this way; there’s no reason to think differently.”'] },
  { name: 'Appeal to novelty', def: 'Assuming something is better simply because it is new.', ex: [
    '“It’s the latest version, so it must be an improvement.”',
    '“This teaching method was invented last year, so it beats the old ones.”'] },
  { name: 'Appeal to emotion', def: 'Using feelings such as fear or pity instead of evidence to win the point.', ex: [
    '“Think of the poor puppies! You have to agree the new mall is a terrible idea.”',
    '“If you really loved your family, you’d buy the premium insurance.”'] },
  { name: 'Appeal to ignorance', def: 'Claiming something is true because it hasn’t been proven false, or false because it hasn’t been proven true.', ex: [
    '“Nobody has proven that ghosts don’t exist, so they do.”',
    '“There’s no evidence the new bridge is safe, so it must be dangerous.”'] },
  { name: 'Burden of proof', def: 'Making a claim and insisting others disprove it, instead of supporting it yourself.', ex: [
    '“I say the moon affects stock prices. Prove me wrong.”',
    '“Until you show my plan won’t work, we should go ahead with it.”'] },
  { name: 'Circular reasoning (begging the question)', def: 'Using the conclusion as one of the premises.', ex: [
    '“This book is reliable because it says it is reliable.”',
    '“He is trustworthy because he always tells the truth.”'] },
  { name: 'Hasty generalization', def: 'Drawing a broad conclusion from too few or unrepresentative cases.', ex: [
    '“Two people from that town were rude to me, so everyone there is rude.”',
    '“I tried one vegetarian dish and didn’t like it, so vegetarian food is bad.”'] },
  { name: 'Post hoc ergo propter hoc', def: 'Assuming that because B followed A, A caused B.', ex: [
    '“I wore my lucky socks and we won, so the socks made us win.”',
    '“The new manager started in March and sales rose in April, so she caused the rise.”'] },
  { name: 'Correlation implies causation', def: 'Treating two things that vary together as if one must cause the other.', ex: [
    '“Towns with more libraries have more crime, so libraries cause crime.”',
    '“Students who drink coffee get better grades, so coffee makes you smarter.”'] },
  { name: 'Texas sharpshooter', def: 'Picking out a pattern after the fact and ignoring the data that doesn’t fit.', ex: [
    '“Look at these five cities with high cancer rates near power lines!” (ignoring the many with low rates)',
    '“My horoscope predicted three things this month that happened!” (ignoring the ones that didn’t)'] },
  { name: 'Cherry picking', def: 'Presenting only the evidence that supports your side.', ex: [
    '“Here are three studies showing chocolate is healthy.” (leaving out the twenty that found no effect)',
    '“Our product had great reviews in May.” (not mentioning the complaints the rest of the year)'] },
  { name: 'Gambler’s fallacy', def: 'Believing past independent random events change the odds of future ones.', ex: [
    '“The coin landed heads five times, so tails is due.”',
    '“This roulette table hasn’t hit red in ages; red is bound to come up.”'] },
  { name: 'Sunk cost fallacy', def: 'Continuing something because of what you’ve already invested, not because of future value.', ex: [
    '“I’ve already watched two hours of this awful film, so I have to finish it.”',
    '“We’ve spent a million on this project; stopping now would waste it.”'] },
  { name: 'Tu quoque (you too)', def: 'Dismissing criticism by pointing out that the critic does the same thing.', ex: [
    '“You say I should exercise more, but you never go to the gym!”',
    '“Why should our company cut emissions when other countries pollute more?”'] },
  { name: 'Whataboutism', def: 'Deflecting a criticism by raising a different issue.', ex: [
    '“Yes, our team broke the rules, but what about the referee’s mistakes last season?”',
    '“You’re criticising the new tax, but what about the old government’s spending?”'] },
  { name: 'Red herring', def: 'Introducing an irrelevant topic to distract from the real issue.', ex: [
    '“Why worry about the leaking roof when there are people with no homes at all?”',
    '“The report says our factory pollutes, but we employ hundreds of local people.”'] },
  { name: 'Genetic fallacy', def: 'Judging a claim by where it came from rather than its merits.', ex: [
    '“That idea came from an advertising agency, so it can’t be true.”',
    '“The theory was first proposed by a student, so it’s probably wrong.”'] },
  { name: 'Guilt by association', def: 'Rejecting a view because of the people or groups who also hold it.', ex: [
    '“A dictator once loved classical music, so there’s something sinister about it.”',
    '“That politician I dislike supports cycling lanes, so they must be a bad idea.”'] },
  { name: 'Loaded question', def: 'Asking a question that contains an unproven assumption.', ex: [
    '“Have you stopped wasting company money?”',
    '“Why is your product so much worse than ours?”'] },
  { name: 'Composition', def: 'Assuming what is true of the parts is true of the whole.', ex: [
    '“Each player on the team is excellent, so the team must be excellent.”',
    '“Every brick is light, so the wall must be light too.”'] },
  { name: 'Division', def: 'Assuming what is true of the whole is true of each part.', ex: [
    '“The university is world-famous, so every professor there is world-famous.”',
    '“The company is profitable, so every department makes money.”'] },
  { name: 'Equivocation', def: 'Switching between different meanings of the same word in one argument.', ex: [
    '“A feather is light. What is light cannot be dark. So a feather cannot be dark.”',
    '“The law says we must obey the laws of nature; gravity is a law of nature; so gravity is a legal matter.”'] },
  { name: 'No true Scotsman', def: 'Protecting a generalization by redefining the group to exclude counterexamples.', ex: [
    '“No real fan would ever leave early.” “My brother left early.” “Then he isn’t a real fan.”',
    '“True scientists never make mistakes. That researcher did, so she wasn’t a true scientist.”'] },
  { name: 'Special pleading', def: 'Applying rules to others while making an exception for yourself without good reason.', ex: [
    '“Everyone must follow the queue, but I’m in a hurry, so I shouldn’t have to.”',
    '“Studies are needed for other remedies, but mine works in ways science can’t measure.”'] },
  { name: 'Moving the goalposts', def: 'Changing the standard of evidence once the original standard is met.', ex: [
    '“Show me one study.” (After seeing one:) “Well, one study proves nothing; show me fifty.”',
    '“If the car does 100 km on a charge, I’ll buy it.” (It does:) “It should really do 300.”'] },
  { name: 'Anecdotal evidence', def: 'Using a personal story or isolated example instead of sound evidence.', ex: [
    '“My grandfather smoked every day and lived to 95, so smoking isn’t that bad.”',
    '“My friend’s car of that brand broke down, so the brand is unreliable.”'] },
  { name: 'Middle ground', def: 'Assuming the truth must lie in a compromise between two positions.', ex: [
    '“One side says the earth is round, the other says it is flat, so maybe it’s somewhat curved.”',
    '“You say it costs 100 and I say 0, so let’s agree it’s worth 50.”'] },
  { name: 'Personal incredulity', def: 'Rejecting something because you find it hard to understand or imagine.', ex: [
    '“I can’t see how evolution could produce an eye, so it must not have happened.”',
    '“I don’t understand how planes stay up, so the physics must be wrong.”'] },
  { name: 'Ambiguity', def: 'Using a vague or double-meaning phrase to mislead.', ex: [
    '“The sign said ‘fine for parking here’, so I parked.”',
    '“Our juice has ‘up to’ 100% of your vitamin needs.” (it may have almost none)'] },
  { name: 'Circular definition', def: 'Defining a term so that the conclusion is true by definition, then presenting it as a discovery.', ex: [
    '“All good films make money, because if it didn’t make money it wasn’t a good film.”',
    '“Nobody who is truly happy complains, because complaining shows you aren’t happy.”'] },
  { name: 'Fallacy fallacy', def: 'Concluding a claim is false because the argument for it contained a fallacy.', ex: [
    '“You used an ad hominem, so your conclusion that the bridge is unsafe must be wrong.”',
    '“Her argument for recycling was badly reasoned, so recycling must be pointless.”'] },
  { name: 'Survivorship bias', def: 'Drawing conclusions only from the cases that “survived” some selection.', ex: [
    '“All the famous entrepreneurs dropped out of college, so dropping out leads to success.”',
    '“Old buildings are so well made; they don’t build them like they used to.” (the badly built ones fell down)'] },
  { name: 'Appeal to consequences', def: 'Arguing a claim is true or false because of whether its consequences are pleasant.', ex: [
    '“The climate can’t be changing, because that would be terrible for my business.”',
    '“There must be life after death, otherwise life would be meaningless.”'] },
  { name: 'Appeal to motive', def: 'Dismissing an argument because the arguer might gain from it, without checking the argument.', ex: [
    '“Of course the dentist says to floss; he wants more patients.”',
    '“The electric-car maker says electric cars are cleaner; they would say that.”'] },
  { name: 'False analogy', def: 'Comparing two things that are not alike in the ways that matter for the argument.', ex: [
    '“Employees are like nails: just as nails must be hit to work, so must employees.”',
    '“A country is like a family, so it should never borrow money.”'] },
  { name: 'Nirvana fallacy', def: 'Rejecting a solution because it isn’t perfect.', ex: [
    '“Seat belts don’t prevent every death, so there’s no point wearing them.”',
    '“This anti-spam filter still lets some spam through, so it’s useless.”'] },
  { name: 'Continuum fallacy', def: 'Arguing that because there is no sharp line between two states, there is no difference.', ex: [
    '“One more grain of sand doesn’t make a heap, so there’s no such thing as a heap.”',
    '“There’s no exact second when you become old, so nobody is really old.”'] },
  { name: 'Affirming the consequent', def: 'Reasoning “if P then Q; Q; therefore P”.', ex: [
    '“If it rained, the street is wet. The street is wet, so it rained.”',
    '“If he’s a doctor, he wears a white coat. He wears a white coat, so he’s a doctor.”'] },
  { name: 'Denying the antecedent', def: 'Reasoning “if P then Q; not P; therefore not Q”.', ex: [
    '“If I study, I’ll pass. I didn’t study, so I won’t pass.”',
    '“If it’s a cat, it has four legs. It’s not a cat, so it doesn’t have four legs.”'] },
];
