# Budgets page port — handoff

This is the production replacement for `artifacts/duitplan/src/pages/budgets.tsx` in `xpressitdev/Brunei-Finance-Base`.

## What changed

- **New "Allocate" tab** added as the *first* (and now default) view — drag-and-drop allocation matching the design system mockup. Three columns: **Bank** (loans), **Envelopes** (spending), **Vault** (savings/goals).
- The existing **Forecast Plan**, **Actual vs Plan**, and **Annual Report** tabs are preserved verbatim — nothing you have today regresses.
- `Cash Flow Plan` heading swaps to **"Allocate your gaji"** when you're on the Allocate tab; reverts otherwise.

## Drop-in instructions

1. Replace `artifacts/duitplan/src/pages/budgets.tsx` with this file.
2. No new dependencies — everything imports from your existing `@workspace/api-client-react`, `@/components/ui/*`, and `lucide-react`.
3. No backend / API changes needed. The Allocate view uses your existing `useUpsertBudget` mutation per category.

## How buckets are derived (until you add proper Vault/Goals tables)

| Bucket | Source |
|---|---|
| **Bank** (loans) | `useListCommitments()` items whose label contains `loan`, `financing`, `credit`, `mortgage`, `hire purchase` |
| **Envelopes (fixed)** | All other `useListCommitments()` items — rent, utilities, etc. |
| **Envelopes (variable)** | `useListCategories()` where `kind === "expense"` |
| **Vault** | `useListCategories()` where `kind === "savings"` OR name matches `/vault\|goal\|saving/i`. Falls back to empty if you have neither yet. |

## Mutations

- Dragging onto an **envelope** or **vault** bucket calls `upsert.mutateAsync({ data: { categoryId, month, plannedAmount } })` — same hook the Forecast Plan tab uses today. Allocations persist immediately.
- Dragging onto a **loan** bucket only updates UI state — backend integration for adjusting commitment amounts isn't wired here. The auto badge tells the user it's locked.
- **Vault unlock** (dragging money OUT of a vault) opens a confirm modal that requires a written reason. Currently the reason is logged to the React state only — there's a `// TODO: POST reason to /api/vault-unlocks` marker where you'd wire an audit-log endpoint when you build one.

## Suggested follow-ups (not in this port)

- Add a `vault_unlock_audits` table + endpoint so the friction-lock reason actually persists. Right now it's UX theatre.
- Move savings/goals to a proper `goals` table with target + deadline, instead of overloading the categories table.
- Add a `commitment_kind` column ("loan" | "fixed") so we don't have to keyword-match labels.

That's it — paste, commit, deploy.
