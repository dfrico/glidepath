// The transaction list: filter, search, and fast tagging.
// Tagging is a native dropdown, so you can click it and type the first letters.
// With "Learn" on, tagging one row also tags every other untagged row from the
// same partner and remembers it for future imports.

import { el, eur2, table } from './dom.js';
import { CATEGORY_NAMES } from './categories.js';

export function renderTransactions(root, transactions, filters, settings, cb) {
  const listWrap = el('div', {});
  const count = el('span', { class: 'muted count' });

  function draw() {
    const filtered = applyFilters(transactions, filters);
    listWrap.replaceChildren(txTable(filtered, cb));
    count.textContent = `${filtered.length} shown · ${transactions.length} total`;
  }

  const search = el('input', { id: 'txSearch', type: 'search', class: 'search', placeholder: 'Search partner or reference…', value: filters.q });
  search.addEventListener('input', () => { filters.q = search.value; draw(); });

  const monthSel = selectFilter(monthsOf(transactions), filters.month, 'All months', (v) => { filters.month = v; draw(); });
  const catSel = selectFilter(CATEGORY_NAMES, filters.category, 'All categories', (v) => { filters.category = v; draw(); });

  const untagged = el('input', { type: 'checkbox' });
  untagged.checked = filters.untaggedOnly;
  untagged.addEventListener('change', () => { filters.untaggedOnly = untagged.checked; draw(); });

  const learn = el('input', { type: 'checkbox' });
  learn.checked = settings.learn;
  learn.addEventListener('change', () => cb.onLearn(learn.checked));

  const toolbar = el('div', { class: 'toolbar' }, [
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

function applyFilters(transactions, f) {
  const q = f.q.trim().toUpperCase();
  return transactions.filter((t) => {
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
