// Turns transactions into the views that help you budget:
// a category-by-month matrix, and your biggest single expenses.
// All figures respect the excluded months (e.g. the wedding month).

import { monthKey } from './budget.js';

export function monthMatrix(transactions, excludedMonths) {
  const excluded = new Set(excludedMonths || []);
  const monthSet = new Set();
  for (const t of transactions) {
    const m = monthKey(t);
    if (m) monthSet.add(m);
  }
  const months = [...monthSet].sort();
  const includedCount = Math.max(months.filter((m) => !excluded.has(m)).length, 1);

  const income = emptyRow(months);
  const expense = emptyRow(months);
  const catMap = new Map();
  const untagged = emptyRow(months);
  let hasUntagged = false;

  for (const t of transactions) {
    const m = monthKey(t);
    if (!m) continue;
    if (t.amount >= 0) {
      income.byMonth[m] += t.amount;
      continue;
    }
    const spend = -t.amount;
    expense.byMonth[m] += spend;
    const cat = t.category || '';
    if (!cat) {
      untagged.byMonth[m] += spend;
      hasUntagged = true;
      continue;
    }
    if (!catMap.has(cat)) catMap.set(cat, emptyRow(months));
    catMap.get(cat).byMonth[m] += spend;
  }

  const finish = (row, name) => {
    let total = 0;
    let included = 0;
    for (const m of months) {
      total += row.byMonth[m];
      if (!excluded.has(m)) included += row.byMonth[m];
    }
    return { name, byMonth: row.byMonth, total, avg: included / includedCount };
  };

  const categories = [...catMap.entries()]
    .map(([name, row]) => finish(row, name))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  // Scale for the heatmap: the biggest category cell in an included month.
  let maxCell = 0;
  for (const c of categories) {
    for (const m of months) {
      if (excluded.has(m)) continue;
      if (c.byMonth[m] > maxCell) maxCell = c.byMonth[m];
    }
  }

  return {
    months,
    excluded,
    income: finish(income, 'Income'),
    expense: finish(expense, 'Total spend'),
    categories,
    untagged: hasUntagged ? finish(untagged, 'Untagged') : null,
    maxCell: maxCell || 1,
  };
}

function emptyRow(months) {
  const byMonth = {};
  for (const m of months) byMonth[m] = 0;
  return { byMonth };
}

export function topExpenses(transactions, n, excludedMonths) {
  const excluded = new Set(excludedMonths || []);
  return transactions
    .filter((t) => t.amount < 0)
    .map((t) => ({
      id: t.id,
      date: t.bookingDate || '',
      partner: t.partnerName || '(no name)',
      category: t.category || '',
      amount: -t.amount,
      month: monthKey(t),
      excluded: excluded.has(monthKey(t)),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
}
