# DuitPlan — Full Session Handoff for Claude Cowork

**Purpose:** This document gives Claude Cowork the full context of a multi-night DuitPlan build session. The user (Hakem, founder of DuitPlan) is now requesting a deep architectural critique of the live production app's dashboard math and calculation logic. Use this document to understand what's been built, what decisions were made, and what's still pending.

**Date:** April 26, 2026
**Session orchestrator:** User (Hakem) — solo founder
**Workflow pattern:** Cowork (UX testing, browser-driven) ↔ Planning Claude (this chat — drafted prompts, managed roadmap) ↔ Replit Agent (executed code changes)

---

## Section 1: Who is the user, and what is DuitPlan?

**User:** Pengiran Abdul Hakem Pengiran Haji Shahbirin
- Brunei-based
- Day job: Turnaround Excellence Engineer at Shell
- Side business: CEO of Cuci Xpress (multiple branches, express car wash, expanding to Tutong, considering interior cleaning service)
- Husband, father of two young children (one autistic — needing attention)
- Active community member, Muslim, observant
- Solo builder of DuitPlan

**DuitPlan:**
- Personal finance tracking app, similar to YNAB but built for Southeast Asia
- Originally Brunei-only (BND); scaled to Malaysia (MYR) and Indonesia (IDR)
- Recently registered as a Brunei Sole Proprietor entity (April 26, 2026)
- Domain: `duitplan.com` (apex), `my.duitplan.com` (Malaysia), `id.duitplan.com` (Indonesia)
- Stack: Replit-hosted React/TypeScript web app, i18next + react-i18next
- Repo: GitHub `xpressitdev/Brunei-Finance-Base`
- Currently in PRODUCTION on real domains with SSL

**Strategic context:**
- Built primarily for Hakem's own use first; soft-launch to friends planned next
- Strongest moat: Zakat calculator (religious differentiator no Western finance app has)
- Engagement engine: "Hari Gaji" payday auto-prompt
- "Make it the best personal finance app I can, no launch pressure" — user's stated success criteria

---

## Section 2: Workflow pattern (important for Cowork to know)

User has built a three-Claude workflow:

1. **Cowork (you)** — UX testing on the live app, browser-driving, fresh-eyes critique
2. **Planning Claude (this chat)** — drafts prompts, manages roadmap continuity, scopes milestones
3. **Replit Agent** — executes code changes based on prompts

User orchestrates by routing context between the three. Cowork has caught critical bugs that Planning Claude couldn't see (bugs only surface during real usage). Pattern works.

---

## Section 3: Complete feature shipping history (chronological)

### Phase 1 — Bug fixes & quick wins (✅ COMPLETE)
- Fixed empty "Spending by Category" chart on Dashboard
- Pulled configured salary into Expense Tracker's "Month Income"
- Built richer Insights page (6 insight types with empty states)
- UX polish: sidebar consistency, dismissible trial banner, "last updated" timestamps

### Milestone 1 — First-impression UX polish (✅ COMPLETE)
Sourced from earlier Cowork session reviewing the deployed app. Three changes shipped:
- Dashboard becomes default landing page after login (was Expense Tracker)
- "Remaining" promoted to hero card with green/amber/red color states based on % of monthly salary, plus plain-language interpretation messages
- Fixed "Selamat datang, Awangku!" placeholder — now uses `user.firstName` (first token only, e.g., "Siti Nurul Aisyah" → "Siti")

### Phase 2 — Multi-region & i18n foundation (✅ COMPLETE)
Originally scoped as "localization." Restructured mid-phase into a full multi-region architecture.

**Architectural decisions:**
- ONE codebase, multiple regional subdomains (apex BN, `my.` MY, `id.` ID)
- Region detected from hostname at app boot
- Region and language are INDEPENDENT (a Malaysian user can browse in English; an Indonesian visitor can switch to English)
- NO user-facing currency switcher — region-stamps user at signup
- Three languages: English, Bahasa Melayu, Bahasa Indonesia (independently translated)

