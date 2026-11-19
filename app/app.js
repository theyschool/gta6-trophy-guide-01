// Leonida Trophy Guide — tracker for the 55 GTA VI PS5 trophies.
// Checklist in localStorage, export/import as JSON, filters by kind/grade/status,
// search, and a spoiler setting that hides story trophies until earned.
// Runs fully offline: the only fetch is the app's own data/trophies.json.
const KEY = 'gta6-trophy-progress-v1';
const SPOILER_KEY = 'gta6-trophy-spoilers-v1';
const listEl = document.getElementById('trophyList');
const searchEl = document.getElementById('search');
const gradeEl = document.getElementById('gradeFilter');
const statusEl = document.getElementById('statusFilter');
const spoilerEl = document.getElementById('spoilerToggle');
const noteEl = document.getElementById('controlsNote');
const countEl = document.getElementById('resultCount');
const onlineNoteEl = document.getElementById('onlineNote');

const STAGE_LABEL = { 1: 'Stage 1 · Story', 2: 'Stage 2 · 100%', 3: 'Stage 3 · Cleanup', 4: 'Platinum' };
const KIND_LABEL = { story: 'Story', missable: 'Missable', collectibles: 'Collectibles', activities: 'Activities' };

let doc;
let earned = new Set();
let kind = 'all';

function loadStored() {
  try { earned = new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]')); } catch { earned = new Set(); }
  try { spoilerEl.checked = JSON.parse(localStorage.getItem(SPOILER_KEY) ?? 'true'); } catch { spoilerEl.checked = true; }
}

function saveProgress() {
  localStorage.setItem(KEY, JSON.stringify([...earned].sort()));
}

function saveSpoiler() {
  localStorage.setItem(SPOILER_KEY, JSON.stringify(spoilerEl.checked));
}

function isSpoilerHidden(t) {
  return spoilerEl.checked && t.kinds.includes('story') && !earned.has(t.name);
}

function matches(t) {
  if (kind === 'online') return false;
  if (kind !== 'all' && !t.kinds.includes(kind)) return false;
  if (gradeEl.value !== 'all' && t.grade !== gradeEl.value) return false;
  if (statusEl.value === 'earned' && !earned.has(t.name)) return false;
  if (statusEl.value === 'remaining' && earned.has(t.name)) return false;
  const q = searchEl.value.trim().toLowerCase();
  if (q && !(t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.guide.toLowerCase().includes(q))) return false;
  return true;
}

function renderProgress() {
  const total = doc.trophies.length;
  const got = doc.trophies.filter((t) => earned.has(t.name));
  const pct = Math.round((got.length / total) * 100);
  document.getElementById('progressCount').textContent = `${got.length} / ${total}`;
  document.getElementById('progressPct').textContent = `${pct}%`;
  document.getElementById('progressFill').style.width = `${pct}%`;
  const byGrade = (g) => got.filter((t) => t.grade === g).length;
  document.getElementById('progressDetail').textContent =
    `${byGrade('platinum')} platinum · ${byGrade('gold')} gold · ${byGrade('silver')} silver · ${byGrade('bronze')} bronze earned`;
}

