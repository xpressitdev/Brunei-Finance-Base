import { useState } from "react";
import { format, addMonths, subMonths, parseISO } from "date-fns";
import {
  useListBudgets,
  useUpsertBudget,
  useListCategories,
  useGetProfile,
  useListCommitments,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Pencil, Check, TrendingDown, TrendingUp, Wallet, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

function fmt(n: number) {
  return "BND " + n.toLocaleString("en-BN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

export default function Budgets() {
  const [activeDate, setActiveDate] = useState(new Date());
  const month = format(activeDate, "yyyy-MM");
  const monthLabel = format(activeDate, "MMMM yyyy");
  const [view, setView] = useState<"plan" | "actual">("plan");
  const [editing, setEditing] = useState<Record<string, string>>({});

  const { data: profile } = useGetProfile();
  const { data: commitments } = useListCommitments();
  const { data: budgets, refetch } = useListBudgets({ month });
  const { data: categories } = useListCategories();
  const upsert = useUpsertBudget();

  const salary = parseFloat(profile?.monthlyIncome ?? "0");
  const totalCommitments = (commitments ?? []).reduce((s, c) => s + parseFloat(c.amount), 0);
  const expenseCategories = (categories ?? []).filter(c => c.kind === "expense");

  const budgetMap = Object.fromEntries((budgets ?? []).map(b => [b.categoryId, b]));

  const totalPlanned = expenseCategories.reduce((s, c) => {
    const b = budgetMap[c.id];
    return s + parseFloat(b?.plannedAmount ?? "0");
  }, 0);

  const totalActual = expenseCategories.reduce((s, c) => {
    const b = budgetMap[c.id];
    return s + parseFloat(b?.actualAmount ?? "0");
  }, 0);

  const pool = salary - totalCommitments - totalPlanned;
  const poolActual = salary - totalCommitments - totalActual;

  const handleSave = async (categoryId: string) => {
    const val = editing[categoryId];
    if (val === undefined) return;
    await upsert.mutateAsync({ data: { categoryId, month, plannedAmount: parseFloat(val).toFixed(2) } });
    setEditing(prev => { const n = { ...prev }; delete n[categoryId]; return n; });
    refetch();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Cash Flow Plan</h1>
          <p className="text-muted-foreground">Plan your income and spending each month.</p>
        </div>
        <div className="flex items-center gap-2 bg-white border rounded-xl px-3 py-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveDate(d => subMonths(d, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold w-32 text-center">{monthLabel}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveDate(d => addMonths(d, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          label="Monthly Income"
          value={fmt(salary)}
          sub={profile?.fullName ? `Gaji ${profile.fullName.split(" ")[0]}` : "From profile"}
          color="bg-emerald-50 border border-emerald-200"
        />
        <SummaryCard
          label="Fixed Commitments"
          value={fmt(totalCommitments)}
          sub={`${(commitments ?? []).length} items`}
          color="bg-orange-50 border border-orange-200"
        />
        <SummaryCard
          label={view === "plan" ? "Total Budgeted" : "Actually Spent"}
          value={view === "plan" ? fmt(totalPlanned) : fmt(totalActual)}
          sub={view === "actual" && totalActual > totalPlanned ? "Over plan" : `of ${fmt(totalPlanned)} planned`}
          color="bg-blue-50 border border-blue-200"
        />
        <SummaryCard
          label={view === "plan" ? "Available Pool" : "Remaining"}
          value={fmt(view === "plan" ? pool : poolActual)}
          sub={pool < 0 ? "Over-committed!" : "After all deductions"}
          color={pool < 0 ? "bg-red-50 border border-red-200" : "bg-white border"}
        />
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={view === "plan" ? "default" : "outline"}
          onClick={() => setView("plan")}
          className="rounded-full"
        >
          Forecast Plan
        </Button>
        <Button
          size="sm"
          variant={view === "actual" ? "default" : "outline"}
          onClick={() => setView("actual")}
          className="rounded-full"
        >
          Actual vs Plan
        </Button>
      </div>

      {/* Income section */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Income</h2>
        </div>
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

      {/* Fixed Commitments section */}
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

      {/* Variable Budget section */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-blue-600" />
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            {view === "plan" ? "Variable Budget" : "Variable Budget — Actual vs Plan"}
          </h2>
        </div>
        <div className="bg-white border rounded-xl overflow-hidden divide-y">
          {expenseCategories.map(cat => {
            const b = budgetMap[cat.id];
            const planned = parseFloat(b?.plannedAmount ?? "0");
            const actual = parseFloat(b?.actualAmount ?? "0");
            const pct = planned > 0 ? Math.min(100, (actual / planned) * 100) : 0;
            const isOver = actual > planned && planned > 0;
            const editVal = editing[cat.id];
            const displayVal = editVal !== undefined ? editVal : planned > 0 ? planned.toFixed(2) : "";

            return (
              <div key={cat.id} className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground flex-1">{cat.name}</span>

                  {view === "plan" ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">BND</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-28 text-right h-8 text-sm"
                        value={displayVal}
                        placeholder="0.00"
                        onChange={e => setEditing(prev => ({ ...prev, [cat.id]: e.target.value }))}
                        onBlur={() => { if (editVal !== undefined) handleSave(cat.id); }}
                        onKeyDown={e => { if (e.key === "Enter") handleSave(cat.id); }}
                      />
                      {editVal !== undefined && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => handleSave(cat.id)}>
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="text-right">
                      <p className={cn("text-sm font-semibold", isOver ? "text-destructive" : "text-foreground")}>
                        {fmt(actual)}
                      </p>
                      <p className="text-xs text-muted-foreground">of {fmt(planned)}</p>
                    </div>
                  )}
                </div>

                {view === "actual" && planned > 0 && (
                  <div className="space-y-1">
                    <Progress value={pct} className={cn("h-1.5", isOver && "[&>div]:bg-destructive")} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{pct.toFixed(0)}% used</span>
                      <span className={isOver ? "text-destructive font-medium" : ""}>
                        {isOver ? `BND ${(actual - planned).toFixed(2)} over` : `BND ${(planned - actual).toFixed(2)} left`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="bg-blue-50 px-5 py-2 flex justify-between items-center">
            <span className="text-xs font-medium text-blue-800">
              {view === "plan" ? "Total Budgeted" : "Total Spent"}
            </span>
            <span className="text-sm font-bold text-blue-800">
              {view === "plan" ? fmt(totalPlanned) : fmt(totalActual)}
            </span>
          </div>
        </div>
      </section>

      {/* Pool summary */}
      <section>
        <div className={cn(
          "rounded-xl p-5 flex items-center justify-between",
          pool < 0 ? "bg-red-50 border-2 border-red-300" : "bg-emerald-50 border-2 border-emerald-300"
        )}>
          <div className="flex items-center gap-3">
            <Wallet className={cn("w-6 h-6", pool < 0 ? "text-red-600" : "text-emerald-600")} />
            <div>
              <p className={cn("font-bold text-base", pool < 0 ? "text-red-800" : "text-emerald-800")}>
                {view === "plan" ? "Available Pool" : "Remaining After Spending"}
              </p>
              <p className="text-xs text-muted-foreground">
                {fmt(salary)} income − {fmt(totalCommitments)} commitments − {fmt(view === "plan" ? totalPlanned : totalActual)} {view === "plan" ? "budgeted" : "spent"}
              </p>
            </div>
          </div>
          <span className={cn("text-2xl font-extrabold", pool < 0 ? "text-red-700" : "text-emerald-700")}>
            {fmt(view === "plan" ? pool : poolActual)}
          </span>
        </div>
      </section>
    </div>
  );
}
