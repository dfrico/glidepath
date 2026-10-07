# Expense budget

A small local web app to budget your expenses and see whether you are on track.
It also has a runway mode for when you have no income: how long will your cash last?
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
3. Go to Transactions, filter to "Untagged only", and tag the rest (pick
   "All time" to see untagged rows older than 3 months).
   With "Learn" on, tagging one row also tags every other row from the same
   partner (except rows you tagged by hand) and remembers it for next time.
   Rules match whole words: a "SHELL" rule tags "SHELL 1234" but not
   "SHELLFISH BAR".

## The four tabs

- Overview — the insights:
  - Headline numbers: average income, spend, net, and the minimum per month.
  - Budget plan: enter your cash, how many months you want it to last, and any
    expected income (e.g. unemployment benefit) and how many months it lasts.
    It gives you a monthly spending cap that counts that income, your essentials
    floor, the room left for optional spend, and a clear verdict (within budget,
    or cut €X per month). Income past the target horizon does not raise the cap.
  - Cash forecast: uses the same cash and income figures from the budget plan.
    It projects your balance month by month and shows the exact month you run
    out, for two scenarios — essentials only and your current plan. It updates
    as you toggle categories, so cuts turn into months.
  - Monthly breakdown: a category-by-month grid, shaded by amount, with an
    average-per-month column. Untick a month header (e.g. your wedding month)
    to keep it out of the averages.
  - Recurring commitments: payments that repeat most months, with their yearly
    cost. The optional ones are flagged "cut?" — your easiest savings.
  - Top single expenses: your biggest one-off payments. Click one to find it
    in Transactions.
  - Where to cut: your biggest optional costs per month.
- Budget — am I on track this month?
  - Pick a month (defaults to the latest). A donut shows where the money went,
    with the percent of the total budget spent in the middle.
  - By category: one bar per category, filled to the percent of its budget
    spent. Bars past full turn red. Essentials are listed first.
  - Yearly costs: bills that come once a year (Annual categories, e.g. property
    tax, car insurance). Each shows what you paid in the last 12 months against
    its yearly cost, when it was last paid, and when the next bill is likely
    due ("due soon" within 2 months). In the month's total these count as their
    monthly set-aside (yearly / 12), not the bill itself, so a yearly bill does
    not wreck the month. A line under the total shows any yearly bills paid
    that month.
  - The month's transactions, sortable by any column (read-only — tag them in
    Transactions).
  - The budget comes from your Budget plan on Overview: the total is the
    "You can spend" cap. Essentials keep their typical-month figure, fixed
    overrides stay as you set them, and the other optional categories share
    what is left in proportion to their usual spend.
  - Without a plan (no cash or target set), each category's budget is its
    typical-month figure (or the yearly cost / 12 for annual categories, or your override from Categories).
- Categories — the controls:
  - Toggle Essential and Annual per category, or set a fixed monthly override.
  - Ignore drops a category from all spending totals (default on for Savings),
    so transfers to yourself do not count as spending.
  - Auto-tag rules: view, edit, or delete the rules the app learned.
- Transactions — the list, most recent first, with filter, search, and fast
  tagging. It shows the last 3 months by default (counted back from your
  latest month of data) to stay fast; switch to Last 12 months or All time.
  This only limits the list: every month still counts in the averages, and
  Learn and auto-tag still work on all your data. The count line tells you
  when matching rows sit in older months. Clicking a top expense on Overview
  widens the period only if that expense is older than it.

## Keep your work safe

Your data and tags live in this browser. Use Backup to save everything to a JSON
file, and Restore to load it back (on a new machine, or after clearing the
browser). This protects the time you spend tagging.

## Key numbers

- Minimum / month = sum of essential categories. This is your runway base.
- Runway at essentials only = months your cash lasts at the minimum monthly,
  counting your expected income for as long as it comes (same maths as the
  cash forecast).
- Runway at current spend = the same, at your typical monthly spend (the one
  the plan's verdict uses; ignored categories like Savings left out).
- Avg income / spend / month = historical averages from your data. Ignored
  categories (Savings transfers in and out, One-off) are left out.
- Budget plan cap = cash on hand ÷ target months. Room for optional = cap minus
  essentials.
- Annual categories = what you paid in the last 12 months of data ÷ 12.

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
- `js/budget-view.js` — the Budget tab (month vs budget)
- `js/transactions.js` — the transaction list and tagging
- `js/dom.js` — small DOM and money-formatting helpers
- `js/store.js` — saves everything in the browser
- `js/main.js` — wires it together

## Re-import later

When you get September data, import it. Existing tags are kept. Tags are matched
by row content, so re-importing the same file will not create duplicates.
