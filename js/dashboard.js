// Two views built from the budget and analysis data:
//   renderOverview  — the insights: plan, month-by-category breakdown, top spend, cuts
//   renderCategories — the controls: essential/annual/override per category

import { el, eur, eur2, table } from './dom.js';

const ACCENT_RGB = '79,157,255';

// ---- Overview -------------------------------------------------------------

export function renderOverview(root, b, matrix, tops, settings, cb) {
  const parts = [];
  if (b.untaggedCount > 0) parts.push(untaggedBanner(b, cb));
  parts.push(kpis(b));
  parts.push(planCard(b, settings, cb));
  parts.push(matrixCard(matrix, cb));
  parts.push(topCard(tops, cb));
  const cuts = cutCandidates(b);
  if (cuts) parts.push(cuts);
  root.replaceChildren(...parts);
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

function kpis(b) {
  const net = b.avgIncome - b.avgSpend;
  return el('div', { class: 'kpis' }, [
    kpi('Avg income / month', eur.format(b.avgIncome)),
    kpi('Avg spend / month', eur.format(b.avgSpend)),
    kpi('Avg net / month', eur.format(net), net < 0 ? 'you spend more than you earn' : 'in the black', net < 0 ? 'neg' : 'pos'),
    kpi('Minimum / month', eur.format(b.runway), 'essentials only — your runway base', 'accent'),
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

  const inputs = el('div', { class: 'plan-inputs' }, [
    el('label', {}, ['Cash on hand (€)', cash]),
    el('label', {}, ['Make it last (months)', target]),
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

  let verdict;
  if (plan.optionalRoom < 0) {
    verdict = status('critical', `Your essentials alone cost more than ${eur.format(plan.allowedMonthly)} per month. To last ${plan.targetMonths} months you must cut essentials, add cash, or shorten the target.`);
  } else if (plan.surplus >= 0) {
    verdict = status('good', `You are within budget by about ${eur.format(plan.surplus)} per month at your current spend.`);
  } else {
    verdict = status('critical', `Cut about ${eur.format(-plan.surplus)} per month from your current spend to last ${plan.targetMonths} months.`);
  }
  return el('div', {}, [rows, verdict]);
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
function topCard(tops, cb) {
  if (!tops.length) return el('div');
  const max = Math.max(...tops.map((t) => t.amount), 1);
  const rows = tops.map((t) => el('div', {
    class: 'top-row' + (t.excluded ? ' off' : ''),
    title: 'Click to find this partner in Transactions',
    onclick: () => cb.onFocusPartner(t.partner),
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
    el('p', { class: 'muted', text: 'Your biggest one-off payments. Click one to find it in Transactions.' }),
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

export function renderCategories(root, b, cb) {
  const sorted = [...b.categories].sort((a, c) => c.monthly - a.monthly);
  const rows = sorted.map((c) => {
    const ess = el('input', { type: 'checkbox' });
    ess.checked = c.essential;
    ess.addEventListener('change', () => cb.onEssential(c.name, ess.checked));

    const ann = el('input', { type: 'checkbox' });
    ann.checked = c.annual;
    ann.addEventListener('change', () => cb.onAnnual(c.name, ann.checked));

    const ov = el('input', { type: 'number', class: 'ov-input', placeholder: 'auto', min: '0', value: c.override ?? '' });
    ov.addEventListener('change', () => cb.onOverride(c.name, ov.value === '' ? null : parseFloat(ov.value)));

    const label = el('td', {}, [
      el('span', { text: c.name }),
      c.annual ? el('span', { class: 'tag', text: 'annual/12' }) : null,
      c.note ? el('span', { class: 'note', text: ' · ' + c.note }) : null,
    ]);

    return el('tr', { class: c.essential ? 'essential-row' : 'opt-row' }, [
      label,
      el('td', { class: 'num strong', text: eur.format(c.monthly) }),
      el('td', { class: 'num muted', text: eur.format(c.total) }),
      el('td', { class: 'num muted', text: String(c.count) }),
      el('td', { class: 'center' }, [ess]),
      el('td', { class: 'center' }, [ann]),
      el('td', {}, [ov]),
    ]);
  });

  const foot = el('tr', { class: 'total-row' }, [
    el('td', { text: 'Minimum monthly runway (essentials)' }),
    el('td', { class: 'num strong', text: eur.format(b.runway) }),
    el('td', {}), el('td', {}), el('td', {}), el('td', {}), el('td', {}),
  ]);
  rows.push(foot);

  root.replaceChildren(el('div', { class: 'card' }, [
    el('h3', { text: 'Categories' }),
    el('p', { class: 'muted', text: 'Essential feeds the runway. Annual spreads a yearly cost over 12 months. Override sets a fixed €/month. Monthly is the typical-month cost; annual categories show yearly total ÷ 12.' }),
    table(['Category', 'Monthly', 'Total', '#', 'Essential', 'Annual', 'Override'], rows),
  ]));
}
