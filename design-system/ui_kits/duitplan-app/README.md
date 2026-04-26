# DuitPlan App UI Kit

A hi-fi, click-through recreation of the DuitPlan web app — the production product running on `duitplan.com`, `my.duitplan.com`, `id.duitplan.com`.

**`index.html`** is the navigable demo. It boots into the dashboard. Use the sidebar to move between:

- **Dashboard** — KPI strip (Salary, Commitments, Liabilities, Total Spent, Remaining), Hari Gaji banner, spending donut, recent transactions, financing summary.
- **Expenses** — month switcher, category roll-up, transaction list.
- **Budgets** — category cards with budget vs actual progress.
- **Debts** — loan tiles with monthly payment, balance, debt-to-income.
- **Goals** — savings vault with progress.
- **Accounts** — connected bank cards.

**Components** (`*.jsx`)

| File | What it is |
|---|---|
| `App.jsx` | Root — sidebar shell + page router (state-based) |
| `Sidebar.jsx` | Left nav: brand lockup, items, sign-out |
| `Topbar.jsx` | Page title + action buttons (Import / Add) |
| `KpiCard.jsx` | Eyebrow + big number + glyph; supports `hero` tint |
| `HariGajiBanner.jsx` | Payday auto-prompt with dual CTA |
| `Card.jsx` | Base card primitive |
| `Button.jsx`, `Badge.jsx`, `Input.jsx` | shadcn-equivalents matching production |
| `TransactionRow.jsx` | Single row with category + account chip |
| `BudgetRow.jsx` | Category, amount-of-budget, color-coded progress |
| `Donut.jsx` | Spending-by-category SVG donut |
| `pages/Dashboard.jsx` | Default landing |
| `pages/Expenses.jsx`, `Budgets.jsx`, `Debts.jsx`, `Goals.jsx`, `Accounts.jsx` | Per-page surfaces |
| `data.js` | Seed data (Hakem-as-user, BIBD/Baiduri accounts, realistic transactions) |
| `icons.jsx` | Lucide-style inline SVGs used everywhere |

This is a **visual recreation** — clicks feel real (active state on nav, banners dismiss, modal-style flows) but nothing persists. The math model matches the handoff doc (`Remaining = salary − commitments − unreconciled debts − spent`) but values are seeded.
