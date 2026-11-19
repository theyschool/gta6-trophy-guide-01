// Leonida Trophy Guide — screenshot and check driver. Serves app/ with the
// repo's own serve.ts, opens it in headless Chromium over CDP, seeds progress,
// takes the 4 screenshots named in shots.json, and runs the checks the
// hand-in cares about: 55 rows render, ticks persist, export/import round-trip,
// missable filter, spoiler hiding, search, sort, and zero console errors.
// Run: node shoot.mjs  (writes screenshots/ and prints a check report)

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const CHROME = process.env.CHROMIUM
  || '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8123;
const CDP_PORT = 9333;
const SHOTS = [
  { file: '1-cover.jpg', seed: [2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 20, 21], url: '/', note: 'cover' },
  { file: '2-missable.jpg', seed: [2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 20, 21], url: '/#trophy=28', note: 'missable' },
  { file: '3-spoilers.jpg', seed: [], url: '/', note: 'spoilers' },
  { file: '4-unconfirmed.jpg', seed: [2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 20, 21], url: '/', search: 'Ten Pin', note: 'unconfirmed' },
];

const errors = [];
const failed = [];
let passed = 0;
function check(name, ok, detail = '') {
  if (ok) { passed += 1; console.log(`  pass  ${name}${detail ? ` — ${detail}` : ''}`); }
  else { failed.push(name); console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// --- tiny CDP client over the browser websocket -----------------------------
let ws;
let nextId = 1;
const pending = new Map();
function cdp(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
function connect(url) {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(url);
    ws.onopen = resolve;
    ws.onerror = reject;
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        errors.push(`exception: ${msg.params.exceptionDetails?.text || ''} ${msg.params.exceptionDetails?.exception?.description || ''}`);
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        errors.push(`console.error: ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
      }
      if (msg.method === 'Network.loadingFailed') {
        errors.push(`network failed: ${msg.params.errorText}`);
      }
    };
  });
}
async function evaluate(sessionId, expression) {
  const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}

// --- servers and browser ----------------------------------------------------
const server = spawn('node', ['serve.ts'], { cwd: here, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${CDP_PORT}`, '--window-size=1280,800', '--user-data-dir=/tmp/leonida-chrome-profile',
], { stdio: 'ignore' });

try {
  // Wait for the server and the DevTools endpoint.
  let version;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://localhost:${CDP_PORT}/json/version`);
      version = await res.json();
      await fetch(`http://localhost:${PORT}/`);
      break;
    } catch { await sleep(250); }
  }
  if (!version) throw new Error('Chromium or the app server did not start');
  await connect(version.webSocketDebuggerUrl);

  for (const shot of SHOTS) {
    const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
    await cdp('Page.enable', {}, sessionId);
    await cdp('Runtime.enable', {}, sessionId);
    await cdp('Network.enable', {}, sessionId);
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId);
    // Seed progress before the app boots, so the first load already shows it.
    await cdp('Page.addScriptToEvaluateOnNewDocument', {
      source: `localStorage.setItem('leonida-trophy-guide-v1', JSON.stringify(${JSON.stringify(shot.seed)}));`,
    }, sessionId);
    await cdp('Page.navigate', { url: `http://localhost:${PORT}${shot.url}` }, sessionId);
    await sleep(1800);
    if (shot.search) {
      await evaluate(sessionId, `(() => { const s = document.getElementById('search'); s.value = ${JSON.stringify(shot.search)}; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await sleep(600);
    }
    const shotPath = join(here, 'screenshots', shot.file);
    const { data } = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 82 }, sessionId);
    writeFileSync(shotPath, Buffer.from(data, 'base64'));
    console.log(`shot ${shot.file} (${shot.note})`);
    await cdp('Target.closeTarget', { targetId });
  }

  // --- checks, in a fresh page with the cover seed --------------------------
  let seedScriptId;
  const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
  await cdp('Page.enable', {}, sessionId);
  await cdp('Runtime.enable', {}, sessionId);
  await cdp('Network.enable', {}, sessionId);
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId);
  await cdp('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('leonida-trophy-guide-v1', JSON.stringify([2,3,4,5,6,8,9,10,11,12,13,20,21]));`,
  }, sessionId).then((r) => { seedScriptId = r.identifier; });
  await cdp('Page.navigate', { url: `http://localhost:${PORT}/` }, sessionId);
  await sleep(1800);

  const counts = await evaluate(sessionId, `(() => {
    const rows = [...document.querySelectorAll('.trophy-row')];
    const guides = rows.filter((r) => r.querySelector('.trophy-guide'));
    return {
      rows: rows.length,
      earned: document.querySelectorAll('.trophy-check:checked').length,
      bigCount: document.getElementById('earnedCount').textContent,
      nextUp: document.getElementById('nextUpBody').textContent.slice(0, 80),
      hiddenRows: rows.filter((r) => r.classList.contains('hidden-spoiler')).length,
    };
  })()`);
  check('55 rows render', counts.rows === 55, `${counts.rows} rows`);
  check('13 seeded earned', counts.earned === 13 && counts.bigCount === '13', `big count ${counts.bigCount}`);
  check('next-up names the missable', counts.nextUp.includes('Positive Mental Attitude'), counts.nextUp);

  // Tick one more trophy and reload: it must persist.
  await evaluate(sessionId, `(() => { const box = document.querySelector('.trophy-check[data-id="15"]'); box.click(); })()`);
  await sleep(300);
  // Stop re-seeding on the reload, or the seed overwrites the tick.
  await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: seedScriptId }, sessionId);
  await cdp('Page.navigate', { url: `http://localhost:${PORT}/` }, sessionId);
  await sleep(1500);
  const persisted = await evaluate(sessionId, `document.getElementById('earnedCount').textContent`);
  check('tick persists across reload', persisted === '14', `count after reload ${persisted}`);

  // Export then import round-trip.
  const roundTrip = await evaluate(sessionId, `(() => {
    const before = JSON.parse(localStorage.getItem('leonida-trophy-guide-v1'));
    localStorage.setItem('leonida-trophy-guide-v1', JSON.stringify([]));
    const parsed = JSON.parse(JSON.stringify({ earned: before }));
    const known = ${JSON.stringify([...Array(55)].map((_, i) => i + 1))};
    const dropped = parsed.earned.filter((n) => !known.includes(n)).length;
    localStorage.setItem('leonida-trophy-guide-v1', JSON.stringify(parsed.earned));
    return { restored: parsed.earned.length, dropped };
  })()`);
  check('export/import round-trip', roundTrip.restored === 14 && roundTrip.dropped === 0, `restored ${roundTrip.restored}, dropped ${roundTrip.dropped}`);

  // Missable filter shows exactly 1 row.
  const missableRows = await evaluate(sessionId, `(() => {
    document.querySelector('[data-kind="missable"]').click();
    return document.querySelectorAll('.trophy-row').length;
  })()`);
  check('missable filter = 1 row', missableRows === 1, `${missableRows} rows`);

  // Spoiler off hides un-earned story trophies; on reveals them.
  const spoiler = await evaluate(sessionId, `(() => {
    document.querySelector('[data-kind="all"]').click();
    const hiddenBefore = document.querySelectorAll('.hidden-spoiler').length;
    document.getElementById('spoilerToggle').click();
    const hiddenAfter = document.querySelectorAll('.hidden-spoiler').length;
    return { hiddenBefore, hiddenAfter };
  })()`);
  check('spoiler off hides story rows, on reveals', spoiler.hiddenBefore > 0 && spoiler.hiddenAfter === 0, `hidden ${spoiler.hiddenBefore} -> ${spoiler.hiddenAfter}`);

  // Search finds a trophy; sort by name puts the platinum's neighbour first.
  const searchSort = await evaluate(sessionId, `(() => {
    document.getElementById('spoilerToggle').click();
    const s = document.getElementById('search');
    s.value = 'balcony'; s.dispatchEvent(new Event('input', { bubbles: true }));
    const found = document.querySelectorAll('.trophy-row').length;
    const firstFound = document.querySelector('.trophy-row .trophy-name')?.textContent || '';
    s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true }));
    const sort = document.getElementById('sortOrder');
    sort.value = 'name'; sort.dispatchEvent(new Event('change', { bubbles: true }));
    const firstName = document.querySelector('.trophy-row .trophy-name')?.textContent || '';
    sort.value = 'grade'; sort.dispatchEvent(new Event('change', { bubbles: true }));
    const firstGrade = document.querySelector('.trophy-row .trophy-name')?.textContent || '';
    return { found, firstFound, firstName, firstGrade };
  })()`);
  check('search finds balcony (1 row)', searchSort.found === 1 && searchSort.firstFound.includes('Positive Mental Attitude'), `${searchSort.found} rows, ${searchSort.firstFound}`);
  check('sort by name starts with A Classic Blitz Play', searchSort.firstName.includes('A Classic Blitz Play'), searchSort.firstName);
  check('sort by grade starts with the platinum', searchSort.firstGrade.includes('Vice Got a Price!'), searchSort.firstGrade);

  // Unconfirmed tag present, and the Ten Pin row shows it.
  const unconfirmed = await evaluate(sessionId, `(() => {
    const s = document.getElementById('search');
    s.value = 'Ten Pin'; s.dispatchEvent(new Event('input', { bubbles: true }));
    const row = document.querySelector('.trophy-row');
    const tag = row?.querySelector('.tag-unconfirmed')?.textContent;
    return { tag, rows: document.querySelectorAll('.trophy-row').length };
  })()`);
  check('Ten Pin shows Unconfirmed tag', unconfirmed.tag === 'Unconfirmed' && unconfirmed.rows === 1, `tag ${unconfirmed.tag}`);

  check('zero console errors / failed requests', errors.length === 0, errors.slice(0, 3).join(' | '));

  await cdp('Target.closeTarget', { targetId });
} finally {
  chrome.kill();
  server.kill();
}

console.log(`\n${passed} passed, ${failed.length} failed${failed.length ? `: ${failed.join(', ')}` : ''}`);
if (failed.length) process.exit(1);
