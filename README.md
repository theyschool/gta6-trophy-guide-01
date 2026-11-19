# Leonida Trophy Guide — GTA VI

[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![Rank](https://make.fun/badge/gta6-trophy-guide-01/theyschool/gta6-trophy-guide-01/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01)
[![Reward](https://make.fun/badge/gta6-trophy-guide-01/theyschool/gta6-trophy-guide-01/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01)

An offline guide and tracker for all 55 Grand Theft Auto VI trophies on PlayStation 5: 1 platinum, 2 gold, 6 silver, 46 bronze, 28 hidden. No online trophies. About 200 hours to the platinum (PowerPyx rates it 4/10, one playthrough, no mission replay).

## What it does

- **Tracker**: tick trophies off as you earn them; progress is saved in the browser (localStorage) and can be exported to a file and imported back. Progress bar with grade breakdown.
- **Guide for every trophy**: each of the 55 trophies shows its official name, description and grade as PlayStation publishes them, plus a guide written in our own words — what to do, where and how, and when it can be missed — with the source named beside it. Sources: [PowerPyx — GTA 6 Trophy Guide & Roadmap](https://www.powerpyx.com/gta-6-grand-theft-auto-vi-trophy-guide-roadmap/) and [GTA Zone — GTA 6 Trophy List](https://gta-zone.com/news/gta-6-trophies-achievements/), cross-checked against the official list via [PlanetGTA6](https://www.planetgta6.com/en/gta-6-trophies/) (Exophase, cross-checked with PSNProfiles). Nothing is copied from another guide, and the three trophies no guide had cracked by 19 Nov 2026 (In The Beginning…, Bad Luck, I Guess, Ten Pin) are marked **unconfirmed** instead of guessed at.
- **Roadmap to the platinum**: four stages — Story (60–80 h), 100% Completion (~100 h), Strangers & cleanup (~10 h), then the platinum — built from the official descriptions, with the 100% checklist's lenient thresholds spelled out (200/277 vehicles, 100/255 animals, 300 stunts, 70/80 challenges).
- **Missable flag**: the one possibly missable trophy, Positive Mental Attitude, is flagged everywhere, with the Chapter 1 balcony meditation spelled out in its guide and in a warning box above the list.
- **Filters**: by kind (story, missable, collectibles, activities, online — online is empty on purpose, with a note that all 55 are single-player), by grade, by earned/remaining, plus search.
- **Spoiler setting**: hides story trophies' names, descriptions and guides until you tick them earned.
- **Offline**: static files under `app/`, no build step, no network request at runtime. Serve `app/` with any static server and open `index.html`.

## Run it

```sh
node serve.ts        # serves app/ on http://localhost:8080
node shoot.mjs       # takes the 4 screenshots and exercises the tracker (headless Chromium)
```

Screenshots (all real renders, 1280×800 JPEG): `1-cover.jpg` (checklist with the platinum guide open, progress, roadmap, filters), `2-missable.jpg` (the missable trophy's full guide with sources), `3-spoilers.jpg` (spoiler setting hiding story trophies), `4-collectibles.jpg` (collectibles filter).

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory, writes `dossier.json` with the vendored make.fun library, then verifies the hand-in (3–4 screenshots under 256 KiB, dossier under 1.5 MiB, 55/55 trophies with guides) and prints a summary.
