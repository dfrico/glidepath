// Two views built from the budget and analysis data:
//   renderOverview  — the insights: plan, month-by-category breakdown, top spend, cuts
//   renderCategories — the controls: essential/annual/override per category

import { el, eur, eur2, table } from './dom.js';
import { CATEGORY_NAMES } from './categories.js';

const ACCENT_RGB = '79,157,255';
const HUE_PLAN = '#3987e5'; // current-plan line
const HUE_ESS = '#d95926'; // essentials-only line
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---- Overview -------------------------------------------------------------

export function renderOverview(root, b, matrix, tops, recurring, forecast, settings, cb) {
  const parts = [];
  if (b.untaggedCount > 0) parts.push(untaggedBanner(b, cb));
  parts.push(kpis(b, settings.mode));
  if (settings.mode === 'runway') {
    parts.push(planCard(b, settings, cb));
    parts.push(forecastCard(forecast, settings, cb));
  }
  parts.push(matrixCard(matrix, cb));
  const skipped = ignoredNote(b);
  const rec = recurringCard(recurring, skipped);
  if (rec) parts.push(rec);
  parts.push(topCard(tops, skipped, cb));
  const cuts = cutCandidates(b);
  if (cuts) parts.push(cuts);
  root.replaceChildren(...parts);
}

function monthLabel(ym) {
  if (!ym) return 'now';
  const [y, m] = ym.split('-').map(Number);
  return `${MON[m - 1]} ${y}`;
}
function monthShort(ym) {
  if (!ym) return 'now';
  const [y, m] = ym.split('-').map(Number);
  return `${MON[m - 1]} '${String(y).slice(2)}`;
}
function fmtRunout(proj) {
  return proj.runout ? `${monthLabel(proj.runout.ym)} · ${proj.runout.i} mo` : `beyond ${proj.cap} months`;
}

function untaggedBanner(b, cb) {
  return el('div', { class: 'banner' }, [
    el('span', { text: `${b.untaggedCount} transactions are still untagged. Tag them so the numbers are complete.` }),
    el('button', { class: 'btn small', onclick: () => cb.gotoUntagged() }, 'Tag them'),
  ]);
}

function kpi(label, value, sub, cls) {
  return el('div', { class: 'kpi ' + (cls || '') }, [
    el('div', { class: 'kpi-label', text: label }),
    el('div', { class: 'kpi-value', text: value }),
    sub ? el('div', { class: 'kpi-sub', text: sub }) : null,
  ]);
}

function kpis(b, mode) {
  const net = b.avgIncome - b.avgSpend;
  return el('div', { class: 'kpis' }, [
    kpi('Avg income / month', eur.format(b.avgIncome)),
    kpi('Avg spend / month', eur.format(b.avgSpend)),
    kpi('Avg net / month', eur.format(net), net < 0 ? 'you spend more than you earn' : 'in the black', net < 0 ? 'neg' : 'pos'),
    kpi('Minimum / month', eur.format(b.runway), mode === 'runway' ? 'essentials only — your runway base' : 'essentials only', 'accent'),
  ]);
}

function fmtMonths(n) {
  if (n == null) return '—';
  return n >= 100 ? '100+ months' : `${n.toFixed(1)} months`;
}

