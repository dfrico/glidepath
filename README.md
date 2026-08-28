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
2. The app auto-tags known merchants and shows the dashboard.
3. Go to Transactions, filter to "Untagged only", and tag the rest.
   With "Learn" on, tagging one row tags every untagged row from the same
   partner and remembers it for next time.
4. On the dashboard:
   - Set your cash on hand to see your runway in months.
   - Toggle "Essential" per category to shape the minimum monthly runway.
   - Toggle "Annual" for yearly costs (spread over 12 months).
   - Untick outlier months (e.g. your wedding month) to keep them out of the
     averages and runway.

## Key numbers

- Minimum / month = sum of essential categories. This is your runway base.
- Runway at essentials only = cash on hand ÷ minimum monthly.
- Runway at current spend = cash on hand ÷ average monthly spend.

## Files

- `index.html` — page shell
- `css/styles.css` — styles
- `js/parse.js` — CSV parsing (tab/semicolon/comma, euro numbers)
- `js/categories.js` — the category list and defaults
- `js/starter-rules.js` — merchant auto-tag rules (edit freely)
- `js/tagging.js` — the auto-tag engine
- `js/budget.js` — the budget and runway maths
- `js/dashboard.js`, `js/transactions.js` — the two panels
- `js/store.js` — saves everything in the browser
- `js/main.js` — wires it together

## Re-import later

When you get September data, import it. Existing tags are kept. Tags are matched
by row content, so re-importing the same file will not create duplicates.
