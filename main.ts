// A working gta6-trophy-guide-01 entry (Node 22, standard library only): the guide is
// this directory's app/ folder, plain static files a browser opens at app/index.html
// (ES modules, CSS, no build step), offline: it loads nothing over the network, and its
// trophy list and guides are app/data/trophies.json. The program hands it in: it copies
// app/ and screenshots/ from beside this file to /output and writes /output/dossier.json,
// the summary the judge reads (your screenshots, the first load's files and bytes, and
// your source), with the vendored make.fun library. Leave vendor/makefun-frontend.ts as
// it is: the scorer requires dossier.json to be byte for byte what its own copy writes.
//
// This entry is the Leonida Trophy Guide: a tracker and cited guide for all 55 GTA VI PS5
// trophies (roadmap to the platinum, missable flags, a Next-up planner, per-stage progress,
// filters by kind, spoiler setting, export/import), in app/; screenshots/ holds 4 real
// renders of it taken with headless Chromium (shots.json says which views); shoot.mjs
// takes them and exercises the tracker. After writing the dossier, main.ts verifies its
// own output and prints a summary, so a bad hand-in fails loudly instead of shipping
// silently.
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

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the
// others refuse an entry the scorer would refuse (more than 4 screenshots or one over
// 256 KiB; more than 993 files and directories in app/ or 48 MiB of app files: app/
// counts beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
const dossier = buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, app_max_files: 993, app_max_bytes: 50331648 });
writeFileSync(join(out, 'dossier.json'), dossier);

// Read a JPEG's dimensions from its SOF0/SOF2 marker, without any dependency.
function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('not a JPEG');
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) throw new Error('bad JPEG marker');
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  throw new Error('no JPEG frame found');
}

function fail(msg) {
  throw new Error(`hand-in check failed: ${msg}`);
}

// Verify the hand-in before reporting success: the gate refuses an entry with
// fewer than 3 or more than 4 screenshots, a screenshot over 256 KiB or with the wrong
// dimensions, or a dossier over 1.5 MiB, so fail loudly here instead of shipping a bad
// entry. The trophy file is checked too: 55 trophies, unique ids and names, every guide
// non-blank, every trophy with at least one named source, and exactly the 4 trophies
// no guide had confirmed by 19 Nov 2026 flagged unconfirmed.
const shots = readdirSync(join(out, 'screenshots')).filter((f) => !f.startsWith('.')).sort();
if (shots.length < 3 || shots.length > 4) fail(`expected 3-4 screenshots, found ${shots.length}`);
for (const shot of shots) {
  const path = join(out, 'screenshots', shot);
  const size = statSync(path).size;
  if (size > 262144) fail(`screenshot ${shot} is ${size} bytes, over the 256 KiB cap`);
  const { width, height } = jpegSize(readFileSync(path));
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  if (long > 1280 || short < 480) fail(`screenshot ${shot} is ${width}x${height}, outside the 1280 long / 480 short limits`);
}
const dossierBytes = statSync(join(out, 'dossier.json')).size;
if (dossierBytes > 1572864) fail(`dossier.json is ${dossierBytes} bytes, over the 1.5 MiB cap`);
const trophies = JSON.parse(readFileSync(join(out, 'app/data/trophies.json'), 'utf8')).trophies;
if (trophies.length !== 55) fail(`expected 55 trophies, found ${trophies.length}`);
const ids = new Set();
const names = new Set();
const knownKinds = new Set(['story', 'missable', 'collectibles', 'activities']);
let guided = 0;
let sourced = 0;
const unconfirmed = [];
for (const t of trophies) {
  if (ids.has(t.id)) fail(`duplicate trophy id ${t.id}`);
  if (names.has(t.name)) fail(`duplicate trophy name ${t.name}`);
  ids.add(t.id);
  names.add(t.name);
  if (typeof t.guide === 'string' && t.guide.trim()) guided++;
  if (Array.isArray(t.sources) && t.sources.length > 0 && t.sources.every((s) => typeof s.name === 'string' && s.name)) sourced++;
  if (!Number.isInteger(t.stage) || t.stage < 1 || t.stage > 4) fail(`trophy ${t.name} has stage ${t.stage}`);
  for (const k of t.kinds ?? []) if (!knownKinds.has(k)) fail(`trophy ${t.name} has unknown kind ${k}`);
  if (t.unconfirmed) unconfirmed.push(t.name);
}
if (guided !== 55) fail(`expected 55 trophies with guides, found ${guided}`);
if (sourced !== 55) fail(`expected 55 trophies with a named source, found ${sourced}`);
if (unconfirmed.length !== 4) fail(`expected 4 unconfirmed trophies, found ${unconfirmed.length}: ${unconfirmed.join(', ')}`);
const missable = trophies.filter((t) => t.missable).map((t) => t.name);
if (missable.length !== 1) fail(`expected exactly 1 missable trophy, found ${missable.length}: ${missable.join(', ')}`);
const stageTotals = { 1: 0, 2: 0, 3: 0, 4: 0 };
for (const t of trophies) stageTotals[t.stage]++;
const expectedStages = { 1: 13, 2: 28, 3: 13, 4: 1 };
for (const s of [1, 2, 3, 4]) {
  if (stageTotals[s] !== expectedStages[s]) fail(`stage ${s} has ${stageTotals[s]} trophies, expected ${expectedStages[s]}`);
}
console.log(`handed in: ${shots.length} screenshots (${shots.join(', ')}), dossier.json ${dossierBytes} bytes, ${guided}/55 trophies with guides, ${sourced}/55 with sources, unconfirmed: ${unconfirmed.join(', ')}, missable: ${missable.join(', ')}, stages 13/28/13/1`);
