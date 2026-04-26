# DuitPlan

## Overview

DuitPlan is a Brunei-first personal finance web app for salaried users. It helps manage monthly salary, expenses, debt obligations, and bank statement imports from local Brunei banks (BIBD and Baiduri).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + wouter (routing)
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: express-session with bcryptjs (email/password)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Architecture

```
artifacts/
  duitplan/         — React + Vite frontend (served at /)
  api-server/       — Express 5 backend (served at /api)
lib/
  db/               — Drizzle ORM schema + PostgreSQL client
  api-spec/         — OpenAPI spec (source of truth)
  api-client-react/ — Generated React Query hooks
  api-zod/          — Generated Zod validation schemas
```

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/duitplan run dev` — run frontend locally

## Database Schema (Drizzle)

Tables in `lib/db/src/schema/`:
- `users` — email/password auth, onboarding status
- `profiles` — fullName, currency (BND), region (BN), locale (en-BN), language (en), payday, monthlyIncome
- `accounts` — bank accounts
- `categories` — 15 default spending categories (seeded)
- `commitments` — monthly recurring obligations (rent, bills, etc.)
- `goals` — financial goals with target amount, saved amount, deadline, and category
- `net_worth_snapshots` — monthly net worth entries (YYYY-MM key, unique per user per month)
- `transactions.receipt_url` — nullable column for storing receipt image object path
- `transactions` — manual + imported transactions
- `monthly_budgets` — budget allocations by category/month
- `debts` — loans and debt obligations
- `debt_scenarios` — payoff simulation results
- `uploaded_documents` — PDF statement uploads
- `imported_transaction_rows` — parsed rows awaiting review
- `merchant_rules` — auto-categorization rules
- `insights` — generated financial observations
- `subscription_plans` — Single "DuitPlan" plan at BND 10/month (seeded)
- `user_subscriptions` — user subscription records (status, nextBillingDate, pocketOrderId)

## API Routes

All routes under `/api`:
- `/auth` — register, login, logout, me
- `/profile` — get/update profile
- `/onboarding/status`, `/onboarding/complete`
- `/accounts` — CRUD
- `/categories` — list + create
- `/commitments` — CRUD
- `/transactions` — CRUD with filters (month, category, type, search)
- `/budgets` — list by month + upsert
- `/debts` — CRUD + payoff simulation
- `/insights` — list + generate (rules-based)
- `/dashboard/summary`, `/dashboard/spending-by-category`, `/dashboard/recent-transactions`
- `/uploads` — PDF upload + row review + confirm import
- `/subscription/current` — unified status: trial (with daysRemaining), active, or expired
- `/subscription/checkout` — POST: initiates Pocket Pay session (BND 10/month)
- `/subscription/callback` — POST: Pocket Pay payment callback (updates subscription)
- `/subscription/activate-test` — POST: dev-only endpoint to activate subscription
- `/goals` — CRUD (list, create, update, delete)
- `/net-worth` — monthly snapshots (list ?year=, upsert POST, delete)
- `/expenses` — Expense Tracker home page (frontend only, uses /transactions API)
- `/receipt/scan` — POST: accepts base64 image, returns AI-extracted receipt data (merchant, amount, date, description, category)
- `/storage/uploads/request-url` — POST: returns presigned GCS URL for receipt image uploads
- `/storage/objects/*` — GET: serves uploaded objects from object storage

## Phase 2 — Multi-Region Architecture (In Progress)

DuitPlan is being extended to serve BN/MY/ID regional subdomains with fixed per-region currency and locale.

**Phase 2 Prompt 1 (complete):**
- `artifacts/duitplan/src/config/regions.ts` — REGIONS map, RegionCode type, getRegionByCode/getCurrencyByRegion/getLocaleByRegion helpers
- `artifacts/duitplan/src/utils/formatting.ts` — formatCurrency, formatNumber, formatDate, formatDateTime, formatRelativeTime (all via Intl APIs, NaN-safe)
- `artifacts/duitplan/src/utils/formatting.test.ts` — 10 vitest unit tests, all passing
- DB: profiles table has region/locale/language fields (default BN/en-BN/en, all existing rows backfilled)
- Test runner: `pnpm --filter @workspace/duitplan test`

**Phase 2 Prompts 2+3 (complete):** Multi-currency support
- `src/hooks/useCurrency.ts` — `useCurrency()` hook exposing `fmt`, `currencyLabel`, `inputStep` from profile region
- All 13 pages refactored to use `useCurrency()`; no hardcoded `BND X.toFixed(2)` remains
- Subdomain hostname detection resolves region from Host header

**Phase 2 Prompt 5a (complete):** i18n infrastructure + string extraction
- `i18next` + `react-i18next` installed
- `src/i18n/index.ts` — i18next config with en/ms/id resources, `initImmediate: false`, fallback `en`
- `src/i18n/locales/en.json` — ~160 nested keys (common, dashboard, expenseTracker, transactions, settings)
- `src/i18n/locales/ms.json` — full Bahasa Melayu translations (native-speaker corrected: Liabiliti→Tanggungan, Urus Niaga→Transaksi, Tidak dikategorikan→Tanpa kategori, etc.)
- `src/i18n/locales/id.json` — full Bahasa Indonesia translations (native-speaker corrected: Akun→Rekening, Tidak dikategorikan→Tanpa kategori, berbeda→lain, etc.)
- `src/i18n/I18nProvider.tsx` — watches `profile.language` with `navigator.language` fallback
- Pages fully translated: `dashboard.tsx`, `expenses/index.tsx`, `transactions.tsx`, `settings.tsx`
- Settings > Preferences tab: language dropdown persists via PATCH `/api/profile { language }`

## Phases Completed

- **Phase 1 (Complete)**: App structure, Auth, Onboarding wizard, Dashboard shell, Prisma schema
  - Authentication: email/password with session cookies
  - Onboarding: 5-step wizard (salary, payday, commitments, debts, categories)
  - Dashboard: summary cards, spending by category chart (Recharts), recent transactions, insights
  - All 20 screens from wireframe spec scaffolded
  - Full Drizzle/PostgreSQL schema with 15 tables
  - 15 default categories seeded
  - Free + Premium subscription plans seeded
  - Mock PDF parsers for BIBD and Baiduri (ready for real parser implementation)

**Phase 3 Prompt 2 (complete):** Payday auto-prompt — in-app banner + review modal
- `lib/db/src/schema/payday_prompts.ts` — new table with state machine (pending/confirmed/skipped/remind_tomorrow), unique per user/year/month
- `artifacts/api-server/src/routes/payday-prompt.ts` — 4 endpoints: GET /current (find-or-create logic, end-of-month payday clamping), POST /:id/confirm (batch creates transactions + updates account balances), POST /:id/skip, POST /:id/remind-tomorrow
- `artifacts/duitplan/src/hooks/usePaydayPrompt.ts` — React Query hook wrapping all 4 endpoints with cache invalidation
- `artifacts/duitplan/src/components/PaydayBanner.tsx` — full-width green banner, shown only when GET /current returns non-null; "Yes, I got paid" → opens modal; "Not yet" → remind tomorrow; "Skip this month" → dismisses for this month
- `artifacts/duitplan/src/components/PaydayReviewModal.tsx` — Dialog-based review modal: income line item (pre-filled with monthlyIncome), one line per active debt, inline edit panels (amount/account/date/description), duplicate detection (warns if salary already logged today), net cashflow footer, Confirm All batch-creates transactions
- `artifacts/duitplan/src/components/layout/AppLayout.tsx` — PaydayBanner inserted above page content
- i18n: paydayPrompt.* keys added to en/ms/id.json

**Phase 3 Prompt 1 (complete):** Zakat calculator page
- `src/config/zakatNisab.ts` — Nisab reference values (BN/MY/ID) for gold and silver thresholds, with last-updated date
- `src/config/zakatAuthorities.ts` — Official Zakat authority metadata (MUIB/Brunei, LZS/Malaysia, BAZNAS/Indonesia)
- `src/pages/zakat.tsx` — Full Zakat calculator page with:
  - Account selector (checkboxes for savings/current accounts only, checked by default)
  - Nisab threshold input with gold/silver quick-set buttons + info popover showing regional reference values
  - Live calculation summary (total wealth, excluded, zakatable wealth, above-nisab check, 2.5% rate, Zakat owed)
  - "Create Zakat goal" button → creates a custom savings goal via `useCreateGoal`
  - "Visit authority" button → links to regional Zakat authority website
  - Shafi'i school disclaimer
- Sidebar: HandCoins icon added, `zakat` nav item inserted between `goals` and `netWorth`
- App.tsx: `/zakat` ProtectedRoute registered
- i18n: `nav.zakat` key + full `zakat.*` section added to en/ms/id locale files

## Upcoming Phases

- **Phase 2**: Core finance tracking — categories, manual transactions, budget allocation
- **Phase 3**: Debt planner — add/edit debts, payoff simulation
- **Phase 4**: Statement import — BIBD + Baiduri PDF parsers, review UI
- **Phase 5**: Insights + premium gating

## Monetization Model

- **45-day free trial**: All new users get full access for 45 days from account creation (derived from `users.created_at + 45 days`). No credit card required.
- **Post-trial**: BND 10/month subscription via Pocket Pay (home.pocket.com.bn) by ThreeG Media.
- **Subscription states**: `trial` (days remaining shown), `active` (paid), `expired` (read-only).
- **Feature gating**: Write routes (transactions, uploads, insights, debts, budgets, commitments) return 403 with `TRIAL_EXPIRED` code when expired.
- **Trial banner**: Persistent top banner in app layout — neutral color >14 days, amber 7–14 days, red <7 days.
- **Expired overlay**: Full-screen overlay blocks interaction, prompts subscribe.
- **Premium page**: Single plan page (not Basic/Premium split) with Pocket Pay checkout button.
- **Payment callbacks**: Pocket Pay callbacks at `/api/subscription/callback` update subscription status.
- **Pocket Pay credentials**: Set `POCKET_MERCHANT_ID`, `POCKET_TERMINAL_ID`, `POCKET_API_KEY`, `POCKET_API_BASE`, `APP_BASE_URL` as environment variables once DuitPlan merchant account is registered.

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `SESSION_SECRET` — Session signing secret
- `PORT` — Port for each service (auto-assigned)
- `BASE_PATH` — Base path for frontend routing
- `POCKET_MERCHANT_ID` — Pocket Pay merchant ID (swap in once account registered)
- `POCKET_TERMINAL_ID` — Pocket Pay terminal ID
- `POCKET_API_KEY` — Pocket Pay API key (used for HMAC callback validation)
- `POCKET_API_BASE` — Pocket Pay API base URL (default: https://home.pocket.com.bn/api)
- `APP_BASE_URL` — Public app URL for payment return URLs

## Design

- Calm fintech dashboard aesthetic — teal/green primary color
- Trustworthy, modern, practical
- Left sidebar on desktop, mobile-responsive
- Currency: BND (Brunei Dollar)
- Built for Brunei salaried professionals
