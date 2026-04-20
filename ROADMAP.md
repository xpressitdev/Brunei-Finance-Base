# DuitPlan — Improvement Roadmap

## Context
DuitPlan is a personal finance tracking app (similar to YNAB) currently serving a single user in Brunei (BND currency). We're preparing to commercialize it for the **Malaysia and Indonesia markets**. This document outlines prioritized improvements across bug fixes, localization, and feature additions.

**Current stack:** Replit-hosted web app. Features include Expense Tracker, Dashboard, Accounts, Transactions, Budgets (Cash Flow Plan), Commitments, Debts, Goals, Net Worth, Upload/Import, Insights, Achievements, AI assistant (DuitPlan AI), Settings.

**Target users:** Middle-income earners in Malaysia and Indonesia, with a likely skew toward Muslim users (relevant for Zakat features).

---

## 🎯 Phase 1 — Bug Fixes & Quick Wins (Start Here)
*Estimated time: 1–2 days. No architectural changes required.*

### 1.1 Fix empty "Spending by Category" chart on Dashboard
**Problem:** The Dashboard's "Spending by Category" panel renders a blank area with only color dots at the bottom. Users see empty state on first load.
**Acceptance criteria:**
- When there are transactions in the selected month, a donut/pie chart displays with category breakdown.
- When there are no transactions, show a clear empty state with a CTA like "Log your first expense".
- Chart must handle single-category data without breaking.

### 1.2 Pull configured salary into Expense Tracker's "Month Income"
**Problem:** The Expense Tracker shows "MONTH INCOME: BND 0.00" even though the user has BND 5,769.36 configured as monthly salary in Settings.
**Acceptance criteria:**
- The Month Income card reflects the user's configured monthly salary automatically.
- If the user logs additional income transactions, they are added on top.
- Entry count reflects both the auto-salary and manual income entries.

### 1.3 Richer Insights page
**Problem:** The Insights page only shows 3 static observations. The "Generate Insights" button's value is unclear.
**Acceptance criteria:**
- Add at least 6 insight types: spending trend vs. last month, category anomalies (e.g. "Dining up 40%"), subscription creep, savings rate, debt-to-income trend, budget adherence.
- Add visual elements: sparklines, month-over-month bars, or heatmaps.
- "Generate Insights" should visibly re-run AI analysis with a loading state.

### 1.4 UX polish
- Sidebar: make the current page highlight more consistent (some items have padding issues).
- Make the trial banner dismissible per session (currently appears on every page).
- Add a "last updated" timestamp on Net Worth and Debt balance cards.

---

## 🌏 Phase 2 — Localization Foundation (Critical Before Scaling)
*Estimated time: 1–2 weeks. Architectural — do this before adding more features.*

### 2.1 Multi-currency support
**Why:** BND is Brunei dollar — ~99% of Malaysia/Indonesia users won't recognize it. This is a dealbreaker.
**Acceptance criteria:**
- Add a `currency` field to user profile. Default based on IP/locale (MYR for Malaysia, IDR for Indonesia, BND for Brunei).
- All monetary displays throughout the app use the user's currency symbol and formatting (IDR uses no decimals, e.g., `Rp 1.500.000`; MYR uses `RM 1,500.00`).
- Create a central `formatCurrency(amount, currency)` utility and refactor all hardcoded "BND" references to use it.
- Settings page has a currency dropdown.
- Bonus: add a simple FX rate table so users migrating data between currencies see reasonable conversions.

**Technical hint:** Use `Intl.NumberFormat` in JavaScript — it handles locale-specific formatting natively.

### 2.2 Internationalization (i18n)
**Why:** Indonesia's mass market strongly prefers Bahasa Indonesia. Malaysia is bilingual but Bahasa Melayu builds trust.
**Acceptance criteria:**
- Integrate i18n library (e.g., `i18next` if React, `next-intl` if Next.js).
- Extract all UI strings into locale files: `en.json`, `ms.json` (Bahasa Melayu), `id.json` (Bahasa Indonesia).
- Language switcher in Settings and top nav.
- Start with English + Bahasa Indonesia (largest addressable market).

### 2.3 Region-aware date and number formats
- Use `DD/MM/YYYY` (standard in both MY and ID).
- Handle thousand separators correctly per locale.

---

## 🕌 Phase 3 — Market Differentiators
*Estimated time: 2–3 weeks. These make you stand out vs. YNAB/Mint/Monzo.*

