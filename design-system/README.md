# DuitPlan Design System

> Personal finance for Southeast Asia, built around how money actually works in Brunei, Malaysia, and Indonesia.

DuitPlan is a salary-first budgeting and personal finance app — think YNAB, but designed for the realities of SEA salaried life: Hari Gaji ("payday") rituals, fixed monthly commitments, car & house financing, and Zakat. It is in production today on three regional subdomains (`duitplan.com`, `my.duitplan.com`, `id.duitplan.com`), powered by one React/TypeScript codebase, three currencies (BND, MYR, IDR), and three languages (English, Bahasa Melayu, Bahasa Indonesia).

The product is built and operated by **Pengiran Abdul Hakem** as a solo founder. The system is deliberately calm, modern, and trustworthy — closer in spirit to Linear or Mercury than to a busy bank app.

---

## Sources used to build this design system

- **Codebase** — `xpressitdev/Brunei-Finance-Base` on GitHub (`replit.md`, `artifacts/duitplan/`).
  - Theme tokens: `artifacts/duitplan/src/index.css`
  - shadcn/ui components: `artifacts/duitplan/src/components/ui/*`
  - App shell: `artifacts/duitplan/src/components/layout/{AppLayout,Sidebar}.tsx`
  - Pages: `artifacts/duitplan/src/pages/*` (landing, dashboard, expenses, budgets, debts, goals, etc.)
- **Handoff doc** — `uploads/DuitPlan_Cowork_Handoff.md` (architecture, math model, user voice).
- **Founder sketches** — `uploads/Screenshot_20260426_*.jpg` (Income → Loan / Expenses / Goals workflow, "envelope-style allocations").
- **Concept icons** — `uploads/{4646189,3304712,images}.png` (vault, payslip, bank — the three flow archetypes from the sketch).

---

## Index — the rest of this folder

| File / folder | What's in it |
|---|---|
| `colors_and_type.css` | Color tokens (light + dark), type scale, shadow + radius system. Drop this in and you have the brand. |
| `assets/` | Logos (favicon SVG, OG image), the three flow illustrations (vault / payslip / bank), and any other shared imagery. |
| `preview/` | Static HTML cards for the Design System tab — colour swatches, type specimens, components, motifs. |
| `ui_kits/duitplan-app/` | High-fidelity recreation of the web app: sidebar, dashboard, expense tracker, budgets, debts/goals, Hari Gaji banner. `index.html` is the navigable demo. |
| `ui_kits/duitplan-marketing/` | Marketing site (landing page) recreation with hero, features, "how it works", CTA. |
| `SKILL.md` | Cross-compatible Agent Skill manifest so this folder is droppable into Claude Code. |

---

## Content fundamentals

DuitPlan's voice is **calm, plain-spoken, and grounded in local life**. It doesn't try to be playful or cute — it's a financial tool — but it isn't stiff either. It uses local words where they carry meaning ("gaji", "Hari Gaji", "Zakat") without translating them away.

**Tone & casing**
- **Sentence case** for everything: button labels, headings, nav. Never Title Case.
- Headings are short and declarative: *"Overview"*, *"Spending by Category"*, *"Financing Summary"*.
- Body copy is calm, second-person, present tense: *"Track your salary, manage your commitments, and stay on top of your loans — without the stress."*
- Empty states are warm and instructive, not apologetic: *"No spending data yet. Upload your BIBD or Baiduri statement, or add a transaction manually."*

**Local vocabulary, used precisely**
- **Gaji** = salary. *"Understand your gaji clearly."*
- **Hari Gaji** = payday. The auto-prompt that fires on payday is named "Hari Gaji" — never "Payday Reminder".
- **Zakat** = obligatory alms. The Zakat calculator is a tentpole feature, paired with the regional authority (MUIB / LZS / BAZNAS).
- **BIBD / Baiduri** (BN), Maybank/CIMB (MY), BCA/Mandiri (ID) — bank names appear verbatim, never abbreviated.
- Currency labels: `BND 1,234.50`, `MYR 1,234.50`, `IDR 1.234.500` (zero decimals for IDR).