// The budget plan: cash + a target, turned into a monthly spending cap and a verdict.
function planCard(b, settings, cb) {
  const cash = el('input', { type: 'number', class: 'num-input', placeholder: 'e.g. 12000', min: '0', value: settings.cash ?? '' });
  cash.addEventListener('change', () => cb.onCash(cash.value === '' ? null : parseFloat(cash.value)));

  const target = el('input', { type: 'number', class: 'num-input', placeholder: 'e.g. 12', min: '1', value: settings.targetMonths ?? '' });
  target.addEventListener('change', () => cb.onTarget(target.value === '' ? null : parseFloat(target.value)));

  const income = el('input', { type: 'number', class: 'num-input', placeholder: '0', min: '0', value: settings.futureIncome ?? 0 });
  income.addEventListener('change', () => cb.onFutureIncome(income.value === '' ? 0 : parseFloat(income.value)));

  const incMonths = el('input', { type: 'number', class: 'num-input', placeholder: 'ongoing', min: '1', value: settings.futureIncomeMonths ?? '' });
  incMonths.addEventListener('change', () => cb.onIncomeMonths(incMonths.value === '' ? null : parseFloat(incMonths.value)));

  const inputs = el('div', { class: 'plan-inputs' }, [
    el('label', {}, ['Cash (€)', cash]),
    el('label', {}, ['Make it last (mo)', target]),
    el('label', {}, ['Income (€/mo)', income]),
    el('label', {}, ['Income for (mo)', incMonths]),
  ]);

  const runwayLine = el('div', { class: 'plan-runway' }, [
    el('div', {}, [el('span', { class: 'muted', text: 'Runway at essentials only: ' }), el('strong', { text: fmtMonths(b.runwayMonths) })]),
    el('div', {}, [el('span', { class: 'muted', text: 'Runway at current spend: ' }), el('strong', { text: fmtMonths(b.burnMonths) })]),
  ]);

  const out = [inputs, runwayLine];
  if (b.plan) out.push(planVerdict(b.plan));
  else out.push(el('p', { class: 'muted', text: 'Enter your cash and a target number of months to get a monthly spending cap.' }));

  return el('div', { class: 'card' }, [el('h3', { text: 'Budget plan' }), ...out]);
}

function planVerdict(plan) {
  const rows = el('div', { class: 'plan-grid' }, [
    planStat('You can spend', eur.format(plan.allowedMonthly) + ' / mo', `to last ${plan.targetMonths} months`),
    planStat('Essentials floor', eur.format(plan.essentials) + ' / mo', 'unavoidable'),
    planStat('Room for optional', eur.format(plan.optionalRoom) + ' / mo', 'after essentials', plan.optionalRoom < 0 ? 'neg' : 'pos'),
  ]);

  const note = plan.income > 0
    ? el('p', { class: 'muted small', text: `Pot: ${eur.format(plan.cash)} cash + ${eur.format(plan.income)}/mo income for ${plan.incomeMonths} months (${eur.format(plan.incomeTotal)}) = ${eur.format(plan.spendable)} over ${plan.targetMonths} months.` })
    : null;

  let verdict;
  if (plan.optionalRoom < 0) {
    verdict = status('critical', `Your essentials alone cost more than ${eur.format(plan.allowedMonthly)} per month. To last ${plan.targetMonths} months you must cut essentials, add cash, or shorten the target.`);
  } else if (plan.surplus >= 0) {
    verdict = status('good', `You are within budget by about ${eur.format(plan.surplus)} per month at your current spend.`);
  } else {
    verdict = status('critical', `Cut about ${eur.format(-plan.surplus)} per month from your current spend to last ${plan.targetMonths} months.`);
  }
  return el('div', {}, [rows, note, verdict]);
}

function planStat(label, value, sub, cls) {
  return el('div', { class: 'plan-stat ' + (cls || '') }, [
    el('div', { class: 'muted', text: label }),
    el('div', { class: 'plan-stat-val', text: value }),
    el('div', { class: 'muted small', text: sub }),
  ]);
}

function status(kind, text) {
  const icon = kind === 'good' ? '✓' : kind === 'warning' ? '!' : '✕';
  return el('div', { class: 'status status-' + kind }, [el('span', { class: 'status-icon', text: icon }), el('span', { text })]);
}

// ---- Cash forecast --------------------------------------------------------

function forecastCard(fc, settings, cb) {
  const head = el('h3', { text: 'Cash forecast' });
  if (!fc) {
    return el('div', { class: 'card' }, [head, el('p', { class: 'muted', text: 'Set your cash on hand in Budget plan above to see the forecast.' })]);
  }

  const heads = el('div', { class: 'forecast-heads' }, [
    forecastHead('Essentials only', fmtRunout(fc.ess), HUE_ESS),
    forecastHead('Current plan', fmtRunout(fc.planned), HUE_PLAN),
  ]);

  return el('div', { class: 'card' }, [
    head,
    el('p', { class: 'muted', text: `From ${monthLabel(fc.startYm)} with ${eur.format(fc.cash)} in cash. Income (set in Budget plan) covers ${settings.futureIncomeMonths ? settings.futureIncomeMonths + ' months' : 'every month'}.` }),
    heads,
    buildForecastChart(fc),
    forecastTable(fc.ess),
  ]);
}

