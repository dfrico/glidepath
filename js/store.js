// Everything persists in the browser (localStorage). Nothing leaves your machine.

import { CATEGORIES } from './categories.js';
import { STARTER_RULES } from './starter-rules.js';

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
    // 'budget' (track spend vs budget) or 'runway' (make cash last N months).
    // Users from before modes existed who set their cash keep runway.
    mode: s.mode ?? (s.cash != null ? 'runway' : 'budget'),
    learn: s.learn ?? true,
    cash: s.cash ?? null,
    targetMonths: s.targetMonths ?? null,
    futureIncome: s.futureIncome ?? 0,
    futureIncomeMonths: s.futureIncomeMonths ?? null,
    excludedMonths: s.excludedMonths ?? [],
    budgetMonth: s.budgetMonth ?? null,
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

function read(k, def) {
  try {
    const v = localStorage.getItem(k);
    return v == null ? def : JSON.parse(v);
  } catch {
    return def;
  }
}
function write(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
