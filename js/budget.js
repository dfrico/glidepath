// Turns tagged transactions into the numbers that matter:
// monthly averages, per-category monthly cost, and the minimum runway.
//
// Outlier months (e.g. your wedding month) can be excluded from the averages.
// They stay in the transaction list, but do not skew the "typical month" figures.
// Annual categories are spread as a yearly cost: what was paid in the last 12
// months of data, / 12. So 18 months holding two yearly bills still gives one
// bill / 12, and a price rise shows up. Exclusions do not apply to them.

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
  for (const c of CATEGORIES) cats[c.name] = { total: 0, included: 0, last12: 0, count: 0 };
  const yearStart = months.length ? addMonths(months[months.length - 1], -11) : '';
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
    if (!cats[cat]) cats[cat] = { total: 0, included: 0, last12: 0, count: 0 };
    cats[cat].total += spend;
    cats[cat].count++;
    if (inMonth) cats[cat].included += spend;
    if (monthKey(t) >= yearStart) cats[cat].last12 += spend;
  }

  const rows = [];
  let runway = 0;
  let optionalMonthly = 0;
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

  // Historical income and spend averages over included months only.
  // Ignored categories are moves, not spend or earnings: transfers to savings
  // (and back from it), one-offs. Rows tagged Income always count as income.
  let incIncome = 0;
  let incExpense = 0;
  for (const t of transactions) {
    if (excluded.has(monthKey(t))) continue;
    const cat = t.category || '';
    if (cat && cat !== 'Income' && catSettings[cat]?.ignore) continue;
    if (t.amount < 0) incExpense += -t.amount;
    else incIncome += t.amount;
  }
  const avgIncome = incIncome / includedCount;
  const avgSpend = incExpense / includedCount;

  // How long the cash lasts, counting the expected income for as long as it
  // comes. Same inputs as the cash forecast, so the two always agree.
  // "Current spend" is the typical month the plan's verdict uses.
  const cash = settings.cash;
  const income = settings.futureIncome || 0;
  const incomeMonths = settings.futureIncomeMonths; // null = ongoing
  const runwayMonths = cash != null && runway > 0 ? monthsUntilEmpty(cash, income, incomeMonths, runway) : null;
  const burnMonths = cash != null && plannedMonthly > 0 ? monthsUntilEmpty(cash, income, incomeMonths, plannedMonthly) : null;

  // Target-based plan: "to make my cash last N months, what can I spend?"
  // Expected income adds to the pot, but only for the months it actually arrives
  // and only within the target horizon (income past the target does not help here).
  // Only in runway mode: in budget mode the Budget tab tracks typical months.
  const targetMonths = settings.targetMonths;
  let plan = null;
  if (settings.mode === 'runway' && cash != null && targetMonths > 0) {
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

// Months until the balance hits zero, with fractions ("3.5 months").
// Infinity if income covers the burn for good.
export function monthsUntilEmpty(cash, income, incomeMonths, burn, cap = 1200) {
  let balance = cash;
  for (let i = 1; i <= cap; i++) {
    const net = burn - (incomeMonths == null || i <= incomeMonths ? income : 0);
    if (net <= 0) {
      if (incomeMonths == null) return Infinity; // income covers it forever
      continue;
    }
    if (balance <= net) return i - 1 + balance / net;
    balance -= net;
  }
  return Infinity;
}

function monthlyBudget(agg, s, includedCount) {
  if (s.budgetOverride != null) return s.budgetOverride;
  if (s.annual) return agg.last12 / 12; // yearly cost, spread evenly
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

// Whole months from a to b: monthsBetween("2026-02", "2027-02") = 12.
export function monthsBetween(a, b) {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}

// Yearly costs (annual categories) for the Budget tab. A yearly bill lands in
// one month, so a monthly bar is useless for it. Instead, track it over the 12
// months ending at `month`: what was actually paid against the yearly budget,
// and when the next bill is likely due (the last bill's month, a year on).
export function yearlyCosts(transactions, budgetRows, budgets, month) {
  const start = addMonths(month, -11);
  const out = [];
  for (const r of budgetRows) {
    if (!r.annual || r.ignore) continue;
    const yearly = (budgets[r.name] ?? r.monthly) * 12;
    let paid = 0;
    let paidThisMonth = 0;
    let lastPaid = null;
    for (const t of transactions) {
      if (t.amount >= 0 || t.category !== r.name) continue;
      const m = monthKey(t);
      if (!m || m > month) continue; // nothing after the tracked month
      if (m >= start) paid += -t.amount;
      if (m === month) paidThisMonth += -t.amount;
      const d = t.bookingDate || t.valueDate;
      if (!lastPaid || d > lastPaid) lastPaid = d;
    }
    if (yearly <= 0 && paid <= 0) continue;
    const nextDue = lastPaid ? addMonths(lastPaid.slice(0, 7), 12) : null;
    out.push({
      name: r.name,
      essential: r.essential,
      yearly,
      monthly: yearly / 12,
      paid,
      paidThisMonth,
      lastPaid,
      nextDue,
      dueIn: nextDue ? monthsBetween(month, nextDue) : null,
    });
  }
  // Soonest bill first; never-seen bills last.
  return out.sort((a, b) => (a.dueIn ?? Infinity) - (b.dueIn ?? Infinity));
}
