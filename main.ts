// A working gta6-trophy-guide-01 entry (Node 22, standard library only): the guide is this directory's app/ folder,
// plain static files a browser opens at app/index.html (ES modules, CSS, no build step), offline: it loads nothing
// over the network, and its trophy list and guides are app/data/trophies.json. The program hands it in: it copies app/
// and screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the judge reads (your
// screenshots, the first load's files and bytes, and your source), with the vendored make.fun library. Leave
// vendor/makefun-frontend.ts as it is: the scorer requires dossier.json to be byte for byte what its own copy writes.
//
// This entry is the Leonida Trophy Guide: a tracker and cited guide for all 55 GTA VI PS5 trophies (roadmap to the
// platinum, missable flags, filters by kind, spoiler setting, export/import), in app/; screenshots/ holds 4 real
// renders of it taken with headless Chromium (shots.json says which views); shoot.mjs takes them and exercises the
// tracker. After writing the dossier, main.ts verifies its own output and prints a summary, so a bad hand-in fails
// loudly instead of shipping silently.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files and directories in app/ or
// 48 MiB of app files: app/ counts beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
const dossier = buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, app_max_files: 993, app_max_bytes: 50331648 });
writeFileSync(join(out, 'dossier.json'), dossier);

// Verify the hand-in before reporting success: the gate refuses an entry with
// fewer than 3 or more than 4 screenshots, a screenshot over 256 KiB, or a
// dossier over 1.5 MiB, so fail loudly here instead of shipping a bad entry.
const shots = readdirSync(join(out, 'screenshots')).filter((f) => !f.startsWith('.')).sort();
if (shots.length < 3 || shots.length > 4) throw new Error(`expected 3-4 screenshots, found ${shots.length}`);
for (const shot of shots) {
  const size = statSync(join(out, 'screenshots', shot)).size;
  if (size > 262144) throw new Error(`screenshot ${shot} is ${size} bytes, over the 256 KiB cap`);
}
const dossierBytes = statSync(join(out, 'dossier.json')).size;
if (dossierBytes > 1572864) throw new Error(`dossier.json is ${dossierBytes} bytes, over the 1.5 MiB cap`);
const trophies = JSON.parse(readFileSync(join(out, 'app/data/trophies.json'), 'utf8'));
const guided = trophies.trophies.filter((t) => typeof t.guide === 'string' && t.guide.trim()).length;
if (trophies.trophies.length !== 55 || guided !== 55) throw new Error(`expected 55 trophies with guides, found ${trophies.trophies.length} / ${guided}`);
console.log(`handed in: ${shots.length} screenshots (${shots.join(', ')}), dossier.json ${dossierBytes} bytes, ${guided}/55 trophies with guides`);