function forecastHead(label, value, hue) {
  return el('div', { class: 'fc-head' }, [
    el('span', { class: 'legend-dot', style: `background:${hue}` }),
    el('div', {}, [el('div', { class: 'muted small', text: label }), el('div', { class: 'fc-val', text: value })]),
  ]);
}

function buildForecastChart(fc) {
  const A = fc.planned.points; // blue
  const B = fc.ess.points; // orange
  const maxI = Math.max(A[A.length - 1].i, B[B.length - 1].i, 1);
  const balances = [...A, ...B].map((p) => p.balance);
  const yMax = Math.max(fc.cash, ...balances, 0);
  const yMin = Math.min(0, ...balances);
  const span = yMax - yMin || 1;

  const W = 760, H = 220, L = 60, R = 18, T = 16, Bm = 30;
  const plotW = W - L - R, plotH = H - T - Bm;
  const x = (i) => L + plotW * (i / maxI);
  const y = (v) => T + plotH * (1 - (v - yMin) / span);
  const zeroY = y(0);
  const linePts = (pts) => pts.map((p) => `${x(p.i).toFixed(1)},${y(p.balance).toFixed(1)}`).join(' ');
  const ymAt = (i) => (A[i] && A[i].ym) || (B[i] && B[i].ym) || null;

  const step = Math.max(1, Math.ceil(maxI / 6));
  let xticks = '';
  for (let i = 0; i <= maxI; i += step) {
    xticks += `<text x="${x(i).toFixed(1)}" y="${H - 10}" text-anchor="middle" fill="#898781" font-size="11">${monthShort(ymAt(i))}</text>`;
  }
  const mark = (proj, color) => proj.runout
    ? `<circle cx="${x(proj.runout.i).toFixed(1)}" cy="${zeroY.toFixed(1)}" r="4" fill="${color}"/><text x="${x(proj.runout.i).toFixed(1)}" y="${(zeroY - 8).toFixed(1)}" text-anchor="middle" fill="${color}" font-size="11">out ${monthShort(proj.runout.ym)}</text>`
    : '';
  const hover = A.map((p) => `<circle cx="${x(p.i).toFixed(1)}" cy="${y(p.balance).toFixed(1)}" r="7" fill="transparent"><title>${monthLabel(p.ym)}: ${eur.format(p.balance)}</title></circle>`).join('');

  const svg = `<svg viewBox="0 0 ${W} ${H}" class="fc-svg" role="img" aria-label="Cash balance forecast">
    <line x1="${L}" y1="${zeroY.toFixed(1)}" x2="${W - R}" y2="${zeroY.toFixed(1)}" stroke="#ff6b6b" stroke-dasharray="4 4" stroke-width="1"/>
    <text x="${L - 8}" y="${(y(yMax) + 4).toFixed(1)}" text-anchor="end" fill="#898781" font-size="11">${eur.format(yMax)}</text>
    <text x="${L - 8}" y="${(zeroY + 4).toFixed(1)}" text-anchor="end" fill="#898781" font-size="11">€0</text>
    <polyline fill="none" stroke="${HUE_ESS}" stroke-width="2" points="${linePts(B)}"/>
    <polyline fill="none" stroke="${HUE_PLAN}" stroke-width="2" points="${linePts(A)}"/>
    ${mark(fc.ess, HUE_ESS)}${mark(fc.planned, HUE_PLAN)}${xticks}${hover}
  </svg>`;
  return el('div', { class: 'fc-chart', html: svg });
}

function forecastTable(proj) {
  const rows = proj.points.filter((p) => p.i > 0).slice(0, 24).map((p) => el('tr', {}, [
    el('td', { text: monthLabel(p.ym) }),
    el('td', { class: 'num pos', text: p.income ? eur.format(p.income) : '—' }),
    el('td', { class: 'num', text: eur.format(p.spend) }),
    el('td', { class: 'num strong ' + (p.balance <= 0 ? 'neg' : ''), text: eur.format(p.balance) }),
  ]));
  return el('details', { class: 'fc-details' }, [
    el('summary', { text: 'Month-by-month (essentials plan)' }),
    table(['Month', 'Income', 'Spend', 'Balance'], rows),
  ]);
}

