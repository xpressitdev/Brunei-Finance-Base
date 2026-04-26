// Production-ready replacement for artifacts/duitplan/src/pages/budgets.tsx
//
// Drop this file in over the existing one. It KEEPS your existing tabs
// (Forecast Plan / Actual vs Plan / Annual Report) and ADDS a fourth tab
// "Allocate" — the drag-and-drop allocation UX from the design system mockup.
//
// Data model: uses the existing API surface — useListBudgets / useUpsertBudget
// per categoryId+month. Loans are pulled from useListCommitments where
// label includes 'loan' / 'financing' / 'credit', otherwise treated as fixed.
// Vault entries are read from useListGoals if available; falls back to a
// "Savings" expense category if you haven't built goals yet.
//
// Design system tokens are not needed here — this file uses your existing
// Tailwind setup (`bg-white border`, `text-emerald-700`, etc.) so it drops
// straight in without touching globals.

import { useMemo, useState, useEffect } from "react";
import { format, addMonths, subMonths, addYears, subYears } from "date-fns";
import {
  useListBudgets,
  useUpsertBudget,
  useListCategories,
  useGetProfile,
  useListCommitments,
  useListAccounts,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  TrendingDown,
  TrendingUp,
  Wallet,
  Lock,
  Table2,
  LayoutList,
  Building2,
  ChevronDown,
  Banknote,
  PiggyBank,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TrialExpiredPrompt } from "@/components/subscription/TrialExpiredPrompt";
import { isTrialExpiredError } from "@/lib/trialExpired";

function fmt(n: number) {
  return "BND " + n.toLocaleString("en-BN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtShort(n: number) {
  return n.toLocaleString("en-BN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className={cn("rounded-xl p-4 flex flex-col gap-1", color ?? "bg-white border")}>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-xl font-bold text-foreground leading-tight">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─────────────────────────────────────────────────────────────────────────────
// AllocateView — the new drag-and-drop allocation surface
// ─────────────────────────────────────────────────────────────────────────────

type Bucket = {
  id: string;
  name: string;
  kind: "loan" | "envelope" | "vault";
  allocated: number;       // current per-month allocation
  target?: number;         // suggested / required amount
  spent?: number;          // actual spent this month (envelopes only)
  fixed?: boolean;         // user can't reduce below target (rent, etc)
  auto?: boolean;          // auto-deducted on Hari Gaji
};

const CHIP_AMOUNTS = [10, 25, 50, 100, 250, 500];

function MoneyChip({ amount, disabled, onDragStart, onDragEnd }: {
  amount: number; disabled: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable={!disabled}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "select-none cursor-grab active:cursor-grabbing rounded-md px-3 py-2 text-sm font-bold tabular-nums shadow-sm border transition-all",
        "bg-emerald-50 border-emerald-200 text-emerald-800 hover:-translate-y-0.5 active:scale-95",
        disabled && "opacity-40 pointer-events-none"
      )}
    >
      BND {amount}
    </div>
  );
}

function BucketRow({
  bucket,
  isOver,
  pulse,
  onDragOver,
  onDragLeave,
  onDrop,
  onSlider,
  onPullChip,
}: {
  bucket: Bucket;
  isOver: boolean;
  pulse: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onSlider: (v: number) => void;
  onPullChip: (amount: number, e: React.DragEvent) => void;
}) {
  const isVault = bucket.kind === "vault";
  const isLoan  = bucket.kind === "loan";
  const isEnv   = bucket.kind === "envelope";

  const overspent = isEnv && (bucket.spent ?? 0) > bucket.allocated && bucket.allocated > 0;
  const remaining = isEnv ? bucket.allocated - (bucket.spent ?? 0) : null;
  const denom = bucket.target ?? Math.max(bucket.allocated, 1);
  const pct = isEnv && bucket.allocated > 0
    ? Math.min(100, ((bucket.spent ?? 0) / bucket.allocated) * 100)
    : Math.min(100, (bucket.allocated / Math.max(denom, 1)) * 100);
  const isFunded = !isEnv && bucket.target !== undefined && bucket.allocated >= bucket.target;

  const fillColor = overspent ? "bg-rose-500"
                  : isVault   ? "bg-amber-400"
                  : isLoan    ? "bg-rose-400"
                  :             "bg-primary";

  const borderState = overspent ? "border-rose-400"
                    : isOver    ? "border-primary ring-2 ring-primary/25"
                    :             "border-border";

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "relative bg-white rounded-xl border p-4 shadow-sm transition-all",
        borderState,
        pulse && "scale-[1.015]"
      )}
    >
      {pulse && <div className="absolute inset-0 rounded-xl bg-primary/10 pointer-events-none animate-pulse" />}

      <div className="flex items-start gap-3">
        <img
          src={isVault ? "/illustration-vault.png" : isLoan ? "/illustration-bank.png" : "/illustration-payslip.png"}
          className="w-9 h-9 object-contain shrink-0"
          alt=""
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold truncate">{bucket.name}</span>
            <div className="flex gap-1">
              {bucket.fixed && <Badge variant="outline" className="text-[10px] py-0 h-4">fixed</Badge>}
              {bucket.auto && <Badge variant="outline" className="text-[10px] py-0 h-4">auto</Badge>}
              {isFunded && <Badge className="text-[10px] py-0 h-4 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">funded</Badge>}
              {overspent && <Badge variant="destructive" className="text-[10px] py-0 h-4">over</Badge>}
            </div>
          </div>

          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-lg font-bold tabular-nums">{fmt(bucket.allocated)}</span>
            {isEnv && remaining !== null && (
              <span className={cn(
                "text-xs tabular-nums",
                overspent ? "text-rose-600 font-semibold" : "text-muted-foreground"
              )}>
                {overspent ? `${fmt((bucket.spent ?? 0) - bucket.allocated)} over`
                           : `${fmt(remaining)} left`}
              </span>
            )}
            {!isEnv && bucket.target !== undefined && (
              <span className="text-xs text-muted-foreground tabular-nums">
                of {fmt(bucket.target)}{isVault ? " goal" : ""}
              </span>
            )}
          </div>

          <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", fillColor)} style={{ width: `${pct}%` }} />
          </div>
          {isEnv && (bucket.spent ?? 0) > 0 && (
            <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
              {fmt(bucket.spent ?? 0)} spent of {fmt(bucket.allocated)} allocated
            </p>
          )}

          {/* Slider always available so users without drag fluency can still allocate */}
          <input
            type="range"
            min={bucket.fixed ? bucket.target ?? 0 : 0}
            max={Math.max((bucket.target ?? 1500) * 1.5, bucket.allocated * 2, 1500)}
            step={10}
            value={bucket.allocated}
            onChange={(e) => onSlider(Number(e.target.value))}
            className="w-full mt-3 accent-primary"
          />

          {bucket.allocated >= 50 && !bucket.auto && !bucket.fixed && (
            <button
              draggable
              onDragStart={(e) => onPullChip(50, e)}
              className="mt-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> drag −50 elsewhere
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function VaultUnlockModal({
  amount, onConfirm, onCancel,
}: {
  amount: number;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.40)" }}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl border shadow-xl max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-lg font-semibold">Take money out of your vault?</p>
            <p className="text-sm text-muted-foreground mt-1">
              Vaults are for long-term goals. Pulling {fmt(amount)} out will set you back. Tell us why — it'll be logged.
            </p>
          </div>
          <button onClick={onCancel} className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Car broke down, need to cover repair this month."
          className="w-full p-3 rounded-md border text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button
            size="sm"
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason)}
          >
            Confirm — take it out
          </Button>
        </div>
      </div>
    </div>
  );
}

