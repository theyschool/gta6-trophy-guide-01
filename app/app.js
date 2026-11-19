// Leonida Trophy Guide — tracker for the 55 GTA VI PS5 trophies.
// Checklist saved in localStorage, export/import as JSON, filters by kind,
// grade and status, search, sort, a spoiler setting, a Next-up planner and
// per-stage progress. Runs fully offline: the only fetch is the app's own
// data/trophies.json.
const PROGRESS_KEY = 'gta6-trophy-progress-v1';
const SPOILER_KEY = 'gta6-trophy-spoilers-v1';
const SORT_KEY = 'gta6-trophy-sort-v1';

const GRADE_RANK = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
const STAGE_NAMES = { 1: 'Stage 1 · Story', 2: 'Stage 2 · 100%', 3: 'Stage 3 · Cleanup', 4: 'Platinum' };
const KIND_NAMES = { story: 'Story', missable: 'Missable', collectibles: 'Collectibles', activities: 'Activities' };

const listEl = document.getElementById('trophyList');
const searchEl = document.getElementById('search');
const gradeEl = document.getElementById('gradeFilter');
const statusEl = document.getElementById('statusFilter');
const sortEl = document.getElementById('sortOrder');
const spoilerEl = document.getElementById('spoilerToggle');
const noteEl = document.getElementById('controlsNote');
const countEl = document.getElementById('resultCount');
const onlineNoteEl = document.getElementById('onlineNote');
const nextUpEl = document.getElementById('nextUp');
const nextUpNameEl = document.getElementById('nextUpName');
const nextUpWhyEl = document.getElementById('nextUpWhy');
const nextUpLinkEl = document.getElementById('nextUpLink');

let data;
let got = new Set();
let kindFilter = 'all';
let sortOrder = 'roadmap';

function loadSaved() {
  try { got = new Set(JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '[]')); } catch { got = new Set(); }
  try { spoilerEl.checked = JSON.parse(localStorage.getItem(SPOILER_KEY) ?? 'true'); } catch { spoilerEl.checked = true; }
  try { sortOrder = localStorage.getItem(SORT_KEY) ?? 'roadmap'; } catch { sortOrder = 'roadmap'; }
  if (!['roadmap', 'name', 'grade', 'stage'].includes(sortOrder)) sortOrder = 'roadmap';
  sortEl.value = sortOrder;
}

function persistGot() {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify([...got].sort()));
}

function persistSpoilers() {
  localStorage.setItem(SPOILER_KEY, JSON.stringify(spoilerEl.checked));
}

function persistSort() {
  try { localStorage.setItem(SORT_KEY, sortOrder); } catch { /* private mode */ }
}

function spoilerHidden(t) {
  return spoilerEl.checked && t.kinds.includes('story') && !got.has(t.name);
}

function passesFilters(t) {
  if (kindFilter === 'online') return false;
  if (kindFilter !== 'all' && !t.kinds.includes(kindFilter)) return false;
  if (gradeEl.value !== 'all' && t.grade !== gradeEl.value) return false;
  if (statusEl.value === 'earned' && !got.has(t.name)) return false;
  if (statusEl.value === 'remaining' && got.has(t.name)) return false;
  const q = searchEl.value.trim().toLowerCase();
  if (q && !(t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.guide.toLowerCase().includes(q))) return false;
  return true;
}

function orderRows(rows) {
  const copy = [...rows];
  if (sortOrder === 'name') copy.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortOrder === 'grade') copy.sort((a, b) => (GRADE_RANK[a.grade] - GRADE_RANK[b.grade]) || (a.id - b.id));
  else if (sortOrder === 'stage') copy.sort((a, b) => (a.stage - b.stage) || (a.id - b.id));
  else copy.sort((a, b) => a.id - b.id);
  return copy;
}

// The single best trophy to chase next: the one possibly missable trophy
// first, then the earliest roadmap stage, then the lowest list number.
function pickNextUp() {
  const left = data.trophies.filter((t) => !got.has(t.name));
  if (left.length === 0) return null;
  left.sort((a, b) => ((b.missable ? 1 : 0) - (a.missable ? 1 : 0)) || (a.stage - b.stage) || (a.id - b.id));
  return left[0];
}

function nextUpWhy(t) {
  if (t.missable) return 'The only possibly missable trophy — do the Chapter 1 balcony meditation before the chapter ends.';
  if (t.stage === 1) return 'Story trophy — earn it while playing through the story.';
  if (t.stage === 2) return 'Part of the 100% Completion checklist — work it after the credits.';
  if (t.stage === 3) return 'Cleanup after the story — Strangers & Freaks and the last secrets.';
  return 'The platinum — it pops when the other 54 are done.';
}

