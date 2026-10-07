# Expense budget — notes for Claude

## What this is
A local, in-browser **budget app**. The core question it answers is
"am I on track with my budget?" — typical-month budgets per category, and this
month's spend against them (Budget tab). Runway / cash forecast is a secondary
mode for when the user has no income (e.g. unemployed). Bank data never leaves
the browser.

## Run
`python3 -m http.server 8137` from the repo root, open http://localhost:8137.
No build, no dependencies, no tests — verify changes in the browser.

## Conventions
- Vanilla ES modules only. No frameworks, no npm, no bundler. Build DOM with
  `el()` from `js/dom.js`; format money with `eur` / `eur2`.
- One `state` object in `js/main.js`. Views never mutate state: they get
  callbacks (`dashCb`, `txCb`); main updates state, saves via `store.js`, then
  re-renders the affected panels. Each view rebuilds its panel from scratch.
- Maths lives in pure modules (`budget.js`, `analysis.js`, `forecast.js`),
  not in view files.
- New settings: add a default in `store.loadSettings()` (backup/restore picks
  them up automatically). Category list and defaults: `js/categories.js`.
- Dates are ISO strings (`YYYY-MM-DD`); months are `YYYY-MM` via `monthKey()`.
  Expenses are negative amounts.
- Semantics to respect everywhere: excluded months stay out of averages;
  `annual` categories are total / max(months of data, 12); `ignore` categories (Savings, Income,
  One-off) are not spending; `budgetOverride` replaces the computed monthly.
  Manual tags are never overwritten by rules; the first matching rule wins;
  rules match whole words (`containsWord` in `tagging.js`), not raw substrings.
- Dark theme only; use the CSS variables in `css/styles.css`.
- Keep the README (user-facing) in sync when adding tabs, cards, or files.
