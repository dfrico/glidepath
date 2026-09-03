// The Budget tab: track this month's spend against your typical-month budget.
//
// The budget for each category is the "monthly" figure computed for the runway
// (typical month, annual/12, or a fixed override). Here we compare the spend of
// one chosen month against that budget: a donut of where the money went, a bar
// per category filled to the percent spent, and the month's transactions
// (read-only — tag them over in Transactions).

import { el, eur, eur2 } from './dom.js';
import { monthKey } from './budget.js';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// A Glasbey-style palette: colours chosen to be as perceptually far apart as
// possible, so many categories stay distinct. This set is filtered for a dark
// background — very dark or washed-out colours are dropped so every swatch reads.
const PALETTE = [
  '#3283fe', '#feaf16', '#2ed9ff', '#f8a19f', '#16ff32', '#e15f99',
  '#b00068', '#1cffce', '#c4451c', '#90ad1c', '#aa0dfe', '#f6222e',
  '#85660d', '#565656', '#1c8356', '#fbe426', '#1cbe4f', '#fa0087',
  '#325a9b', '#c075a6', '#ffcb1f', '#66b0ff', '#3b00fb', '#dea0fd',
  '#0d8c3f', '#ff6b6b', '#00c0c7', '#d95bd8', '#a1e05a', '#e07b39',
];
function catColor(i) { return PALETTE[i % PALETTE.length]; }

function monthLabel(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  return `${MON[m - 1]} ${y}`;
}

// Build the per-category comparison for one month, plus that month's rows.
export function trackMonth(transactions, budgetRows, month) {
  const byCat = {};
  budgetRows.forEach((r, i) => {
    byCat[r.name] = {
      name: r.name, budget: r.monthly, essential: r.essential, ignore: r.ignore,
      spent: 0, count: 0, color: catColor(i),
    };
  });

  let untaggedSpent = 0;
  const txs = [];
  for (const t of transactions) {
    if (monthKey(t) !== month) continue;
    txs.push(t);
    if (t.amount >= 0) continue; // expenses only feed the budget
    const spend = -t.amount;
    const cat = t.category || '';
    if (!cat) { untaggedSpent += spend; continue; }
    const c = byCat[cat];
    if (c) { c.spent += spend; c.count++; }
  }

  // Ignored categories (Savings, Income, One-off) have no meaningful budget.
  const cats = budgetRows
    .map((r) => byCat[r.name])
    .filter((c) => !c.ignore && (c.budget > 0 || c.spent > 0));
  for (const c of cats) {
    c.pct = c.budget > 0 ? c.spent / c.budget : (c.spent > 0 ? Infinity : 0);
  }

  const totalBudget = cats.reduce((a, c) => a + c.budget, 0);
  const totalSpent = cats.reduce((a, c) => a + c.spent, 0);

  return { month, cats, txs, untaggedSpent, totalBudget, totalSpent };
}

export function renderBudget(root, transactions, budget, settings, sort, cb) {
  const months = budget.months;
  if (!months.length) { root.replaceChildren(el('p', { class: 'muted', text: 'No months of data yet.' })); return; }

  const month = months.includes(settings.budgetMonth) ? settings.budgetMonth : months[months.length - 1];
  const data = trackMonth(transactions, budget.categories, month);

  root.replaceChildren(
    header(months, month, cb),
    summaryCard(data),
    breakdownCard(data),
    txCard(data, sort, cb),
  );
}

function header(months, month, cb) {
  const sel = el('select', { class: 'sel' });
  for (const m of months) {
    const o = el('option', { value: m, text: monthLabel(m) });
    if (m === month) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => cb.onBudgetMonth(sel.value));
  return el('div', { class: 'budget-head' }, [
    el('label', { class: 'muted', text: 'Tracking month' }),
    sel,
  ]);
}

// Donut of where the money went, with the month's spend vs budget in the hole.
function summaryCard(d) {
  const overall = d.totalBudget > 0 ? d.totalSpent / d.totalBudget : 0;
  const pctText = d.totalBudget > 0 ? Math.round(overall * 100) + '%' : '—';
  const cls = overall > 1 ? 'neg' : 'pos';

  const withSpend = d.cats.filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent);
  const legend = el('div', { class: 'donut-legend' }, withSpend.map((c) => el('div', { class: 'legend-row' }, [
    el('span', { class: 'legend-dot', style: `background:${c.color}` }),
    el('span', { class: 'legend-name', text: c.name }),
    el('span', { class: 'legend-val num muted', text: eur.format(c.spent) }),
  ])));

  const note = d.untaggedSpent > 0
    ? el('p', { class: 'muted small', text: `${eur.format(d.untaggedSpent)} of this month's spend is untagged and not counted here. Tag it in Transactions.` })
    : null;

  return el('div', { class: 'card' }, [
    el('h3', { text: `Spend vs budget · ${monthLabel(d.month)}` }),
    el('div', { class: 'donut-wrap' }, [
      el('div', { class: 'donut', html: donutSvg(withSpend, d.totalSpent, pctText, cls) }),
      legend,
    ]),
    el('p', { class: 'muted', text: `Spent ${eur.format(d.totalSpent)} of a ${eur.format(d.totalBudget)} budget this month.` }),
    note,
  ]);
}

