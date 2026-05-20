import { Router, type IRouter } from "express";
import { eq, and, like, asc, sql } from "drizzle-orm";
import { db, netWorthSnapshotsTable, assetEntriesTable, accountsTable, debtsTable } from "@workspace/db";
import { ListNetWorthSnapshotsQueryParams } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

function formatSnapshot(s: typeof netWorthSnapshotsTable.$inferSelect) {
  return {
    id: s.id,
    userId: s.userId,
    month: s.month,
    netWorth: s.netWorth,
    notes: s.notes ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get("/net-worth", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const qp = ListNetWorthSnapshotsQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }

  const conditions = [eq(netWorthSnapshotsTable.userId, req.userId!)];
  if (qp.data.year) {
    conditions.push(like(netWorthSnapshotsTable.month, `${qp.data.year}-%`));
  }

  const snapshots = await db.select().from(netWorthSnapshotsTable)
    .where(and(...conditions))
    .orderBy(asc(netWorthSnapshotsTable.month));

  res.json(snapshots.map(formatSnapshot));
});

// ───────────────────────────────────────────────────────────────
// GET /net-worth/timeline?range=6m|1y|5y|all
// Returns monthly time series of [{ month, assets, liabilities, netWorth }].
//
// Methodology:
//  - "assets" for month M  = sum over distinct (name, category) of the
//    latest asset_entries.value where month <= M (carry-forward), PLUS the
//    sum of accounts.balance for the CURRENT month only.
//  - "liabilities" for any past month uses the current sum of
//    debts.outstandingBalance, since debt-balance history is not tracked
//    yet. This is an approximation — surface a note in the UI.
//  - The series is anchored to the user's first recorded asset_entry month
//    (or current month - range if no entries exist) and extends to the
//    current month.
// ───────────────────────────────────────────────────────────────

const RANGE_TO_MONTHS: Record<string, number | "all"> = {
  "6m": 6,
  "1y": 12,
  "5y": 60,
  "all": "all",
};

function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

function monthDiff(later: string, earlier: string): number {
  const [ly, lm] = later.split("-").map(Number);
  const [ey, em] = earlier.split("-").map(Number);
  return (ly - ey) * 12 + (lm - em);
}

function monthsBetween(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = end;
  while (cur >= start) {
    out.unshift(cur);
    cur = prevMonth(cur);
  }
  return out;
}

router.get("/net-worth/timeline", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const rangeKey = String(req.query.range ?? "1y").toLowerCase();
  const rangeSpec = RANGE_TO_MONTHS[rangeKey];
  if (rangeSpec === undefined) {
    res.status(400).json({ error: "range must be one of: 6m, 1y, 5y, all" });
    return;
  }

  const userId = req.userId!;
  const today = currentMonthStr();

  // Fetch all asset entries, current account balances, and current debts in parallel.
  const [allEntries, accounts, debts] = await Promise.all([
    db.select().from(assetEntriesTable).where(eq(assetEntriesTable.userId, userId)),
    db.select().from(accountsTable).where(eq(accountsTable.userId, userId)),
    db.select().from(debtsTable).where(eq(debtsTable.userId, userId)),
  ]);

  const totalCash = accounts.reduce((s, a) => s + parseFloat(a.balance ?? "0"), 0);
  const totalLiabilities = debts.reduce((s, d) => s + parseFloat(d.outstandingBalance ?? "0"), 0);

  // Determine the start month of the series.
  const earliestEntryMonth = allEntries.length > 0
    ? allEntries.reduce((min, e) => (e.month < min ? e.month : min), allEntries[0].month)
    : null;

  let startMonth: string;
  if (rangeSpec === "all") {
    // For "all", anchor to earliest asset entry. If none, default to 12 months.
    if (earliestEntryMonth && earliestEntryMonth <= today) {
      startMonth = earliestEntryMonth;
    } else {
      startMonth = today;
      for (let i = 0; i < 11; i++) startMonth = prevMonth(startMonth);
    }
  } else {
    startMonth = today;
    for (let i = 0; i < rangeSpec - 1; i++) startMonth = prevMonth(startMonth);
  }

  // Hard cap at 120 months to avoid runaway series.
  if (monthDiff(today, startMonth) > 120) {
    let m = today;
    for (let i = 0; i < 119; i++) m = prevMonth(m);
    startMonth = m;
  }

  const months = monthsBetween(startMonth, today);

  // Pre-index entries by (name|category) → sorted [{ month, updatedAtMs, id, value }].
  // We sort by month ASC; for equal months we tie-break by updatedAt then id
  // so that the "latest" pick is deterministic and matches /assets.
  type EntryRec = { month: string; updatedAtMs: number; id: string; value: number };
  const byKey: Map<string, EntryRec[]> = new Map();
  for (const e of allEntries) {
    const key = `${e.name}|${e.category}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push({
      month: e.month,
      updatedAtMs: e.updatedAt instanceof Date ? e.updatedAt.getTime() : new Date(e.updatedAt as unknown as string).getTime(),
      id: e.id,
      value: parseFloat(e.value),
    });
  }
  for (const list of byKey.values()) {
    list.sort((a, b) => {
      if (a.month !== b.month) return a.month.localeCompare(b.month);
      if (a.updatedAtMs !== b.updatedAtMs) return a.updatedAtMs - b.updatedAtMs;
      return a.id.localeCompare(b.id);
    });
  }

  // Build series.
  const series = months.map((m) => {
    let nonCashAssets = 0;
    for (const list of byKey.values()) {
      // Latest entry with entry.month <= m (deterministic tie-break by updatedAt then id).
      let latest: EntryRec | null = null;
      for (const rec of list) {
        if (rec.month <= m) latest = rec;
        else break;
      }
      if (latest) nonCashAssets += latest.value;
    }
    // Cash balance only counts for the current month — we don't have history.
    const cash = m === today ? totalCash : 0;
    const assets = nonCashAssets + cash;
    return {
      month: m,
      assets: assets.toFixed(2),
      liabilities: totalLiabilities.toFixed(2),
      netWorth: (assets - totalLiabilities).toFixed(2),
    };
  });

  res.json({
    range: rangeKey,
    startMonth,
    endMonth: today,
    cashIncludedFromMonth: today,
    liabilitiesApproximation: "current_only",
    series,
  });
});

export default router;
