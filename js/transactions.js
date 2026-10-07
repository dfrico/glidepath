// The transaction list: filter, search, and fast tagging.
// Tagging is a native dropdown, so you can click it and type the first letters.
// With "Learn" on, tagging one row also tags every other untagged row from the
// same partner and remembers it for future imports.
//
// The list shows the last 3 months by default: years of rows (each with its own
// category dropdown) make rendering and tagging slow. All the data still feeds
// the averages elsewhere; this only limits what is listed.

import { el, eur2, table } from './dom.js';
import { CATEGORY_NAMES } from './categories.js';
import { addMonths } from './budget.js';

// Period options. Counted back from the latest month in the data, not today,
// so an import that ends last month still shows 3 full months.
const PERIODS = [
  { value: '3', label: 'Last 3 months' },
  { value: '12', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
];

export function renderTransactions(root, transactions, filters, settings, cb) {
  const listWrap = el('div', {});
  const count = el('span', { class: 'muted count' });

  const allMonths = monthsOf(transactions);
  const fromMonth = periodStart(allMonths, filters.period);
  const months = allMonths.filter((m) => m >= fromMonth);
  if (filters.month && !months.includes(filters.month)) filters.month = '';

  function draw() {
    const filtered = byDateDesc(applyFilters(transactions, filters, fromMonth));
    listWrap.replaceChildren(txTable(filtered, cb));
    // Say when the period hides rows that match, so they never seem lost.
    // Filtering is cheap; only drawing rows is slow.
    const hidden = fromMonth ? applyFilters(transactions, filters, '').length - filtered.length : 0;
    count.textContent = `${filtered.length} shown` + (hidden > 0 ? ` · ${hidden} more in older months` : '') + ` · ${transactions.length} total`;
  }

  // Changing the period also changes which months the month filter offers.
  const periodSel = el('select', { class: 'sel' }, PERIODS.map((p) => {
    const o = el('option', { value: p.value, text: p.label });
    if (p.value === filters.period) o.selected = true;
    return o;
  }));
  periodSel.addEventListener('change', () => {
    filters.period = periodSel.value;
    renderTransactions(root, transactions, filters, settings, cb);
  });

  const search = el('input', { id: 'txSearch', type: 'search', class: 'search', placeholder: 'Search partner or reference…', value: filters.q });
  search.addEventListener('input', () => { filters.q = search.value; draw(); });

  const monthSel = selectFilter(months.slice().reverse(), filters.month, 'All months', (v) => { filters.month = v; draw(); });
  const catSel = selectFilter(CATEGORY_NAMES, filters.category, 'All categories', (v) => { filters.category = v; draw(); });

  const untagged = el('input', { type: 'checkbox' });
  untagged.checked = filters.untaggedOnly;
  untagged.addEventListener('change', () => { filters.untaggedOnly = untagged.checked; draw(); });

  const learn = el('input', { type: 'checkbox' });
  learn.checked = settings.learn;
  learn.addEventListener('change', () => cb.onLearn(learn.checked));

  const toolbar = el('div', { class: 'toolbar' }, [
    periodSel,
    search,
    monthSel,
    catSel,
    el('label', { class: 'check' }, [untagged, ' Untagged only']),
    el('label', { class: 'check', title: 'Tagging a row also tags other untagged rows from the same partner, and remembers it.' }, [learn, ' Learn']),
    el('button', { class: 'btn small ghost', onclick: () => cb.onRetag() }, 'Re-run auto-tag'),
    el('button', { class: 'btn small ghost', onclick: () => cb.onExport() }, 'Export tagged CSV'),
    count,
  ]);

  root.replaceChildren(toolbar, listWrap);
  draw();
}

function selectFilter(options, current, allLabel, onChange) {
  const sel = el('select', { class: 'sel' });
  sel.appendChild(el('option', { value: '', text: allLabel }));
  for (const o of options) {
    const opt = el('option', { value: o, text: o });
    if (o === current) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}

function monthsOf(transactions) {
  const set = new Set();
  for (const t of transactions) {
    const m = (t.bookingDate || '').slice(0, 7);
    if (m) set.add(m);
  }
  return [...set].sort();
}

// The shortest period that still shows month `ym`, so jumping to an old
// expense works without listing everything.
export function smallestPeriodFor(transactions, ym) {
  const months = monthsOf(transactions);
  for (const p of PERIODS) {
    const from = periodStart(months, p.value);
    if (!from || !ym || ym >= from) return p.value;
  }
  return 'all';
}

// First month of the chosen period ('' = no limit).
function periodStart(months, period) {
  const n = Number(period);
  if (!n || !months.length) return '';
  return addMonths(months[months.length - 1], -(n - 1));
}

function applyFilters(transactions, f, fromMonth) {
  const q = f.q.trim().toUpperCase();
  return transactions.filter((t) => {
    if (fromMonth && (t.bookingDate || '').slice(0, 7) < fromMonth) return false;
    if (f.untaggedOnly && (t.category || t.amount > 0)) return false;
    if (f.month && (t.bookingDate || '').slice(0, 7) !== f.month) return false;
    if (f.category && t.category !== f.category) return false;
    if (q) {
      const hay = ((t.partnerName || '') + ' ' + (t.reference || '')).toUpperCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// Most recent first. Dates are ISO (YYYY-MM-DD), so string order is date order.
// Same-day rows keep their import order (sort is stable).
function txDate(t) { return t.bookingDate || t.valueDate || ''; }
function byDateDesc(rows) {
  return rows.slice().sort((a, b) => (txDate(a) < txDate(b) ? 1 : txDate(a) > txDate(b) ? -1 : 0));
}

function txTable(rows, cb) {
  const body = rows.map((t) => {
    const sel = el('select', { class: 'catsel' + (t.manual ? ' manual' : '') });
    sel.appendChild(el('option', { value: '', text: '— untagged —' }));
    for (const name of CATEGORY_NAMES) {
      const opt = el('option', { value: name, text: name });
      if (t.category === name) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => cb.onTag(t.id, sel.value));

    return el('tr', { class: t.amount > 0 ? 'income' : '' }, [
      el('td', { class: 'nowrap', text: t.bookingDate || '' }),
      el('td', { title: t.partnerName || '' }, t.partnerName || '(no name)'),
      el('td', { class: 'ref', title: t.reference || '' }, t.reference || ''),
      el('td', { class: 'num ' + (t.amount < 0 ? 'neg' : 'pos'), text: eur2.format(t.amount) }),
      el('td', {}, [sel]),
    ]);
  });
  return table(['Date', 'Partner', 'Reference', 'Amount', 'Category'], body);
}
