// The list of categories, with sensible starting defaults.
// essential = counts toward the minimum monthly runway (you can toggle this in the app).
// annual    = a yearly cost spread over 12 months (e.g. car insurance paid once a year).
// You can change any of this in the dashboard; your changes are saved in the browser.

export const UNTAGGED = '';

export const CATEGORIES = [
  { name: 'Mortgage',           essential: true,  annual: false },
  { name: 'Savings',            essential: false, annual: false, ignore: true, note: 'money set aside, not consumed' },
  { name: 'HOA',                essential: true,  annual: false },
  { name: 'Heat',               essential: true,  annual: false },
  { name: 'Internet and phone', essential: true,  annual: false },
  { name: 'Electricity',        essential: true,  annual: false },
  { name: 'Subscriptions',      essential: false, annual: false },
  { name: 'Dog food',           essential: true,  annual: false },
  { name: 'Car insurance',      essential: true,  annual: true,  note: 'prorated over 12 months' },
  { name: 'Property tax',       essential: true,  annual: true,  note: 'prorated over 12 months' },
  { name: 'Road tax',           essential: true,  annual: true },
  { name: 'Water',              essential: true,  annual: false },
  { name: 'Car (lease)',        essential: true,  annual: false },
  { name: 'Groceries',          essential: true,  annual: false },
  { name: 'Supplements',        essential: false, annual: false },
  { name: 'Coffee',             essential: false, annual: false, note: 'at home, beans' },
  { name: 'Gas',                essential: true,  annual: false },
  { name: 'Hair salon',         essential: false, annual: false },
  { name: 'Impulse buys',       essential: false, annual: false },
  { name: 'Home stuff',         essential: false, annual: false, note: 'decor or needs' },
  { name: 'Leisure',            essential: false, annual: false, note: 'dining out etc' },
  { name: 'Travel',             essential: false, annual: false },
  { name: 'Clothes',            essential: false, annual: false },
  { name: 'Unexpected/Other',   essential: false, annual: false },
];

export const CATEGORY_NAMES = CATEGORIES.map((c) => c.name);