// ---- Recurring commitments ------------------------------------------------

// " (excluding Savings and One-off)" — the ignored categories that actually
// have expenses, so the note follows the Ignore toggles in Categories.
function ignoredNote(b) {
  const names = b.categories.filter((c) => c.ignore && c.count > 0).map((c) => c.name);
  if (!names.length) return '';
  const list = names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  return ` (excluding ${list})`;
}

function recurringCard(rec, skipped) {
  if (!rec.length) return null;
  const totalMo = rec.reduce((a, r) => a + r.monthly, 0);
  const cancMo = rec.filter((r) => r.cancelable).reduce((a, r) => a + r.monthly, 0);
  const rows = rec.slice(0, 20).map((r) => el('tr', { class: r.cancelable ? 'cancelable' : '' }, [
    el('td', { title: r.name }, r.name),
    el('td', {}, [
      r.category ? el('span', { text: r.category }) : el('span', { class: 'muted', text: 'untagged' }),
      r.varies ? el('span', { class: 'tag', text: 'varies' }) : null,
      r.cancelable ? el('span', { class: 'tag cut', text: 'cut?' }) : null,
    ]),
    el('td', { class: 'num strong', text: eur.format(r.monthly) }),
    el('td', { class: 'num muted', text: eur.format(r.yearly) }),
    el('td', { class: 'num muted', text: `${r.monthsSeen} mo` }),
  ]));
  return el('div', { class: 'card' }, [
    el('h3', { text: 'Recurring commitments' }),
    el('p', { class: 'muted', text: `Payments that repeat most months${skipped}: about ${eur.format(totalMo)} per month, of which ${eur.format(cancMo)} is optional and could be cut.` }),
    table(['Partner', 'Category', '€/mo', '€/yr', 'Seen'], rows),
  ]);
}

// Month-by-category matrix, shaded by amount. Numbers are always shown.
function matrixCard(m, cb) {
  const months = m.months;
  const head = [el('th', { text: 'Category' })];
  for (const mo of months) {
    const chk = el('input', { type: 'checkbox', class: 'month-chk' });
    chk.checked = !m.excluded.has(mo);
    chk.addEventListener('change', () => cb.onMonthInclude(mo, chk.checked));
    head.push(el('th', { class: 'num month-h' + (m.excluded.has(mo) ? ' off' : '') }, [
      el('div', { text: mo.slice(5) + '/' + mo.slice(2, 4) }),
      el('label', { class: 'month-toggle', title: 'Include this month in the averages' }, [chk]),
    ]));
  }
  head.push(el('th', { class: 'num', text: 'Avg/mo' }));
  head.push(el('th', { class: 'num', text: 'Total' }));

  const body = [];
  body.push(specialRow(m.income, months, m.excluded, 'income-row'));
  body.push(specialRow(m.expense, months, m.excluded, 'spend-row'));
  body.push(netRow(m, months));
  body.push(el('tr', { class: 'divider' }, [el('td', { colspan: String(months.length + 3) })]));
  for (const c of m.categories) body.push(catRow(c, months, m.excluded, m.maxCell));
  if (m.untagged) body.push(catRow(m.untagged, months, m.excluded, m.maxCell, true));

  const wrap = el('div', { class: 'matrix-wrap' }, [
    el('table', { class: 'tbl matrix' }, [
      el('thead', {}, [el('tr', {}, head)]),
      el('tbody', {}, body),
    ]),
  ]);

  return el('div', { class: 'card' }, [
    el('h3', { text: 'Monthly breakdown' }),
    el('p', { class: 'muted', text: 'What each category cost per month. Darker = more. Untick a month header to keep it out of the averages.' }),
    wrap,
  ]);
}

function specialRow(row, months, excluded, cls) {
  const cells = [el('td', { class: 'rowhead', text: row.name })];
  for (const mo of months) cells.push(el('td', { class: 'num' + (excluded.has(mo) ? ' off' : ''), text: eur.format(row.byMonth[mo]) }));
  cells.push(el('td', { class: 'num strong', text: eur.format(row.avg) }));
  cells.push(el('td', { class: 'num muted', text: eur.format(row.total) }));
  return el('tr', { class: cls }, cells);
}

