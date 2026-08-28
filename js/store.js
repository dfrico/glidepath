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
      budgetOverride: s.budgetOverride ?? null,
    };
  }
  return out;
}
export function saveCategorySettings(v) { write(K.cats, v); }

export function loadSettings() {
  const s = read(K.settings, {});
  return { learn: s.learn ?? true, cash: s.cash ?? null, excludedMonths: s.excludedMonths ?? [] };
}
export function saveSettings(v) { write(K.settings, v); }

export function clearAll() { for (const k of Object.values(K)) localStorage.removeItem(k); }

function read(k, def) {
  try {
    const v = localStorage.getItem(k);
    return v == null ? def : JSON.parse(v);
  } catch {
    return def;
  }
}
function write(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