function donutSvg(cats, totalSpent, centerPct, centerCls) {
  const S = 200, r = 78, cx = S / 2, cy = S / 2;
  const C = 2 * Math.PI * r;
  const total = totalSpent || 1;
  let offset = 0;
  let segs = '';
  for (const c of cats) {
    const len = (c.spent / total) * C;
    segs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c.color}" stroke-width="26" `
      + `stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"><title>${c.name}: ${eur.format(c.spent)}</title></circle>`;
    offset += len;
  }
  if (!cats.length) {
    segs = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#2a2a2a" stroke-width="26"/>`;
  }
  const centerColor = centerCls === 'neg' ? '#ec6a5e' : '#3fb950';
  return `<svg viewBox="0 0 ${S} ${S}" role="img" aria-label="Spend by category">
    <g transform="rotate(-90 ${cx} ${cy})">${segs}</g>
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="${centerColor}" font-size="30" font-weight="700">${centerPct}</text>
    <text x="${cx}" y="${cy + 18}" text-anchor="middle" fill="#898781" font-size="12">of budget</text>
  </svg>`;
}

// One bar per category, filled to the percent of budget spent.
function breakdownCard(d) {
  // Essentials first, then optional. Within each group, biggest budget first.
  const cats = d.cats.slice().sort((a, b) =>
    (b.essential - a.essential) || (b.budget - a.budget));
  const rows = cats.map((c) => {
    const over = c.pct > 1;
    const noBudget = !(c.budget > 0);
    const fill = Math.min(c.pct, 1) * 100;
    const overFill = over && !noBudget ? Math.min(c.pct - 1, 1) * 100 : 0;
    const pctText = noBudget ? 'no budget' : Math.round(c.pct * 100) + '%';

    return el('div', { class: 'bud-row' + (over ? ' over' : '') }, [
      el('div', { class: 'bud-top' }, [
        el('span', { class: 'bud-name' }, [
          el('span', { class: 'legend-dot', style: `background:${c.color}` }),
          c.name,
          c.essential ? el('span', { class: 'tag', text: 'essential' }) : null,
        ]),
        el('span', { class: 'bud-figs num' }, [
          el('strong', { text: eur.format(c.spent) }),
          el('span', { class: 'muted', text: ' / ' + (noBudget ? '—' : eur.format(c.budget)) }),
          el('span', { class: 'bud-pct ' + (over ? 'neg' : 'muted'), text: ' · ' + pctText }),
        ]),
      ]),
      el('div', { class: 'bud-track' }, [
        el('div', { class: 'bud-fill', style: `width:${fill.toFixed(1)}%;background:${c.color}` }),
        overFill > 0 ? el('div', { class: 'bud-over', style: `width:${overFill.toFixed(1)}%` }) : null,
      ]),
    ]);
  });

  return el('div', { class: 'card' }, [
    el('h3', { text: 'By category' }),
    el('p', { class: 'muted', text: 'How much of each budget you have spent this month. Bars past full turn red for over budget.' }),
    el('div', { class: 'bud-list' }, rows),
  ]);
}

// The month's transactions, sortable, read-only (tag them in Transactions).
function txCard(d, sort, cb) {
  const rows = sortTxs(d.txs, sort);
  const body = rows.map((t) => el('tr', { class: t.amount > 0 ? 'income' : '' }, [
    el('td', { class: 'nowrap', text: t.bookingDate || '' }),
    el('td', { title: t.partnerName || '' }, t.partnerName || '(no name)'),
    el('td', { class: 'ref', title: t.reference || '' }, t.reference || ''),
    el('td', { class: 'num ' + (t.amount < 0 ? 'neg' : 'pos'), text: eur2.format(t.amount) }),
    el('td', { class: t.category ? '' : 'muted', text: t.category || 'untagged' }),
  ]));

  const cols = [
    { key: 'bookingDate', label: 'Date' },
    { key: 'partnerName', label: 'Partner' },
    { key: 'reference', label: 'Reference' },
    { key: 'amount', label: 'Amount', num: true },
    { key: 'category', label: 'Category' },
  ];
  const head = el('tr', {}, cols.map((col) => {
    const active = sort.key === col.key;
    const arrow = active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return el('th', { class: 'sortable' + (col.num ? ' num' : '') + (active ? ' sorted' : ''), onclick: () => cb.onBudgetSort(col.key) }, col.label + arrow);
  }));

  return el('div', { class: 'card' }, [
    el('h3', { text: `Transactions · ${monthLabel(d.month)}` }),
    el('p', { class: 'muted', text: 'This month only. Click a header to sort. To tag, use the Transactions tab.' }),
    el('div', { class: 'tx-wrap' }, [
      el('table', { class: 'tbl' }, [el('thead', {}, [head]), el('tbody', {}, body)]),
    ]),
  ]);
}

function sortTxs(txs, sort) {
  const dir = sort.dir === 'asc' ? 1 : -1;
  const key = sort.key;
  return txs.slice().sort((a, b) => {
    let av = a[key], bv = b[key];
    if (key === 'amount') return (av - bv) * dir;
    av = (av || '').toString().toUpperCase();
    bv = (bv || '').toString().toUpperCase();
    return av < bv ? -dir : av > bv ? dir : 0;
  });
}
