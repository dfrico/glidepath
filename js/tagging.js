// Auto-tagging engine. Rules match on partner name, reference, or IBAN.
// The first matching rule wins. Manual tags are never overwritten.
// A rule matches whole words only: "SHELL" matches "SHELL 1234" but not
// "SHELLFISH BAR"; "DIGI" does not match "DIGITAL".

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
    if (containsWord(hay, needle)) return r.category;
  }
  return '';
}

// True if needle appears in hay with no letter or digit right before or after.
// Unicode-aware, so Ñ, Á, etc. count as letters.
function containsWord(hay, needle) {
  let i = hay.indexOf(needle);
  while (i !== -1) {
    const before = hay[i - 1];
    const after = hay[i + needle.length];
    if (!isWordChar(before) && !isWordChar(after)) return true;
    i = hay.indexOf(needle, i + 1);
  }
  return false;
}

function isWordChar(c) { return c != null && /[\p{L}\p{N}]/u.test(c); }

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
