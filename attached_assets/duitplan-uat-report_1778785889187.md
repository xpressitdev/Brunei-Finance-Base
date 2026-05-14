# DuitPlan UAT Report

**Site tested:** https://www.duitplan.com
**Tester persona:** Aiman bin Abdullah, Brunei resident, BND 2,500.75 monthly take-home
**Test date:** 15 May 2026
**Tester account:** aiman.uat.test@duitplan-test.com
**Browser:** Chrome desktop

---

## Summary

A real first-time user can sign up, complete the 8-step onboarding, log a transaction, and come back later to find their data — so the core promise works. The product is genuinely well thought out for the Brunei/Malaysia/Indonesia market, with excellent localisation (Selamat datang, gaji, Hari Gaji, Hari Raya, Hajj/Umrah, Takaful, MUIB-aware Zakat). However, there are two **critical bugs** that will undermine user trust the moment they're hit: (1) negative salaries are silently accepted, and (2) most pages don't refresh their summary stats after a transaction is added or edited (the user has to F5). On top of that, a fresh user **cannot categorise their first expense properly** because no everyday spending categories (Food, Transport, etc.) are seeded — only two random envelopes called "Debt Repayment" and "Education". These are all fixable but they would each cost real users.

---

## Critical bugs

### 1. Negative salary accepted with no validation
- **Where:** Onboarding Step 3 — "Your salary & Hari Gaji"
- **Reproduction:** Type `-500` in the Monthly Salary field → red border appears (visual hint) but no error message → click Continue → form proceeds to Step 4 with a negative salary saved.
- **Impact:** Garbage data flows into all downstream calculations (debt-to-income, leftover, envelope allocations). For a financial app this is a severe trust issue.
- **Fix:** Reject `value < 0`. Either disable Continue or show an inline error like "Salary must be a positive amount."

### 2. Dashboard / Transactions page KPIs and heatmap do not refresh after add or edit
- **Where:** `/transactions` (and any page driven by aggregated stats)
- **Reproduction:** Add a transaction → modal closes → the new row appears at the bottom of the list, but the header KPIs (`SPENT · MAY`, `NET FLOW`, `AVG PER DAY`), the heatmap colouring for the day, and the "Top merchants / Spending by Category" stat blocks all stay at zero. Same for editing — the row updates to BND 12.50 but `HIGHEST DAY` still says BND 8.50. Only a hard refresh (F5) fixes it.
- **Impact:** Users will think their entries didn't save and double-log them, or they'll lose confidence in the totals.
- **Fix:** Invalidate / refetch the aggregate queries on save and on edit. (Looks like a missing query invalidation in whatever React-Query / SWR layer is in use.)

### 3. No upper-bound on salary value
- **Where:** Onboarding Step 3 + Settings → Profile
- **Reproduction:** Enter `999999999` in Monthly Salary → accepted, Continue enabled.
- **Impact:** Likely to produce overflow or display-breaking values down the line; also lets fat-finger errors past silently.
- **Fix:** Cap at a sensible maximum (e.g. BND 1,000,000) and show a warning.

---

## Usability issues

### A. First-time user has no usable spending categories
- After completing onboarding, the only categories available in the Add Transaction dropdown are **"Debt Repayment"** and **"Education"** (both auto-defaulted to BND 500/mo even though I left their envelope targets at 0 in Step 6). There is no Food, Groceries, Transport, Petrol, Eating Out, Entertainment, etc. To log a lunch I had to bail out to **Categories**, manually add "Food & Groceries", then come back.
- **Why "Education"?** I never said anything about education during onboarding. It's a very specific seeded category that won't apply to most users.
- **Fix:** Seed the variable category list with the typical Brunei/SEA spending categories (Food & Groceries, Petrol, Transport, Eating Out, Entertainment, Health, Personal). Don't auto-assign defaults of BND 500 to envelopes the user explicitly left at 0.

### B. Onboarding leftover ≠ Dashboard remaining
- Onboarding Step 8 "Your money flow" shows leftover = BND 1,180.75 (income − debt − bills − envelopes − **goals contributions**).
- Dashboard "Remaining" shows BND 1,867.50 = income − commitments − spending − loan repayments only. The BND 200/month goal contribution is **silently dropped**. After bumping salary to BND 3,000 the gap is exactly BND 200.
- The promised auto-contribution to Emergency Fund also doesn't show up on the Budgets page — Emergency Fund still says BND 0 of BND 5,000 goal.
- **Why it matters:** the onboarding sets an expectation ("your goal will be funded automatically") that the dashboard immediately violates. Users will think their money isn't being earmarked.
- **Fix:** Either auto-allocate the configured goal contribution into the Vault each cycle, or change the onboarding summary so it doesn't promise something the dashboard won't deliver.

### C. "Add transaction" button on the Dashboard navigates instead of opening the modal
- The same button label, in the same brand-green pill style, behaves differently on two pages: on `/dashboard` it redirects to `/transactions`; on `/transactions` it opens an Add Transaction modal. Inconsistent and slightly slower.
- **Fix:** Open the modal in place from the dashboard too.

### D. Onboarding helper text out of sync with the form state
- Step 2 ("Build your money pool") starts with two skeleton accounts (Cash on hand, BIBD Savings) but the helper text reads **"Add at least one account to keep going."** A user reasonably reads this as "I haven't added any" and tries to add more.
- **Fix:** Reword to "Enter a balance for at least one account to continue."

### E. Going Back in the onboarding wizard wipes the in-progress field
- Entered `-500`, hit Continue, hit Back — the field is cleared. Probably a side effect of validation, but the loss isn't communicated.