function stageCounts() {
  const counts = {};
  for (const t of data.trophies) {
    counts[t.stage] ??= { got: 0, total: 0 };
    counts[t.stage].total++;
    if (got.has(t.name)) counts[t.stage].got++;
  }
  return counts;
}

function paintProgress() {
  const total = data.trophies.length;
  const earned = data.trophies.filter((t) => got.has(t.name));
  const pct = Math.round((earned.length / total) * 100);
  document.getElementById('progressCount').textContent = `${earned.length} / ${total}`;
  document.getElementById('progressPct').textContent = `${pct}%`;
  document.getElementById('progressFill').style.width = `${pct}%`;
  const byGrade = (g) => earned.filter((t) => t.grade === g).length;
  document.getElementById('progressDetail').textContent =
    `${byGrade('platinum')} platinum · ${byGrade('gold')} gold · ${byGrade('silver')} silver · ${byGrade('bronze')} bronze earned`;
}

function paintStages() {
  const counts = stageCounts();
  for (const stage of [1, 2, 3, 4]) {
    const el = document.getElementById(`stageCount${stage}`);
    if (el && counts[stage]) el.textContent = `${counts[stage].got}/${counts[stage].total} earned`;
  }
}

function paintNextUp() {
  const next = pickNextUp();
  if (!next) {
    nextUpNameEl.textContent = 'Vice Got a Price!';
    nextUpWhyEl.textContent = 'All 54 others are done — the platinum is yours.';
    nextUpLinkEl.hidden = true;
    return;
  }
  nextUpNameEl.textContent = next.name;
  nextUpWhyEl.textContent = nextUpWhy(next);
  nextUpLinkEl.hidden = false;
  nextUpLinkEl.dataset.trophyId = String(next.id);
}

function tagEl(text, cls) {
  const s = document.createElement('span');
  s.className = `tag ${cls}`;
  s.textContent = text;
  return s;
}

function trophyRow(t) {
  const li = document.createElement('li');
  li.className = 'trophy' + (got.has(t.name) ? ' earned' : '') + (t.missable ? ' missable-flag' : '');
  li.dataset.trophyId = String(t.id);
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = got.has(t.name);
  box.setAttribute('aria-label', `Earned: ${t.name}`);
  box.addEventListener('change', () => {
    if (box.checked) got.add(t.name);
    else got.delete(t.name);
    persistGot();
    paintAll();
  });
  li.append(box);
  const body = document.createElement('div');
  const head = document.createElement('div');
  head.className = 'trophy-head';
  const badge = document.createElement('span');
  badge.className = `badge ${t.grade}`;
  badge.textContent = t.grade;
  head.append(badge);
  if (spoilerHidden(t)) {
    const hidden = document.createElement('span');
    hidden.className = 'spoiler-hidden';
    hidden.textContent = 'Hidden story trophy — tick it earned to reveal its name, description and guide.';
    body.append(head, hidden);
    li.append(body);
    return li;
  }
  const name = document.createElement('span');
  name.className = 'trophy-name';
  name.textContent = t.name;
  const desc = document.createElement('span');
  desc.className = 'trophy-desc';
  desc.textContent = `“${t.description}”`;
  head.append(name, desc);
  if (t.missable) head.append(tagEl('⚠ Possibly missable', 'missable'));
  if (t.unconfirmed) head.append(tagEl('Unconfirmed', 'unconfirmed'));
  if (t.hidden) head.append(tagEl('Hidden on PS5', 'hidden'));
  head.append(tagEl(STAGE_NAMES[t.stage] ?? `Stage ${t.stage}`, 'stage'));
  for (const k of t.kinds) {
    if (k === 'missable') continue;
    head.append(tagEl(KIND_NAMES[k] ?? k, ''));
  }
  const guide = document.createElement('p');
  guide.className = 'trophy-guide';
  guide.textContent = t.guide;
  const sources = document.createElement('p');
  sources.className = 'trophy-sources';
  sources.textContent = 'Sources: ';
  t.sources.forEach((s, i) => {
    if (i > 0) sources.append(document.createTextNode(' · '));
    if (s.url) {
      const a = document.createElement('a');
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = s.name;
      sources.append(a);
    } else {
      sources.append(document.createTextNode(s.name));
    }
  });
  body.append(head, guide, sources);
  li.append(body);
  return li;
}

