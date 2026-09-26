# Mind Gym

A brain-training and curiosity app for Windows. I use AI all day; this is where I keep my own thinking sharp: quick games, a big bank of topics to be curious about, and exercises that make me think before I look anything up.

Mind Gym is a sibling of [Focus Point](https://github.com/Niick-pixel/Focus-purpose): same themes, same kind of installer and updates, and it's built to stay out of Focus Point's way (see [Plays well with Focus Point](#plays-well-with-focus-point)).

> **Status: Phase 1 of 6.** The skeleton, five games, the keyword bank, stats and settings work. Online content (Wikipedia, quizzes, videos), 60+ game types, spaced repetition and optional AI features are coming. The full plan is in [`docs/PHASE0_PLAN.md`](docs/PHASE0_PLAN.md) and the spec in [`docs/MIND_GYM_SPEC.md`](docs/MIND_GYM_SPEC.md).

## Features (so far)

- **Five games, all offline and seeded.**
  - **Mental math sprint.** As many as you can in 60 seconds, from single-digit sums up to two-digit multiplication and percentages.
  - **Stroop.** Name the ink colour, not the word. The colours come from the Okabe–Ito palette, and **colour-blind mode** switches to a spatial Stroop that never relies on colour.
  - **Dual n-back.** Positions and letters at the same time, 1-back to 4-back.
  - **Schulte table.** Find 1, 2, 3… in order, on grids from 3×3 to 6×6.
  - **Word ladder.** Change one letter at a time. Puzzles come from common words, so a common-word path always exists, and the stated step count is always the shortest.
- **Every puzzle has a seed code** like `stroop:4:k9x2mf`. Replay it, or share it, and you get exactly the same puzzle.
- **Adaptive levels.** Each skill (logic, math, language, memory, attention, spatial, strategy, knowledge, deep thinking) has its own rating. New rounds aim for about 75 % success, the "hard but doable" zone. You can bias it easier or harder.
- **Thinking timer.** Hints and "show solution" stay locked for the first N seconds, so you try first.
- **Auto-pause.** If the window loses focus (a Focus Point break, a notification, Alt+Tab), the round pauses. Paused time never counts.
- **Keyword bank: 540 topics across 33 domains**, from entropy to the Maya numerals, from Costa Rica's abolished army to the Voynich manuscript.
  - Fuzzy search with aliases and typos, plus domain filters.
  - Random picks: fully random, within a domain, **outside my comfort zone** (favours domains you've explored least), and **rabbit hole** (follow the related-topics graph).
  - **Keyword of the day**, the same all day.
- **Daily Mix.** A short guided set: warm-up, math, memory and words, then the keyword of the day and an explain-it-back prompt.
- **Stats that stay on your computer.** Minutes per day, rounds, "thinking without AI" time, personal bests, a skill radar, and export to JSON or CSV.
- **Four themes:** Night, Dusk, Forest and Sand, the same as Focus Point, with contrast checked by the tests.
- **Keyboard first.** Ctrl+K searches, Esc pauses, and every game plays without a mouse.
- **Private.** No accounts, no telemetry. The app only goes online to check for updates, and in later phases to reach the content sources you enable.

## Plays well with Focus Point

Focus Point holds its breaks while a fullscreen game or video is in front. Mind Gym is screen time, not rest, so it makes sure it never looks fullscreen:

- It opens in a normal window.
- A maximized window normally stops at the taskbar, which is fine. With an auto-hidden taskbar, or on a monitor without one, a maximized window would cover the whole screen and Focus Point would wait. In that case Mind Gym maximizes to one pixel short of the screen (Settings → *Keep Focus Point breaks working when maximized*, on by default).
- True fullscreen (F11) is off unless you turn it on, and Settings warns that it delays Focus Point breaks.
- The tray icon, daily reminder and start-with-Windows are all **off by default**. Focus Point already owns that slot.

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
| `npm run icons` | Redraws the app and tray icons |
| `npm run dist` | Builds the Windows installer into `dist/` |

Set `MIND_GYM_DATA_DIR` to keep data somewhere other than `%APPDATA%/Mind Gym` while developing.

## Adding keywords

Keywords live in `data/keywords/<domain>.txt`, one per line:

```
id | Term | alias; alias | tag, tag | difficulty 1-5 | related-id, related-id | Wikipedia title (optional)
entropy | Entropy | second law of thermodynamics | thermodynamics | 3 | maxwells-demon, arrow-of-time |
```

Then run `npm run keywords:build`. The build fails on duplicate ids, duplicate Wikipedia titles, related ids that don't exist, and empty domains. Wikidata IDs aren't typed by hand; a verification script will fill them from Wikipedia in Phase 2.

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
| Focus Point coexistence ("safe maximize", opt-in fullscreen) | `src/main/window-guard.js` |
| Auto-updates (electron-updater + GitHub Releases) | `src/main/updater.js` |
| Seeded random numbers and seed codes (shared by main and games) | `src/shared/rng.js` |
| The game contract | `src/shared/game-contract.js` |
| Game shell: intro, level picker, pause, results | `src/renderer/views/play.js` |
| Games (pure logic in `logic.js`, UI in `index.js`) | `src/renderer/games/*/` |
| Views: home, Daily Mix, games, keywords, stats, settings | `src/renderer/views/` |

The renderer is plain JavaScript modules with no framework and no bundler. Games load on demand. Pages run with `contextIsolation`, `sandbox`, no Node access, and a strict Content Security Policy. The renderer can't reach the network at all; external links open in your browser, and only for a short list of known sites.

## License

MIT. Word list from [an-array-of-english-words](https://www.npmjs.com/package/an-array-of-english-words) (MIT). Theme colours shared with Focus Point.
