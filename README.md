# Glidepath

**Budgeting that never sees your bank data.** Drop in your bank's CSV export. Glidepath categorises it, shows where the money goes, and answers one of three questions:

| Mode | The question it answers |
|---|---|
| **Budget** | Am I on track this month? |
| **Runway** | How long can I fund myself while I work on my own thing? |
| **FIRE** | When does my portfolio cover my spending? |

Everything runs in your browser. Nothing is uploaded. There is no server, no account, no tracking, and the whole app is a few thousand lines of plain JavaScript you can read.

[Run it](#run-it) · [What you get](#what-you-get) · [Supported exports](#supported-bank-exports) · [How it's built](#under-the-hood) · [Report a bug](https://github.com/dfrico/glidepath/issues)

<!-- hero screenshot: docs/screenshots/overview.png (pending) -->

## Run it

Glidepath is static files. Serve the folder with anything and open it:

```
python3 -m http.server 8137
```

Then open http://localhost:8137. (A web server is needed because the app uses ES modules, which browsers block over `file://`.) A hosted version with sample data is on the way.

1. Drop your bank CSV on the page, or click *Import CSV*.
2. Known merchants are tagged automatically and the Overview opens.
3. Go to *Transactions*, filter to *Untagged only*, and tag the rest. With *Learn* on, tagging one row tags every other row from the same partner and remembers the rule for next time.

Re-import later and existing tags are kept. Rows are matched by content, so importing the same file twice creates no duplicates.

## What you get

**Overview** is the insights page.
- Headline numbers: average income, spend, net (or savings rate in FIRE mode), and your essentials minimum per month.
- Monthly breakdown: a category-by-month grid shaded by amount, with a per-month average. Untick a month (your wedding, a move) to keep it out of the averages.
- Recurring commitments: payments that repeat most months, with their yearly cost. Optional ones are flagged as your easiest savings.
- Top single expenses and where to cut: your biggest one-offs and your biggest optional costs per month.
- Plus the cards for your mode, below.

**Budget** answers "am I on track this month?". Pick a month, see a donut of where the money went and one bar per category filled to the share of its budget spent. Bars past full turn red. Yearly bills (property tax, car insurance) are tracked over 12 months with a likely due date, and count as their monthly set-aside so one bill doesn't wreck the month.

**Categories** holds the controls: essential or not, annual or not, a fixed monthly override, ignore (so transfers to savings don't count as spending), and the auto-tag rules the app has learned.

**Transactions** is the list, newest first, with filter, search and fast tagging. It shows the last three months by default to stay fast; every month still counts in the averages.

**Backup and restore** save everything, data and tags, to one JSON file. Your tagging work is the valuable part; this protects it.

## The three modes

Pick a mode in the top bar. It decides what Overview shows and where the Budget tab's numbers come from. Your inputs are kept when you switch.

### Budget

Keep spending on track. Each category's budget is its typical-month figure (or your override), and the Budget tab compares each month against it.

### Runway

A founder's runway: make your cash last while you work on your own thing.

- **Budget plan**: enter your cash, how many months you want it to last, and any expected income (freelance work, a severance, a part-time gig) and how long it lasts. You get a monthly spending cap, your essentials floor, the room left for optional spend, and a verdict: within budget, or cut €X per month.
- **Cash forecast**: a month-by-month balance for two scenarios, essentials only and your current plan, showing the exact month each runs out. Toggle categories and watch cuts turn into months.
- The Budget tab then budgets against the plan's cap: essentials keep their typical figure, and optional categories share what's left in proportion to their usual spend.

### FIRE

Grow your investments toward financial independence.

- Enter what you have invested, what you add per month (defaults to your historical average net), a real yearly return and a withdrawal rate.
- You get two targets, **Lean FI** (a portfolio that pays for your essentials) and **FI** (one that pays for your typical spend), and a chart of your portfolio growing toward them with the month each is reached.
- The net tile becomes your savings rate.

## Supported bank exports

Any CSV with an amount column works. Delimiters (tab, semicolon, comma) and European number formats (`1.234,56`) are detected automatically. These columns are recognised when present:

| Column header | Used for |
|---|---|
| `Amount (EUR)` or `Amount` | the transaction amount (required) |
| `Booking date`, `Value date` | the month it belongs to |
| `Partner name` | merchant, for auto-tagging and recurring detection |
| `Payment reference`, `Type`, `Account name` | shown in the list, searchable |
| `Partner IBAN`, `Original amount`, `Original currency`, `Exchange rate` | kept for reference |

This is the column set of N26's current export, which is what Glidepath was built against. Mapping another bank's export is a few lines in `js/parse.js`; pull requests with new formats are welcome.

## Key numbers

- Minimum / month = sum of essential categories. This is your runway base.
- Runway at essentials only = months your cash lasts at the minimum, counting expected income for as long as it comes.
- Runway at current spend = the same, at your typical monthly spend.
- Avg income / spend / month = historical averages from your data. Ignored categories (savings transfers, one-offs) are left out.
- Budget plan cap = (cash + expected income over the horizon) ÷ target months. Room for optional = cap minus essentials.
- Annual categories = what you paid in the last 12 months ÷ 12.
- Savings rate = average net ÷ average income.
- FI target = yearly spend × 100 ÷ withdrawal rate (4% means 25× your yearly spend). Returns are real, after inflation, so targets stay in today's euros.

## Under the hood

Vanilla ES modules, no framework, no build step, no dependencies. The maths lives in pure modules you can unit-test or read on their own; the views rebuild their panel from one state object.

- `js/parse.js`: CSV parsing, delimiter and number-format detection
- `js/tagging.js`, `js/starter-rules.js`: the auto-tag engine and the starter merchant rules
- `js/budget.js`: budgets, runway and the plan cap
- `js/analysis.js`: the month-by-category matrix, top expenses, recurring detection
- `js/forecast.js`: the cash projection and the FIRE growth projection
- `js/dashboard.js`, `js/budget-view.js`, `js/transactions.js`: the views
- `js/store.js`: everything saved in the browser, plus backup and restore
- `js/main.js`: state and wiring

Data is stored in the browser's local storage. Clearing site data clears it, which is why *Backup* exists.

## License

[MIT](LICENSE). Built by [Daniel Fernández](https://dfrico.com).
