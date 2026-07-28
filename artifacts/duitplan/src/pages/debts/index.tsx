import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import {
  useListDebts,
  useCreateDebt,
  useUpdateDebt,
  useDeleteDebt,
  useGetProfile,
} from "@workspace/api-client-react";
import type { Debt } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Lightbulb,
  PieChart,
  Car,
  Home,
  CreditCard,
  Banknote,
  TrendingDown,
} from "lucide-react";
import { useRegion } from "@/hooks/useRegion";
import { KpiCard } from "@/components/redesign/KpiCard";
import { safeNum, fmtMonths } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
// Payoff math (kept inline so the list page is self-contained)
// ─────────────────────────────────────────────────────────────────────────────

function computePayoffCurve(
  balance: number,
  payment: number,
  rate: number,
  maxMonths = 1200,
): { month: number; balance: number; totalInterest: number }[] {
  const points: { month: number; balance: number; totalInterest: number }[] = [];
  let bal = balance;
  let totalInterest = 0;
  points.push({ month: 0, balance: Math.round(bal * 100) / 100, totalInterest: 0 });
  for (let m = 1; m <= maxMonths; m++) {
    const interestCharged = rate > 0 ? bal * rate : 0;
    totalInterest += interestCharged;
    const principalPaid = Math.min(payment - interestCharged, bal);
    if (principalPaid <= 0) break; // payment can't even cover interest
    bal = Math.max(0, bal - principalPaid);
    points.push({
      month: m,
      balance: Math.round(bal * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
    });
    if (bal <= 0) break;
  }
  return points;
}

function mergeCurves(
  standard: { month: number; balance: number }[],
  accelerated: { month: number; balance: number }[],
): { month: number; standard: number; accelerated: number }[] {
  const maxMonth = Math.max(
    standard[standard.length - 1]?.month ?? 0,
    accelerated[accelerated.length - 1]?.month ?? 0,
  );
  const result: { month: number; standard: number; accelerated: number }[] = [];
  const stdMap = new Map(standard.map((p) => [p.month, p.balance]));
  const accMap = new Map(accelerated.map((p) => [p.month, p.balance]));
  for (let m = 0; m <= maxMonth; m++) {
    const stdBal = stdMap.has(m) ? stdMap.get(m)! : m > (standard[standard.length - 1]?.month ?? 0) ? 0 : null;
    const accBal = accMap.has(m) ? accMap.get(m)! : m > (accelerated[accelerated.length - 1]?.month ?? 0) ? 0 : null;
    if (stdBal !== null || accBal !== null) {
      result.push({ month: m, standard: stdBal ?? 0, accelerated: accBal ?? 0 });
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Debt-type metadata (icon + label + tint)
// ─────────────────────────────────────────────────────────────────────────────

const DEBT_TYPE_OPTIONS = [
  { value: "car_loan", label: "Car" },
  { value: "home_loan", label: "House" },
  { value: "personal_loan", label: "Personal" },
  { value: "credit_card", label: "Credit card" },
  { value: "student_loan", label: "Student" },
  { value: "other", label: "Other" },
];

function debtTypeMeta(t: string | null | undefined) {
  const v = (t ?? "").toLowerCase();
  if (v.includes("car") || v.includes("vehicle"))
    return { Icon: Car, label: "Car" };
  if (v.includes("home") || v.includes("house") || v.includes("mortgage") || v.includes("housing"))
    return { Icon: Home, label: "House" };
  if (v.includes("credit") || v.includes("cc"))
    return { Icon: CreditCard, label: "Credit" };
  if (v.includes("personal"))
    return { Icon: Banknote, label: "Personal" };
  if (v.includes("student") || v.includes("education"))
    return { Icon: Banknote, label: "Student" };
  return { Icon: Banknote, label: "Loan" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline payoff simulator — rendered beneath each loan row
// ─────────────────────────────────────────────────────────────────────────────

function LoanSimulator({ debt }: { debt: Debt }) {
  const { formatCurrency } = useRegion();
  const updateMutation = useUpdateDebt();
  const baseBalance = safeNum(debt.outstandingBalance);
  const basePayment = safeNum(debt.monthlyPayment);
  const ratePerMonth = debt.interestRate ? safeNum(debt.interestRate) / 100 / 12 : 0;
  const sliderMax = 500;
  // Seed from persisted targetExtraPayment so the slider reflects what /budgets
  // is using. Re-seed whenever the debt row updates from the server.
  const persistedExtra = safeNum(debt.targetExtraPayment);
  const [extra, setExtra] = useState(persistedExtra);
  useEffect(() => { setExtra(persistedExtra); }, [persistedExtra]);

  // Debounced persist — after the user stops dragging for 400ms, write the new
  // extra to the DB so /budgets and Hari Gaji auto-deductions pick it up.
  useEffect(() => {
    if (extra === persistedExtra) return;
    const t = setTimeout(() => {
      updateMutation.mutate({ id: debt.id, data: { targetExtraPayment: extra.toFixed(2) } });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extra, persistedExtra, debt.id]);

  const standardCurve = useMemo(
    () => computePayoffCurve(baseBalance, basePayment, ratePerMonth),
    [baseBalance, basePayment, ratePerMonth],
  );
  const acceleratedCurve = useMemo(
    () => computePayoffCurve(baseBalance, basePayment + extra, ratePerMonth),
    [baseBalance, basePayment, extra, ratePerMonth],
  );
  const baseMonths = standardCurve[standardCurve.length - 1]?.month ?? 0;
  const newMonths = acceleratedCurve[acceleratedCurve.length - 1]?.month ?? 0;
  const monthsSaved = Math.max(0, baseMonths - newMonths);
  const baseTotalInterest = standardCurve[standardCurve.length - 1]?.totalInterest ?? 0;
  const accTotalInterest = acceleratedCurve[acceleratedCurve.length - 1]?.totalInterest ?? 0;
  const interestSaved = Math.max(0, baseTotalInterest - accTotalInterest);
  const chartData = useMemo(
    () => mergeCurves(standardCurve, acceleratedCurve),
    [standardCurve, acceleratedCurve],
  );
  const cannotPayoff = ratePerMonth > 0 && basePayment <= baseBalance * ratePerMonth;
  const finalMonths = newMonths > 0 ? newMonths : baseMonths;

  return (
    <div className="mt-4 rounded-lg bg-accent/30 border border-dashed p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
          <TrendingDown className="w-3.5 h-3.5" />
        </div>
        <h4 className="text-sm font-semibold text-foreground">
          What if I pay extra each month?
        </h4>
      </div>

      {cannotPayoff && (
        <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 mb-3">
          The current minimum payment doesn&apos;t cover the monthly interest. Increase your minimum to actually pay off the principal.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4">
        {/* Left — slider + chips */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              Extra /mo
            </Label>
            <div className="text-sm font-bold tabular-nums">{formatCurrency(extra)}</div>
          </div>
          <input
            type="range"
            min={0}
            max={sliderMax}
            step={10}
            value={extra}
            onChange={(e) => setExtra(Number(e.target.value))}
            className="w-full accent-emerald-600"
            aria-label="Extra monthly payment"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums mt-0.5">
            <span>0</span>
            <span>{formatCurrency(sliderMax)}</span>
          </div>
          <div className="flex gap-1.5 mt-2">
            {[50, 100, 200, 500].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setExtra(v)}
                className={cn(
                  "flex-1 h-7 rounded-md text-[11px] font-semibold tabular-nums border transition-colors",
                  extra === v
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white border-border hover:bg-accent/40",
                )}
              >
                +{v}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="rounded-md bg-white border p-3">
              <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">
                Paid off in
              </div>
              <div className="text-base font-bold tabular-nums mt-0.5">
                {fmtMonths(finalMonths)}
              </div>
              {monthsSaved > 0 && (
                <div className="text-[10px] font-semibold text-emerald-700 tabular-nums mt-0.5">
                  −{fmtMonths(monthsSaved)} sooner
                </div>
              )}
            </div>
            <div className="rounded-md bg-white border p-3">
              <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">
                Interest saved
              </div>
              <div className="text-base font-bold tabular-nums mt-0.5 text-emerald-700">
                {formatCurrency(interestSaved)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">vs minimum-only</div>
            </div>
          </div>
        </div>

        {/* Right — chart */}
        <div className="min-w-0">
          <div className="flex items-center justify-end gap-3 text-[10px] mb-1">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 rounded bg-rose-500" /> Minimum only
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 rounded bg-emerald-600" />
              With +{formatCurrency(extra)}
            </span>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-acc-${debt.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  tick={false}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide domain={[0, "auto"]} />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  labelFormatter={(l) => `Month ${l}`}
                  contentStyle={{ fontSize: 11 }}
                />
                <Area
                  type="monotone"
                  dataKey="standard"
                  name="Minimum only"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  fill="transparent"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="accelerated"
                  name={`With +${formatCurrency(extra)}`}
                  stroke="#10b981"
                  strokeWidth={1.5}
                  fill={`url(#grad-acc-${debt.id})`}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
            <span>Today</span>
            <span>Balance over time</span>
            <span>{fmtMonths(finalMonths)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loan row (header strip + lifetime progress + inline simulator)
// ─────────────────────────────────────────────────────────────────────────────

function LoanRow({
  debt,
  onEdit,
  onDelete,
}: {
  debt: Debt;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { formatCurrency } = useRegion();
  const balance = safeNum(debt.outstandingBalance);
  const minPay = safeNum(debt.monthlyPayment);
  const ratePerMonth = debt.interestRate ? safeNum(debt.interestRate) / 100 / 12 : 0;

  // Lifetime progress: pre-compute the original principal from the standard
  // payoff curve. The first point of the standard curve (month 0) is the
  // current balance, so we approximate the *original* principal by replaying
  // the schedule backwards using the user-entered monthly payment.
  // For simplicity we treat the current balance as the start and report
  // 0% progress when we have no record of the original principal.
  const original = useMemo(() => {
    if (!debt.startDate) return balance;
    const [y, m] = debt.startDate.split("-").map(Number);
    if (!y || !m) return balance;
    const start = new Date(y, m - 1, 1);
    const now = new Date();
    const monthsElapsed = Math.max(
      0,
      (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()),
    );
    if (monthsElapsed === 0 || minPay <= 0) return balance;
    // Reconstruct original by stepping the schedule forward from various
    // candidate original principals and picking the one whose balance after
    // monthsElapsed matches the current balance. Simple bisection is fast
    // enough for the small ranges we deal with.
    let lo = balance;
    let hi = balance + minPay * monthsElapsed * 2 + 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      let bal = mid;
      for (let k = 0; k < monthsElapsed; k++) {
        const interest = ratePerMonth > 0 ? bal * ratePerMonth : 0;
        const principal = Math.min(minPay - interest, bal);
        bal = Math.max(0, bal - Math.max(0, principal));
      }
      if (bal > balance) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  }, [debt.startDate, balance, minPay, ratePerMonth]);

  const paidOffPct = original > 0
    ? Math.max(0, Math.min(100, Math.round(((original - balance) / original) * 100)))
    : 0;

  const meta = debtTypeMeta(debt.debtType);
  const Icon = meta.Icon;
  const typeLabel = meta.label.toUpperCase();

  return (
    <div className="border-b last:border-b-0">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Type icon */}
          <div className="w-9 h-9 rounded-md bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <Icon className="w-4 h-4" />
          </div>

          {/* Title + caption + lifetime bar */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="font-semibold text-base truncate">{debt.lender}</h3>
              <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                {typeLabel}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 tabular-nums">
              {debt.interestRate ? <>{debt.interestRate}% APR · </> : null}
              {formatCurrency(balance)} remaining
            </p>

            {/* Lifetime progress bar (rose) */}
            <div className="mt-2 max-w-md">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-rose-500 transition-all"
                  style={{ width: `${paidOffPct}%` }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                {paidOffPct}% paid off over the loan&apos;s lifetime
              </div>
            </div>
          </div>

          {/* Right — Min/mo + actions (desktop only; mobile renders below) */}
          <div className="hidden sm:flex items-start gap-3 shrink-0">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">
                Min /mo
              </div>
              <div className="text-base font-bold tabular-nums">
                {formatCurrency(minPay)}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={onEdit}
              aria-label={`Edit ${debt.lender}`}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              aria-label={`Delete ${debt.lender}`}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Mobile-only action row — keeps Min/mo readable and gives buttons full tap targets */}
        <div className="flex sm:hidden items-center justify-between gap-3 mt-3 pt-3 border-t">
          <div>
            <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">
              Min /mo
            </div>
            <div className="text-base font-bold tabular-nums">
              {formatCurrency(minPay)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={onEdit}
              aria-label={`Edit ${debt.lender}`}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              aria-label={`Delete ${debt.lender}`}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Inline payoff simulator */}
        <LoanSimulator debt={debt} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline "Add a loan" form (always visible, single horizontal row on lg)
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  lender: "",
  debtType: "car_loan",
  outstandingBalance: "",
  monthlyPayment: "",
  interestRate: "",
  startDate: "",
};

type FormState = typeof EMPTY_FORM;

function AddLoanForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (data: FormState) => void;
  isPending: boolean;
}) {
  const { region, decimalStep } = useRegion();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
    setForm(EMPTY_FORM);
  };

  const fieldLabel = "text-[9px] uppercase tracking-wider font-semibold text-muted-foreground";

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="px-5 py-3 border-b bg-accent/20 flex items-center gap-2">
        <div className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
          <Plus className="w-3 h-3" />
        </div>
        <h2 className="text-sm font-semibold">Add a loan</h2>
      </div>

      <form onSubmit={submit} className="p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <Label className={fieldLabel}>Name</Label>
            <Input
              value={form.lender}
              onChange={(e) => setForm({ ...form, lender: e.target.value })}
              placeholder="e.g. Toyota Hilux loan"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className={fieldLabel}>Type</Label>
            <select
              value={form.debtType}
              onChange={(e) => setForm({ ...form, debtType: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {DEBT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className={fieldLabel}>Balance</Label>
            <Input
              type="number"
              step={decimalStep}
              min="0"
              value={form.outstandingBalance}
              onChange={(e) =>
                setForm({ ...form, outstandingBalance: e.target.value })
              }
              placeholder={`${region.currency} 0.00`}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className={fieldLabel}>Rate %</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.interestRate}
              onChange={(e) =>
                setForm({ ...form, interestRate: e.target.value })
              }
              placeholder="0.0"
            />
          </div>
          <div className="space-y-1.5">
            <Label className={fieldLabel}>Min /mo</Label>
            <Input
              type="number"
              step={decimalStep}
              min="0"
              value={form.monthlyPayment}
              onChange={(e) =>
                setForm({ ...form, monthlyPayment: e.target.value })
              }
              placeholder={`${region.currency} 0.00`}
              required
            />
          </div>
          <div className="col-span-2 sm:col-span-3 lg:col-span-5 flex justify-end">
            <Button type="submit" disabled={isPending} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              {isPending ? "Adding…" : "Add"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function Debts() {
  const { t } = useTranslation();
  const { data: debts, isLoading, refetch } = useListDebts();
  const { data: profile } = useGetProfile();
  const createMutation = useCreateDebt();
  const updateMutation = useUpdateDebt();
  const deleteMutation = useDeleteDebt();
  const { formatCurrency, region, decimalStep } = useRegion();

  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);

  const handleAdd = async (form: FormState) => {
    try {
      await createMutation.mutateAsync({
        data: {
          lender: form.lender,
          debtType: form.debtType,
          outstandingBalance: form.outstandingBalance,
          monthlyPayment: form.monthlyPayment,
          interestRate: form.interestRate || undefined,
          startDate: form.startDate || undefined,
        },
      });
      refetch();
    } catch {
      // mutation error state is surfaced by react-query
    }
  };

  const openEdit = (debt: Debt) => {
    setEditingDebt(debt);
    setEditForm({
      lender: debt.lender,
      debtType: debt.debtType,
      outstandingBalance: debt.outstandingBalance,
      monthlyPayment: debt.monthlyPayment,
      interestRate: debt.interestRate ?? "",
      startDate: debt.startDate ?? "",
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDebt) return;
    try {
      await updateMutation.mutateAsync({
        id: editingDebt.id,
        data: {
          lender: editForm.lender,
          debtType: editForm.debtType,
          outstandingBalance: editForm.outstandingBalance,
          monthlyPayment: editForm.monthlyPayment,
          interestRate: editForm.interestRate || null,
          startDate: editForm.startDate || null,
        },
      });
      setEditingDebt(null);
      setEditForm(EMPTY_FORM);
      refetch();
    } catch {
      // mutation error state is surfaced by react-query
    }
  };

  const handleDelete = async (debt: Debt) => {
    if (!confirm(`Delete "${debt.lender}"? This cannot be undone.`)) return;
    try {
      await deleteMutation.mutateAsync({ id: debt.id });
      refetch();
    } catch {
      // mutation error state is surfaced by react-query
    }
  };

  const totalBalance =
    debts?.reduce((acc, curr) => acc + safeNum(curr.outstandingBalance), 0) || 0;
  const totalMonthly =
    debts?.reduce((acc, curr) => acc + safeNum(curr.monthlyPayment), 0) || 0;
  const monthlyIncome = safeNum(profile?.monthlyIncome);
  const dti = monthlyIncome > 0 ? (totalMonthly / monthlyIncome) * 100 : 0;
  const dtiTone: "rose" | "amber" | "emerald" =
    dti > 40 ? "rose" : dti > 30 ? "amber" : "emerald";

  if (isLoading) return <div className="p-8">{t("debts.loading")}</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header — title + "View on Budgets" link */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            {t("debts.title")}
          </h1>
          <p className="text-muted-foreground">
            Add or edit loans. Each one becomes a Bank card on the Budgets page that you fund every month.
          </p>
        </div>
        <Link href="/budgets">
          <Button variant="outline" className="gap-2">
            <PieChart className="w-4 h-4" />
            View on Budgets
          </Button>
        </Link>
      </div>

      {/* KPI strip — Total debt / Min/mo / DTI / Info */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total debt"
          value={formatCurrency(totalBalance)}
          footer={`${debts?.length ?? 0} ${(debts?.length ?? 0) === 1 ? "loan" : "loans"}`}
          tone="rose"
        />
        <KpiCard
          label="Monthly minimum"
          value={formatCurrency(totalMonthly)}
          footer="Sum of minimum payments"
        />
        <KpiCard
          label="Debt-to-income"
          value={monthlyIncome > 0 ? `${dti.toFixed(0)}%` : "—"}
          footer={
            monthlyIncome > 0
              ? `${dtiTone === "rose" ? "High" : dtiTone === "amber" ? "Watch" : "Healthy"} · target < 36%`
              : "Set monthly income in Settings"
          }
          tone={dtiTone}
        />
        <div className="rounded-xl border border-dashed bg-accent/40 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-white border flex items-center justify-center text-primary shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold">How this connects to Budgets</div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
              Each loan becomes a card in the <span className="font-semibold">Bank</span> column.
              The minimum payment is the monthly target you fund from your gaji.
            </p>
          </div>
        </div>
      </div>

      {/* Inline add-loan form */}
      <AddLoanForm onSubmit={handleAdd} isPending={createMutation.isPending} />

      {/* Your loans card */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-3 border-b bg-accent/20 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Your loans</h2>
          <span className="text-[11px] text-muted-foreground">Tap a row to edit</span>
        </div>

        {!debts || debts.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            {t("debts.empty")}
          </div>
        ) : (
          <div>
            {debts.map((d) => (
              <LoanRow
                key={d.id}
                debt={d}
                onEdit={() => openEdit(d)}
                onDelete={() => handleDelete(d)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      <Dialog
        open={!!editingDebt}
        onOpenChange={(open) => {
          if (!open) {
            setEditingDebt(null);
            setEditForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("debts.editDialog.title")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editForm.lender}
                onChange={(e) => setEditForm({ ...editForm, lender: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <select
                value={editForm.debtType}
                onChange={(e) => setEditForm({ ...editForm, debtType: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {DEBT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("debts.addDialog.balanceLabel", { currency: region.currency })}</Label>
              <Input
                type="number"
                step={decimalStep}
                value={editForm.outstandingBalance}
                onChange={(e) =>
                  setEditForm({ ...editForm, outstandingBalance: e.target.value })
                }
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("debts.addDialog.monthlyPaymentLabel", { currency: region.currency })}</Label>
                <Input
                  type="number"
                  step={decimalStep}
                  value={editForm.monthlyPayment}
                  onChange={(e) =>
                    setEditForm({ ...editForm, monthlyPayment: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t("debts.addDialog.interestRateLabel")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.interestRate}
                  onChange={(e) =>
                    setEditForm({ ...editForm, interestRate: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("debts.addDialog.startDateLabel")}</Label>
              <Input
                type="date"
                value={editForm.startDate}
                onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