**Completed work:**
- 2.1 Region config + formatter utilities (`regions.ts`, `formatting.ts`); IDR zero-decimal handling
- 2.2 Hostname-based region detection at app boot
- 2.3 Refactor every page to use `formatCurrency` via `useRegion` hook
- 2.4 Region testing infrastructure (test-my and test-id seed users, dev-only `?region=` URL override, dev indicator)
- 2.5 IDR decimal fix (per-region `decimals` config so IDR shows 0 trailing decimals natively)
- 2.6 Premium tab + trial banner removal (no real free tier yet)
- 2.7 i18n setup with i18next + react-i18next
- 2.8 String extraction across all 13 internal pages with translations
- 2.9 Achievement badges and sidebar nav extraction with translations
- 2.10 Landing page rewrite to pan-regional copy (no Brunei/BIBD/BND references)
- 2.11 Auth, onboarding, AI chat UI chrome extraction with translations
- 2.12 Landing page language detection (subdomain → browser locale → English) + manual switcher

**Outstanding (deferred):**
- 2.13 Native-speaker review of Malay and Indonesian translations (machine-translated; usable for dev but needs review before public launch)

### Phase 3.1 — Zakat Calculator (✅ COMPLETE)
Religious differentiator. Strongest moat in MY/ID/BN markets.

**Decisions:**
- Scope: Version 2 (Wealth-Aware Calculator) — pulls from existing accounts, calculates Zakatable wealth automatically
- Placement: Standalone page in main nav between Goals and Net Worth
- Wealth detection: All accounts checked by default, user can deselect
- Nisab: User-entered with helper text showing approximate gold/silver values (April 2026 reference values hardcoded — BN: 16,575; MY: 54,400; ID: 225,250,000)
- Regional authorities: Auto-show user's region's body (MUIB for BN, LZS for MY, BAZNAS for ID)
- Madhab: Default Shafi'i with disclaimer, no override dropdown for v1

### Phase 3.3 — Hari Gaji Payday Auto-Prompt (✅ COMPLETE — banner-only v1)
Engagement loop: app proactively detects payday, prompts user to confirm receipt of salary, auto-creates income transaction + debt repayment outflows.

**Decisions:**
- Trigger: in-app banner only (no email yet, no push — those deferred until business email infra is sorted)
- Banner appears on payday, persists until user acts
- "Yes, I got paid" → review modal with salary + debt line items
- Each line editable, deselectable, then batch-confirmed
- All debts deduct on payday for v1 (per-debt due dates deferred — see IDEA-002)
- New `payday_prompts` table tracks per-month lifecycle states (pending/confirmed/skipped/remind_tomorrow)

### Production deployment (✅ COMPLETE)
All 4 domains live with SSL:
- `duitplan.com` (apex, BN default)
- `www.duitplan.com`
- `my.duitplan.com` (Malaysia)
- `id.duitplan.com` (Indonesia)

### Polish: Expense Tracker hero actions (✅ COMPLETE)
Bottom-right floating buttons (camera + add) collided with Feedback widget. Fixed by:
- Persistent action bar at top of Expense Tracker (always visible)
- Hero buttons in empty state (when no expenses)
- Removed bottom-right FABs entirely on this page

### Milestone 1.5 — Loan double-counting fix (✅ COMPLETE)
**Critical calculation bug found by Cowork during fresh-eyes testing.**

**The bug:** Step 3 (Commitments) and Step 5 (Loans) of onboarding both exposed the same loan tiles (Car Loan, Personal Loan, House Financing, Credit Card). Loans declared in both got counted twice in "Remaining this month" calculation.

**The fix:**
- Removed loan tiles from Step 3
- Helper note: "Have a car loan, house financing, or credit card debt? You'll add those in the next step"
- One-time data migration with dry-run safety, dedup logic, and auto-migration banner
- Migration successfully ran on the only affected account

### Milestone 1.6 — Pre-launch bug bash (✅ JUST DEPLOYED)
**Founder dogfooding revealed 4 launch-blocking issues:**