**Pronouns & emoji**
- *"You"* throughout. *"We"* only where the app actively does something for the user (*"We extract the transactions and categorise them automatically"*).
- Emoji is used sparingly as in-page texture: 🇧🇳 in the landing eyebrow, 📊 / 🧾 / 🏅 as empty-state and badge glyphs. **Never in body copy or buttons.**

**Microcopy examples (lifted from production)**
- Button: *"Start Planning Free"*, *"Import Statement"*, *"Add Transaction"*, *"Manage Financing"*.
- Eyebrow: *"MONTHLY SALARY"*, *"FIXED COMMITMENTS"*, *"LIABILITIES"*, *"REMAINING"*, *"THIS MONTH"*.
- Helper: *"Have a car loan, house financing, or credit card debt? You'll add those in the next step."*
- Status pill: `+BND 1,200.00 received` / `-BND 320.00`.

---

## Visual foundations

### Palette
A single anchor hue — **teal-green at `hsl(162 70% 35%)`** — does almost all the heavy lifting. Backgrounds drift slightly toward that hue (`hsl(160 20% 99%)` for body, `hsl(160 20% 97%)` for sidebar) so the page feels tinted, not bleach-white. Accent washes are 5–10% primary (`bg-primary/5`, `bg-primary/10`) for KPI hero cards and pills. Status colours are conventional (emerald `#10b981` gains, rose for liabilities, amber for streaks, sky for account chips) but always sit *on top* of the calm teal-tinted base.

### Type
**Inter** (Google Fonts), 400/500/600/700. No serif on production surfaces. Big numbers use `tabular-nums` so currency columns line up. Headings are tight (`tracking-tight`, ~`-0.01em`); display sizes (`5xl`/`7xl` on hero) lean even tighter. Eyebrow labels above KPI values are `text-xs uppercase tracking-wider` and muted — this is a recurring rhythm.

### Spacing & layout
4-px grid (Tailwind defaults). The app is a left-sidebar shell on desktop (`w-64` sidebar) collapsing to a hamburger on mobile. Content sits in `space-y-8` blocks. KPI strips are `grid-cols-2 lg:grid-cols-5 gap-4`. Cards are generous on padding (`p-6` outer, `pt-4 px-5 pb-5` for KPI cards specifically) and never crowded.

### Cards
- `border` + `bg-card` + `shadow` (very flat — see shadow tokens; even `shadow-xl` is ~10% opacity).
- Radius `rounded-xl` (~12px). Marketing surfaces use `rounded-2xl` (~16px).
- The hero KPI ("Remaining") gets a faint primary tint: `border-primary/20 bg-primary/5`.
- Streak cards use `border-orange-200 bg-orange-50` — the only place warm colour is allowed to dominate a card.

### Backgrounds
Solid surfaces, no gradients on production UI. The marketing landing page uses one full-bleed CTA band in `bg-primary` (white text). No background images, no patterns, no grain — the calm-fintech bet is that the *tinting* of the neutrals is enough texture.

### Animation
Subtle and functional. `animate-in fade-in duration-500` on the dashboard mount; `transition-colors` on links and nav items; `transition-transform duration-200 ease-in-out` on the mobile sidebar slide. **No bounces, no springy easing, no hero animations.** Loading states are a `animate-pulse` skeleton in `bg-muted`.

### Hover & press
- **Hover-elevate** is the universal rule (defined in `index.css`): a `::after` overlay tints by `var(--elevate-1)` (3% black) on hover, `var(--elevate-2)` (8%) on active. This applies to buttons, sidebar nav items, badges, list rows. **No darken/lighten of the colour itself.**
- Outline buttons have *no* hover bg change — only the elevate overlay.
- Links inside text use `underline-offset-4 hover:underline`.
- Press state shrinks shadow (`active:shadow-none` on outline buttons) — never scale.

### Borders, shadows, transparency
- Borders are 1px, `hsl(var(--border))` (2-3% darker than card). Outline buttons use `var(--button-outline)` = `rgba(0,0,0,.10)` so they read on any tinted surface.
- Shadows are layered but very low-opacity (≤4% alpha). The system is "border-first, shadow-second".
- Transparency is reserved for: header backdrop (`bg-white/80 backdrop-blur-sm`), mobile nav scrim (`bg-black/50`), and the elevate overlays.

