// Progress store: the earned set lives in localStorage, and can be exported to a
// file and imported back. Import validates the file's shape, drops ids that are
// not trophies in this guide, and reports how many it restored.
export const STORAGE_KEY = 'leonida-trophy-guide-v1';

export function loadEarned() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((n) => Number.isInteger(n)));
  } catch {
    return new Set();
  }
}

export function saveEarned(earned) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...earned].sort((a, b) => a - b)));
  } catch {
    // Storage full or unavailable: the in-memory set still works for this visit.
  }
}

export function exportEarned(earned) {
  const payload = {
    app: 'leonida-trophy-guide',
    version: 1,
    exportedAt: new Date().toISOString(),
    earned: [...earned].sort((a, b) => a - b),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'leonida-trophy-progress.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return payload.earned.length;
}

// Parses an imported file's text. Returns { earned, restored, dropped, error }.
// A file is accepted when it is JSON with an "earned" array of trophy ids; ids
// that are not in knownIds are dropped and counted, never trusted.
export function parseImport(text, knownIds) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { earned: null, restored: 0, dropped: 0, error: 'That file is not JSON.' };
  }
  const list = Array.isArray(parsed) ? parsed : parsed?.earned;
  if (!Array.isArray(list)) {
    return { earned: null, restored: 0, dropped: 0, error: 'That file has no earned list in it.' };
  }
  const known = new Set(knownIds);
  const earned = new Set();
  let dropped = 0;
  for (const n of list) {
    if (Number.isInteger(n) && known.has(n)) earned.add(n);
    else dropped += 1;
  }
  return { earned, restored: earned.size, dropped, error: null };
}
