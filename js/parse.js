// CSV parsing. Runs fully in the browser. The bank export uses tab separators,
// but this auto-detects tab, semicolon, or comma, and handles euro number formats.

const HEADER_MAP = {
  'booking date': 'bookingDate',
  'value date': 'valueDate',
  'partner name': 'partnerName',
  'partner iban': 'partnerIban',
  'type': 'type',
  'payment reference': 'reference',
  'account name': 'accountName',
  'amount (eur)': 'amount',
  'amount': 'amount',
  'original amount': 'originalAmount',
  'original currency': 'originalCurrency',
  'exchange rate': 'exchangeRate',
};

export function parseCsv(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.length > 0);
  if (!lines.length) return { rows: [], error: 'The file is empty.' };

  const delim = detectDelimiter(lines[0]);
  const header = parseLine(lines[0], delim).map((h) => h.trim().toLowerCase());
  const keys = header.map((h) => HEADER_MAP[h] || null);

  if (!keys.includes('amount')) {
    return { rows: [], error: 'No "Amount (EUR)" column found. Check the file header.' };
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i], delim);
    if (cells.every((c) => c.trim() === '')) continue;
    const r = {};
    cells.forEach((val, idx) => {
      const k = keys[idx];
      if (k) r[k] = val.trim();
    });
    r.amount = parseAmount(r.amount);
    if (r.amount == null) continue;
    r.id = hashId(r);
    rows.push(r);
  }
  return { rows, delim, mappedColumns: keys.filter(Boolean).length };
}

function detectDelimiter(line) {
  const candidates = ['\t', ';', ','];
  let best = '\t';
  let max = -1;
  for (const d of candidates) {
    const count = line.split(d).length - 1;
    if (count > max) { max = count; best = d; }
  }
  return max > 0 ? best : '\t';
}

function parseLine(line, delim) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

// Handles "-248.30", "-1.234,56", "1 234,56 €", etc.
export function parseAmount(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/[^0-9.,-]/g, '');
  if (!s || s === '-') return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastComma > lastDot) {
    // comma is the decimal separator
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // dot is the decimal separator (or no decimals)
    s = s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

// Stable id from the row content, so re-importing keeps your tags.
function hashId(r) {
  const key = [r.bookingDate, r.valueDate, r.amount, r.partnerName, r.reference].join('|');
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return 't' + h.toString(36);
}
