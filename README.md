# Mind Gym

A brain-training and curiosity app for Windows. I use AI all day; this is where I keep my own thinking sharp: quick games, a big bank of topics to be curious about, and exercises that make me think before I look anything up.

Mind Gym is a sibling of [Focus Point](https://github.com/Niick-pixel/Focus-purpose): same themes, same kind of installer and updates, and it's built to stay out of Focus Point's way (see [Plays well with Focus Point](#plays-well-with-focus-point)).

> **Status: Phase 5 of 6.** 83 game types, 1,541 keywords, keyword sessions, videos with recall, spaced repetition, an adaptive Daily Mix, streaks, the curiosity map and full stats work. Optional AI features and v1.0 polish are next. The full plan is in [`docs/PHASE0_PLAN.md`](docs/PHASE0_PLAN.md) and the spec in [`docs/MIND_GYM_SPEC.md`](docs/MIND_GYM_SPEC.md).

## Features (so far)

- **83 game types, seeded, and all but three playable fully offline** (the picture quizzes need the internet the first time).
  - **Logic:** logic grids (zebra, unique solution guaranteed), knights and knaves, Mastermind, Tower of Hanoi, syllogisms, spot the fallacy (46 fallacies), and **24 puzzles from Simon Tatham's Portable Puzzle Collection** (Solo, Keen, Towers, Unequal, Pattern, Loopy, Light Up, Bridges, Net, Tents, Range, Galaxies, Magnets, Signpost, Dominosa, Filling, Palisade, Undead, Mines, Pearl, Tracks, Unruly, Map, Mosaic).
  - **Math:** mental math sprint, Countdown numbers and the 24 game (a solver proves every puzzle solvable), Fermi estimation (scored on log error), sequences, Kakuro (unique solution), probability intuition (predict, then watch it simulated), orders of magnitude.
  - **Language:** Countdown letters, anagrams, word ladder, Wordle-style, cryptograms (public-domain quotes), mini crosswords from the keyword bank, etymology.
  - **Memory:** dual n-back, digit span (forwards and backwards), Corsi blocks, card pairs, Kim's game, a memory-palace trainer, and "yesterday" recall of facts from 1, 3 and 7 days ago.
  - **Attention and speed:** Stroop (with a colour-blind mode), Schulte tables, Flanker, Go/No-Go, reaction time (simple and choice), visual search, RSVP speed reading with comprehension questions.
  - **Spatial:** 3D mental rotation, 15-puzzle, Rush Hour (every puzzle's minimum move count is exact), map geography.
  - **Strategy:** rated chess puzzles (Lichess database), a full game against Stockfish at your level, Connect Four against minimax, and Nim with a "discover the winning rule" mode.
  - **Knowledge:** trivia (two open databases plus an offline bank), guess the Wikipedia article, chronology ("On this day" or an offline set), flags, capitals, higher or lower, and three picture quizzes: art through time (The Met and the Art Institute of Chicago), name that species (iNaturalist, Costa Rica by default) and "What am I looking at?" (NASA's Astronomy Picture of the Day).
  - **Deep thinking:** explain it back (Feynman technique), steelman the other side, first principles, and a no-AI challenge of the day.
  - **Riddles and lateral thinking:** 112 riddles, 42 situation puzzles and 50 rebuses.
- **Every puzzle has a seed code** like `stroop:4:k9x2mf`. Replay it, or share it, and you get exactly the same puzzle.
- **Daily Mix that adapts.** Warm-up → logic → memory → extra rounds for your weakest skills while time allows → today's keyword (explained back) → something to think about → something to watch. It favours weaker skills, mostly skips games you played in the last 3 days, varies the keyword's domain, fits the length you set, and puts due reviews first.
- **More ways to play:** Pick a skill (three rounds), Marathon (game after game until you stop), your own playlists, Random anything, Rabbit hole.
- **Spaced repetition (FSRS).** Key facts from keyword sessions and your video summaries become review cards that come back just before you'd forget them. Grade Again / Hard / Good / Easy (each shows when the card returns); set your target recall and new cards per day.
- **Streaks that allow rest.** Days trained in a row, with rest days (1 a week by default) that don't break it. You can hide streaks.
- **Curiosity map.** Every keyword you've explored, clustered by domain and linked where topics are related, plus the frontier: unexplored topics one step from what you know.
- **Adaptive levels.** Each skill (logic, math, language, memory, attention, spatial, strategy, knowledge, deep thinking) has its own rating. New rounds aim for about 75 % success, the "hard but doable" zone. You can bias it easier or harder.
- **Thinking timer.** Hints and "show solution" stay locked for the first N seconds, so you try first.
- **Auto-pause.** If the window loses focus (a Focus Point break, a notification, Alt+Tab), the round pauses. Paused time never counts.
- **Keyword bank: 1,541 topics across 33 domains**, from entropy to the Maya numerals, from Costa Rica's abolished army to the Voynich manuscript.
  - Fuzzy search with aliases and typos, plus domain filters.
  - Random picks: fully random, within a domain, **outside my comfort zone** (favours domains you've explored least), and **rabbit hole** (follow the related-topics graph).
  - **Keyword of the day**, the same all day.
- **Keyword sessions.** Pick a keyword and go through seven steps:
  1. **Predict** what it is before reading anything.
  2. **Learn** from the Wikipedia summary, its lead image, and key facts from Wikidata.
  3. **Quiz:** 5–8 questions, some built from the summary and facts, some bonus trivia.
  4. **Puzzle tie-in:** a short related game.
  5. **Explain it back** from memory. It's checked against the summary's key ideas, and you see what you covered and missed.
  6. **Watch** (videos arrive in Phase 4).
  7. **Remember:** key facts become review cards.

  Offline, the session still works from the keyword bank alone.
- **Add your own keywords** from Wikipedia (search, or roll a random article), and let any keyword suggest more topics from its Wikipedia links.
- **Watch and learn.** The latest videos from 36 curated channels (Veritasium, Kurzgesagt, 3Blue1Brown, PBS Space Time and more; switch any off or add your own), public-domain documentaries from the Internet Archive, and, with your own optional key, YouTube search.
  - Each keyword session suggests matching videos. Add them to your watch-later list; videos always open in your browser.
  - When you've watched one: three recall questions (the main idea, one fact, and which topic it was about). Your answers become a review card and an entry in **Things I've learned**.
- **Optional API keys** (YouTube Data API, NASA) are encrypted with Windows' own protection (DPAPI through Electron `safeStorage`) and never written to settings or shown again.
- **On this day and the daily chess puzzle** on the home screen, when online.
- **Daily Mix.** A short guided set: warm-up, math, memory and words, then the keyword of the day and an explain-it-back prompt.
- **Stats that stay on your computer.** Minutes per day (7/30/90 days), streaks, most played, personal bests, the skill radar now vs 30 days ago with each skill's trend, keywords explored over time, reviews due in the next 14 days, recall rate, videos watched, and "thinking without AI" time. Every chart has a table view and keyboard-focusable values. Export everything (cards, reviews and watch list included) to JSON or CSV.
- **Four themes:** Night, Dusk, Forest and Sand, the same as Focus Point, with contrast checked by the tests.
- **Keyboard first.** Ctrl+K searches, Esc pauses, and every game plays without a mouse.
- **Private and offline-first.** No accounts, no telemetry. Online sources only enrich: each one can be turned off, there's a full offline mode, and everything fetched is cached so it still works without a connection.

## Plays well with Focus Point

Focus Point holds its breaks while a fullscreen game or video is in front. Mind Gym is screen time, not rest, so it makes sure it never looks fullscreen:

- It opens in a normal window.
- A maximized window normally stops at the taskbar, which is fine. With an auto-hidden taskbar, or on a monitor without one, a maximized window would cover the whole screen and Focus Point would wait. In that case Mind Gym maximizes to one pixel short of the screen (Settings → *Keep Focus Point breaks working when maximized*, on by default).
- True fullscreen (F11) is off unless you turn it on, and Settings warns that it delays Focus Point breaks.
- The tray icon, daily reminder and start-with-Windows are all **off by default**. Focus Point already owns that slot.

## Online sources

| Source | Used for | License | Limits we respect |
| --- | --- | --- | --- |
| [Wikipedia](https://en.wikipedia.org/) | Summaries, images, "On this day", topic search | CC BY-SA 4.0 (credited on every summary) | Identified User-Agent, ≤ 4 requests/s |
| [Wikidata](https://www.wikidata.org/) | Key facts, dated quiz questions | CC0 | One small query at a time, cached 30 days |
| [Open Trivia DB](https://opentdb.com/) | Bonus trivia, the trivia game | CC BY-SA 4.0 | One request every 5.5 s, session tokens |
| [The Trivia API](https://the-trivia-api.com/) | The trivia game | CC BY-NC 4.0 (fine while Mind Gym is free) | One request every 2 s |
| YouTube channel feeds | Latest videos from curated channels | YouTube Terms of Service (we only link out) | Cached 6 h; a failing feed falls back to its last copy |
| YouTube Data API (your key, optional) | Video search in the Watch step | YouTube API Services Terms | Cached 7 days, at most 20 searches a day |
| [Internet Archive](https://archive.org/) | Documentary films | Only items marked public domain, CC0, CC BY or CC BY-SA (or the Prelinger Archives) | One request every 1.5 s, cached 14 days |
| [The Met](https://www.metmuseum.org/hubs/open-access) | Art quiz | CC0 (Open Access objects only) | ≤ 2 requests/s, cached 30 days |
| [Art Institute of Chicago](https://api.artic.edu/docs/) | Art quiz | CC0 (public-domain works only) | ≤ 60 requests/min, identified with `AIC-User-Agent` |
| [iNaturalist](https://www.inaturalist.org/) | Species quiz | Per photo: CC0, CC BY or CC BY-NC only, author credited | ≤ 1 request/s, lists cached 30 days |
| [NASA APOD](https://apod.nasa.gov/) | Space quiz | Per image, credit shown | DEMO_KEY (or yours); batches cached a year; switches to the new endpoint on 2026-12-01 |
| [Lichess](https://lichess.org/) | Daily puzzle; offline puzzle pack from the CC0 database | CC0 | One request at a time, 1 min pause after a 429 |

All requests happen in the main process, only to these hosts, and are cached on disk. The pages themselves can't reach the network. The *Verify online sources* workflow checks every endpoint weekly from GitHub Actions.

**Stockfish** (GPL-3.0) is not bundled. The first time you play it, Mind Gym downloads the unmodified official release (1.8 MB, from GitHub or its npm mirror on jsDelivr), checks it against SHA-256 fingerprints pinned in the code, and runs it in a separate Web Worker. You can remove it from the Licenses page.

REST Countries was planned, but its free API was switched off in September 2026. Mind Gym ships its own country list (195 countries, capitals and flags) instead.

## Install (Windows)

Download the latest **`MindGym-Setup-x.y.z.exe`** from the [Releases page](https://github.com/Niick-pixel/Level-up-IQ/releases/latest) and run it. After that, the app keeps itself up to date.

> Windows SmartScreen may warn you because the app isn't code-signed. Click *More info → Run anyway*.

**Publishing a new version:** bump `version` in `package.json` and get it onto `main` (merge a pull request). The *Build Windows app* workflow notices that version has no release yet, builds the installer, creates the `vX.Y.Z` tag and a GitHub Release, and attaches the installer plus the `latest.yml` update manifest.

## Run from source

```bash
npm install
npm start
npm test
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run keywords:build` | Rebuilds `assets/keywords.json` from the shards in `data/keywords/` and validates them |
| `npm run words:build` | Rebuilds the English word lists in `assets/packs/words-en.json` |
| `npm run countries:build` | Rebuilds `assets/packs/countries.json` from `data/countries.txt` |
| `npm run verify:providers` | Checks every online source live (needs internet) |
| `npm run icons` | Redraws the app and tray icons |
| `npm run dist` | Builds the Windows installer into `dist/` |

Set `MIND_GYM_DATA_DIR` to keep data somewhere other than `%APPDATA%/Mind Gym` while developing.

## Adding keywords

Keywords live in `data/keywords/<domain>.txt`, one per line:

```
id | Term | alias; alias | tag, tag | difficulty 1-5 | related-id, related-id | Wikipedia title (optional)
entropy | Entropy | second law of thermodynamics | thermodynamics | 3 | maxwells-demon, arrow-of-time |
```

Then run `npm run keywords:build`. The build fails on duplicate ids, duplicate Wikipedia titles, related ids that don't exist, and empty domains. Wikidata IDs aren't typed by hand: run the *Verify online sources* workflow with "Save keyword Wikidata IDs" ticked, and it resolves every title and commits the IDs.

## How it's built

| Part | File |
| --- | --- |
| App shell: window, protocol, tray, reminder, security policy | `src/main/main.js` |
| `app://` protocol that serves only the app's own folders | `src/main/protocol.js` |
| Every IPC handler, with argument checks | `src/main/ipc.js`, `src/preload.js` |
| Settings saved to `%APPDATA%/Mind Gym/settings.json` | `src/main/store.js` |
| Training history (`stats.json` + `history.jsonl`) | `src/main/stats.js` |
| Per-skill ratings and difficulty picking | `src/main/rating.js` |
| Keyword bank: fuzzy search, random modes, keyword of the day | `src/main/keywords.js`, `scripts/build-keywords.js` |
| Online sources: provider base, rate limiter, Wikipedia, Wikidata, Open Trivia DB, Lichess | `src/main/providers/` |
| Disk cache (JSON and images, TTL, stale-if-offline, size cap) | `src/main/cache.js` |
| Keyword sessions, quiz builder, explain-it-back check | `src/main/session.js`, `src/main/quiz.js`, `src/main/explain.js` |
| Your keywords, review cards, session log | `src/main/learning.js` |
| Live source checks, Wikidata IDs, Lichess pack | `scripts/verify-providers.js`, `scripts/build-lichess-subset.js`, `.github/workflows/verify-providers.yml` |
| Focus Point coexistence ("safe maximize", opt-in fullscreen) | `src/main/window-guard.js` |
| Auto-updates (electron-updater + GitHub Releases) | `src/main/updater.js` |
| Seeded random numbers and seed codes (shared by main and games) | `src/shared/rng.js` |
| The game contract | `src/shared/game-contract.js` |
| Game shell: intro, level picker, pause, results | `src/renderer/views/play.js` |
| Games (pure logic in `logic.js`, UI in `index.js`) | `src/renderer/games/*/` |
| Shared game engines: quiz, typed answers, riddles, reflection, speeded trials, span staircase, chessboard | `src/renderer/games/_engine/` |
| Simon Tatham's puzzles: WebAssembly build, host page, bridge | `.github/workflows/build-tatham.yml`, `scripts/tatham-presets.cjs`, `src/renderer/tatham/` |
| Stockfish download and integrity checks | `src/main/engines.js` |
| Online extras for the knowledge games, picture pools for offline play | `src/main/knowledge.js` |
| Watch list, recall, video suggestions, curated channels | `src/main/media.js`, `src/main/channels.js` |
| Encrypted API keys | `src/main/secrets.js` |
| Spaced repetition (FSRS via ts-fsrs) | `src/main/srs.js` |
| Daily Mix planner and Marathon picker (pure, seeded, tested) | `src/shared/mix-plan.js` |
| Streaks, curiosity map | `src/main/stats.js`, `src/main/curiosity.js` |
| Step runner for the mix, skills, marathon and playlists; chart kit | `src/renderer/views/run.js`, `src/renderer/views/charts.js` |
| Prebuilt packs: Rush Hour puzzles, world map | `scripts/build-rush-hour.mjs`, `scripts/build-map.mjs` |
| Views: home, Daily Mix, games, keywords, stats, settings | `src/renderer/views/` |

The renderer is plain JavaScript modules with no framework and no bundler. Games load on demand. Pages run with `contextIsolation`, `sandbox`, no Node access, and a strict Content Security Policy. The renderer can't reach the network at all; external links open in your browser, and only for a short list of known sites.

## License

MIT. Word list from [an-array-of-english-words](https://www.npmjs.com/package/an-array-of-english-words) (MIT). Theme colours shared with Focus Point.