#### Fix 1: Reconcile-on-transaction logic (the architectural one)

**Bug:** When Hari Gaji banner created a debt repayment transaction, the debt was now subtracted twice from "Remaining this month":
- Once because `debts.monthly_payment` summed into planned outflows
- Once because actual transaction summed into actual outflows

**Fix:**
- Added `linked_debt_id` column (nullable, foreign key) to `transactions` table
- Hari Gaji confirmation now stamps each debt-payment transaction with the corresponding debt's ID
- "Remaining this month" calculation modified to:
  - Sum all transactions for current month (actual outflows)
  - Sum debt monthly_payments WHERE debt.id NOT IN (debts already reconciled by a transaction this month)
  - This way, a debt counts as planned UNTIL a linked transaction reconciles it; then the transaction takes its place

**V1 limitation:** Manually-created transactions do NOT auto-link. Only Hari Gaji-created transactions reconcile. Acceptable for v1.

#### Fix 2: Hari Gaji banner shouldn't fire on signup day

**Bug:** When user signs up and their payday for the current month has already passed (or is today), the banner fires immediately. User confirms, app creates transactions on top of account balances that already reflect those events. **Account balances entered during onboarding represent CURRENT state (post-salary, post-debt-deductions for the month).** Adding new transactions for events that already happened double-counts.

**Fix:**
- Added `onboarded_at` timestamp to users table (backfilled `created_at` for existing users)
- Banner trigger logic now skips if `current_month_payday_date <= user.onboarded_at`
- Result: User signs up Apr 5 with payday=20 → banner fires Apr 20 ✓. User signs up Apr 26 with payday=25 → banner first fires May 25 ✓.
- **Implementation note:** Initial code had bug ("skip entire calendar month") — caught by Planning Claude during verification, fixed to use day-of-month integer comparison

#### Fix 3: Variable budget save bug
**Bug:** Variable budget amounts flashed empty momentarily after save (race condition between local state clear and server refresh).
**Fix:** Save now waits for server data refresh before clearing input edit state.

#### Fix 4: "YNAB" placeholder text removed from Plan vs Actual section
Two occurrences found in user-facing UI, replaced with neutral copy in EN/MS/ID.

---

## Section 4: Architectural decisions Cowork should know

### The "Remaining this month" model (Option A — Reconcile on Transaction)
After much discussion, user picked Option A:

> When a planned debt becomes an actual transaction, the planned amount is no longer subtracted from Remaining. The transaction takes its place.

**Why this matters for Cowork's investigation:** This is the architectural model. If you find numbers that don't match, the question is whether the BEHAVIOR matches this model, or whether the model itself is conceptually wrong.

### Region/Language independence
- A user's region is permanent (set at signup based on subdomain)
- A user's language is changeable in Settings
- These are independent dimensions
- Currency follows region; UI text follows language

### Database tables (high-level)
- `users` — auth + region + language + payday + monthlyIncome + onboarded_at
- `accounts` — bank accounts/wallets per user with balances
- `transactions` — actual financial events (income/expense) with optional `linked_debt_id`
- `commitments` — recurring bills (rent, utilities, family support) — does NOT include loans after Milestone 1.5
- `debts` — loans/financing with monthly_payment and outstanding_balance
- `goals` — savings goals
- `budgets` — fixed and variable category budgets
- `payday_prompts` — Hari Gaji lifecycle state per user × month
- `migration_source` (column on debts) — flags loans that came from auto-migration

### Dashboard math (current model)
This is the math AS IT SHOULD WORK after Milestone 1.6:

```
salary = user.monthlyIncome
fixed_commitments = SUM(commitments.monthly_amount)
liabilities = SUM(debts.monthly_payment)  // shown as a KPI
total_spent = SUM(transactions for current month, expense type)

reconciled_debt_ids = SET of debts where a transaction this month has linked_debt_id matching the debt
unreconciled_debts = SUM(debts.monthly_payment) WHERE debt.id NOT IN reconciled_debt_ids

remaining = salary - fixed_commitments - unreconciled_debts - total_spent
```

