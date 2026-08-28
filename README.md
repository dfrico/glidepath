# Expense budget

A small local web app to budget your expenses and find your runway.
It runs fully in your browser. Your bank data stays on your machine — nothing is uploaded.

## Run it

```
cd expense-budget
python3 -m http.server 8137
```

Then open http://localhost:8137 in your browser.

(A plain web server is needed because the app uses ES modules, which browsers
block when you open the file directly with `file://`.)

## Use it

1. Drop your bank CSV on the page, or click "Import CSV".
2. The app auto-tags known merchants and opens on Overview.
3. Go to Transactions, filter to "Untagged only", and tag the rest.
   With "Learn" on, tagging one row tags every untagged row from the same
   partner and remembers it for next time.

## The three tabs

- Overview — the insights:
  - Headline numbers: average income, spend, net, and the minimum per month.
  - Budget plan: enter your cash and how many months you want it to last. It
    gives you a monthly spending cap, your essentials floor, the room left for
    optional spend, and a clear verdict (within budget, or cut €X per month).
  - Cash forecast: add any expected income (e.g. unemployment benefit) and how
    many months it lasts. It projects your balance month by month and shows the
    exact month you run out, for two scenarios — essentials only and your
    current plan. It updates as you toggle categories, so cuts turn into months.
  - Monthly breakdown: a category-by-month grid, shaded by amount, with an
    average-per-month column. Untick a month header (e.g. your wedding month)
    to keep it out of the averages.
  - Recurring commitments: payments that repeat most months, with their yearly
    cost. The optional ones are flagged "cut?" — your easiest savings.
  - Top single expenses: your biggest one-off payments. Click one to find it
    in Transactions.
  - Where to cut: your biggest optional costs per month.
- Categories — the controls:
  - Toggle Essential and Annual per category, or set a fixed monthly override.
  - Ignore drops a category from all spending totals (default on for Savings),
    so transfers to yourself do not count as spending.
  - Auto-tag rules: view, edit, or delete the rules the app learned.
- Transactions — the full list, filter, search, and fast tagging.

## Keep your work safe

Your data and tags live in this browser. Use Backup to save everything to a JSON
file, and Restore to load it back (on a new machine, or after clearing the
browser). This protects the time you spend tagging.

## Key numbers

- Minimum / month = sum of essential categories. This is your runway base.
- Runway at essentials only = cash on hand ÷ minimum monthly.
- Runway at current spend = cash on hand ÷ average monthly spend.
- Budget plan cap = cash on hand ÷ target months. Room for optional = cap minus
  essentials.

## Files

- `index.html` — page shell
- `css/styles.css` — styles
- `js/parse.js` — CSV parsing (tab/semicolon/comma, euro numbers)
- `js/categories.js` — the category list and defaults
- `js/starter-rules.js` — merchant auto-tag rules (edit freely)
- `js/tagging.js` — the auto-tag engine
- `js/budget.js` — the budget, runway, and plan maths
- `js/analysis.js` — the month-by-category matrix, top expenses, recurring detection
- `js/forecast.js` — the month-by-month cash projection
- `js/dashboard.js` — the Overview and Categories views
- `js/transactions.js` — the transaction list and tagging
- `js/store.js` — saves everything in the browser
- `js/main.js` — wires it together

## Re-import later

When you get September data, import it. Existing tags are kept. Tags are matched
by row content, so re-importing the same file will not create duplicates.