### Imagery feel
Concept icons in the founder sketches are **flat 2-tone illustrations** — one soft fill colour on a 2-3px navy stroke, no shadows, ~512px squares. They're warm-but-restrained: mint green, soft mustard, dusty blue.

### Iconography
**Lucide React**, throughout. 16-20px (`w-4 h-4` to `w-5 h-5`) at 1.5px stroke. Always sit beside (not inside) text. The sidebar uses one icon per nav item; KPI cards have a tiny lucide glyph in the top-right at 60-70% opacity (`text-primary/60`, `text-orange-500/70`).
See `ICONOGRAPHY` section for the full library and substitution rules.

### Layout rules
- One page, one purpose. No tabs-within-tabs.
- Sidebar is the *only* primary nav surface on desktop. No top nav.
- Action buttons live top-right of every page (Import Statement / Add Transaction).
- Floating action buttons are forbidden — they collided with the Feedback widget and were removed.

---

## Iconography

DuitPlan uses **Lucide React** as its icon system, applied uniformly:

- Stroke 1.5–2px, no fills, ~16px in body / 20–24px in headers / 11px in micro-labels.
- Always sit *next to* text with `gap-2`, never overlapping.
- Tinted to match purpose: primary teal for the active surface, `text-muted-foreground` for nav idle, semantic colours for status (rose for debt, amber for streak, emerald for gains, sky for accounts).

**The icons used by the app today** (sidebar):
`Bot`, `ScanLine`, `LayoutDashboard`, `Building2`, `Receipt`, `PieChart`, `CalendarDays`, `Wallet`, `Target`, `TrendingUp`, `Upload`, `Lightbulb`, `Trophy`, `Settings`, `Star`.

**Hi-fi recreations**
For the UI kits and slide templates we link **Lucide** from CDN (`https://unpkg.com/lucide@latest`). It's a 1:1 match.

**Concept illustrations**
The founder's sketches use three flat 2-tone glyphs to symbolise the three money workflows:

| Glyph | Meaning | File |
|---|---|---|
| 🏦 Bank | Loan repayments — auto-deducted on Hari Gaji | `assets/illustration-bank.png` |
| ✉️💵 Payslip envelope | Income arriving (Hari Gaji) | `assets/illustration-payslip.png` |
| 🔒 Vault | Savings & goals — long-term, hard to take out | `assets/illustration-vault.png` |

These are kept as raster assets (not redrawn) so the founder's hand-picked artwork stays canonical.

**Emoji usage**
- 🇧🇳 / 🇲🇾 / 🇮🇩 — region pill on landing.
- 📊 — empty chart state.
- 🧾 — empty transactions state.
- 🏅 / 🏆 / 🔥 — gamification (achievements, streaks). Each badge has a custom emoji set per achievement (`badge.icon` in DB).
- **Never in body, never in CTA buttons, never as bullet decoration.**

**Brand mark**
- The favicon is a vermilion rounded square (`#FF3C00`) — the "founder mark", not the in-app brand. **Flagged for review** — there's a tension between the bright orange favicon and the calm teal app palette. Recommend either retinting the favicon to teal, or making the orange a deliberate accent.
- The wordmark is the literal text **"DuitPlan"** in Inter Bold, tinted `text-primary`. The header lockup uses a 32px rounded-square primary tile with an uppercase **"D"** beside the wordmark.

---

## Caveats / open questions

- **Font files** — we link Inter from Google Fonts (matches production exactly). No local TTFs to ship.
- **Favicon hue** — orange `#FF3C00` doesn't match the teal in-app brand. Confirm intent.
- **MY/ID screens** — codebase is one app with currency/lang switching; we recreate the BN-default surfaces. MY/ID-specific copy variants are deferred until native-speaker review (Phase 2.13).

---

## Skill manifest

This folder is also a Claude Agent Skill — see `SKILL.md`. Drop the whole folder into a Claude Code project and the skill activates automatically.