### 3.1 Zakat Calculator
**Why:** Malaysia (~63% Muslim) and Indonesia (~87% Muslim) — no Western finance app addresses this. Huge differentiator. Your existing "Umrah with Family" goal already shows you understand this user.
**Acceptance criteria:**
- New section under Goals or as a standalone tool: "Zakat Calculator".
- Calculate Zakat on savings (2.5% if balance > nisab threshold for 1 hijri year).
- Pull nisab threshold dynamically (gold price-based) or allow manual entry.
- Show current nisab status based on user's account balances.
- Option to create a Zakat payment goal automatically.
- Optional: notify user when their savings have held above nisab for 1 year.

### 3.2 Local bank statement import
**Why:** The more banks you parse automatically, the stickier the product.
**Priority banks:**
- **Malaysia:** Maybank, CIMB, Public Bank, RHB, Hong Leong, Bank Islam.
- **Indonesia:** BCA, Mandiri, BNI, BRI, Bank Syariah Indonesia (BSI).
- **E-wallets:** GrabPay, Touch 'n Go, Boost (MY); GoPay, OVO, DANA (ID).
**Acceptance criteria:**
- Each supported bank has a named parser that handles PDF statements and CSV exports.
- AI fallback for unsupported formats (you already have this — retain it).
- Show "Supported banks" list clearly on the Upload page.

### 3.3 Shared household budgets (stretch)
**Why:** SEA finance is often managed household-wide. YNAB does this poorly.
**Acceptance criteria:**
- Invite a spouse/family member to view-only or co-manage budget.
- Transactions tagged by household member.

---

## 💰 Phase 4 — Monetization & Growth
*Estimated time: 1–2 weeks. Do once product is rock solid.*

### 4.1 Local payment methods for subscription
**Why:** Pocket Pay alone won't convert MY/ID users.
**Acceptance criteria:**
- **Malaysia:** Integrate Billplz or iPay88 for FPX (online banking), GrabPay, Boost, TNG eWallet.
- **Indonesia:** Integrate Xendit or Midtrans for GoPay, OVO, DANA, BCA VA, QRIS.
- Keep Pocket Pay for Brunei.
- Show payment methods based on user's selected currency/region.

### 4.2 Regional pricing
**Why:** BND 10/month ≈ MYR 33 ≈ IDR 117,000. Too expensive for Indonesia baseline.
**Acceptance criteria:**
- Tiered regional pricing:
  - Malaysia: MYR 15–19/month
  - Indonesia: IDR 39,000–49,000/month
  - Brunei: BND 10/month (current)
- Show annual pricing with ~20% discount.
- Display prices in user's local currency on the Premium page.

### 4.3 Free tier for funnel
**Why:** Standard conversion funnel in SEA apps. Trial alone has higher drop-off.
**Acceptance criteria:**
- Free tier: up to 50 transactions/month, 1 account, basic dashboard. No AI, no debt simulator, no insights.
- Premium: unlimited + all features.
- Clear upgrade prompts when hitting limits (non-annoying).

### 4.4 Referral program
- Give 1 free month for each successful paid referral (both referrer and referee).
- Simple shareable link.

---

## 🔧 Technical & Infra Notes

- **Database:** If you're not already using a proper DB (Postgres/Supabase), migrate before multi-user scaling. Replit DB is fine for prototypes but not production multi-tenant.
- **Auth:** Ensure per-user data isolation is tested rigorously before adding paying users.
- **Secrets:** All API keys (payment gateways, AI) must be in Replit Secrets, never in code.
- **Analytics:** Add PostHog or similar to track feature usage before investing further.
- **Error monitoring:** Add Sentry or similar for production issues.

---

## 🚦 Recommended Starting Order

1. **Week 1:** Phase 1.1, 1.2, 1.4 (bugs + polish)
2. **Week 2:** Phase 1.3 (richer insights) + start Phase 2.1 (currency)
3. **Week 3–4:** Finish Phase 2.1, 2.2, 2.3 (localization complete)
4. **Week 5–6:** Phase 3.1 (Zakat) + 3.2 (local bank parsers)
5. **Week 7–8:** Phase 4.1, 4.2, 4.3 (monetization)
6. **Week 9+:** Phase 3.3, 4.4, and iteration based on early user feedback

---

## 📋 Success Metrics to Track

- **Phase 1:** Zero blank states on Dashboard, accurate income display.
- **Phase 2:** Language + currency switchable with no broken strings or formatting.
- **Phase 3:** ≥5 MY/ID bank statements parse successfully end-to-end.
- **Phase 4:** Free-to-paid conversion ≥3%, payment success rate ≥95%.