function netRow(m, months) {
  const cells = [el('td', { class: 'rowhead', text: 'Net' })];
  for (const mo of months) {
    const v = m.income.byMonth[mo] - m.expense.byMonth[mo];
    cells.push(el('td', { class: 'num ' + (v < 0 ? 'neg' : 'pos') + (m.excluded.has(mo) ? ' off' : ''), text: eur.format(v) }));
  }
  const avg = m.income.avg - m.expense.avg;
  cells.push(el('td', { class: 'num strong ' + (avg < 0 ? 'neg' : 'pos'), text: eur.format(avg) }));
  cells.push(el('td', {}));
  return el('tr', { class: 'net-row' }, cells);
}

function catRow(c, months, excluded, maxCell, muted) {
  const cells = [el('td', { class: 'rowhead' + (muted ? ' muted' : ''), text: c.name })];
  for (const mo of months) {
    const v = c.byMonth[mo];
    const off = excluded.has(mo);
    const alpha = v > 0 && !off ? 0.1 + 0.62 * Math.min(v / maxCell, 1) : 0;
    const style = alpha > 0 ? `background: rgba(${ACCENT_RGB}, ${alpha.toFixed(3)})` : '';
    cells.push(el('td', { class: 'num heat' + (off ? ' off' : ''), style, text: v > 0 ? eur.format(v) : '·' }));
  }
  cells.push(el('td', { class: 'num strong', text: eur.format(c.avg) }));
  cells.push(el('td', { class: 'num muted', text: eur.format(c.total) }));
  return el('tr', {}, cells);
}

// Top single expenses, as magnitude bars (label carries identity).
function topCard(tops, skipped, cb) {
  if (!tops.length) return el('div');
  const max = Math.max(...tops.map((t) => t.amount), 1);
  const rows = tops.map((t) => el('div', {
    class: 'top-row' + (t.excluded ? ' off' : ''),
    title: 'Click to find this partner in Transactions',
    onclick: () => cb.onFocusPartner(t.partner, t.month),
  }, [
    el('div', { class: 'top-bar-wrap' }, [
      el('div', { class: 'top-bar', style: `width:${(t.amount / max * 100).toFixed(1)}%` }),
      el('div', { class: 'top-label' }, [
        el('span', { class: 'top-partner', text: t.partner }),
        el('span', { class: 'top-meta muted', text: `${t.date}${t.category ? ' · ' + t.category : ' · untagged'}${t.excluded ? ' · excluded month' : ''}` }),
      ]),
    ]),
    el('div', { class: 'top-amount num', text: eur2.format(t.amount) }),
  ]));
  return el('div', { class: 'card' }, [
    el('h3', { text: 'Top single expenses' }),
    el('p', { class: 'muted', text: `Your biggest single payments${skipped}. Click one to find it in Transactions.` }),
    el('div', { class: 'top-list' }, rows),
  ]);
}

function cutCandidates(b) {
  const opt = b.categories.filter((c) => !c.essential && c.monthly > 0).sort((a, c) => c.monthly - a.monthly).slice(0, 8);
  if (!opt.length) return null;
  const total = opt.reduce((a, c) => a + c.monthly, 0);
  return el('div', { class: 'card' }, [
    el('h3', { text: 'Where to cut' }),
    el('p', { class: 'muted', text: 'Optional spend, per typical month. Biggest first.' }),
    el('div', { class: 'chips' }, opt.map((c) => el('div', { class: 'chip' }, [
      el('span', { text: c.name }),
      el('strong', { text: eur.format(c.monthly) }),
    ]))),
    el('p', { class: 'muted', text: `Cut all of these and you save about ${eur.format(total)} per month.` }),
  ]);
}

// ---- Categories (controls) ------------------------------------------------