### Hari Gaji onboarding rule
```
SKIP banner for current month if:
  current_month_payday_date <= user.onboarded_at
```

---

## Section 5: Known V1 limitations (NOT bugs — don't classify as bugs)

These are intentional scope decisions:

- **Manual transactions don't auto-link to debts** — only Hari Gaji-created transactions reconcile. Manual debt payments will still double-count until manual linking is built (deferred).
- **Bank statement parsing for MY/ID banks** — Maybank, CIMB, BCA, Mandiri etc. deferred until real sample statements collected. Currently only BIBD/Baiduri (Brunei) parsers exist.
- **Per-debt due-day scheduling** — all debts deduct on payday for now. Real banks deduct different debts on different days, but this is captured as IDEA-002 for later.
- **Email reminders for Hari Gaji** — deferred until business email infra is set up.
- **Push notifications** — deferred (PWA strategy not yet committed).
- **Drag-and-drop envelope budgeting** — captured as IDEA-001, deferred to Phase 5 post-launch.
- **"Reset my data" feature** — captured as IDEA-004, deferred until users request it.
- **Native-speaker translation review** — Phase 2.13, deferred to pre-launch.
- **Investigation of mystery Mailgun DNS records** — AUDIT-001, no apparent active service using them, deferred until email infra planning.
- **Region-aware AI system prompt** — currently has Brunei references baked in, deferred to bank parser phase.

---

## Section 6: What Cowork should investigate now

User has explicit suspicions that the dashboard math, calculation logic, and overall architecture are still off in ways beyond Milestone 1.6's reconciliation fix. User has sketches on a tablet that they'll share via screenshot during the session.

### The setup
- User is logged into their REAL account on production (`hakemshahbirin@live.com` or similar)
- User will share their browser via your browser connector — you direct, they click
- User will share tablet sketches showing where they think logic is wrong
- You're the architect/auditor; user is your hands

### What user wants from you

1. **Listen to user's suspicions first.** They'll show tablet sketches and walk through their mental model of the bug before you click anything. Don't pre-judge.

2. **Investigate together.** Direct user to specific places, ask them to perform actions, observe resulting numbers. Treat each suspicion as a hypothesis to validate or invalidate.

3. **Look beyond what user flags.** While investigating, watch for related issues user hasn't noticed. Dashboard has many moving parts (Salary, Fixed Commitments, Liabilities, Total Spent, Remaining, Spending by Category, Insights). Surface anything that looks off even if user didn't point to it.

4. **Architectural framing, not just bugs.** Don't just say "X number is wrong." Explain WHY — what's the underlying mental model mismatch? What should the math actually represent? Is there a conceptual flaw in how Remaining is defined? Is the relationship between commitments / debts / transactions / budgets coherent?

