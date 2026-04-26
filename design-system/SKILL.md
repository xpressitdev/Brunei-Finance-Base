---
name: duitplan-design-system
description: Use when designing for DuitPlan — a salary-first personal finance app for Brunei, Malaysia, and Indonesia. Activate any time a user mentions DuitPlan, gaji, Hari Gaji, BIBD/Baiduri, or asks for designs in this folder. Provides production tokens, components, and tone of voice so any new screen, page, slide, or marketing asset matches the live product.
---

# DuitPlan Design System — Skill

DuitPlan is a calm, modern personal-finance app for salaried life in Southeast Asia. Single React/TypeScript codebase, three regions (BN/MY/ID), three currencies (BND/MYR/IDR). One founder: Pengiran Abdul Hakem.

## When this skill activates
- User asks for a DuitPlan screen, slide, mockup, marketing asset, email, etc.
- User mentions "gaji", "Hari Gaji", "Zakat", "BIBD", "Baiduri", or any of the regional banks listed in `README.md`.
- A file in this folder is referenced or modified.

## What to read first
1. **`README.md`** — full content + visual + iconography fundamentals. Authoritative.
2. **`colors_and_type.css`** — drop-in tokens. Always link this in a new HTML deliverable, never re-define values.
3. **`ui_kits/duitplan-app/`** — production app recreation. Lift components from here for any in-app surface (sidebar, KPI cards, transaction rows, Hari Gaji banner, budgets, debts, goals).
4. **`ui_kits/duitplan-marketing/index.html`** — landing page recreation. Lift sections/copywriting patterns for any external surface.

## Hard rules
- **Sentence case everywhere.** Never Title Case. *"Add transaction"*, not *"Add Transaction"*. (Exception: proper nouns — "Hari Gaji", "BIBD".)
- **Calm, not chirpy.** This is a finance tool. No emoji in body or buttons. Allowed: 🇧🇳/🇲🇾/🇮🇩 region pills, 🔥 streaks, 🏅 achievements, glyph emoji in empty states.
- **Single anchor hue.** Teal `hsl(162 70% 35%)` is the only saturated brand colour on production surfaces. Status colours (emerald/rose/amber/sky) are *accents*, not backgrounds.
- **No gradients on app UI.** Marketing CTA band uses solid `bg-primary`. That's it.
- **Borders first, shadows second.** Cards are `border + bg-card`, very flat shadow.
- **Tabular nums on every currency value.** Inter `font-variant-numeric: tabular-nums`.
- **Currency formatting**: `BND 1,234.50`, `MYR 1,234.50`, `IDR 1.234.500` (zero decimals for IDR).
- **Lucide icons only**, 1.5–2 stroke. No mixed icon families.
- **Inter only.** Linked from Google Fonts. Don't introduce a serif.

## Voice cheat sheet
- Use *gaji* (salary), *Hari Gaji* (payday), *Zakat* — never translate.
- Bank names verbatim: BIBD, Baiduri, Maybank, CIMB, BCA, Mandiri.
- Eyebrows are 11–12px uppercase, `tracking-wider`, muted: `MONTHLY SALARY`, `REMAINING`, `LIABILITIES`.
- Empty states warm and instructive, never apologetic.
- Buttons: short verb-noun. "Add transaction", "Import statement", "Manage financing", "Start planning free".

## Quick component lift
For a new app screen, this header is the canonical pattern:
```jsx
<Topbar
  title="Budgets"
  subtitle="Plan your envelopes for April."
  actions={<>
    <Button variant="outline" size="sm"><I.Upload/>Import statement</Button>
    <Button size="sm"><I.Plus/>Add transaction</Button>
  </>}/>
```
KPI strips are `grid-cols-2 lg:grid-cols-5 gap-3`, the Remaining card always wears `tinted` (primary 5% wash + primary 20% border).

## What not to do
- Don't introduce a second sans-serif. Don't introduce a serif at all.
- Don't gradient backgrounds. Don't add background images or patterns.
- Don't use round, scale, or springy easing — animations are functional fades + colour transitions.
- Don't add a top nav on desktop — sidebar is the only primary nav.
- Don't add filler stats, dummy charts, or decorative iconography. If a section feels empty, design through it; don't pad it.

When in doubt, open the live UI kit (`ui_kits/duitplan-app/index.html`) and match what's already there.
