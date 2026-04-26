# DuitPlan post-launch visual audit — punch list

**Region audited:** Brunei (`duitplan.com`), authenticated as Hakem
**Pages covered:** Dashboard, Budgets (Allocate + Forecast Plan), Debts
**Format:** Numbered findings, tagged, one-line description, one-line fix, ready-to-paste Replit Agent prompt.

Order of attack: **#1, #2, #3 are blocker-grade** (broken math + broken core feature). Everything else is polish — fix in any order after the blockers.

---

## #1 — `BND NaN` on Allocate tab "Available to allocate" header

**Tag:** Calculation bug
**Where:** `/budgets` → Allocate tab → top hero card
**What you see:** `BND NaN of BND 5,769.36 April gaji` and `BND NaN allocated · NaN%`
**Root cause (suspected):** A summand in the `available = gaji - sum(buckets)` calculation is `undefined`, so the arithmetic produces NaN. Most likely the `loans` total is undefined when the Bank bucket has zero items (see #3 below — Bank query is wrong).
**Fix:** Defensive `|| 0` (or `?? 0`) on every bucket total before summing. Add a unit test for the empty-buckets case.

**Replit Agent prompt:**
```
Fix the "BND NaN" bug on artifacts/duitplan/src/pages/budgets.tsx (Allocate tab).

Symptom: top hero card shows "BND NaN of BND 5,769.36 April gaji" and "BND NaN allocated · NaN%".

Steps:
1. Read budgets.tsx and find every numeric calculation in the Allocate tab — specifically: available-to-allocate, allocated total, allocation percentage, per-bucket totals (Bank/Envelopes/Vault).
2. For each `+`, `-`, `/`, `Math.X(...)` that uses values from useListBudgets / useListCommitments / useListDebts / useListGoals, wrap each operand with `?? 0` (or `Number.isFinite(x) ? x : 0`) so undefined / null / NaN inputs produce 0 instead of poisoning the result.
3. Add a small helper `function safeNum(x: unknown): number { return typeof x === "number" && Number.isFinite(x) ? x : 0; }` at the top of the file and use it everywhere instead of repeating ?? 0.
4. Verify in dev preview (use the testing skill, log in as the BND test seed user) — Available header should show a real BND amount, not NaN, even when one or more buckets are empty.
5. Commit: "fix(budgets): defensive numeric coercion on Allocate tab — eliminate BND NaN when buckets are empty"

Out of scope: do NOT change the bucket-derivation rules (handled separately in #3), do NOT touch Forecast Plan / Actual vs Plan / Annual Report tabs.
```

---

## #2 — `BND NaN` on Forecast Plan tab (Total Budgeted + Available Pool)

**Tag:** Calculation bug
**Where:** `/budgets` → Forecast Plan tab → top KPI strip
**What you see:** `TOTAL BUDGETED: BND NaN — of BND NaN planned` and `AVAILABLE POOL: BND NaN — After all deductions`
**Root cause:** Same NaN propagation as #1 — the totals on Forecast Plan also depend on bucket sums. Likely the same code path or a shared helper.
**Fix:** Same `safeNum` pattern from #1, applied to Forecast Plan calculations.

**Replit Agent prompt:**
```
After fixing #1 above, also apply the same `safeNum` defensive coercion to the Forecast Plan tab calculations in artifacts/duitplan/src/pages/budgets.tsx.

Symptom: TOTAL BUDGETED and AVAILABLE POOL KPI cards both show "BND NaN" / "of BND NaN planned" / "After all deductions BND NaN".

Steps:
1. Find the calculations that feed the Forecast Plan KPI strip (TOTAL BUDGETED and AVAILABLE POOL).
2. Wrap every input with safeNum (the helper added in #1).
3. Verify Forecast Plan KPIs show real BND amounts.
4. Commit: "fix(budgets): defensive numeric coercion on Forecast Plan KPI strip"

Out of scope: layout/copy changes.
```

---

## #3 — Bank column on Allocate tab is empty even though user has loans

**Tag:** Architectural mismatch (data model)
**Where:** `/budgets` → Allocate tab → leftmost column ("Bank")
**What you see:** *"No loans yet. Add commitments labelled 'Loan' / 'Financing' on the Commitments page."*
**Why this is wrong:** Per Milestone 1.5 in the handoff doc, loans were REMOVED from the `commitments` table after the double-counting bug, and now live in the `debts` table. The Allocate tab queries `useListCommitments()` for loans (the `handoff/budgets.tsx` template made a pre-Milestone-1.5 assumption). User's 4 loans are visible at `/debts` totalling BND 3,426.37/month.
**Fix:** Switch Bank bucket source from `useListCommitments` (filtered by label) to `useListDebts()` directly. Each debt becomes one Bank-bucket row showing the `monthly_payment`.

**Replit Agent prompt:**
```
Fix the Bank column on artifacts/duitplan/src/pages/budgets.tsx (Allocate tab) to read from the debts table instead of commitments.

Symptom: Bank column shows "No loans yet. Add commitments labelled 'Loan' / 'Financing' on the Commitments page" — but the user has 4 loans visible on /debts totalling BND 3,426.37/month.

Background: Per the production handoff doc, Milestone 1.5 removed loans from `commitments` (which caused double-counting) and they now live in `debts`. The Allocate tab template was written before this migration.

Steps:
1. Find the existing Bank-bucket data source in budgets.tsx — currently it's `useListCommitments()` filtered by labels containing "loan" / "financing" / "credit" / "mortgage" / "hire purchase".
2. Replace with `useListDebts()` (this hook already exists in @workspace/api-client-react — used by the Debts page).
3. Each debt row in the Bank bucket should show: debt name, monthly_payment, lock badge (auto on Hari Gaji), and outstanding balance as subtitle. Match the visual treatment of the existing envelope row but with the bank/lock styling.
4. Update the empty-state message from "Add commitments labelled..." to "No debts yet. Add a loan or financing on the Debts page." and link to /debts.
5. Update the bucket-derivation table comment at the top of the file to reflect: Bank = useListDebts(), Envelopes (fixed) = useListCommitments(), Envelopes (variable) = useListCategories where kind === "expense", Vault = useListGoals().
6. Verify in dev preview: Bank column should show 4 loan rows (Credit Card, Car Loan, Personal Financing, Personal Loan 2) summing to ~BND 3,426/month.
7. This will likely also resolve #1 (NaN goes away once the loans total is a real number).
8. Commit: "feat(budgets): pull Bank bucket from debts table (post-Milestone-1.5 data model)"

Out of scope: do NOT add backend changes. Do NOT touch other tabs. Drag-onto-Bank still updates UI state only (locked auto-Hari Gaji, no commitment mutation).
```

---

## #4 — All CTAs use Title Case, design system requires sentence case

**Tag:** Typography / Copy
**Where:** Almost every primary/secondary button across the app
**What you see:** "Import Statement", "Add Transaction", "Manage Financing", "Add Debt", "Simulate Payoff", "Confirm allocation" (this last one is correct — proves the rule was once being followed).
**Why it matters:** SKILL.md HARD RULE — *"Sentence case everywhere. Never Title Case."*
**Fix:** Lowercase all secondary words on every button label. Translation files (en.json / ms.json / id.json) get the same treatment.

**Replit Agent prompt:**
```
Convert all button labels in artifacts/duitplan/src/i18n/locales/en.json (and apply matching changes to ms.json / id.json) from Title Case to sentence case, per the design system's HARD RULE.

Buttons to fix (English — apply equivalent changes in MS and ID where structurally similar):
- "Import Statement" → "Import statement"
- "Add Transaction" → "Add transaction"
- "Manage Financing" → "Manage financing"
- "Add Debt" → "Add debt"
- "Simulate Payoff" → "Simulate payoff"
- "View all transactions" → already correct, leave alone
- "Confirm allocation" → already correct, leave alone

Steps:
1. grep the EN locale file for every button-label string. List them.
2. For each one, if it's Title Case, propose the sentence-case version. Do NOT touch proper nouns: "Hari Gaji", "BIBD", "Baiduri", "Zakat", region names, bank names, brand "DuitPlan".
3. Do the same for MS and ID files (where Malay/Indonesian capitalization rules allow).
4. Tab labels on Budgets page ("Forecast Plan", "Actual vs Plan", "Annual Report", "Allocate") — review whether these are tabs (often Title Case is OK for tabs) or buttons. If they're rendered as button-style toggles, lowercase to "Forecast plan", "Actual vs plan", "Annual report".
5. Commit: "fix(i18n): sentence-case all button labels per design system rule"

Out of scope: do NOT change page titles, headings, or eyebrow labels (eyebrows are uppercase by spec).
```

---

## #5 — Dashboard transaction labels duplicated (`Credit Card — Credit Card`)

**Tag:** Copy / Layout
**Where:** Dashboard → Recent Transactions list
**What you see:** Rows display "Credit Card — Credit Card", "Car Loan — Car Loan", "Personal Loan — Personal Financing" — the title and subtitle are the same value (or close to it).
**Root cause:** When a transaction is auto-created from a Hari Gaji debt repayment, both the `description` field and the `category.name` field get set to the debt name. The row component renders `description — category.name`, producing the dup.
**Fix:** When `description` and `category.name` are identical (or one contains the other), render only the description. Or skip the em-dash + subtitle entirely for auto-linked debt transactions.

**Replit Agent prompt:**
```
Fix duplicate labels in the Recent Transactions widget on artifacts/duitplan/src/pages/dashboard.tsx (or wherever the recent-transactions list component lives — search the codebase).

Symptom: rows show "Credit Card — Credit Card" / "Car Loan — Car Loan" / "Personal Loan — Personal Financing" because the auto-created Hari Gaji debt transactions get both `description` and `category.name` set to the debt name.

Steps:
1. Find the row renderer for the Recent Transactions list.
2. When `description` === `category.name` (case-insensitive, trimmed), render ONLY the description (no em-dash, no subtitle).
3. When `description` strictly contains `category.name` or vice versa, render the longer one only.
4. Otherwise render the existing "description — category.name" pattern.
5. Verify on Dashboard with the BND test seed user — auto-debt rows should show just one label.
6. Commit: "fix(dashboard): collapse duplicate description/category in Recent Transactions row"

Out of scope: don't change the data model, don't change Hari Gaji insertion logic.
```

---

## #6 — "Test - Groceries" transaction missing BIBD Savings account chip

**Tag:** Layout / Data display
**Where:** Dashboard → Recent Transactions
**What you see:** Every row has the date + an account chip ("BIBD Savings") except "Test - Groceries" which only shows the date.
**Why it matters:** Inconsistent row heights and visual rhythm. Could be: (a) a manually-entered transaction with no `account_id`, (b) the account got deleted, (c) the chip-render code crashes silently when account is null.
**Fix:** Show a placeholder chip ("Unknown account" or "—") when `transaction.account` is null. This keeps the row layout consistent and signals to the user that they should set an account.

**Replit Agent prompt:**
```
On the Recent Transactions widget, when a transaction has no account_id (or the account has been deleted), render a placeholder chip instead of nothing.

Symptom: "Test - Groceries" row on the Dashboard renders without the BIBD Savings chip that all other rows have, causing inconsistent row heights.

Steps:
1. Find the row component that renders the date + account chip.
2. If `transaction.account` is null/undefined, render a muted "—" chip with `text-muted-foreground` styling and the same dimensions as the regular account chip. Tooltip on the chip: "No account set — click to add".
3. Verify visual consistency on Dashboard.
4. Commit: "fix(dashboard): consistent row layout for transactions with no account"

Out of scope: don't auto-assign accounts, don't delete the orphan transaction.
```

---

## #7 — `Debt-to-Income` capitalization breaks sentence-case rule

**Tag:** Typography / Copy
**Where:** Dashboard → Financing Summary card → bottom row
**What you see:** Subtitle "Debt-to-income 59.39%" (sentence case ✓) but the table row label says "Debt-to-Income" (capital I). Inconsistent.
**Fix:** Lowercase the "I". One label, two places — make them match.

**Replit Agent prompt:**
```
Find every "Debt-to-Income" string in artifacts/duitplan/src/ and i18n locales and change to "Debt-to-income" (lowercase i), per the design system's sentence-case rule.

Symptom: Dashboard Financing Summary card has the subtitle "Debt-to-income 59.39%" but the row label below says "Debt-to-Income 59.39%". Pick one (sentence case wins).

Steps:
1. grep for "Debt-to-Income" in src and locales.
2. Replace each occurrence with "Debt-to-income".
3. Commit: "fix(copy): lowercase 'income' in 'Debt-to-income' to match design system rule"
```

---

## #8 — Streak card placeholder day-cells look unfinished

**Tag:** Layout / Visual
**Where:** Dashboard → "1-day streak — keep it going" card
**What you see:** Three day-cells in the streak bar; only the first is filled with "1", the other two are empty dashed-border boxes. Why three? It feels arbitrary.
**Suspected intent:** Show a 3-day rolling window with the current day highlighted. But it reads as "you're 1 of 3 needed" or "two days unfinished".
**Fix options (pick one):**
- **A** — Show the last 7 days, with each day filled (logged) or empty (skipped). More familiar.
- **B** — Show only "today" as one prominent cell (no placeholders). Cleanest.
- **C** — Keep 3 cells but label them with day-of-week (Sun / Mon / Tue) so the "3" feels intentional.

**Replit Agent prompt:**
```
The streak card on artifacts/duitplan/src/pages/dashboard.tsx (or its equivalent component) renders 3 placeholder day-cells with only the first filled. The empty placeholders look unfinished.

Recommended change: render the last 7 days as a row of 7 small cells. Cells for days where the user logged at least one transaction get the orange filled treatment with the day number; cells for days without a transaction stay empty (dashed border). Today's cell gets a thicker outline regardless of state.

Steps:
1. Find the streak card component.
2. Replace the 3-cell placeholder layout with a 7-cell rolling window of `today - 6` to `today`.
3. Each cell: small square (~32px), date number inside, filled/empty per per-day transaction count.
4. Commit: "feat(dashboard): streak card shows 7-day rolling window instead of 3 placeholders"

Out of scope: streak math/logic itself, achievement badge logic. Just the visual.
```

---

## #9 — Spending donut shows 100% "Uncategorized" — categorizer not labeling transactions

**Tag:** Data / Visual (low confidence — could be intentional)
**Where:** Dashboard → "Spending by Category" donut
**What you see:** Single teal slice = 100% Uncategorized = BND 2,886.29.
**Why this matters:** With everything Uncategorized, the donut conveys nothing. Either:
  - (a) Auto-categorization isn't running on auto-created Hari Gaji debt transactions
  - (b) The user genuinely hasn't categorized them yet (manual action expected)
**Recommended fix (visual side):** When 100% of spending is Uncategorized, replace the donut with a small empty-state CTA: "Categorize your transactions to see where your money goes →" linking to /transactions. Keeps the dashboard from looking broken.

**Replit Agent prompt:**
```
On the Dashboard's "Spending by Category" widget, replace the donut with an empty-state CTA when 100% of the month's spending falls under a single category named "Uncategorized" (or null category).

Symptom: Hakem's BND April data shows a donut with one solid teal ring labeled "Uncategorized BND 2,886.29" — visually indistinguishable from a loading skeleton.

Steps:
1. Find the SpendingDonut component.
2. Compute `isAllUncategorized = categories.length === 1 && categories[0].name.toLowerCase() === "uncategorized"` (or null).
3. When true, replace the donut SVG with a centered card: 🧾 glyph + "Categorize your transactions to see where your money goes" + a primary "Categorize transactions" button linking to /transactions.
4. When false, render the donut as today.
5. Commit: "fix(dashboard): empty-state CTA when all spending is uncategorized"

Out of scope: don't change the auto-categorizer or category model.
```

---

## #10 — Allocate tab feels imbalanced when Bank column is empty (ties to #3)

**Tag:** Layout
**Where:** `/budgets` → Allocate tab
**What you see:** Once #3 is fixed (Bank pulls from debts), this won't apply. But IF Bank ever ends up empty (a user with zero loans), the leftmost third of the page is just empty-state text — a lot of dead whitespace.
**Fix:** When Bank bucket is empty, collapse the page to a 2-col layout (Envelopes + Vault), and replace the Bank column with a horizontal banner under the Available card: *"No loans tracked. [Add a loan]"*.

**Replit Agent prompt:**
```
When the Bank bucket on artifacts/duitplan/src/pages/budgets.tsx (Allocate tab) has zero items, collapse the layout from 3 columns to 2 (Envelopes + Vault) and render the Bank empty state as a thin banner under the Available card instead.

Steps:
1. After #3 is in (Bank reads from debts), check for `bankItems.length === 0`.
2. If true: render the Bank empty state as a banner spanning the full width under the Available-to-allocate card, with a primary "Add a loan" link to /debts. The 3-col grid becomes a 2-col grid for Envelopes + Vault.
3. If false: render the existing 3-col layout.
4. Commit: "feat(budgets): collapse Allocate to 2-col when Bank bucket is empty"

Out of scope: any other layout change.
```

---

## #11 — Envelope sliders appear "all-the-way-left" despite full unspent allocation

**Tag:** Visual / UX clarity
**Where:** `/budgets` → Allocate tab → each Envelope row
**What you see:** Every envelope row has a slider with the thumb at the leftmost position, even though the amount label says e.g. "BND 128.00 / BND 128.00 left" (full amount unspent). The visual contradicts the numeric.
**Suspected:** Slider represents the allocation amount on a 0-to-max scale, where max is much larger than current allocation. So the thumb at far-left = "current allocation, which is small relative to max possible". But this isn't intuitive — users see "empty bar" and think "no money left".
**Fix:** Either (a) change the slider to a SPENT-vs-ALLOCATED progress bar (full bar = nothing spent yet, drains as you spend — matches the "drained as you spend" copy under Envelopes header), or (b) keep the allocation slider but anchor it to a sensible max (2× current) so thumb sits in the middle when allocation = "typical".

**Replit Agent prompt:**
```
Replace the per-envelope slider on the Allocate tab with a "spent vs allocated" progress bar.

Current behavior: slider thumb is at the far-left position even when the amount is "BND 128.00 / BND 128.00 left" (fully unspent). Users read this as "empty / no money" — visual contradicts the numeric.

Desired behavior: a horizontal progress bar that FILLS as the user spends. Empty/grey on the right = unspent. Filled (primary teal) on the left = already spent this month.

Steps:
1. In artifacts/duitplan/src/pages/budgets.tsx, find the Envelope row renderer.
2. Replace the slider with a `<Progress value={spent / allocated * 100} />` from @/components/ui/progress (the same shadcn primitive).
3. The "BND 128.00 / BND 128.00 left" copy stays — it now matches the progress bar.
4. Color: when spent < allocated → primary teal. When spent ≥ allocated → destructive red (over-budget).
5. Commit: "feat(budgets): per-envelope progress bar reflects spent-vs-allocated"

Out of scope: the drag-chip allocation interaction stays.
```

---

## #12 — Remaining card breakdown is incomplete (missing line items)

**Tag:** Definitional ambiguity
**Where:** Dashboard → REMAINING hero card
**What you see:** "Commitments −BND 978.00 / Spending −BND 2,886.29" — but doing the math: 5,769.36 − 978 − 2,886.29 = 1,905.07. The card shows 1,264.99. The difference (~BND 640) is unaccounted for in the visible breakdown.
**Why:** Per the Milestone 1.6 model, `remaining = salary − fixed_commitments − unreconciled_debts − total_spent`. The unreconciled-debts line is being subtracted but not shown in the card breakdown.
**Fix:** Add a third line "Loan repayments due  −BND 640.08" (or whatever the unreconciled_debts total is) so users can trace how Remaining was computed.

**Replit Agent prompt:**
```
The REMAINING hero card on the Dashboard shows two breakdown lines (Commitments + Spending) but the math doesn't add up — there's a hidden subtraction for unreconciled debts. Add it as a visible line.

Symptom: Salary 5,769.36 − Commitments 978 − Spending 2,886.29 = 1,905.07. But card shows Remaining = BND 1,264.99. The ~BND 640 gap is the unreconciled_debts term per the Milestone 1.6 reconciliation model — but it's invisible to the user.

Steps:
1. Find the Remaining card breakdown renderer.
2. Add a third line right under "Commitments": "Loan repayments due  −BND {unreconciled_debts_total}". Use the same numeric formatting as the other lines (right-aligned, tabular-nums, minus sign in red).
3. If unreconciled_debts_total === 0, hide the line entirely (don't show "−BND 0.00").
4. Commit: "feat(dashboard): show unreconciled debts line in Remaining card breakdown"

Out of scope: don't change the math itself.
```

---

## Sequencing recommendation

Run them in this order so you don't double-handle files:

1. **#3 first** (Bank → debts) — biggest functional fix. Will likely auto-resolve #1.
2. **#1 + #2** as a single follow-up — defensive `safeNum` for any remaining NaN paths. May be one commit if #3 already cured everything.
3. **#4** (sentence case) — cross-file but mechanical, low risk.
4. **#5, #6, #7, #12** — small polish on Dashboard.
5. **#8, #9, #11** — visual treatments.
6. **#10** — only matters once #3 is in.

Each prompt is self-contained — paste into Replit Agent one at a time, let it checkpoint, verify in dev preview before publishing.
