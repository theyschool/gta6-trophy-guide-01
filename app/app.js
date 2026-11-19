// Leonida Trophy Guide — boot, checklist, filters, spoiler rule, sort, the
// Next-up planner, the roadmap, and export/import. All data comes from
// data/trophies.json; progress lives in localStorage through store.js.
import { loadEarned, saveEarned, exportEarned, parseImport, STORAGE_KEY } from './store.js';

const GRADE_RANK = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
const STAGES = [
  { n: 1, name: 'Story first', text: 'Play the story through to the final mission — and meditate at every spot offered along the way, before Chapter 1 ends.' },
  { n: 2, name: 'Open world', text: 'Activities and collectibles: races, stunts, shooting ranges, cards, WAiNK It, vehicles and every region of Leonida.' },
  { n: 3, name: 'Side missions & robberies', text: 'Stranger strands, the named robberies, and the money trophies. Nothing here is missable.' },
  { n: 4, name: 'The long grind', text: 'The 100% checklist, the 50 challenges, and the trophies no guide has pinned down yet. Then the platinum pops.' },
];
const PREFS_KEY = 'leonida-trophy-guide-prefs-v1';

const state = {
  trophies: [],
  earned: loadEarned(),
  kind: 'all',
  grade: 'all',
  query: '',
  sort: 'roadmap',
  spoilers: false,
  openGuide: null,
};

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    if (typeof p.sort === 'string') state.sort = p.sort;
    if (typeof p.spoilers === 'boolean') state.spoilers = p.spoilers;
  } catch { /* defaults stand */ }
}

function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ sort: state.sort, spoilers: state.spoilers }));
  } catch { /* prefs are a nicety */ }
}

function el(id) { return document.getElementById(id); }

function isStory(t) { return t.kinds.includes('story'); }

function spoilerHidden(t) {
  return !state.spoilers && isStory(t) && !state.earned.has(t.id);
}