function renderList() {
  const visible = doc.trophies.filter(matches);
  onlineNoteEl.hidden = kind !== 'online';
  countEl.textContent = kind === 'online'
    ? '0 trophies — the Online filter is empty on purpose: GTA VI has no online trophies.'
    : `Showing ${visible.length} of ${doc.trophies.length} trophies` +
      (kind !== 'all' ? ` · ${KIND_LABEL[kind] ?? kind}` : '') +
      (gradeEl.value !== 'all' ? ` · ${gradeEl.value}` : '') +
      (statusEl.value !== 'all' ? ` · ${statusEl.value}` : '');
  listEl.replaceChildren();
  if (visible.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = kind === 'online'
      ? 'Nothing here — every GTA VI trophy is earned in single-player.'
      : 'No trophies match these filters. Clear the search or pick another kind.';
    listEl.append(li);
    return;
  }
  for (const t of visible) {
    const li = document.createElement('li');
    li.className = 'trophy' + (earned.has(t.name) ? ' earned' : '') + (t.missable ? ' missable-flag' : '');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = earned.has(t.name);
    box.setAttribute('aria-label', `Earned: ${t.name}`);
    box.addEventListener('change', () => {
      if (box.checked) earned.add(t.name);
      else earned.delete(t.name);
      saveProgress();
      renderProgress();
      renderList();
    });
    li.append(box);
    const body = document.createElement('div');
    const head = document.createElement('div');
    head.className = 'trophy-head';
    const badge = document.createElement('span');
    badge.className = `badge ${t.grade}`;
    badge.textContent = t.grade;
    head.append(badge);
    if (isSpoilerHidden(t)) {
      const hidden = document.createElement('span');
      hidden.className = 'spoiler-hidden';
      hidden.textContent = 'Hidden story trophy — tick it earned to reveal its name, description and guide.';
      body.append(head, hidden);
      li.append(body);
      listEl.append(li);
      continue;
    }
    const name = document.createElement('span');
    name.className = 'trophy-name';
    name.textContent = t.name;
    const desc = document.createElement('span');
    desc.className = 'trophy-desc';
    desc.textContent = `“${t.description}”`;
    head.append(name, desc);
    if (t.missable) {
      const tag = document.createElement('span');
      tag.className = 'tag missable';
      tag.textContent = '⚠ Possibly missable';
      head.append(tag);
    }
    if (t.hidden) {
      const tag = document.createElement('span');
      tag.className = 'tag hidden';
      tag.textContent = 'Hidden on PS5';
      head.append(tag);
    }
    const stage = document.createElement('span');
    stage.className = 'tag stage';
    stage.textContent = STAGE_LABEL[t.stage] ?? `Stage ${t.stage}`;
    head.append(stage);
    for (const k of t.kinds) {
      if (k === 'missable') continue;
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = KIND_LABEL[k] ?? k;
      head.append(tag);
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
    listEl.append(li);
  }
}

function render() {
  renderProgress();
  renderList();
}

function exportProgress() {
  const payload = {
    app: 'leonida-trophy-guide',
    game: 'Grand Theft Auto VI',
    version: 1,
    exportedAt: new Date().toISOString(),
    earned: [...earned].sort(),
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  a.download = 'gta6-trophy-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
  noteEl.textContent = `Exported ${earned.size} earned trophies to gta6-trophy-progress.json.`;
}

async function importProgress(file) {
  try {
    const data = JSON.parse(await file.text());
    const names = Array.isArray(data) ? data : data.earned;
    if (!Array.isArray(names)) throw new Error('no earned list');
    const known = new Set(doc.trophies.map((t) => t.name));
    const good = names.filter((n) => typeof n === 'string' && known.has(n));
    const bad = names.length - good.length;
    earned = new Set(good);
    saveProgress();
    render();
    noteEl.textContent = `Imported ${good.length} earned trophies` + (bad ? ` (${bad} unknown names skipped).` : '.');
  } catch {
    noteEl.textContent = 'Import failed: that file is not a trophy-progress export from this guide.';
  }
}

document.getElementById('exportBtn').addEventListener('click', exportProgress);
document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) importProgress(file);
  e.target.value = '';
});
document.getElementById('resetBtn').addEventListener('click', () => {
  if (window.confirm('Clear all earned ticks? This cannot be undone.')) {
    earned = new Set();
    saveProgress();
    render();
    noteEl.textContent = 'Progress cleared.';
  }
});
document.getElementById('kindChips').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-kind]');
  if (!btn) return;
  kind = btn.dataset.kind;
  for (const b of document.querySelectorAll('#kindChips .chip')) b.classList.toggle('active', b === btn);
  renderList();
});
for (const el of [searchEl, gradeEl, statusEl]) el.addEventListener('input', renderList);
spoilerEl.addEventListener('change', () => { saveSpoiler(); renderList(); });

// Deep link: #trophy=<id> scrolls to a trophy and flashes it (used by screenshots).
function applyHash() {
  const m = window.location.hash.match(/#trophy=(\d+)/);
  if (!m) return;
  const t = doc.trophies.find((x) => x.id === Number(m[1]));
  if (!t) return;
  const row = [...listEl.children].find((li) => li.querySelector('.trophy-name')?.textContent === t.name);
  if (row) {
    row.scrollIntoView({ block: 'center' });
    row.style.outline = '2px solid var(--pink)';
    setTimeout(() => { row.style.outline = ''; }, 2500);
  }
}

loadStored();
doc = await (await fetch('data/trophies.json')).json();
render();
applyHash();
window.__guideReady = true;