5. **Distinguish three categories of issue:**
   - **Calculation bugs** (the math is wrong given a clear correct answer)
   - **Definitional ambiguity** (the math is "correct" but the displayed label doesn't match what users expect — naming/UX problem)
   - **Architectural mismatch** (the data model itself is wrong; no calculation can fix it without restructuring)

6. **Output format:** A numbered list of issues, each tagged with one of the three categories above, plus a one-sentence "what should this be instead" for each. Avoid prose summaries — give a punch list that can be converted directly into Replit Agent prompts.

### What user will handle
- All clicking, navigation, screenshot capture
- Showing what's on screen
- Sharing tablet sketches via screenshot
- Pasting your final report into Planning Claude session for prompt drafting

---

## Section 7: Earlier Cowork findings (for continuity)

User's earlier dogfooding produced 10 feedback items captured in a spreadsheet. Items 1, 2, 3, 4, 5, 9 became Milestone 1.6. Remaining items not yet addressed:

- **Item 3 (partially):** Auto-logged debt transactions need a category — fixed via reconciliation but visual category labeling may still need work
- **Item 6:** Duplicated debt entries possible + can't delete on mobile — NOT YET FIXED
- **Item 7:** Simulate button too hidden — NOT YET FIXED
- **Item 8:** BIBD upload failed + unclear function — NOT YET FIXED
- **Item 10:** Feedback form UX (minimize, screenshots, image upload) — NOT YET FIXED

These are queued for "Milestone 1.7 — Feedback round 1 polish" but not started. Cowork's new investigation may surface higher-priority items that supersede this list.

---

## Section 8: Files maintained outside the codebase

User maintains three reference docs (separate from the Replit codebase):

1. **`ROADMAP.md`** — Phase 1 / Milestone 1 / Phase 2 / Phase 3 / Phase 4 / Phase 5 plan with all completed/deferred items
2. **`IDEAS.md`** — Future ideas backlog (envelope budgeting, WhatsApp notifications, reset-my-data, etc.) with re-evaluation triggers
3. **`REGION_CONTENT_BACKLOG.md`** — Region-aware content gaps (BIBD references in AI prompts, native translation review, etc.)

---

## Section 9: Tone and style preferences

Based on session history:
- User catches agent drift quickly — values careful, deliberate, scope-respecting work
- User has demonstrated maturity in deferring features (envelope budgeting, reset-my-data, push notifications) when not blocking
- User responds well to honest pushback — not yes-man behavior
- User is comfortable with tight-scoped prompts and STRICT scope boundaries
- User appreciates concrete test scenarios over abstract descriptions
- User is OK with multi-night arcs but values shipping over polish

---

## Section 10: Tech stack quick reference

- **Framework:** React + TypeScript on Replit (Autoscale deployment)
- **i18n:** i18next + react-i18next, locale files at `src/i18n/locales/{en,ms,id}.json`
- **Region config:** `src/config/regions.ts`
- **Formatters:** `src/utils/formatting.ts` with `formatCurrency`, `formatNumber`, `formatDate`
- **Backend:** API server in `artifacts/api-server/`, frontend in `artifacts/duitplan/`
- **Database:** Postgres (presumed — confirm if needed)
- **Auth:** Session-based with `SESSION_SECRET`
- **AI:** OpenAI integration via `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY`
- **Storage:** Replit object storage for uploaded files
- **Domains:** GoDaddy registrar + GoDaddy DNS (Cloudflare detour deferred)

---

## Section 11: Things that have been confirmed working

So Cowork doesn't waste time re-verifying:

- ✅ Multi-region detection from hostname
- ✅ Auto-language detection on landing page (subdomain → browser locale → English)
- ✅ Manual language switcher on landing
- ✅ All 13 internal pages render in EN/MS/ID
- ✅ Region-aware currency formatting (BND/MYR/IDR with correct decimals)
- ✅ Zakat calculator with regional bodies (MUIB/LZS/BAZNAS)
- ✅ Hari Gaji banner appearing on payday (with the new onboarding rule applied)
- ✅ Hari Gaji confirmation creating transactions linked to debts
- ✅ Sidebar nav i18n in all languages
- ✅ Achievement badges in all languages
- ✅ Sign in/sign up flows in all languages
- ✅ Onboarding wizard (6 steps) functional
- ✅ Loan tiles removed from Step 3 (Milestone 1.5)
- ✅ "YNAB" text removed from Plan vs Actual

---

## Section 12: How to start the session with the user

Suggested opener for Cowork:

> Hi Hakem! I've read the full handoff context — I have a complete picture of where DuitPlan stands today, what's been shipped, what's deferred, and what architectural model has been chosen for the dashboard math.
>
> You mentioned you have sketches on your tablet showing where you think the logic is off. Please share those first — I want to understand your mental model before we click into the app.
>
> Once I see your sketches, we'll drive the browser together to investigate. I'll direct, you click, we compare what we see against what should be. I'll output the final findings as a tagged punch list (calculation bugs / definitional ambiguity / architectural mismatch) so it converts directly into prompts for Replit Agent.
>
> Ready when you are.

---

**End of handoff document.**
