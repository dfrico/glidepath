// Turns tagged transactions into the numbers that matter:
// monthly averages, per-category monthly cost, and the minimum runway.
//
// Outlier months (e.g. your wedding month) can be excluded from the averages.
// They stay in the transaction list, but do not skew the "typical month" figures.
// Annual categories are spread as a yearly cost: total / months of data, with at
// least 12 months, so 18 months holding two yearly bills still gives one bill / 12.
// Exclusions do not apply to them.

import { CATEGORIES } from './categories.js';

export function monthKey(t) { return (t.bookingDate || t.valueDate || '').slice(0, 7); }

// "2026-08" + 2 -> "2026-10". Used by the cash forecast.
export function addMonths(ym, k) {
  const [y, m] = ym.split('-').map(Number);
  const idx = y * 12 + (m - 1) + k;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

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
  let optionalMonthly = 0;
  for (const c of CATEGORIES) {
    const s = catSettings[c.name];
    const agg = cats[c.name];
    const monthly = monthlyBudget(agg, s, includedCount, months.length);
    rows.push({
      name: c.name,
      total: agg.total,
      count: agg.count,
      monthly,
      essential: s.essential,
      annual: s.annual,
      ignore: s.ignore,
      override: s.budgetOverride,
      note: c.note || '',
    });
    if (s.ignore) continue; // not counted as spending (e.g. transfers to savings)
    if (s.essential) runway += monthly;
    else optionalMonthly += monthly;
  }
  const untaggedMonthly = untaggedIncluded / includedCount;
  const plannedMonthly = runway + optionalMonthly + untaggedMonthly;

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

  // Target-based plan: "to make my cash last N months, what can I spend?"
  // Expected income adds to the pot, but only for the months it actually arrives
  // and only within the target horizon (income past the target does not help here).
  const targetMonths = settings.targetMonths;
  let plan = null;
  if (cash != null && targetMonths > 0) {
    const income = settings.futureIncome || 0;
    const incomeMonthsRaw = settings.futureIncomeMonths; // null = ongoing
    const incomeMonths = incomeMonthsRaw == null ? targetMonths : Math.min(incomeMonthsRaw, targetMonths);
    const incomeTotal = income * incomeMonths;
    const spendable = cash + incomeTotal; // total pot over the horizon
    const allowedMonthly = spendable / targetMonths;
    plan = {
      targetMonths,
      cash,
      income,
      incomeMonths,
      incomeTotal,
      spendable,
      allowedMonthly,
      essentials: runway,
      optionalRoom: allowedMonthly - runway, // what's left for optional after essentials
      surplus: allowedMonthly - plannedMonthly, // vs your current typical spend
    };
  }

  return {
    months,
    includedMonths,
    includedCount,
    byMonth,
    categories: rows,
    untaggedIncluded,
    untaggedCount,
    untaggedMonthly,
    runway,
    optionalMonthly,
    plannedMonthly,
    avgSpend,
    avgIncome,
    runwayMonths,
    burnMonths,
    plan,
  };
}

function monthlyBudget(agg, s, includedCount, monthsOfData) {
  if (s.budgetOverride != null) return s.budgetOverride;
  if (s.annual) return agg.total / Math.max(monthsOfData, 12); // yearly cost, spread evenly
  return agg.included / includedCount; // typical month
}

// Per-category monthly budgets for tracking a month (the Budget tab).
// With a budget plan, the total is the plan's cap ("you can spend X / mo"):
// essentials keep their figure, fixed overrides are kept as set, and the rest
// of the optional categories share what is left, in proportion to their typical
// spend. If essentials alone exceed the cap, optional budgets drop to zero.
// Without a plan, each category's budget is simply its typical-month figure.
export function categoryBudgets(b) {
  const out = {};
  for (const c of b.categories) out[c.name] = c.monthly;
  if (!b.plan) return { byName: out, fromPlan: false, scale: 1 };

  let fixedOptional = 0;
  let autoOptional = 0;
  for (const c of b.categories) {
    if (c.ignore || c.essential) continue;
    if (c.override != null) fixedOptional += c.monthly;
    else autoOptional += c.monthly;
  }
  const room = b.plan.optionalRoom - fixedOptional;
  const scale = autoOptional > 0 ? Math.max(0, room / autoOptional) : 0;
  for (const c of b.categories) {
    if (c.ignore || c.essential || c.override != null) continue;
    out[c.name] = c.monthly * scale;
  }
  return { byName: out, fromPlan: true, scale };
}
