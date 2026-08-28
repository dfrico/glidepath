// Auto-tagging engine. Rules match on partner name, reference, or IBAN.
// The first matching rule wins. Manual tags are never overwritten.

export function applyRules(tx, rules) {
  const name = (tx.partnerName || '').toUpperCase();
  const ref = (tx.reference || '').toUpperCase();
  const iban = (tx.partnerIban || '').toUpperCase();
  for (const r of rules) {
    const needle = (r.contains || '').toUpperCase();
    if (!needle) continue;
    let hay;
    if (r.field === 'partnerName') hay = name;
    else if (r.field === 'reference') hay = ref;
    else if (r.field === 'iban') hay = iban;
    else hay = name + ' ' + ref;
    if (hay.includes(needle)) return r.category;
  }
  return '';
}

// Re-apply rules to every transaction that you have not tagged by hand.
export function autoTagAll(transactions, rules) {
  for (const t of transactions) {
    if (t.manual) continue;
    t.category = applyRules(t, rules);
  }
}

export function makeRuleFromTx(tx, category) {
  return { field: 'partnerName', contains: (tx.partnerName || '').toUpperCase().trim(), category };
}