### F. Form validation is silent (relies on browser-native tooltips only)
- Empty required fields and bad email formats only get a red border and the browser's native pop-up. There's no inline error message inside the form. On the registration page in particular this means users see a focused field with no explanation and have to hover/wait to read the browser bubble.
- **Fix:** Show explicit inline messages.

### G. Password requirement is 6 characters minimum
- For a personal-finance app this is too weak. There's no strength meter, no requirement for digits/symbols, no breach check.
- **Fix:** Min 10–12 with at least one digit; ideally a strength meter.

### H. No "Forgot password?" link on the login page
- Sign-in form has Email + Password + Sign In and that's it. A user who forgets their password is locked out with no self-service recovery.
- **Fix:** Standard "Forgot password?" link, with a token-based reset email flow.

### I. No email verification on signup
- Account is created and onboarding starts immediately after Create Account. Good for friction reduction, risky for data integrity (typo'd emails will never receive password resets, etc.).
- **Fix:** At minimum send a confirmation email after signup; consider soft-blocking some features until verified.

### J. "Overspending" badge before payday is misleading
- Net Flow card shows red "Overspending" because the user has spent BND 12.50 and Income is BND 0 for the month — but Hari Gaji is the 25th and it's only the 15th. The app *knows* the user's payday.
- **Fix:** Calculate net flow against expected income for the cycle, or relabel to "Pre-payday spending" until Hari Gaji.

### K. `maximum-scale=1` on the viewport meta tag
- Blocks pinch-zoom on mobile. Accessibility issue (WCAG 1.4.4 Resize Text).
- **Fix:** Drop `maximum-scale=1` from the viewport meta.

---

## Nice-to-haves

- **Autocomplete merchant names** — when I typed "Lunch at Hua Ho Kiulap" there's no learning. Brunei users will type the same merchant repeatedly (Hua Ho, Supa Save, Soon Lee, Jollibee). Suggest as I type.
- **Inline category creation from the Add Transaction modal** — let me add "Food & Groceries" without leaving the modal.
- **Bulk import** — the homepage advertises BIBD/Baiduri PDF import; it would be great to surface that in onboarding for users who want to skip manual entry.
- **A real DuitPlan logomark in the onboarding header** — currently shows a generic green "D" tile.
- **Mobile bottom nav** — the sidebar is a lot of items for a phone; a bottom bar with the four main destinations (Dashboard, Transactions, Budgets, Goals) would feel more native.
- **Currency selector tied to country** — the app advertises Brunei/Malaysia/Indonesia but defaults to BND with no obvious way to switch to MYR or IDR.
- **Date picker on the Add Transaction modal** could be friendlier than the native browser one (especially on mobile).

---

## What worked well — don't touch

- **Localisation is excellent and culturally on-point.** "Selamat datang, Aiman", *gaji*, *duit*, *Hari Gaji*, *Hari Raya*, *Hajj/Umrah*, Takaful, MUIB. This is the single biggest differentiator versus generic budgeting apps and it's well executed.
- **The marketing homepage is clean and quick.** Value prop is clear, the sample card on the hero is real and persuasive, and the secondary CTA ("Import a statement") is a smart alternative to "Sign up".
- **Built-in Zakat calculator with the right authority per country (MUIB / LZS / BAZNAS)** is a genuinely thoughtful feature.
- **Onboarding architecture is well designed.** The 8-step wizard is broken into the right conceptual chunks (Welcome → Accounts → Salary → Debts → Bills → Envelopes → Goals → Summary) with a clear progress bar, Skip-for-now where appropriate, and a final "Looks right" summary.
- **Step 5 helper line:** *"Loans and financing aren't here — you've already added them as Debts in the previous step."* Exactly the right kind of preventative microcopy.
- **The math (where it's actually computed) is correct.** Pool total updates live as you fill balances. Step 8 leftover (2500.75 − 350 − 770 − 200 = 1180.75) is right. Dashboard recalculates Debt-to-income (350/3000 = 11.67%) instantly when salary is changed.
- **Validation feedback on the registration password** uses native HTML5 properly (min 6, type=email).
- **Login error message is well-judged** — "Invalid email or password" doesn't disclose which.
- **Data persistence works.** Sign out, sign back in, everything is exactly as left, including the salary edit and the lone transaction.
- **Gamification feels appropriate, not gimmicky** — the streak bar, "Log 10 transactions" challenge, and the "Debt Aware / First Transaction" badges encourage the daily habit the app needs to be useful.
- **Add Transaction → Edit Transaction round-trip works** — the edit modal pre-fills correctly.
- **"Free while in beta · No bank connection needed" reassurances** on the hero are exactly right for the Brunei market where Open Banking doesn't really exist.

---

## What I didn't get to (would test next)

- **Receipt Scanner** (sidebar item) — could not exercise in this UAT pass.
- **DuitPlan AI** (sidebar item) — what does it do, what does it cost in latency.
- **Statement import (BIBD/Baiduri PDF)** — homepage advertises it but the flow itself wasn't tested.
- **Drag-and-drop allocation on Budgets** — the chip-drag UI is novel and likely to be the highest-friction part of the app for non-technical users; deserves its own usability session.
- **True mobile rendering** — the Chrome MCP would not actually resize the browser window during this run, so mobile responsiveness was inferred from CSS classes (Tailwind sm/md/lg present, no hamburger). Should be hand-tested on a real phone.
- **Annual Report / Forecast Plan / Actual vs Plan** tabs on Budgets.
- **Zakat calculator** end-to-end.
- **Multi-currency switching** (the app claims Brunei/Malaysia/Indonesia support).
- **Account deletion / GDPR-style data export** under Settings → Privacy.
