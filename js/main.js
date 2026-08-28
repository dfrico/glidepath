// Wires everything together: import, state, tagging, and the two panels.

import * as store from './store.js';
import { parseCsv } from './parse.js';
import { applyRules, autoTagAll, makeRuleFromTx } from './tagging.js';
import { computeBudget, monthKey, addMonths } from './budget.js';
import { monthMatrix, topExpenses, recurringCommitments } from './analysis.js';
import { project } from './forecast.js';
import { renderOverview, renderCategories } from './dashboard.js';
import { renderTransactions } from './transactions.js';

const state = {
  transactions: store.loadTransactions(),
  rules: store.loadRules(),
  catSettings: store.loadCategorySettings(),
  settings: store.loadSettings(),
  filters: { q: '', month: '', category: '', untaggedOnly: false },
};

const dom = {
  empty: document.getElementById('empty'),
  overview: document.getElementById('overview'),
  categories: document.getElementById('categories'),
  transactions: document.getElementById('transactions'),
  tabs: document.getElementById('tabs'),
  range: document.getElementById('range'),
  fileInput: document.getElementById('fileInput'),
  jsonInput: document.getElementById('jsonInput'),
  dropzone: document.getElementById('dropzone'),
};

// ---- Import ---------------------------------------------------------------

function readFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => importText(String(reader.result));
  reader.readAsText(file);
}

function importText(text) {
  const { rows, error } = parseCsv(text);
  if (error) { alert(error); return; }
  if (!rows.length) { alert('No usable rows found in that file.'); return; }
  const added = mergeRows(rows);
  store.saveTransactions(state.transactions);
  renderAll();
  alert(`Imported ${rows.length} rows. ${added} new, ${rows.length - added} already known.`);
}

// Keep tags across re-imports. Duplicates within one file are kept separately.
function mergeRows(rows) {
  const preexisting = new Set(state.transactions.map((t) => t.id));
  const used = new Set(preexisting);
  let added = 0;
  for (const r of rows) {
    if (preexisting.has(r.id)) continue;
    let id = r.id;
    let k = 1;
    while (used.has(id)) id = r.id + '#' + (++k);
    r.id = id;
    used.add(id);
    r.category = applyRules(r, state.rules);
    r.manual = false;
    state.transactions.push(r);
    added++;
  }
  return added;
}

// ---- Tagging --------------------------------------------------------------

function onTag(id, category) {
  const t = state.transactions.find((x) => x.id === id);
  if (!t) return;
  if (category === '') {
    // reverted to auto: let the rules decide again
    t.manual = false;
    t.category = applyRules(t, state.rules);
  } else {
    t.category = category;
    t.manual = true;
    if (state.settings.learn) {
      upsertRule(t, category);
      const partner = (t.partnerName || '').toUpperCase();
      for (const o of state.transactions) {
        if (o.manual || o.category) continue;
        if ((o.partnerName || '').toUpperCase() === partner) o.category = category;
      }
    }
  }
  store.saveTransactions(state.transactions);
  store.saveRules(state.rules);
  renderAll();
}

function upsertRule(t, category) {
  const key = (t.partnerName || '').toUpperCase().trim();
  if (!key) return;
  const existing = state.rules.find((r) => r.field === 'partnerName' && r.contains === key);
  if (existing) existing.category = category;
  else state.rules.unshift(makeRuleFromTx(t, category));
}

// ---- Settings callbacks ---------------------------------------------------

function updateCat(name, patch) {
  state.catSettings[name] = { ...state.catSettings[name], ...patch };
  store.saveCategorySettings(state.catSettings);
  renderOverviewPanel();
  renderCategoriesPanel();
}

function updateSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  store.saveSettings(state.settings);
}

function afterRulesChange() {
  store.saveRules(state.rules);
  autoTagAll(state.transactions, state.rules);
  store.saveTransactions(state.transactions);
  renderAll();
}

const dashCb = {
  onEssential: (name, v) => updateCat(name, { essential: v }),
  onAnnual: (name, v) => updateCat(name, { annual: v }),
  onIgnore: (name, v) => updateCat(name, { ignore: v }),
  onOverride: (name, v) => updateCat(name, { budgetOverride: v }),
  onCash: (v) => { updateSettings({ cash: v }); renderOverviewPanel(); },
  onTarget: (v) => { updateSettings({ targetMonths: v }); renderOverviewPanel(); },
  onFutureIncome: (v) => { updateSettings({ futureIncome: v }); renderOverviewPanel(); },
  onIncomeMonths: (v) => { updateSettings({ futureIncomeMonths: v }); renderOverviewPanel(); },
  onMonthInclude: (m, include) => {
    const set = new Set(state.settings.excludedMonths);
    if (include) set.delete(m); else set.add(m);
    updateSettings({ excludedMonths: [...set] });
    renderOverviewPanel();
    renderCategoriesPanel();
  },
  onRuleChange: (idx, category) => { if (state.rules[idx]) { state.rules[idx].category = category; afterRulesChange(); } },
  onRuleDelete: (idx) => { state.rules.splice(idx, 1); afterRulesChange(); },
  onRuleAdd: (rule) => { state.rules.unshift(rule); afterRulesChange(); },
  onFocusPartner: (partner) => {
    state.filters.q = partner;
    state.filters.untaggedOnly = false;
    showTab('transactions');
  },
  gotoUntagged: () => {
    state.filters.untaggedOnly = true;
    showTab('transactions');
  },
};

const txCb = {
  onTag,
  onLearn: (v) => updateSettings({ learn: v }),
  onRetag: () => {
    autoTagAll(state.transactions, state.rules);
    store.saveTransactions(state.transactions);
    renderAll();
  },
  onExport: exportCsv,
};