export function renderCategories(root, data, cb) {
  const b = data.budget;
  const sorted = [...b.categories].sort((a, c) => c.monthly - a.monthly);
  const rows = sorted.map((c) => {
    const ess = el('input', { type: 'checkbox' });
    ess.checked = c.essential;
    ess.disabled = c.ignore;
    ess.addEventListener('change', () => cb.onEssential(c.name, ess.checked));

    const ann = el('input', { type: 'checkbox' });
    ann.checked = c.annual;
    ann.addEventListener('change', () => cb.onAnnual(c.name, ann.checked));

    const ign = el('input', { type: 'checkbox' });
    ign.checked = c.ignore;
    ign.addEventListener('change', () => cb.onIgnore(c.name, ign.checked));

    const ov = el('input', { type: 'number', class: 'ov-input', placeholder: 'auto', min: '0', value: c.override ?? '' });
    ov.addEventListener('change', () => cb.onOverride(c.name, ov.value === '' ? null : parseFloat(ov.value)));

    const label = el('td', {}, [
      el('span', { text: c.name }),
      c.annual ? el('span', { class: 'tag', text: 'annual/12' }) : null,
      c.ignore ? el('span', { class: 'tag', text: 'not counted' }) : null,
      c.note ? el('span', { class: 'note', text: ' · ' + c.note }) : null,
    ]);

    return el('tr', { class: c.ignore ? 'ignored-row' : c.essential ? 'essential-row' : 'opt-row' }, [
      label,
      el('td', { class: 'num strong', text: eur.format(c.monthly) }),
      el('td', { class: 'num muted', text: eur.format(c.total) }),
      el('td', { class: 'num muted', text: String(c.count) }),
      el('td', { class: 'center' }, [ess]),
      el('td', { class: 'center' }, [ann]),
      el('td', { class: 'center' }, [ign]),
      el('td', {}, [ov]),
    ]);
  });

  const foot = el('tr', { class: 'total-row' }, [
    el('td', { text: 'Minimum monthly runway (essentials)' }),
    el('td', { class: 'num strong', text: eur.format(b.runway) }),
    el('td', {}), el('td', {}), el('td', {}), el('td', {}), el('td', {}), el('td', {}),
  ]);
  rows.push(foot);

  root.replaceChildren(
    el('div', { class: 'card' }, [
      el('h3', { text: 'Categories' }),
      el('p', { class: 'muted', text: 'Essential feeds the runway. Annual spreads a yearly cost over 12 months. Ignore drops a category from all spending totals (e.g. transfers to savings). Override sets a fixed €/month.' }),
      table(['Category', 'Monthly', 'Total', '#', 'Essential', 'Annual', 'Ignore', 'Override'], rows),
    ]),
    rulesCard(data.rules, cb),
  );
}

function selectCategory(current, onChange) {
  const sel = el('select', { class: 'sel' });
  sel.appendChild(el('option', { value: '', text: '— untagged —' }));
  for (const n of CATEGORY_NAMES) {
    const o = el('option', { value: n, text: n });
    if (n === current) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}

function rulesCard(rules, cb) {
  const rows = rules.map((r, idx) => el('tr', {}, [
    el('td', { class: 'mono', title: r.contains }, r.contains),
    el('td', { class: 'muted', text: r.field }),
    el('td', {}, [selectCategory(r.category, (v) => cb.onRuleChange(idx, v))]),
    el('td', {}, [el('button', { class: 'btn small ghost', onclick: () => cb.onRuleDelete(idx) }, 'Delete')]),
  ]));

  const contains = el('input', { type: 'text', class: 'search', placeholder: 'text to match, e.g. NETFLIX' });
  const field = el('select', { class: 'sel' });
  for (const f of ['partnerName', 'reference', 'iban', 'any']) field.appendChild(el('option', { value: f, text: f }));
  const cat = selectCategory('', () => {});
  const add = el('button', {
    class: 'btn small',
    onclick: () => {
      const v = contains.value.trim();
      if (!v) return;
      cb.onRuleAdd({ field: field.value, contains: v.toUpperCase(), category: cat.value });
    },
  }, 'Add rule');

  return el('div', { class: 'card' }, [
    el('h3', { text: 'Auto-tag rules' }),
    el('p', { class: 'muted', text: 'The first matching rule wins. Editing here re-tags everything you have not tagged by hand.' }),
    table(['Match', 'Field', 'Category', ''], rows),
    el('div', { class: 'toolbar' }, [contains, field, cat, add]),
  ]);
}
