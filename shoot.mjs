// Dev tooling (not part of the entry): take the 4 screenshots in shots.json with
// headless Chromium, and exercise the tracker (check, persist, export, import,
// filters, spoiler toggle, sort, Next-up planner, stage progress, unconfirmed tag).
// Serves app/ via serve.ts on localhost:8080.
// Usage: node shoot.mjs   (run from this repo's root)
import { chromium } from 'playwright-core';
import { execSync, spawn } from 'node:child_process';
import { readFileSync, statSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:8080';
const trophies = JSON.parse(readFileSync(join(ROOT, 'app/data/trophies.json'), 'utf8')).trophies;
const shots = JSON.parse(readFileSync(join(ROOT, 'shots.json'), 'utf8'));
const nameOf = (id) => trophies.find((t) => t.id === id).name;

const server = spawn('node', ['serve.ts'], { cwd: ROOT, stdio: 'ignore' });
async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(BASE + '/index.html');
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('serve.ts did not come up');
}

const exe = execSync("ls -d ~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome | head -1", { encoding: 'utf8' }).trim();
console.log('chromium:', exe);
await waitForServer();
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const errors = [];
let failures = 0;

try {
  for (const shot of shots) {
    const page = await browser.newPage({ viewport: shot.viewport });
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${shot.file} console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`${shot.file} pageerror: ${e.message}`));
    const seedNames = (shot.seed ?? []).map(nameOf);
    await page.addInitScript((names) => {
      localStorage.setItem('gta6-trophy-progress-v1', JSON.stringify(names));
      localStorage.setItem('gta6-trophy-spoilers-v1', JSON.stringify(true));
    }, seedNames);
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__guideReady === true, null, { timeout: 15000 });
    if (shot.kind) await page.click(`#kindChips [data-kind="${shot.kind}"]`);
    if (shot.search) await page.fill('#search', shot.search);
    if (shot.scroll) await page.evaluate((y) => window.scrollTo(0, y), shot.scroll);
    if (shot.scrollToRow) await page.evaluate(() => { document.querySelector('.trophy')?.scrollIntoView({ block: 'center' }); });
    await page.waitForTimeout(300);
    const path = join(ROOT, 'screenshots', shot.file);
    await page.screenshot({ path, type: 'jpeg', quality: 86 });
    const size = statSync(path).size;
    const rows = await page.locator('.trophy').count();
    console.log(shot.file, `${size} bytes`, `${rows} rows shown`);
    if (size > 262144) { console.log('  FAIL: over 256 KiB'); failures++; }
    await page.close();
  }

  // Functional checks on a fresh page.
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`check console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`check pageerror: ${e.message}`));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__guideReady === true, null, { timeout: 15000 });
  const check = async (label, ok) => { console.log(ok ? `  ok: ${label}` : `  FAIL: ${label}`); if (!ok) failures++; };

  await check('55 rows render', (await page.locator('.trophy').count()) === 55);
  await check('progress starts 0 / 55', (await page.locator('#progressCount').innerText()) === '0 / 55');
  // Next-up planner: with nothing earned, the missable trophy comes first.
  await check('next-up names the missable trophy', (await page.locator('#nextUpName').innerText()) === 'Positive Mental Attitude');
  await check('next-up reason mentions Chapter 1', (await page.locator('#nextUpWhy').innerText()).includes('Chapter 1'));
  // Stage progress starts at zero everywhere.
  await check('stage 1 shows 0/13', (await page.locator('#stageCount1').innerText()) === '0/13 earned');
  await check('stage 2 shows 0/28', (await page.locator('#stageCount2').innerText()) === '0/28 earned');
  // Tick the first trophy (Vice Got a Price!) and confirm persistence across reload.
  await page.locator('.trophy input[type="checkbox"]').first().check();
  await check('progress becomes 1 / 55', (await page.locator('#progressCount').innerText()) === '1 / 55');
  await check('stage 4 shows 1/1 after ticking the platinum', (await page.locator('#stageCount4').innerText()) === '1/1 earned');
  await check('next-up still names the missable trophy after ticking the platinum', (await page.locator('#nextUpName').innerText()) === 'Positive Mental Attitude');
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__guideReady === true, null, { timeout: 15000 });
  await check('tick persists after reload', (await page.locator('#progressCount').innerText()) === '1 / 55');
  // Next-up link jumps to the missable trophy's row.
  await page.click('#nextUpLink');
  await check('next-up link reveals the missable row', (await page.locator('#trophyList [data-trophy-id="28"]').count()) === 1);
  // Export: capture the download and check its content.
  const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
  await page.click('#exportBtn');
  const dl = await downloadPromise;
  const dlPath = join(ROOT, 'export-check.json');
  await dl.saveAs(dlPath);
  const exported = JSON.parse(readFileSync(dlPath, 'utf8'));
  await check('export contains the ticked trophy', exported.earned.includes('Vice Got a Price!'));
  unlinkSync(dlPath);
  // Reset, then import the same payload back.
  page.on('dialog', (d) => d.accept());
  await page.click('#resetBtn');
  await check('reset clears progress', (await page.locator('#progressCount').innerText()) === '0 / 55');
  const importPath = join(ROOT, 'import-check.json');
  writeFileSync(importPath, JSON.stringify({ app: 'leonida-trophy-guide', version: 1, earned: ['Vice Got a Price!', 'A Long Road', 'Cunning Stunts'] }));
  await page.setInputFiles('#importFile', importPath);
  await page.waitForTimeout(300);
  await check('import restores 3 earned', (await page.locator('#progressCount').innerText()) === '3 / 55');
  unlinkSync(importPath);
  // Sort: by name the first row is A Classic Blitz Play; by grade the platinum leads.
  await page.selectOption('#sortOrder', 'name');
  await check('sort by name puts A Classic Blitz Play first', (await page.locator('.trophy-name').first().innerText()) === 'A Classic Blitz Play');
  await page.selectOption('#sortOrder', 'grade');
  await check('sort by grade puts the platinum first', (await page.locator('.trophy-name').first().innerText()) === 'Vice Got a Price!');
  await page.selectOption('#sortOrder', 'roadmap');
  // Filters.
  await page.click('#kindChips [data-kind="missable"]');
  await check('missable filter shows exactly 1 row', (await page.locator('.trophy').count()) === 1);
  await check('missable row is Positive Mental Attitude', (await page.locator('.trophy-name').first().innerText()) === 'Positive Mental Attitude');
  await page.click('#kindChips [data-kind="online"]');
  await check('online filter shows the no-online note', await page.locator('#onlineNote').isVisible());
  await page.click('#kindChips [data-kind="all"]');
  // Spoiler toggle: story rows hidden while on, revealed when off.
  await page.click('#kindChips [data-kind="story"]');
  const hiddenCount = await page.locator('.spoiler-hidden').count();
  await check('spoiler on hides un-earned story trophies', hiddenCount === 12);
  await page.locator('#spoilerToggle').uncheck();
  await check('spoiler off reveals them', (await page.locator('.spoiler-hidden').count()) === 0);
  // Search.
  await page.click('#kindChips [data-kind="all"]');
  await page.fill('#search', 'balcony');
  await check('search finds the meditation trophy', (await page.locator('.trophy').count()) === 1);
  // Unconfirmed tag: searching for Ten Pin shows exactly its row, tagged.
  await page.fill('#search', 'Ten Pin');
  await check('search finds Ten Pin', (await page.locator('.trophy').count()) === 1);
  await check('Ten Pin carries the Unconfirmed tag', (await page.locator('.tag.unconfirmed').count()) === 1);
  await page.close();
} finally {
  await browser.close();
  server.kill();
}

if (errors.length) { console.log('ERRORS:'); for (const e of errors) console.log(' ', e); failures += errors.length; }
console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