function paintRows() {
  const visible = orderRows(data.trophies.filter(passesFilters));
  onlineNoteEl.hidden = kindFilter !== 'online';
  countEl.textContent = kindFilter === 'online'
    ? '0 trophies — the Online filter is empty on purpose: GTA VI has no online trophies.'
    : `Showing ${visible.length} of ${data.trophies.length} trophies` +
      (kindFilter !== 'all' ? ` · ${KIND_NAMES[kindFilter] ?? kindFilter}` : '') +
      (gradeEl.value !== 'all' ? ` · ${gradeEl.value}` : '') +
      (statusEl.value !== 'all' ? ` · ${statusEl.value}` : '') +
      (sortOrder !== 'roadmap' ? ` · sorted by ${sortOrder}` : '');
  listEl.replaceChildren();
  if (visible.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = kindFilter === 'online'
      ? 'Nothing here — every GTA VI trophy is earned in single-player.'
      : 'No trophies match these filters. Clear the search or pick another kind.';
    listEl.append(li);
    return;
  }
  for (const t of visible) listEl.append(trophyRow(t));
}

function paintAll() {
  paintProgress();
  paintStages();
  paintNextUp();
  paintRows();
}

function exportGot() {
  const payload = {
    app: 'leonida-trophy-guide',
    game: 'Grand Theft Auto VI',
    version: 1,
    exportedAt: new Date().toISOString(),
    earned: [...got].sort(),
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  a.download = 'gta6-trophy-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
  noteEl.textContent = `Exported ${got.size} earned trophies to gta6-trophy-progress.json.`;
}

async function importGot(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const names = Array.isArray(parsed) ? parsed : parsed.earned;
    if (!Array.isArray(names)) throw new Error('no earned list');
    const known = new Set(data.trophies.map((t) => t.name));
    const good = names.filter((n) => typeof n === 'string' && known.has(n));
    const bad = names.length - good.length;
    got = new Set(good);
    persistGot();
    paintAll();
    noteEl.textContent = `Imported ${good.length} earned trophies` + (bad ? ` (${bad} unknown names skipped).` : '.');
  } catch {
    noteEl.textContent = 'Import failed: that file is not a trophy-progress export from this guide.';
  }
}

// Show one trophy in the list: clear every filter that could hide it,
// then scroll to its row and flash it (used by the Next-up link and #trophy=).
function jumpToTrophy(id) {
  const t = data.trophies.find((x) => x.id === id);
  if (!t) return;
  kindFilter = 'all';
  searchEl.value = '';
  gradeEl.value = 'all';
  statusEl.value = 'all';
  for (const b of document.querySelectorAll('#kindChips .chip')) b.classList.toggle('active', b.dataset.kind === 'all');
  paintRows();
  const row = listEl.querySelector(`[data-trophy-id="${id}"]`);
  if (row) {
    row.scrollIntoView({ block: 'center' });
    row.style.outline = '2px solid var(--pink)';
    setTimeout(() => { row.style.outline = ''; }, 2500);
  }
}

document.getElementById('exportBtn').addEventListener('click', exportGot);
document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) importGot(file);
  e.target.value = '';
});
document.getElementById('resetBtn').addEventListener('click', () => {
  if (window.confirm('Clear all earned ticks? This cannot be undone.')) {
    got = new Set();
    persistGot();
    paintAll();
    noteEl.textContent = 'Progress cleared.';
  }
});
document.getElementById('kindChips').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-kind]');
  if (!btn) return;
  kindFilter = btn.dataset.kind;
  for (const b of document.querySelectorAll('#kindChips .chip')) b.classList.toggle('active', b === btn);
  paintRows();
});
for (const el of [searchEl, gradeEl, statusEl]) el.addEventListener('input', paintRows);
sortEl.addEventListener('change', () => { sortOrder = sortEl.value; persistSort(); paintRows(); });
spoilerEl.addEventListener('change', () => { persistSpoilers(); paintRows(); });
nextUpLinkEl.addEventListener('click', (e) => {
  e.preventDefault();
  const id = Number(nextUpLinkEl.dataset.trophyId);
  if (id) jumpToTrophy(id);
});

function followHash() {
  const m = window.location.hash.match(/#trophy=(\d+)/);
  if (m) jumpToTrophy(Number(m[1]));
}

loadSaved();
data = await (await fetch('data/trophies.json')).json();
paintAll();
followHash();
window.__guideReady = true;
