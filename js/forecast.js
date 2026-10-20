// Cash forecast: project your balance month by month and find when it hits zero.
// Each month: balance = balance + income (if still coming) - burn.
// Income can be time-limited (e.g. a contract or a severance that ends after N months).

import { addMonths } from './budget.js';

export function project(startYm, cash, monthlyIncome, incomeMonths, burn, cap = 60) {
  const points = [{ i: 0, ym: null, balance: cash, income: 0, spend: 0 }];
  let balance = cash;
  let runout = null;

  for (let i = 1; i <= cap; i++) {
    const income = incomeMonths == null || i <= incomeMonths ? monthlyIncome || 0 : 0;
    balance = balance + income - burn;
    const ym = addMonths(startYm, i - 1);
    points.push({ i, ym, balance, income, spend: burn });
    if (balance <= 0) { runout = { i, ym }; break; }
  }
  return { points, runout, cap };
}

// FIRE projection: the portfolio grows month by month toward financial
// independence. Each month: balance = balance * (1 + monthly return) + contribution.
// The return is "real" (after inflation), so targets stay in today's euros.
// Targets are { key, amount }; each gets the first month the balance reaches it.
// Runs until every target is reached, or `cap` months (60 years).
export function projectGrowth(startYm, invested, contribution, annualReturnPct, targets, cap = 720) {
  const r = Math.pow(1 + (annualReturnPct || 0) / 100, 1 / 12) - 1;
  let balance = invested || 0;
  const points = [{ i: 0, ym: null, balance }];
  const reach = {};
  for (const t of targets) if (balance >= t.amount) reach[t.key] = { i: 0, ym: null };

  for (let i = 1; i <= cap && Object.keys(reach).length < targets.length; i++) {
    balance = balance * (1 + r) + (contribution || 0);
    const ym = addMonths(startYm, i - 1);
    points.push({ i, ym, balance });
    for (const t of targets) {
      if (!reach[t.key] && balance >= t.amount) reach[t.key] = { i, ym };
    }
  }
  return { points, reach, cap };
}

// The portfolio that sustains a yearly spend at a given withdrawal rate
// (4% -> 25x the yearly spend).
export function fiTarget(monthlySpend, withdrawalPct) {
  return withdrawalPct > 0 ? (monthlySpend * 12 * 100) / withdrawalPct : Infinity;
}
