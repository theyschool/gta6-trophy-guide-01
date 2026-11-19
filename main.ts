// Leonida Trophy Guide — the hand-in program (Node 22, standard library only).
// It copies app/ and screenshots/ from beside this file to /output (or
// MAKEFUN_OUTPUT_DIR outside the grader) and writes /output/dossier.json with
// the vendored make.fun library. Before it copies anything it verifies its own
// hand-in: the trophy file names every one of the 55 official trophies with a
// guide and a named source, and every screenshot is a whole JPEG inside the
// gate's size limits. Run it as: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const appDir = join(here, 'app');
const shotsDir = join(here, 'screenshots');

const EXPECTED = { total: 55, platinum: 1, gold: 2, silver: 6, bronze: 46, hidden: 28, missable: 1 };

function fail(message) {
  throw new Error(`hand-in refused: ${message}`);
}

// --- the trophy file -------------------------------------------------------
const raw = readFileSync(join(appDir, 'data', 'trophies.json'), 'utf8');
let data;
try {
  data = JSON.parse(raw);
} catch {
  fail('app/data/trophies.json is not valid JSON');
}
const trophies = Array.isArray(data) ? data : data.trophies;
if (!Array.isArray(trophies)) fail('app/data/trophies.json holds no trophies array');
if (trophies.length !== EXPECTED.total) fail(`trophies.json holds ${trophies.length} trophies, expected ${EXPECTED.total}`);

const ids = new Set();
const names = new Set();
const grades = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
let hidden = 0;
let missable = 0;
for (const t of trophies) {
  if (!Number.isInteger(t.id) || ids.has(t.id)) fail(`trophy id ${t.id} is missing or repeated`);
  ids.add(t.id);
  if (typeof t.name !== 'string' || !t.name.trim() || names.has(t.name)) fail(`trophy name ${JSON.stringify(t.name)} is missing or repeated`);
  names.add(t.name);
  if (!Object.hasOwn(grades, t.grade)) fail(`${t.name} has grade ${JSON.stringify(t.grade)}`);
  grades[t.grade] += 1;
  if (t.hidden) hidden += 1;
  if (t.missable) missable += 1;
  if (typeof t.guide !== 'string' || !t.guide.trim()) fail(`${t.name} has no guide`);
  if (!Array.isArray(t.sources) || !t.sources.length || !t.sources.every((s) => typeof s === 'string' && s.trim())) {
    fail(`${t.name} names no source for its guide`);
  }
  // The guide must be written in our own words, not a copy of the official text.
  if (typeof t.description === 'string' && t.description.trim() && t.guide.trim() === t.description.trim()) {
    fail(`${t.name}'s guide repeats its official description word for word`);
  }
  // An unconfirmed trophy must say so in its guide, not just carry the flag.
  if (t.unconfirmed && !/unconfirmed/i.test(t.guide)) fail(`${t.name} is flagged unconfirmed but its guide never says so`);
  if (!Number.isInteger(t.stage) || t.stage < 1 || t.stage > 4) fail(`${t.name} has stage ${t.stage}, expected 1-4`);
  if (!Array.isArray(t.kinds) || !t.kinds.length) fail(`${t.name} names no kind`);
}
for (const [grade, want] of Object.entries({ platinum: EXPECTED.platinum, gold: EXPECTED.gold, silver: EXPECTED.silver, bronze: EXPECTED.bronze })) {
  if (grades[grade] !== want) fail(`${grades[grade]} ${grade} trophies, expected ${want}`);
}
if (hidden !== EXPECTED.hidden) fail(`${hidden} hidden trophies, expected ${EXPECTED.hidden}`);
if (missable !== EXPECTED.missable) fail(`${missable} missable trophies, expected ${EXPECTED.missable}`);

// --- the screenshots -------------------------------------------------------
if (!existsSync(shotsDir)) fail('screenshots/ is missing');
const shots = readdirSync(shotsDir).filter((n) => !n.startsWith('.')).sort();
if (shots.length < 3 || shots.length > 4) fail(`screenshots/ holds ${shots.length} images, expected 3 or 4`);
for (const name of shots) {
  const path = join(shotsDir, name);
  if (!statSync(path).isFile()) fail(`screenshots/${name} is not a regular file`);
  const bytes = readFileSync(path);
  if (bytes.length > 262144) fail(`screenshots/${name} is ${bytes.length} bytes, over the 256 KiB cap`);
  if (bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== 0xd8) fail(`screenshots/${name} is not a JPEG`);
  const { width, height } = jpegSize(bytes, name);
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  if (long > 1280) fail(`screenshots/${name} is ${width}x${height}, long side over 1280`);
  if (short < 480) fail(`screenshots/${name} is ${width}x${height}, short side under 480`);
}

// Reads a JPEG's dimensions from its SOF0/SOF2 marker, without decoding it.
function jpegSize(bytes, name) {
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) fail(`screenshots/${name} is not a well-formed JPEG`);
    const marker = bytes[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = bytes.readUInt16BE(i + 2);
    if (marker === 0xc0 || marker === 0xc2) {
      return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  fail(`screenshots/${name} has no size marker`);
}

// --- the hand-in -----------------------------------------------------------
mkdirSync(out, { recursive: true });
cpSync(appDir, join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, app_max_files: 993, app_max_bytes: 50331648 }),
);
const dossier = JSON.parse(readFileSync(join(out, 'dossier.json'), 'utf8'));
console.log(`handed in: ${shots.length} screenshots, dossier.json ${statSync(join(out, 'dossier.json')).size} bytes, ${trophies.length}/${EXPECTED.total} trophies with guides, ${trophies.filter((t) => t.sources.length).length}/${EXPECTED.total} with sources, unconfirmed: ${trophies.filter((t) => t.unconfirmed).map((t) => t.name).join(', ')}, missable: ${trophies.filter((t) => t.missable).map((t) => t.name).join(', ')}, stages ${[1, 2, 3, 4].map((s) => trophies.filter((t) => t.stage === s).length).join('/')}`);