// ---- Export ---------------------------------------------------------------

function exportCsv() {
  const cols = ['Booking Date', 'Partner Name', 'Payment Reference', 'Amount (EUR)', 'Category'];
  const lines = [cols.join('\t')];
  for (const t of state.transactions) {
    lines.push([t.bookingDate, t.partnerName, t.reference, t.amount, t.category || ''].map(cell).join('\t'));
  }
  download('expenses-tagged.csv', lines.join('\n'), 'text/csv');
}

function cell(v) {
  const s = v == null ? '' : String(v);
  return /[\t"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function download(name, text, type) {
  const blob = new Blob([text], { type: type || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function backup() {
  download('expense-budget-backup.json', JSON.stringify(store.exportState(), null, 2), 'application/json');
}

function restore(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(String(reader.result));
      if (!confirm('Restore this backup? It replaces the current data and tags in this browser.')) return;
      store.importState(obj);
      state.transactions = store.loadTransactions();
      state.rules = store.loadRules();
      state.catSettings = store.loadCategorySettings();
      state.settings = store.loadSettings();
      renderAll();
      alert(`Restored ${state.transactions.length} transactions.`);
    } catch (e) {
      alert('Could not restore: ' + e.message);
    }
  };
  reader.readAsText(file);
}

// ---- Rendering ------------------------------------------------------------

function buildForecast(budget) {
  if (state.settings.cash == null) return null;
  const months = [...new Set(state.transactions.map(monthKey).filter(Boolean))].sort();
  if (!months.length) return null;
  const startYm = addMonths(months[months.length - 1], 1);
  const { cash, futureIncome, futureIncomeMonths } = state.settings;
  return {
    startYm,
    cash,
    ess: project(startYm, cash, futureIncome, futureIncomeMonths, budget.runway),
    planned: project(startYm, cash, futureIncome, futureIncomeMonths, budget.plannedMonthly),
  };
}

function renderOverviewPanel() {
  const budget = computeBudget(state.transactions, state.catSettings, state.settings);
  const matrix = monthMatrix(state.transactions, state.settings.excludedMonths);
  const tops = topExpenses(state.transactions, 12, state.settings.excludedMonths);
  const essentialNames = budget.categories.filter((c) => c.essential && !c.ignore).map((c) => c.name);
  const recurring = recurringCommitments(state.transactions, essentialNames);
  const forecast = buildForecast(budget);
  renderOverview(dom.overview, budget, matrix, tops, recurring, forecast, state.settings, dashCb);
}

function renderCategoriesPanel() {
  const budget = computeBudget(state.transactions, state.catSettings, state.settings);
  renderCategories(dom.categories, { budget, rules: state.rules }, dashCb);
}

function renderTransactionsPanel() {
  renderTransactions(dom.transactions, state.transactions, state.filters, state.settings, txCb);
}

function renderAll() {
  const has = state.transactions.length > 0;
  dom.empty.hidden = has;
  dom.tabs.hidden = !has;
  if (!has) {
    dom.overview.hidden = true;
    dom.categories.hidden = true;
    dom.transactions.hidden = true;
    dom.range.textContent = '';
    return;
  }
  const months = [...new Set(state.transactions.map(monthKey).filter(Boolean))].sort();
  dom.range.textContent = months.length ? `${months[0]} to ${months[months.length - 1]} · ${state.transactions.length} transactions` : '';
  renderOverviewPanel();
  renderCategoriesPanel();
  renderTransactionsPanel();
  const current = dom.tabs.querySelector('.tab.active');
  showTab(current ? current.dataset.tab : 'overview');
}

// ---- Tabs -----------------------------------------------------------------

function showTab(name) {
  for (const btn of dom.tabs.querySelectorAll('.tab')) btn.classList.toggle('active', btn.dataset.tab === name);
  dom.overview.hidden = name !== 'overview';
  dom.categories.hidden = name !== 'categories';
  dom.transactions.hidden = name !== 'transactions';
  if (name === 'transactions') renderTransactionsPanel();
}

// ---- Wiring ---------------------------------------------------------------

document.getElementById('importBtn').addEventListener('click', () => dom.fileInput.click());
dom.dropzone.addEventListener('click', () => dom.fileInput.click());
dom.fileInput.addEventListener('change', () => { readFile(dom.fileInput.files[0]); dom.fileInput.value = ''; });

document.getElementById('backupBtn').addEventListener('click', backup);
document.getElementById('restoreBtn').addEventListener('click', () => dom.jsonInput.click());
dom.jsonInput.addEventListener('change', () => { restore(dom.jsonInput.files[0]); dom.jsonInput.value = ''; });

document.getElementById('clearBtn').addEventListener('click', () => {
  if (!state.transactions.length) return;
  if (!confirm('Remove all imported data and tags from this browser?')) return;
  store.clearAll();
  state.transactions = [];
  state.rules = store.loadRules();
  state.catSettings = store.loadCategorySettings();
  state.settings = store.loadSettings();
  renderAll();
});

for (const btn of dom.tabs.querySelectorAll('.tab')) {
  btn.addEventListener('click', () => showTab(btn.dataset.tab));
}

['dragenter', 'dragover'].forEach((ev) => window.addEventListener(ev, (e) => {
  e.preventDefault();
  dom.dropzone.classList.add('over');
}));
['dragleave', 'drop'].forEach((ev) => window.addEventListener(ev, (e) => {
  e.preventDefault();
  if (ev === 'drop') {
    const file = e.dataTransfer && e.dataTransfer.files[0];
    if (file) readFile(file);
  }
  dom.dropzone.classList.remove('over');
}));

renderAll();
