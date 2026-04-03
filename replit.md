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
- `profiles` — fullName, currency (BND), payday, monthlyIncome
- `accounts` — bank accounts
- `categories` — 15 default spending categories (seeded)
- `commitments` — monthly recurring obligations (rent, bills, etc.)
- `transactions` — manual + imported transactions
- `monthly_budgets` — budget allocations by category/month
- `debts` — loans and debt obligations
- `debt_scenarios` — payoff simulation results
- `uploaded_documents` — PDF statement uploads
- `imported_transaction_rows` — parsed rows awaiting review
- `merchant_rules` — auto-categorization rules
- `insights` — generated financial observations
- `subscription_plans` — Free + Premium plans (seeded)
- `user_subscriptions` — user subscription records

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
- `/subscription/plans`, `/subscription/current`

## Phases Completed

- **Phase 1 (Current)**: App structure, Auth, Onboarding wizard, Dashboard shell, Prisma schema
  - Authentication: email/password with session cookies
  - Onboarding: 5-step wizard (salary, payday, commitments, debts, categories)
  - Dashboard: summary cards, spending by category chart (Recharts), recent transactions, insights
  - All 20 screens from wireframe spec scaffolded
  - Full Drizzle/PostgreSQL schema with 15 tables
  - 15 default categories seeded
  - Free + Premium subscription plans seeded
  - Mock PDF parsers for BIBD and Baiduri (ready for real parser implementation)

## Upcoming Phases

- **Phase 2**: Core finance tracking — categories, manual transactions, budget allocation
- **Phase 3**: Debt planner — add/edit debts, payoff simulation
- **Phase 4**: Statement import — BIBD + Baiduri PDF parsers, review UI
- **Phase 5**: Insights + premium gating

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `SESSION_SECRET` — Session signing secret
- `PORT` — Port for each service (auto-assigned)
- `BASE_PATH` — Base path for frontend routing

## Design

- Calm fintech dashboard aesthetic — teal/green primary color
- Trustworthy, modern, practical
- Left sidebar on desktop, mobile-responsive
- Currency: BND (Brunei Dollar)
- Built for Brunei salaried professionals
