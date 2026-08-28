// Cash forecast: project your balance month by month and find when it hits zero.
// Each month: balance = balance + income (if still coming) - burn.
// Income can be time-limited (e.g. unemployment benefit that stops after N months).

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
