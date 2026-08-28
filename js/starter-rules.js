// Starter auto-tag rules for common Spanish / euro-zone merchants.
// These are guesses to save you the first pass. Edit, add, or remove freely.
// Each rule: { field: 'partnerName' | 'reference' | 'iban' | 'any', contains, category }
// Matching is case-insensitive "contains". The first rule that matches wins.
// The app also learns: when you tag a row by hand, it adds a rule for that partner.

function toRules(category, needles) {
  return needles.map((contains) => ({ field: 'partnerName', contains: contains.toUpperCase().trim(), category }));
}

export const STARTER_RULES = [
  ...toRules('Groceries', ['MERCADONA', 'CARREFOUR', 'LIDL', 'ALDI', 'EROSKI', 'ALCAMPO', 'CONSUM', 'SUPERCOR', 'AHORRAMAS', 'HIPERCOR']),
  ...toRules('Gas', ['REPSOL', 'CEPSA', 'GALP', 'SHELL', 'PETRONOR', 'PLENOIL', 'BALLENOIL', 'ESTACION DE SERVICIO']),
  ...toRules('Subscriptions', ['NETFLIX', 'SPOTIFY', 'HBO', 'DISNEY', 'YOUTUBE', 'ICLOUD', 'APPLE.COM', 'GOOGLE', 'AMAZON PRIME', 'PRIME VIDEO', 'OPENAI', 'CHATGPT', 'DROPBOX', 'MICROSOFT']),
  ...toRules('Internet and phone', ['MOVISTAR', 'VODAFONE', 'ORANGE', 'YOIGO', 'MASMOVIL', 'DIGI', 'PEPEPHONE', 'LOWI', 'JAZZTEL']),
  ...toRules('Electricity', ['IBERDROLA', 'ENDESA', 'HOLALUZ', 'TOTALENERGIES']),
  ...toRules('Heat', ['NATURGY', 'REDEXIS', 'GAS NATURAL']),
  ...toRules('Water', ['CANAL DE ISABEL', 'AGUAS', 'EMASESA', 'HIDRALIA', 'AGBAR', 'AQUALIA']),
  ...toRules('Dog food', ['TIENDANIMAL', 'KIWOKO', 'ZOOPLUS', 'MASKOTA']),
  ...toRules('Car insurance', ['MUTUA', 'MAPFRE', 'LINEA DIRECTA', 'ALLIANZ', 'GENERALI', 'ZURICH', 'PELAYO', 'REALE', 'AXA']),
  // Amazon retail is usually stuff for the house. Manual tags still win.
  { field: 'any', contains: 'AMZN', category: 'Home stuff' },
];
