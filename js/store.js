// Everything persists in the browser (localStorage). Nothing leaves your machine.

import { CATEGORIES } from './categories.js';
import { STARTER_RULES } from './starter-rules.js';
import { showError } from './notice.js';

const K = {
  tx: 'eb.transactions',
  rules: 'eb.rules',
  cats: 'eb.categorySettings',
  settings: 'eb.settings',
};

export function loadTransactions() { return read(K.tx, []); }
export function saveTransactions(v) { write(K.tx, v); }

export function loadRules() { return read(K.rules, null) || STARTER_RULES.slice(); }
export function saveRules(v) { write(K.rules, v); }

export function loadCategorySettings() {
  const stored = read(K.cats, {});
  const out = {};
  for (const c of CATEGORIES) {
    const s = stored[c.name] || {};
    out[c.name] = {
      essential: s.essential ?? c.essential,
      annual: s.annual ?? c.annual,
      ignore: s.ignore ?? c.ignore ?? false,
      budgetOverride: s.budgetOverride ?? null,
    };
  }
  return out;
}
export function saveCategorySettings(v) { write(K.cats, v); }

export function loadSettings() {
  const s = read(K.settings, {});
  return {
    // 'budget' (track spend vs budget), 'runway' (make cash last N months),
    // or 'fire' (grow investments toward financial independence).
    // Users from before modes existed who set their cash keep runway.
    mode: s.mode ?? (s.cash != null ? 'runway' : 'budget'),
    learn: s.learn ?? true,
    cash: s.cash ?? null,
    targetMonths: s.targetMonths ?? null,
    futureIncome: s.futureIncome ?? 0,
    futureIncomeMonths: s.futureIncomeMonths ?? null,
    excludedMonths: s.excludedMonths ?? [],
    budgetMonth: s.budgetMonth ?? null,
    // FIRE inputs. Separate from runway's cash: invested money, not cash on hand.
    fireInvested: s.fireInvested ?? null,
    fireContribution: s.fireContribution ?? null, // null = your historical avg net
    fireReturn: s.fireReturn ?? 5, // %/yr, real (after inflation)
    fireWithdrawal: s.fireWithdrawal ?? 4, // %/yr, the "4% rule"
  };
}
export function saveSettings(v) { write(K.settings, v); }

export function clearAll() { for (const k of Object.values(K)) localStorage.removeItem(k); }

// Full backup, so tagging work survives a browser wipe.
export function exportState() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions: loadTransactions(),
    rules: loadRules(),
    categorySettings: read(K.cats, {}),
    settings: read(K.settings, {}),
  };
}

export function importState(obj) {
  if (!obj || !Array.isArray(obj.transactions)) throw new Error('This file is not a valid backup.');
  write(K.tx, obj.transactions);
  if (obj.rules) write(K.rules, obj.rules);
  if (obj.categorySettings) write(K.cats, obj.categorySettings);
  if (obj.settings) write(K.settings, obj.settings);
}

// A corrupt or unreadable entry falls back to the default so the app still
// opens; the user is told, since tags or settings may be missing.
function read(k, def) {
  let v = null;
  try {
    v = localStorage.getItem(k);
  } catch {
    warnOnce('read', 'Browser storage is not available, so nothing can be loaded or saved. Private mode or blocked site data are the usual causes.');
    return def;
  }
  if (v == null) return def;
  try {
    return JSON.parse(v);
  } catch {
    showError('Saved data for this app looks damaged and was skipped.', 'Restore a backup if you have one. Entry: ' + k);
    return def;
  }
}

// Quota or disabled storage: keep running on in-memory state, say so once.
function write(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {
    warnOnce('write', 'Changes are not being saved: browser storage is full or disabled. Use Backup to keep your work.', e && e.message);
  }
}

const warned = new Set();
function warnOnce(key, message, detail) {
  if (warned.has(key)) return;
  warned.add(key);
  showError(message, detail);
}
