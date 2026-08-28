// Turns tagged transactions into the numbers that matter:
// monthly averages, per-category monthly cost, and the minimum runway.
//
// Outlier months (e.g. your wedding month) can be excluded from the averages.
// They stay in the transaction list, but do not skew the "typical month" figures.
// Annual categories are always spread as total / 12, regardless of exclusions.

import { CATEGORIES } from './categories.js';

export function monthKey(t) { return (t.bookingDate || t.valueDate || '').slice(0, 7); }

function uniqueMonths(transactions) {
  const set = new Set();
  for (const t of transactions) {
    const m = monthKey(t);
    if (m) set.add(m);
  }
  return [...set].sort();
}

export function computeBudget(transactions, catSettings, settings) {
  const excluded = new Set(settings.excludedMonths || []);
  const months = uniqueMonths(transactions);
  const includedMonths = months.filter((m) => !excluded.has(m));
  const includedCount = Math.max(includedMonths.length, 1);

  // Per-month income and spend (all months, for the table).
  const byMonth = {};
  for (const m of months) byMonth[m] = { income: 0, expense: 0, excluded: excluded.has(m) };
  for (const t of transactions) {
    const m = monthKey(t);
    if (!byMonth[m]) continue;
    if (t.amount < 0) byMonth[m].expense += -t.amount;
    else byMonth[m].income += t.amount;
  }

  // Per-category totals. "total" is all-time; "included" only counts kept months.
  const cats = {};
  for (const c of CATEGORIES) cats[c.name] = { total: 0, included: 0, count: 0 };
  let untaggedIncluded = 0;
  let untaggedCount = 0;

  for (const t of transactions) {
    if (t.amount >= 0) continue; // expenses only
    const spend = -t.amount;
    const inMonth = !excluded.has(monthKey(t));
    const cat = t.category || '';
    if (!cat) {
      untaggedCount++;
      if (inMonth) untaggedIncluded += spend;
      continue;
    }
    if (!cats[cat]) cats[cat] = { total: 0, included: 0, count: 0 };
    cats[cat].total += spend;
    cats[cat].count++;
    if (inMonth) cats[cat].included += spend;
  }

  const rows = [];
  let runway = 0;
  for (const c of CATEGORIES) {
    const s = catSettings[c.name];
    const agg = cats[c.name];
    const monthly = monthlyBudget(agg, s, includedCount);
    rows.push({
      name: c.name,
      total: agg.total,
      count: agg.count,
      monthly,
      essential: s.essential,
      annual: s.annual,
      override: s.budgetOverride,
      note: c.note || '',
    });
    if (s.essential) runway += monthly;
  }

  // Income and spend averages over included months only.
  let incIncome = 0;
  let incExpense = 0;
  for (const t of transactions) {
    if (excluded.has(monthKey(t))) continue;
    if (t.amount < 0) incExpense += -t.amount;
    else incIncome += t.amount;
  }
  const avgIncome = incIncome / includedCount;
  const avgSpend = incExpense / includedCount;

  const cash = settings.cash;
  const runwayMonths = cash != null && runway > 0 ? cash / runway : null;
  const burnMonths = cash != null && avgSpend > 0 ? cash / avgSpend : null;

  return {
    months,
    includedMonths,
    includedCount,
    byMonth,
    categories: rows,
    untaggedIncluded,
    untaggedCount,
    runway,
    avgSpend,
    avgIncome,
    runwayMonths,
    burnMonths,
  };
}

function monthlyBudget(agg, s, includedCount) {
  if (s.budgetOverride != null) return s.budgetOverride;
  if (s.annual) return agg.total / 12; // yearly cost, spread evenly
  return agg.included / includedCount; // typical month
}
