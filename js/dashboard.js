// The dashboard: headline numbers, runway, where to cut, by month, by category.

import { el, eur, table } from './dom.js';

export function renderDashboard(root, b, settings, cb) {
  const parts = [];
  if (b.untaggedCount > 0) parts.push(untaggedBanner(b, cb));
  parts.push(kpis(b));
  parts.push(cashBox(b, settings, cb));
  const cuts = cutCandidates(b);
  if (cuts) parts.push(cuts);
  parts.push(monthsTable(b, cb));
  parts.push(categoryTable(b, cb));
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

function cashBox(b, settings, cb) {
  const input = el('input', {
    type: 'number', class: 'cash-input', placeholder: 'e.g. 12000', min: '0',
    value: settings.cash ?? '',
  });
  input.addEventListener('change', () => cb.onCash(input.value === '' ? null : parseFloat(input.value)));

  return el('div', { class: 'card cashbox' }, [
    el('div', { class: 'cashbox-in' }, [
      el('label', { text: 'Cash on hand (€)' }),
      input,
    ]),
    el('div', { class: 'cashbox-out' }, [
      el('div', {}, [el('span', { class: 'muted', text: 'Runway at essentials only: ' }), el('strong', { text: fmtMonths(b.runwayMonths) })]),
      el('div', {}, [el('span', { class: 'muted', text: 'Runway at current spend: ' }), el('strong', { text: fmtMonths(b.burnMonths) })]),
    ]),
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

function monthsTable(b, cb) {
  const max = Math.max(1, ...b.months.map((m) => b.byMonth[m].expense));
  const rows = b.months.map((m) => {
    const d = b.byMonth[m];
    const net = d.income - d.expense;
    const keep = el('input', { type: 'checkbox' });
    keep.checked = !d.excluded;
    keep.addEventListener('change', () => cb.onMonthInclude(m, keep.checked));
    return el('tr', { class: d.excluded ? 'muted-row' : '' }, [
      el('td', { text: m }),
      el('td', { class: 'num', text: eur.format(d.income) }),
      el('td', { class: 'num', text: eur.format(d.expense) }),
      el('td', { class: 'num ' + (net < 0 ? 'neg' : 'pos'), text: eur.format(net) }),
      el('td', {}, [el('div', { class: 'bar' }, [el('div', { class: 'bar-fill', style: `width:${(d.expense / max * 100).toFixed(0)}%` })])]),
      el('td', { class: 'center' }, [keep]),
    ]);
  });
  return el('div', { class: 'card' }, [
    el('h3', { text: 'By month' }),
    el('p', { class: 'muted', text: 'Untick a month (e.g. your wedding month) to keep it out of the averages and runway.' }),
    table(['Month', 'Income', 'Spend', 'Net', 'Spend level', 'In averages'], rows),
  ]);
}

function categoryTable(b, cb) {
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

  return el('div', { class: 'card' }, [
    el('h3', { text: 'By category' }),
    el('p', { class: 'muted', text: 'Essential feeds the runway. Annual spreads a yearly cost over 12 months. Override sets a fixed €/month.' }),
    table(['Category', 'Monthly', 'Total', '#', 'Essential', 'Annual', 'Override'], rows),
  ]);
}