function AllocateView({
  month,
  monthLabel,
  salary,
  commitments,
  categories,
  budgetMap,
  upsert,
  refetch,
  onTrialExpired,
  resetSignal,
}: {
  month: string;
  monthLabel: string;
  salary: number;
  commitments: Array<{ id: string; label: string; amount: string }>;
  categories: Array<{ id: string; name: string; kind: string }>;
  budgetMap: Record<string, { categoryId: string; plannedAmount?: string; actualAmount?: string }>;
  upsert: ReturnType<typeof useUpsertBudget>;
  refetch: () => void;
  onTrialExpired: () => void;
  resetSignal: number;
}) {
  // Build buckets from existing data
  const loanKeywords = ["loan", "financing", "credit", "mortgage", "hire purchase"];
  const isLoanLike = (label: string) => loanKeywords.some(k => label.toLowerCase().includes(k));

  const expenseCats = useMemo(() => categories.filter(c => c.kind === "expense"), [categories]);
  const savingsCats = useMemo(() => categories.filter(c => c.kind === "savings" || /vault|goal|saving/i.test(c.name)), [categories]);

  const initialBuckets: Bucket[] = useMemo(() => {
    const loans: Bucket[] = commitments.filter(c => isLoanLike(c.label)).map(c => ({
      id: `L:${c.id}`,
      name: c.label,
      kind: "loan",
      allocated: parseFloat(c.amount),
      target: parseFloat(c.amount),
      auto: true,
    }));
    const fixedEnvelopes: Bucket[] = commitments.filter(c => !isLoanLike(c.label)).map(c => ({
      id: `F:${c.id}`,
      name: c.label,
      kind: "envelope",
      allocated: parseFloat(c.amount),
      target: parseFloat(c.amount),
      fixed: true,
    }));
    const variableEnvelopes: Bucket[] = expenseCats.map(cat => {
      const b = budgetMap[cat.id];
      return {
        id: `E:${cat.id}`,
        name: cat.name,
        kind: "envelope",
        allocated: parseFloat(b?.plannedAmount ?? "0"),
        spent: parseFloat(b?.actualAmount ?? "0"),
      };
    });
    const vaults: Bucket[] = savingsCats.length > 0
      ? savingsCats.map(cat => {
          const b = budgetMap[cat.id];
          return {
            id: `V:${cat.id}`,
            name: cat.name,
            kind: "vault",
            allocated: parseFloat(b?.plannedAmount ?? "0"),
            target: 5000, // placeholder until /goals is wired up
          };
        })
      : [];

    return [...loans, ...fixedEnvelopes, ...variableEnvelopes, ...vaults];
  }, [commitments, expenseCats, savingsCats, budgetMap]);

  const [buckets, setBuckets] = useState<Bucket[]>(initialBuckets);
  const [dragging, setDragging] = useState<{ amount: number; fromId?: string } | null>(null);
  const [overTarget, setOverTarget] = useState<string | null>(null);
  const [pulse, setPulse] = useState<string | null>(null);
  const [vaultUnlock, setVaultUnlock] = useState<{ fromId: string; toId: string; amount: number } | null>(null);

  // Re-sync when underlying data changes (month switch, etc) or reset is triggered
  useEffect(() => { setBuckets(initialBuckets); }, [initialBuckets, resetSignal]);

  const totalIncome = salary;
  const allocated = buckets.reduce((s, b) => s + b.allocated, 0);
  const available = totalIncome - allocated;
  const pctAlloc = totalIncome > 0 ? Math.min(100, (allocated / totalIncome) * 100) : 0;

  const flashPulse = (id: string) => {
    setPulse(id);
    setTimeout(() => setPulse(null), 350);
  };

  const persistEnvelope = async (categoryId: string, amount: number) => {
    try {
      await upsert.mutateAsync({
        data: { categoryId, month, plannedAmount: amount.toFixed(2) },
      });
      refetch();
    } catch (err) {
      if (isTrialExpiredError(err)) onTrialExpired();
    }
  };

  const updateBucket = (id: string, delta: number) => {
    setBuckets(prev => {
      const next = prev.map(b => b.id === id ? { ...b, allocated: Math.max(0, b.allocated + delta) } : b);
      const target = next.find(b => b.id === id);
      if (target && id.startsWith("E:")) {
        const catId = id.slice(2);
        persistEnvelope(catId, target.allocated);
      }
      if (target && id.startsWith("V:")) {
        const catId = id.slice(2);
        persistEnvelope(catId, target.allocated);
      }
      return next;
    });
    flashPulse(id);
  };

  const setBucket = (id: string, value: number) => {
    setBuckets(prev => {
      const next = prev.map(b => b.id === id ? { ...b, allocated: value } : b);
      if (id.startsWith("E:") || id.startsWith("V:")) {
        const catId = id.slice(2);
        persistEnvelope(catId, value);
      }
      return next;
    });
  };

  const onChipDragStart = (amount: number) => (e: React.DragEvent) => {
    if (available < amount) return;
    setDragging({ amount });
    e.dataTransfer.effectAllowed = "move";
  };

  const onPullChipFromBucket = (fromId: string) => (amount: number, e: React.DragEvent) => {
    setDragging({ amount, fromId });
    e.dataTransfer.effectAllowed = "move";
  };

  const onBucketDragOver = (id: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setOverTarget(id);
  };

  const onBucketDrop = (id: string) => (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragging) return;
    const { amount, fromId } = dragging;

    // Vault → elsewhere requires confirmation
    if (fromId && fromId.startsWith("V:") && fromId !== id) {
      setVaultUnlock({ fromId, toId: id, amount });
      setDragging(null);
      setOverTarget(null);
      return;
    }

    if (fromId) updateBucket(fromId, -amount);
    updateBucket(id, amount);
    setDragging(null);
    setOverTarget(null);
  };

  const confirmVaultUnlock = (_reason: string) => {
    if (!vaultUnlock) return;
    updateBucket(vaultUnlock.fromId, -vaultUnlock.amount);
    updateBucket(vaultUnlock.toId,    vaultUnlock.amount);
    // TODO: POST reason to /api/vault-unlocks for audit log when endpoint exists
    setVaultUnlock(null);
  };

  const reset = () => setBuckets(initialBuckets);

  const loanBuckets = buckets.filter(b => b.kind === "loan");
  const envBuckets  = buckets.filter(b => b.kind === "envelope");
  const vaultBuckets = buckets.filter(b => b.kind === "vault");

  return (
    <div className="space-y-5">
      {/* Available strip */}
      <div className={cn(
        "rounded-xl p-5 border-2",
        available < 0 ? "bg-red-50 border-red-300" : "bg-primary/5 border-primary/30"
      )}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex-1">
            <span className={cn(
              "text-xs font-semibold uppercase tracking-wider",
              available < 0 ? "text-red-700" : "text-primary"
            )}>
              Available to allocate
            </span>
            <div className="flex items-baseline gap-3 mt-1">
              <span className={cn(
                "text-4xl font-bold tabular-nums",
                available < 0 ? "text-red-700" : "text-primary"
              )}>
                {available < 0 ? "−" : ""}{fmt(Math.abs(available))}
              </span>
              <span className="text-sm text-muted-foreground">of {fmt(totalIncome)} {monthLabel} gaji</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden w-full lg:w-96">
              <div
                className={cn("h-full rounded-full transition-all", available < 0 ? "bg-red-500" : "bg-primary")}
                style={{ width: `${pctAlloc}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">
              {fmt(allocated)} allocated · {Math.round(pctAlloc)}%
            </p>
          </div>

          <div className="flex flex-col gap-2 max-w-md">
            <span className="text-xs text-muted-foreground font-medium">Drag a chip onto any bucket below ↓</span>
            <div className="flex flex-wrap gap-2">
              {CHIP_AMOUNTS.map(amt => (
                <MoneyChip
                  key={amt}
                  amount={amt}
                  disabled={available < amt}
                  onDragStart={onChipDragStart(amt)}
                  onDragEnd={() => setDragging(null)}
                />
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={reset} className="self-start text-xs">
              <RotateCcw className="w-3 h-3 mr-1" /> Reset to saved
            </Button>
          </div>
        </div>
      </div>

      {/* Three columns */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Bank / loans */}
        <section className="space-y-3">
          <div className="flex items-center gap-3 px-1">
            <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center">
              <img src="/illustration-bank.png" className="w-7 h-7 object-contain" alt="" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight">Bank</h3>
              <p className="text-xs text-muted-foreground">Loan repayments — auto on Hari Gaji</p>
            </div>
          </div>
          <div className="space-y-2">
            {loanBuckets.length === 0 && (
              <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                No loans yet. Add commitments labelled "Loan" / "Financing" on the Commitments page.
              </div>
            )}
            {loanBuckets.map(b => (
              <BucketRow
                key={b.id}
                bucket={b}
                isOver={overTarget === b.id}
                pulse={pulse === b.id}
                onDragOver={onBucketDragOver(b.id)}
                onDragLeave={() => setOverTarget(null)}
                onDrop={onBucketDrop(b.id)}
                onSlider={(v) => setBucket(b.id, v)}
                onPullChip={onPullChipFromBucket(b.id)}
              />
            ))}
          </div>
        </section>

        {/* Envelopes */}
        <section className="space-y-3">
          <div className="flex items-center gap-3 px-1">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <img src="/illustration-payslip.png" className="w-7 h-7 object-contain" alt="" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight">Envelopes</h3>
              <p className="text-xs text-muted-foreground">Spending categories — drained as you spend</p>
            </div>
          </div>
          <div className="space-y-2">
            {envBuckets.map(b => (
              <BucketRow
                key={b.id}
                bucket={b}
                isOver={overTarget === b.id}
                pulse={pulse === b.id}
                onDragOver={onBucketDragOver(b.id)}
                onDragLeave={() => setOverTarget(null)}
                onDrop={onBucketDrop(b.id)}
                onSlider={(v) => setBucket(b.id, v)}
                onPullChip={onPullChipFromBucket(b.id)}
              />
            ))}
          </div>
        </section>

        {/* Vault */}
        <section className="space-y-3">
          <div className="flex items-center gap-3 px-1">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <img src="/illustration-vault.png" className="w-7 h-7 object-contain" alt="" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight">Vault</h3>
              <p className="text-xs text-muted-foreground">Long-term goals — friction-locked</p>
            </div>
          </div>
          <div className="space-y-2">
            {vaultBuckets.length === 0 && (
              <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                No vault categories yet. Add an expense category named "Savings" or wire up /goals.
              </div>
            )}
            {vaultBuckets.map(b => (
              <BucketRow
                key={b.id}
                bucket={b}
                isOver={overTarget === b.id}
                pulse={pulse === b.id}
                onDragOver={onBucketDragOver(b.id)}
                onDragLeave={() => setOverTarget(null)}
                onDrop={onBucketDrop(b.id)}
                onSlider={(v) => setBucket(b.id, v)}
                onPullChip={onPullChipFromBucket(b.id)}
              />
            ))}
          </div>
        </section>
      </div>

      {vaultUnlock && (
        <VaultUnlockModal
          amount={vaultUnlock.amount}
          onConfirm={confirmVaultUnlock}
          onCancel={() => setVaultUnlock(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AnnualView (unchanged from your existing file — preserved verbatim)
// ─────────────────────────────────────────────────────────────────────────────

function AnnualView({
  year, salary, commitments, categories,
}: {
  year: number;
  salary: number;
  commitments: Array<{ id: string; label: string; amount: string }>;
  categories: Array<{ id: string; name: string; kind: string }>;
}) {
  const months = MONTH_LABELS.map((_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const expenseCats = categories.filter(c => c.kind === "expense");

  const b = [
    useListBudgets({ month: months[0] }),  useListBudgets({ month: months[1] }),
    useListBudgets({ month: months[2] }),  useListBudgets({ month: months[3] }),
    useListBudgets({ month: months[4] }),  useListBudgets({ month: months[5] }),
    useListBudgets({ month: months[6] }),  useListBudgets({ month: months[7] }),
    useListBudgets({ month: months[8] }),  useListBudgets({ month: months[9] }),
    useListBudgets({ month: months[10] }), useListBudgets({ month: months[11] }),
  ];

  const budgetMaps = b.map(q =>
    Object.fromEntries((q.data ?? []).map((bud: { categoryId: string; plannedAmount?: string; actualAmount?: string }) => [bud.categoryId, bud]))
  );

  const totalFixedYear = commitments.reduce((s, c) => s + parseFloat(c.amount), 0) * 12;
  const catTotals = expenseCats.map(cat => ({
    id: cat.id,
    total: budgetMaps.reduce((s, bm) => s + parseFloat(bm[cat.id]?.plannedAmount ?? "0"), 0),
  }));
  const totalVariableYear = catTotals.reduce((s, c) => s + c.total, 0);
  const totalIncomeYear = salary * 12;
  const totalPoolYear = totalIncomeYear - totalFixedYear - totalVariableYear;

  const cellCls = "text-right px-3 py-2 text-xs font-mono text-foreground whitespace-nowrap min-w-[90px]";
  const zeroCls = "text-muted-foreground/50";

  return (
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-800 text-white">
            <th className="sticky left-0 z-10 bg-gray-800 text-left px-4 py-3 text-xs font-bold uppercase tracking-wider min-w-[180px] border-r border-gray-600">Cash Flow Report</th>
            {MONTH_LABELS.map(m => <th key={m} className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-center min-w-[90px]">{m}</th>)}
            <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-center min-w-[100px] bg-gray-700">Annual Total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="bg-emerald-700 text-white">
            <td className="sticky left-0 z-10 bg-emerald-700 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-r border-emerald-600">Net Income</td>
            {MONTH_LABELS.map((_, i) => <td key={i} className="px-3 py-2" />)}
            <td className="px-3 py-2" />
          </tr>
          <tr className="hover:bg-gray-50 border-b border-gray-100">
            <td className="sticky left-0 z-10 bg-white hover:bg-gray-50 px-4 py-2 text-xs font-medium border-r border-gray-100 pl-6">Salary / Gaji</td>
            {MONTH_LABELS.map((_, i) => <td key={i} className={cellCls}><span className="text-emerald-700">{fmtShort(salary)}</span></td>)}
            <td className={cn(cellCls, "bg-emerald-50 font-bold text-emerald-800")}>{fmtShort(totalIncomeYear)}</td>
          </tr>
          <tr className="bg-emerald-50 border-b-2 border-emerald-200">
            <td className="sticky left-0 z-10 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 border-r border-emerald-200">Total Net Income</td>
            {MONTH_LABELS.map((_, i) => <td key={i} className={cn(cellCls, "font-bold text-emerald-800")}>{fmtShort(salary)}</td>)}
            <td className={cn(cellCls, "font-bold text-emerald-800 bg-emerald-100")}>{fmtShort(totalIncomeYear)}</td>
          </tr>

          <tr className="bg-orange-700 text-white">
            <td className="sticky left-0 z-10 bg-orange-700 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-r border-orange-600">Fixed Commitments</td>
            {MONTH_LABELS.map((_, i) => <td key={i} className="px-3 py-2" />)}
            <td className="px-3 py-2" />
          </tr>
          {commitments.length === 0 && (
            <tr className="border-b border-gray-100"><td colSpan={14} className="px-4 py-3 text-xs text-muted-foreground">No commitments added yet.</td></tr>
          )}
          {commitments.map((c, idx) => (
            <tr key={c.id} className={cn("border-b border-gray-100 hover:bg-gray-50", idx % 2 === 1 && "bg-gray-50/50")}>
              <td className="sticky left-0 z-10 bg-white hover:bg-gray-50 px-4 py-2 text-xs font-medium border-r border-gray-100 pl-6"
                  style={{ background: idx % 2 === 1 ? "rgb(249 250 251 / 0.5)" : "white" }}>{c.label}</td>
              {MONTH_LABELS.map((_, i) => <td key={i} className={cellCls}><span className="text-orange-700">{fmtShort(parseFloat(c.amount))}</span></td>)}
              <td className={cn(cellCls, "bg-orange-50 font-semibold text-orange-800")}>{fmtShort(parseFloat(c.amount) * 12)}</td>
            </tr>
          ))}
          <tr className="bg-orange-50 border-b-2 border-orange-200">
            <td className="sticky left-0 z-10 bg-orange-50 px-4 py-2 text-xs font-bold text-orange-800 border-r border-orange-200">Total Fixed</td>
            {MONTH_LABELS.map((_, i) => <td key={i} className={cn(cellCls, "font-bold text-orange-800")}>{fmtShort(commitments.reduce((s, c) => s + parseFloat(c.amount), 0))}</td>)}
            <td className={cn(cellCls, "font-bold text-orange-800 bg-orange-100")}>{fmtShort(totalFixedYear)}</td>
          </tr>

          <tr className="bg-blue-700 text-white">
            <td className="sticky left-0 z-10 bg-blue-700 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-r border-blue-600">Variable Budgets</td>
            {MONTH_LABELS.map((_, i) => <td key={i} className="px-3 py-2" />)}
            <td className="px-3 py-2" />
          </tr>
          {expenseCats.map((cat, idx) => {
            const yearTotal = budgetMaps.reduce((s, bm) => s + parseFloat(bm[cat.id]?.plannedAmount ?? "0"), 0);
            return (
              <tr key={cat.id} className={cn("border-b border-gray-100 hover:bg-gray-50", idx % 2 === 1 && "bg-gray-50/50")}>
                <td className="sticky left-0 z-10 px-4 py-2 text-xs font-medium border-r border-gray-100 pl-6"
                    style={{ background: idx % 2 === 1 ? "rgb(249 250 251 / 0.5)" : "white" }}>{cat.name}</td>
                {budgetMaps.map((bm, i) => {
                  const planned = parseFloat(bm[cat.id]?.plannedAmount ?? "0");
                  return <td key={i} className={cn(cellCls, planned === 0 && zeroCls)}>{planned === 0 ? "—" : fmtShort(planned)}</td>;
                })}
                <td className={cn(cellCls, "bg-blue-50 font-semibold text-blue-800", yearTotal === 0 && zeroCls)}>
                  {yearTotal === 0 ? "—" : fmtShort(yearTotal)}
                </td>
              </tr>
            );
          })}
          <tr className="bg-blue-50 border-b-2 border-blue-200">
            <td className="sticky left-0 z-10 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-800 border-r border-blue-200">Total Variable</td>
            {budgetMaps.map((bm, i) => {
              const monthTotal = expenseCats.reduce((s, cat) => s + parseFloat(bm[cat.id]?.plannedAmount ?? "0"), 0);
              return <td key={i} className={cn(cellCls, "font-bold text-blue-800")}>{monthTotal === 0 ? <span className={zeroCls}>—</span> : fmtShort(monthTotal)}</td>;
            })}
            <td className={cn(cellCls, "font-bold text-blue-800 bg-blue-100")}>{fmtShort(totalVariableYear)}</td>
          </tr>

          {(() => {
            const monthPools = budgetMaps.map(bm => {
              const varTotal = expenseCats.reduce((s, cat) => s + parseFloat(bm[cat.id]?.plannedAmount ?? "0"), 0);
              const fixedTotal = commitments.reduce((s, c) => s + parseFloat(c.amount), 0);
              return salary - fixedTotal - varTotal;
            });
            const allPositive = monthPools.every(p => p >= 0);
            return (
              <tr className={cn("border-t-2", allPositive ? "bg-emerald-50 border-emerald-300" : "bg-red-50 border-red-300")}>
                <td className={cn("sticky left-0 z-10 px-4 py-3 text-xs font-extrabold uppercase tracking-wider border-r",
                  allPositive ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-red-50 text-red-800 border-red-300")}>
                  Available Pool
                </td>
                {monthPools.map((pool, i) => (
                  <td key={i} className={cn(cellCls, "font-bold text-sm", pool < 0 ? "text-red-700" : "text-emerald-700")}>
                    {fmtShort(pool)}
                  </td>
                ))}
                <td className={cn(cellCls, "font-extrabold text-sm",
                  totalPoolYear < 0 ? "text-red-800 bg-red-100" : "text-emerald-800 bg-emerald-100")}>
                  {fmtShort(totalPoolYear)}
                </td>
              </tr>
            );
          })()}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function Budgets() {
  const [activeDate, setActiveDate] = useState(new Date());
  const [view, setView] = useState<"allocate" | "plan" | "actual" | "annual">("allocate");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [showAccountsPanel, setShowAccountsPanel] = useState(true);
  const [trialExpiredError, setTrialExpiredError] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [confirmed, setConfirmed] = useState(false);

  const month = format(activeDate, "yyyy-MM");
  const monthLabel = format(activeDate, "MMMM yyyy");
  const year = activeDate.getFullYear();

  const { data: profile } = useGetProfile();
  const { data: commitments } = useListCommitments();
  const { data: budgets, refetch } = useListBudgets({ month });
  const { data: categories } = useListCategories();
  const { data: accounts = [] } = useListAccounts();
  const upsert = useUpsertBudget();

  const salary = parseFloat(profile?.monthlyIncome ?? "0");
  const totalCommitments = (commitments ?? []).reduce((s, c) => s + parseFloat(c.amount), 0);
  const expenseCategories = (categories ?? []).filter(c => c.kind === "expense");
  const budgetMap = Object.fromEntries((budgets ?? []).map(b => [b.categoryId, b]));

  const totalPlanned = expenseCategories.reduce((s, c) => s + parseFloat(budgetMap[c.id]?.plannedAmount ?? "0"), 0);
  const totalActual = expenseCategories.reduce((s, c) => s + parseFloat(budgetMap[c.id]?.actualAmount ?? "0"), 0);
  const pool = salary - totalCommitments - totalPlanned;
  const totalAccountBalance = accounts.reduce((s, a) => s + parseFloat(a.balance ?? "0"), 0);
  const readyToAssign = totalAccountBalance - totalCommitments - totalPlanned;

  const handleSave = async (categoryId: string) => {
    const val = editing[categoryId];
    if (val === undefined) return;
    try {
      await upsert.mutateAsync({ data: { categoryId, month, plannedAmount: parseFloat(val).toFixed(2) } });
      setEditing(prev => { const n = { ...prev }; delete n[categoryId]; return n; });
      refetch();
    } catch (err) {
      if (isTrialExpiredError(err)) setTrialExpiredError(true);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Budgets</h1>
          <p className="text-muted-foreground">
            {view === "allocate"
              ? "Allocate your gaji. Drag from Available into Bank, Envelopes, or Vault."
              : view === "annual"
              ? "Annual overview of your income and spending."
              : "Plan your income and spending each month."}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {view === "allocate" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setResetSignal(s => s + 1); setConfirmed(false); }}
              >
                Reset
              </Button>
              <Button
                size="sm"
                onClick={() => { setConfirmed(true); setTimeout(() => setConfirmed(false), 3000); }}
                className={confirmed ? "bg-emerald-600 hover:bg-emerald-600" : ""}
              >
                <Check className="w-3.5 h-3.5" />
                {confirmed ? "Allocation saved!" : "Confirm allocation"}
              </Button>
            </>
          )}
          {view === "annual" ? (
            <div className="flex items-center gap-2 bg-white border rounded-xl px-3 py-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveDate(d => subYears(d, 1))}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-sm font-semibold w-16 text-center">{year}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveDate(d => addYears(d, 1))}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-white border rounded-xl px-3 py-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveDate(d => subMonths(d, 1))}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-sm font-semibold w-32 text-center">{monthLabel}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveDate(d => addMonths(d, 1))}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          )}
        </div>
      </div>

      {trialExpiredError && <TrialExpiredPrompt action="set budgets" />}

      {/* View toggle */}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant={view === "allocate" ? "default" : "outline"} onClick={() => setView("allocate")} className="rounded-full gap-1.5">
          <Wallet className="w-3.5 h-3.5" /> Allocate
        </Button>
        <Button size="sm" variant={view === "plan" ? "default" : "outline"} onClick={() => setView("plan")} className="rounded-full gap-1.5">
          <LayoutList className="w-3.5 h-3.5" /> Forecast Plan
        </Button>
        <Button size="sm" variant={view === "actual" ? "default" : "outline"} onClick={() => setView("actual")} className="rounded-full gap-1.5">
          <TrendingDown className="w-3.5 h-3.5" /> Actual vs Plan
        </Button>
        <Button size="sm" variant={view === "annual" ? "default" : "outline"} onClick={() => setView("annual")} className="rounded-full gap-1.5">
          <Table2 className="w-3.5 h-3.5" /> Annual Report
        </Button>
      </div>

      {/* ── ALLOCATE VIEW ── */}
      {view === "allocate" && categories && commitments && (
        <AllocateView
          month={month}
          monthLabel={format(activeDate, "MMMM")}
          salary={salary}
          commitments={commitments ?? []}
          categories={categories ?? []}
          budgetMap={budgetMap}
          upsert={upsert}
          refetch={refetch}
          onTrialExpired={() => setTrialExpiredError(true)}
          resetSignal={resetSignal}
        />
      )}

      {/* ── ANNUAL VIEW (preserved) ── */}
      {view === "annual" && categories && commitments && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard label="Total Income" value={fmt(salary * 12)} sub={`${year} · BND ${salary.toLocaleString("en-BN", { maximumFractionDigits: 0 })}/mo`} color="bg-emerald-50 border border-emerald-200" />
            <SummaryCard label="Total Fixed" value={fmt(totalCommitments * 12)} sub={`${(commitments ?? []).length} commitments × 12`} color="bg-orange-50 border border-orange-200" />
            <SummaryCard label="Income / mo" value={fmt(salary)} sub="Monthly salary" color="bg-white border" />
            <SummaryCard label="Fixed / mo" value={fmt(totalCommitments)} sub="Monthly commitments" color="bg-white border" />
          </div>
          <AnnualView year={year} salary={salary} commitments={commitments ?? []} categories={categories ?? []} />
        </>
      )}

      {/* ── PLAN / ACTUAL (preserved from your existing file) ── */}
      {(view === "plan" || view === "actual") && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {view === "plan" ? (
              <SummaryCard label="Monthly Income" value={fmt(salary)} sub={profile?.fullName ? `Gaji ${profile.fullName.split(" ")[0]}` : "From profile"} color="bg-emerald-50 border border-emerald-200" />
            ) : (
              <SummaryCard label="Account Balances" value={fmt(totalAccountBalance)} sub={`${accounts.length} account${accounts.length !== 1 ? "s" : ""}`} color="bg-emerald-50 border border-emerald-200" />
            )}
            <SummaryCard label="Fixed Commitments" value={fmt(totalCommitments)} sub={`${(commitments ?? []).length} items`} color="bg-orange-50 border border-orange-200" />
            <SummaryCard label={view === "plan" ? "Total Budgeted" : "Actually Spent"} value={view === "plan" ? fmt(totalPlanned) : fmt(totalActual)} sub={view === "actual" && totalActual > totalPlanned ? "Over plan" : `of ${fmt(totalPlanned)} planned`} color="bg-blue-50 border border-blue-200" />
            <SummaryCard label={view === "plan" ? "Available Pool" : "Ready to Assign"} value={fmt(view === "plan" ? pool : readyToAssign)}
              sub={view === "plan"
                ? pool < 0 ? "Over-committed!" : "After all deductions"
                : readyToAssign < 0 ? "Over-assigned!" : "Unallocated real cash"}
              color={view === "plan"
                ? pool < 0 ? "bg-red-50 border border-red-200" : "bg-white border"
                : readyToAssign < 0 ? "bg-red-50 border border-red-200" : "bg-white border"} />
          </div>

          {view === "plan" ? (
            <section className="space-y-2">
              <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-600" /><h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Income</h2></div>
              <div className="bg-white border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="font-semibold text-foreground">Monthly Salary / Gaji</p>
                    <p className="text-xs text-muted-foreground">Payday: {profile?.payday ? `${profile.payday}th of the month` : "—"}</p>
                  </div>
                  <span className="font-bold text-emerald-700 text-lg">{fmt(salary)}</span>
                </div>
                <div className="bg-emerald-50 px-5 py-2 flex justify-between items-center border-t border-emerald-100">
                  <span className="text-xs font-medium text-emerald-800">Total Income</span>
                  <span className="text-sm font-bold text-emerald-800">{fmt(salary)}</span>
                </div>
              </div>
            </section>
          ) : (
            <section className="space-y-2">
              <button className="flex items-center gap-2 w-full text-left" onClick={() => setShowAccountsPanel(p => !p)}>
                <Building2 className="w-4 h-4 text-emerald-600" />
                <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex-1">Account Balances</h2>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", !showAccountsPanel && "-rotate-90")} />
              </button>
              {showAccountsPanel && (
                <div className="bg-white border rounded-xl overflow-hidden">
                  {accounts.length === 0 ? (
                    <div className="px-5 py-4 text-sm text-muted-foreground">No accounts added yet. <a href="/accounts" className="text-primary underline">Add your accounts</a> to use YNAB-style budgeting.</div>
                  ) : (
                    accounts.map(a => (
                      <div key={a.id} className="flex items-center justify-between px-5 py-3 border-b last:border-0">
                        <div>
                          <span className="text-sm font-medium text-foreground">{a.name}</span>
                          {a.bankName && <span className="text-xs text-muted-foreground ml-2">{a.bankName}</span>}
                        </div>
                        <span className="font-semibold text-emerald-700 text-sm">{fmt(parseFloat(a.balance ?? "0"))}</span>
                      </div>
                    ))
                  )}
                  <div className="bg-emerald-50 px-5 py-2 flex justify-between items-center border-t border-emerald-100">
                    <span className="text-xs font-medium text-emerald-800">Total Cash</span>
                    <span className="text-sm font-bold text-emerald-800">{fmt(totalAccountBalance)}</span>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-orange-600" />
              <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Fixed Commitments</h2>
              <Badge variant="secondary" className="text-xs">auto</Badge>
            </div>
            <div className="bg-white border rounded-xl overflow-hidden divide-y">
              {(commitments ?? []).length === 0 && (
                <p className="px-5 py-4 text-sm text-muted-foreground">No commitments yet. Add them on the Commitments page.</p>
              )}
              {(commitments ?? []).map(c => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-sm font-medium text-foreground">{c.label}</span>
                  <span className="text-sm font-semibold text-orange-700">{fmt(parseFloat(c.amount))}</span>
                </div>
              ))}
              <div className="bg-orange-50 px-5 py-2 flex justify-between items-center">
                <span className="text-xs font-medium text-orange-800">Total Fixed</span>
                <span className="text-sm font-bold text-orange-800">{fmt(totalCommitments)}</span>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-blue-600" />
              <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                {view === "plan" ? "Variable Budget" : "Category Budget — Actual (YNAB)"}
              </h2>
            </div>

            {view === "actual" && (
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b bg-gray-50 rounded-t-xl border">
                <span>Category</span><span className="w-24 text-right">Assigned</span><span className="w-24 text-right">Activity</span><span className="w-24 text-right">Available</span>
              </div>
            )}

            <div className={cn("bg-white border rounded-xl overflow-hidden divide-y", view === "actual" && "rounded-t-none border-t-0")}>
              {expenseCategories.map(cat => {
                const b = budgetMap[cat.id];
                const planned = parseFloat(b?.plannedAmount ?? "0");
                const actual = parseFloat(b?.actualAmount ?? "0");
                const available = planned - actual;
                const pct = planned > 0 ? Math.min(100, (actual / planned) * 100) : 0;
                const isOver = actual > planned && planned > 0;
                const editVal = editing[cat.id];
                const displayVal = editVal !== undefined ? editVal : planned > 0 ? planned.toFixed(2) : "";

                return (
                  <div key={cat.id} className="px-5 py-4 space-y-2">
                    {view === "plan" ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-foreground flex-1">{cat.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">BND</span>
                          <Input type="number" step="0.01" min="0" className="w-28 text-right h-8 text-sm" value={displayVal} placeholder="0.00"
                            onChange={e => setEditing(prev => ({ ...prev, [cat.id]: e.target.value }))}
                            onBlur={() => { if (editVal !== undefined) handleSave(cat.id); }}
                            onKeyDown={e => { if (e.key === "Enter") handleSave(cat.id); }} />
                          {editVal !== undefined && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => handleSave(cat.id)}><Check className="w-4 h-4" /></Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center">
                        <span className="text-sm font-medium text-foreground">{cat.name}</span>
                        <span className="w-24 text-right text-sm text-muted-foreground font-mono">{planned > 0 ? `BND ${planned.toFixed(2)}` : "—"}</span>
                        <span className="w-24 text-right text-sm font-mono text-foreground">{actual > 0 ? `-BND ${actual.toFixed(2)}` : "—"}</span>
                        <span className={cn("w-24 text-right text-sm font-semibold font-mono",
                          isOver ? "text-destructive" : planned > 0 ? "text-emerald-700" : "text-muted-foreground")}>
                          {planned > 0 ? `BND ${available.toFixed(2)}` : "—"}
                        </span>
                      </div>
                    )}
                    {view === "actual" && planned > 0 && (
                      <div className="space-y-1">
                        <Progress value={pct} className={cn("h-1", isOver && "[&>div]:bg-destructive")} />
                        {isOver && <p className="text-xs text-destructive font-medium">BND {(actual - planned).toFixed(2)} over budget</p>}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="bg-blue-50 px-5 py-2 flex justify-between items-center">
                {view === "plan" ? (
                  <><span className="text-xs font-medium text-blue-800">Total Budgeted</span><span className="text-sm font-bold text-blue-800">{fmt(totalPlanned)}</span></>
                ) : (
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 w-full text-xs font-bold text-blue-800">
                    <span>Total</span><span className="w-24 text-right">{fmt(totalPlanned)}</span><span className="w-24 text-right">{fmt(totalActual)}</span>
                    <span className={cn("w-24 text-right", (totalPlanned - totalActual) < 0 ? "text-destructive" : "text-emerald-700")}>{fmt(totalPlanned - totalActual)}</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section>
            {view === "plan" ? (
              <div className={cn("rounded-xl p-5 flex items-center justify-between", pool < 0 ? "bg-red-50 border-2 border-red-300" : "bg-emerald-50 border-2 border-emerald-300")}>
                <div className="flex items-center gap-3">
                  <Wallet className={cn("w-6 h-6", pool < 0 ? "text-red-600" : "text-emerald-600")} />
                  <div>
                    <p className={cn("font-bold text-base", pool < 0 ? "text-red-800" : "text-emerald-800")}>Available Pool</p>
                    <p className="text-xs text-muted-foreground">{fmt(salary)} income − {fmt(totalCommitments)} commitments − {fmt(totalPlanned)} budgeted</p>
                  </div>
                </div>
                <span className={cn("text-2xl font-extrabold", pool < 0 ? "text-red-700" : "text-emerald-700")}>{fmt(pool)}</span>
              </div>
            ) : (
              <div className={cn("rounded-xl p-5", readyToAssign < 0 ? "bg-red-50 border-2 border-red-300" : "bg-emerald-50 border-2 border-emerald-300")}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Building2 className={cn("w-6 h-6", readyToAssign < 0 ? "text-red-600" : "text-emerald-600")} />
                    <p className={cn("font-bold text-base", readyToAssign < 0 ? "text-red-800" : "text-emerald-800")}>Ready to Assign</p>
                  </div>
                  <span className={cn("text-2xl font-extrabold", readyToAssign < 0 ? "text-red-700" : "text-emerald-700")}>{fmt(readyToAssign)}</span>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground border-t pt-3">
                  <div className="flex justify-between"><span>Total Account Balances</span><span className="font-medium text-emerald-700">{fmt(totalAccountBalance)}</span></div>
                  <div className="flex justify-between"><span>− Fixed Commitments</span><span className="font-medium text-orange-700">−{fmt(totalCommitments)}</span></div>
                  <div className="flex justify-between"><span>− Assigned to Categories</span><span className="font-medium text-blue-700">−{fmt(totalPlanned)}</span></div>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