function visibleTrophies() {
  const q = state.query.trim().toLowerCase();
  let list = state.trophies.filter((t) => {
    if (state.kind !== 'all' && !t.kinds.includes(state.kind)) return false;
    if (state.grade !== 'all' && t.grade !== state.grade) return false;
    if (q) {
      const hay = `${t.name} ${t.description} ${t.guide}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const byId = (a, b) => a.id - b.id;
  const byName = (a, b) => a.name.localeCompare(b.name);
  const byGrade = (a, b) => GRADE_RANK[a.grade] - GRADE_RANK[b.grade] || byName(a, b);
  if (state.sort === 'name') list.sort(byName);
  else if (state.sort === 'grade') list.sort(byGrade);
  else if (state.sort === 'stage') list.sort((a, b) => a.stage - b.stage || byId(a, b));
  else {
    const kindOrder = (t) => (t.missable ? 0 : isStory(t) ? 1 : t.kinds.includes('activities') ? 2 : 3);
    list.sort((a, b) => a.stage - b.stage || kindOrder(a) - kindOrder(b) || byId(a, b));
  }
  return list;
}

function medal(t) {
  return `<span class="medal ${t.grade}" title="${t.grade}" aria-label="${t.grade} trophy"></span>`;
}

function tagsFor(t) {
  const tags = [];
  if (t.missable) tags.push('<span class="tag tag-missable">Missable</span>');
  if (t.unconfirmed) tags.push('<span class="tag tag-unconfirmed">Unconfirmed</span>');
  if (t.hidden) tags.push('<span class="tag tag-hidden">Hidden</span>');
  if (typeof t.count === 'number') tags.push(`<span class="tag tag-count">0 / ${t.count.toLocaleString('en-US')}</span>`);
  for (const k of t.kinds) tags.push(`<span class="tag">${k}</span>`);
  return tags.join(' ');
}

function rowHtml(t) {
  const earned = state.earned.has(t.id);
  const hidden = spoilerHidden(t);
  const open = state.openGuide === t.id;
  const name = hidden ? 'Hidden story trophy' : t.name;
  const desc = hidden
    ? 'Earn it in the game to reveal its name and description.'
    : t.description;
  const guide = hidden
    ? '<p>This trophy stays hidden until you earn it. Turn spoilers on to read its guide.</p>'
    : `<p>${t.guide}</p><p class="source-line"><strong>Sources:</strong> ${t.sources.join(', ')}</p>`;
  return `<li class="trophy-row${earned ? ' earned' : ''}${hidden ? ' hidden-spoiler' : ''}" id="trophy-${t.id}" data-trophy-id="${t.id}">
    <div class="trophy-top">
      <input class="trophy-check" type="checkbox" data-id="${t.id}" ${earned ? 'checked' : ''} aria-label="Mark ${name} earned">
      ${medal(t)}
      <div class="trophy-main">
        <div class="trophy-name">${name} <span class="grade-label">${t.grade}</span></div>
        <div class="trophy-desc">${desc}</div>
        <div class="trophy-meta">${tagsFor(t)}</div>
        <button class="guide-toggle" type="button" data-guide="${t.id}" aria-expanded="${open}">${open ? 'Hide guide' : 'Read the guide'}</button>
        ${open ? `<div class="trophy-guide">${guide}</div>` : ''}
      </div>
    </div>
  </li>`;
}

function renderList() {
  const list = visibleTrophies();
  el('trophyList').innerHTML = list.map(rowHtml).join('');
  const shown = el('trophyList').querySelectorAll('.trophy-row:not(.hidden-spoiler)').length;
  el('shownCount').textContent = `— showing ${shown} of ${state.trophies.length}`;
  el('emptyNote').hidden = list.length > 0;
}

function renderProgress() {
  const earned = state.earned.size;
  const total = state.trophies.length;
  el('earnedCount').textContent = earned;
  el('progressFill').style.width = total ? `${(earned / total) * 100}%` : '0%';
  el('progressNote').textContent = earned === 0
    ? 'No trophies earned yet — tick them off as you go.'
    : earned === total
      ? 'Platinum! Every trophy earned — you are a Leonida Legend.'
      : `${earned} of ${total} earned — ${total - earned} to go.`;
  el('stageStrip').innerHTML = STAGES.map((s) => {
    const inStage = state.trophies.filter((t) => t.stage === s.n);
    const done = inStage.filter((t) => state.earned.has(t.id)).length;
    return `<div class="stage-chip"><strong>Stage ${s.n}</strong><span class="stage-count">${done} / ${inStage.length}</span><span class="stage-name">${s.name}</span><div class="stage-bar"><i style="width:${inStage.length ? (done / inStage.length) * 100 : 0}%"></i></div></div>`;
  }).join('');
}

function nextUp() {
  const remaining = state.trophies.filter((t) => !state.earned.has(t.id));
  if (!remaining.length) {
    el('nextUpBody').innerHTML = 'Every trophy earned — <strong>Vice Got a Price!</strong> is yours. Congratulations, Leonida Legend.';
    return;
  }
  const missable = remaining.find((t) => t.missable);
  const pick = missable || [...remaining].sort((a, b) => a.stage - b.stage || a.id - b.id)[0];
  const why = missable
    ? 'the only missable trophy — do it before Chapter 1 ends, or it is gone for this playthrough.'
    : `the earliest trophy left on the roadmap (stage ${pick.stage}).`;
  el('nextUpBody').innerHTML = `<a href="#trophy-${pick.id}" data-jump="${pick.id}">${pick.name}</a> — ${pick.description} <span class="nextup-why">${why}</span>`;
}

function renderRoadmap() {
  el('roadmapSteps').innerHTML = STAGES.map((s) => {
    const inStage = state.trophies.filter((t) => t.stage === s.n);
    const done = inStage.filter((t) => state.earned.has(t.id)).length;
    return `<li><strong>Stage ${s.n} — ${s.name} (${done}/${inStage.length})</strong><p>${s.text}</p></li>`;
  }).join('');
  el('unconfirmedList').innerHTML = state.trophies
    .filter((t) => t.unconfirmed)
    .map((t) => `<li>${t.name} — ${t.description}</li>`)
    .join('');
}

function renderAll() {
  renderProgress();
  nextUp();
  renderRoadmap();
  renderList();
}

function setEarned(id, on) {
  if (on) state.earned.add(id);
  else state.earned.delete(id);
  saveEarned(state.earned);
  renderProgress();
  nextUp();
  renderRoadmap();
  const row = document.querySelector(`[data-trophy-id="${id}"]`);
  if (row) row.classList.toggle('earned', on);
}

function openGuide(id, scroll) {
  state.openGuide = state.openGuide === id ? null : id;
  renderList();
  if (scroll) {
    const row = document.getElementById(`trophy-${id}`);
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function wireEvents() {
  el('search').addEventListener('input', (e) => { state.query = e.target.value; renderList(); });
  el('kindFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-kind]');
    if (!btn) return;
    state.kind = btn.dataset.kind;
    document.querySelectorAll('#kindFilters button').forEach((b) => b.classList.toggle('active', b === btn));
    renderList();
  });
  el('gradeFilter').addEventListener('change', (e) => { state.grade = e.target.value; renderList(); });
  el('sortOrder').addEventListener('change', (e) => { state.sort = e.target.value; savePrefs(); renderList(); });
  el('spoilerToggle').addEventListener('change', (e) => { state.spoilers = e.target.checked; savePrefs(); renderList(); });
  el('trophyList').addEventListener('change', (e) => {
    const box = e.target.closest('.trophy-check');
    if (box) setEarned(Number(box.dataset.id), box.checked);
  });
  el('trophyList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-guide]');
    if (btn) openGuide(Number(btn.dataset.guide), false);
  });
  el('nextUpBody').addEventListener('click', (e) => {
    const link = e.target.closest('[data-jump]');
    if (!link) return;
    e.preventDefault();
    state.openGuide = Number(link.dataset.jump);
    renderList();
    const row = document.getElementById(`trophy-${link.dataset.jump}`);
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  el('exportBtn').addEventListener('click', () => {
    const n = exportEarned(state.earned);
    el('progressNote').textContent = `Exported ${n} earned ${n === 1 ? 'trophy' : 'trophies'} to leonida-trophy-progress.json.`;
  });
  el('importBtn').addEventListener('click', () => el('importFile').click());
  el('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const result = parseImport(text, state.trophies.map((t) => t.id));
    if (result.error) {
      el('progressNote').textContent = `Import failed: ${result.error}`;
    } else {
      state.earned = result.earned;
      saveEarned(state.earned);
      renderAll();
      el('progressNote').textContent = `Imported ${result.restored} earned ${result.restored === 1 ? 'trophy' : 'trophies'}${result.dropped ? ` (${result.dropped} unknown ${result.dropped === 1 ? 'entry' : 'entries'} dropped)` : ''}.`;
    }
    e.target.value = '';
  });
}

async function boot() {
  loadPrefs();
  el('sortOrder').value = state.sort;
  el('spoilerToggle').checked = state.spoilers;
  let data;
  try {
    const res = await fetch('data/trophies.json');
    data = await res.json();
  } catch {
    el('nextUpBody').textContent = 'Could not load data/trophies.json — serve app/ over HTTP and try again.';
    return;
  }
  state.trophies = Array.isArray(data) ? data : data.trophies;
  wireEvents();
  renderAll();
  const hash = new URLSearchParams(location.hash.slice(1));
  const jump = Number(hash.get('trophy'));
  if (jump && state.trophies.some((t) => t.id === jump)) {
    state.openGuide = jump;
    renderList();
    const row = document.getElementById(`trophy-${jump}`);
    if (row) row.scrollIntoView({ block: 'center' });
  }
}

boot();
