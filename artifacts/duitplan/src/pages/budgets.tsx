import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  TrendingDown,
  TrendingUp,
  Wallet,
  Lock,
  Table2,
  LayoutList,
  Building2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TrialExpiredPrompt } from "@/components/subscription/TrialExpiredPrompt";
import { isTrialExpiredError } from "@/lib/trialExpired";
import { useRegion } from "@/hooks/useRegion";

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className={cn("rounded-xl p-4 flex flex-col gap-1", color ?? "bg-white border")}>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-xl font-bold text-foreground leading-tight">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function AnnualView({
  year,
  salary,
  commitments,
  categories,
}: {
  year: number;
  salary: number;
  commitments: Array<{ id: string; label: string; amount: string }>;
  categories: Array<{ id: string; name: string; kind: string }>;
}) {
  const { t } = useTranslation();
  const { formatCurrency } = useRegion();
  const months = MONTH_LABELS.map((_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const expenseCats = categories.filter(c => c.kind === "expense");

  const b = [
    useListBudgets({ month: months[0] }),
    useListBudgets({ month: months[1] }),
    useListBudgets({ month: months[2] }),
    useListBudgets({ month: months[3] }),
    useListBudgets({ month: months[4] }),
    useListBudgets({ month: months[5] }),
    useListBudgets({ month: months[6] }),
    useListBudgets({ month: months[7] }),
    useListBudgets({ month: months[8] }),
    useListBudgets({ month: months[9] }),
    useListBudgets({ month: months[10] }),
    useListBudgets({ month: months[11] }),
  ];

  const budgetMaps = b.map(q =>
    Object.fromEntries((q.data ?? []).map((bud: { categoryId: string; plannedAmount?: string; actualAmount?: string }) => [bud.categoryId, bud]))
  );

  const totalFixedYear = commitments.reduce((s, c) => s + parseFloat(c.amount), 0) * 12;

  const catTotals = expenseCats.map(cat => {
    const total = budgetMaps.reduce((s, bm) => {
      const entry = bm[cat.id];
      return s + parseFloat(entry?.plannedAmount ?? "0");
    }, 0);
    return { id: cat.id, total };
  });
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
            <th className="sticky left-0 z-10 bg-gray-800 text-left px-4 py-3 text-xs font-bold uppercase tracking-wider min-w-[180px] border-r border-gray-600">
              {t("budgets.annual.cashFlowReport")}
            </th>
            {MONTH_LABELS.map(m => (
              <th key={m} className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-center min-w-[90px]">
                {m}
              </th>
            ))}
            <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-center min-w-[100px] bg-gray-700">
              {t("budgets.annual.annualTotal")}
            </th>
          </tr>
        </thead>
        <tbody>
          {/* ── NET INCOME ── */}
          <tr className="bg-emerald-700 text-white">
            <td className="sticky left-0 z-10 bg-emerald-700 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-r border-emerald-600">
              {t("budgets.annual.netIncome")}
            </td>
            {MONTH_LABELS.map((_, i) => <td key={i} className="px-3 py-2" />)}
            <td className="px-3 py-2" />
          </tr>
          <tr className="hover:bg-gray-50 border-b border-gray-100">
            <td className="sticky left-0 z-10 bg-white hover:bg-gray-50 px-4 py-2 text-xs font-medium border-r border-gray-100 pl-6">
              {t("budgets.annual.salaryRow")}
            </td>
            {MONTH_LABELS.map((_, i) => (
              <td key={i} className={cellCls}>
                <span className="text-emerald-700">{formatCurrency(salary)}</span>
              </td>
            ))}
            <td className={cn(cellCls, "bg-emerald-50 font-bold text-emerald-800")}>
              {formatCurrency(totalIncomeYear)}
            </td>
          </tr>
          <tr className="bg-emerald-50 border-b-2 border-emerald-200">
            <td className="sticky left-0 z-10 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 border-r border-emerald-200">
              {t("budgets.annual.totalNetIncome")}
            </td>
            {MONTH_LABELS.map((_, i) => (
              <td key={i} className={cn(cellCls, "font-bold text-emerald-800")}>
                {formatCurrency(salary)}
              </td>
            ))}
            <td className={cn(cellCls, "font-bold text-emerald-800 bg-emerald-100")}>
              {formatCurrency(totalIncomeYear)}
            </td>
          </tr>

          {/* ── FIXED COMMITMENTS ── */}
          <tr className="bg-orange-700 text-white">
            <td className="sticky left-0 z-10 bg-orange-700 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-r border-orange-600">
              {t("budgets.annual.fixedCommitments")}
            </td>
            {MONTH_LABELS.map((_, i) => <td key={i} className="px-3 py-2" />)}
            <td className="px-3 py-2" />
          </tr>
          {commitments.length === 0 && (
            <tr className="border-b border-gray-100">
              <td colSpan={14} className="px-4 py-3 text-xs text-muted-foreground">
                {t("budgets.annual.noCommitments")}
              </td>
            </tr>
          )}
          {commitments.map((c, idx) => (
            <tr key={c.id} className={cn("border-b border-gray-100 hover:bg-gray-50", idx % 2 === 1 && "bg-gray-50/50")}>
              <td className="sticky left-0 z-10 bg-white hover:bg-gray-50 px-4 py-2 text-xs font-medium border-r border-gray-100 pl-6"
                style={{ background: idx % 2 === 1 ? "rgb(249 250 251 / 0.5)" : "white" }}>
                {c.label}
              </td>
              {MONTH_LABELS.map((_, i) => (
                <td key={i} className={cellCls}>
                  <span className="text-orange-700">{formatCurrency(parseFloat(c.amount))}</span>
                </td>
              ))}
              <td className={cn(cellCls, "bg-orange-50 font-semibold text-orange-800")}>
                {formatCurrency(parseFloat(c.amount) * 12)}
              </td>
            </tr>
          ))}
          <tr className="bg-orange-50 border-b-2 border-orange-200">
            <td className="sticky left-0 z-10 bg-orange-50 px-4 py-2 text-xs font-bold text-orange-800 border-r border-orange-200">
              {t("budgets.annual.totalFixed")}
            </td>
            {MONTH_LABELS.map((_, i) => (
              <td key={i} className={cn(cellCls, "font-bold text-orange-800")}>
                {formatCurrency(commitments.reduce((s, c) => s + parseFloat(c.amount), 0))}
              </td>
            ))}
            <td className={cn(cellCls, "font-bold text-orange-800 bg-orange-100")}>
              {formatCurrency(totalFixedYear)}
            </td>
          </tr>

          {/* ── VARIABLE BUDGETS ── */}
          <tr className="bg-blue-700 text-white">
            <td className="sticky left-0 z-10 bg-blue-700 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-r border-blue-600">
              {t("budgets.annual.variableBudgets")}
            </td>
            {MONTH_LABELS.map((_, i) => <td key={i} className="px-3 py-2" />)}
            <td className="px-3 py-2" />
          </tr>
          {expenseCats.map((cat, idx) => {
            const yearTotal = budgetMaps.reduce((s, bm) => {
              return s + parseFloat(bm[cat.id]?.plannedAmount ?? "0");
            }, 0);
            return (
              <tr key={cat.id} className={cn("border-b border-gray-100 hover:bg-gray-50", idx % 2 === 1 && "bg-gray-50/50")}>
                <td className="sticky left-0 z-10 px-4 py-2 text-xs font-medium border-r border-gray-100 pl-6"
                  style={{ background: idx % 2 === 1 ? "rgb(249 250 251 / 0.5)" : "white" }}>
                  {cat.name}
                </td>
                {budgetMaps.map((bm, i) => {
                  const planned = parseFloat(bm[cat.id]?.plannedAmount ?? "0");
                  return (
                    <td key={i} className={cn(cellCls, planned === 0 && zeroCls)}>
                      {planned === 0 ? "—" : formatCurrency(planned)}
                    </td>
                  );
                })}
                <td className={cn(cellCls, "bg-blue-50 font-semibold text-blue-800", yearTotal === 0 && zeroCls)}>
                  {yearTotal === 0 ? "—" : formatCurrency(yearTotal)}
                </td>
              </tr>
            );
          })}
          <tr className="bg-blue-50 border-b-2 border-blue-200">
            <td className="sticky left-0 z-10 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-800 border-r border-blue-200">
              {t("budgets.annual.totalVariable")}
            </td>
            {budgetMaps.map((bm, i) => {
              const monthTotal = expenseCats.reduce((s, cat) => s + parseFloat(bm[cat.id]?.plannedAmount ?? "0"), 0);
              return (
                <td key={i} className={cn(cellCls, "font-bold text-blue-800")}>
                  {monthTotal === 0 ? <span className={zeroCls}>—</span> : formatCurrency(monthTotal)}
                </td>
              );
            })}
            <td className={cn(cellCls, "font-bold text-blue-800 bg-blue-100")}>
              {formatCurrency(totalVariableYear)}
            </td>
          </tr>

          {/* ── AVAILABLE POOL ── */}
          {(() => {
            const monthPools = budgetMaps.map(bm => {
              const varTotal = expenseCats.reduce((s, cat) => s + parseFloat(bm[cat.id]?.plannedAmount ?? "0"), 0);
              const fixedTotal = commitments.reduce((s, c) => s + parseFloat(c.amount), 0);
              return salary - fixedTotal - varTotal;
            });
            const allPositive = monthPools.every(p => p >= 0);
            return (
              <tr className={cn("border-t-2", allPositive ? "bg-emerald-50 border-emerald-300" : "bg-red-50 border-red-300")}>
                <td className={cn(
                  "sticky left-0 z-10 px-4 py-3 text-xs font-extrabold uppercase tracking-wider border-r",
                  allPositive ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-red-50 text-red-800 border-red-300"
                )}>
                  {t("budgets.annual.availablePool")}
                </td>
                {monthPools.map((pool, i) => (
                  <td key={i} className={cn(
                    cellCls, "font-bold text-sm",
                    pool < 0 ? "text-red-700" : "text-emerald-700"
                  )}>
                    {formatCurrency(pool)}
                  </td>
                ))}
                <td className={cn(
                  cellCls, "font-extrabold text-sm",
                  totalPoolYear < 0 ? "text-red-800 bg-red-100" : "text-emerald-800 bg-emerald-100"
                )}>
                  {formatCurrency(totalPoolYear)}
                </td>
              </tr>
            );
          })()}
        </tbody>
      </table>
    </div>
  );
}

export default function Budgets() {
  const { t } = useTranslation();
  const [activeDate, setActiveDate] = useState(new Date());
  const [view, setView] = useState<"plan" | "actual" | "annual">("plan");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [showAccountsPanel, setShowAccountsPanel] = useState(true);

  const month = format(activeDate, "yyyy-MM");
  const year = activeDate.getFullYear();

  const { formatCurrency, formatMonthYear, region, decimalStep } = useRegion();
  const monthLabel = formatMonthYear(activeDate);
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

  const totalAccountBalance = accounts.reduce((s, a) => s + parseFloat(a.balance ?? "0"), 0);
  const readyToAssign = totalAccountBalance - totalCommitments - totalPlanned;

  const [trialExpiredError, setTrialExpiredError] = useState(false);

  const handleSave = async (categoryId: string) => {
    const val = editing[categoryId];
    if (val === undefined) return;
    try {
      await upsert.mutateAsync({ data: { categoryId, month, plannedAmount: parseFloat(val).toFixed(2) } });
      await refetch();
      setEditing(prev => { const n = { ...prev }; delete n[categoryId]; return n; });
    } catch (err) {
      if (isTrialExpiredError(err)) {
        setTrialExpiredError(true);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">{t("budgets.title")}</h1>
          <p className="text-muted-foreground">{t("budgets.subtitle")}</p>
        </div>

        {view === "annual" ? (
          <div className="flex items-center gap-2 bg-white border rounded-xl px-3 py-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveDate(d => subYears(d, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold w-16 text-center">{year}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveDate(d => addYears(d, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-white border rounded-xl px-3 py-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveDate(d => subMonths(d, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold w-32 text-center">{monthLabel}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveDate(d => addMonths(d, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {trialExpiredError && (
        <TrialExpiredPrompt action="set budgets" />
      )}

      {/* View toggle */}
      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          variant={view === "plan" ? "default" : "outline"}
          onClick={() => setView("plan")}
          className="rounded-full gap-1.5"
        >
          <LayoutList className="w-3.5 h-3.5" />
          {t("budgets.views.plan")}
        </Button>
        <Button
          size="sm"
          variant={view === "actual" ? "default" : "outline"}
          onClick={() => setView("actual")}
          className="rounded-full gap-1.5"
        >
          <TrendingDown className="w-3.5 h-3.5" />
          {t("budgets.views.actual")}
        </Button>
        <Button
          size="sm"
          variant={view === "annual" ? "default" : "outline"}
          onClick={() => setView("annual")}
          className="rounded-full gap-1.5"
        >
          <Table2 className="w-3.5 h-3.5" />
          {t("budgets.views.annual")}
        </Button>
      </div>

      {/* ── ANNUAL TABLE VIEW ── */}
      {view === "annual" && categories && commitments && (
        <>
          {/* Annual summary header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard
              label={t("budgets.annual.summary.totalIncome")}
              value={formatCurrency(salary * 12)}
              sub={`${year} · ${formatCurrency(salary)}/mo`}
              color="bg-emerald-50 border border-emerald-200"
            />
            <SummaryCard
              label={t("budgets.annual.summary.totalFixed")}
              value={formatCurrency(totalCommitments * 12)}
              sub={t("budgets.summary.commitmentsX12", { count: (commitments ?? []).length })}
              color="bg-orange-50 border border-orange-200"
            />
            <SummaryCard
              label={t("budgets.annual.summary.incomePerMonth")}
              value={formatCurrency(salary)}
              sub={t("budgets.annual.summary.monthlySalary")}
              color="bg-white border"
            />
            <SummaryCard
              label={t("budgets.annual.summary.fixedPerMonth")}
              value={formatCurrency(totalCommitments)}
              sub={t("budgets.annual.summary.monthlyCommitments")}
              color="bg-white border"
            />
          </div>
          <AnnualView
            year={year}
            salary={salary}
            commitments={commitments ?? []}
            categories={categories ?? []}
          />
        </>
      )}

      {/* ── MONTHLY VIEWS ── */}
      {view !== "annual" && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {view === "plan" ? (
              <SummaryCard
                label={t("budgets.summary.monthlyIncome")}
                value={formatCurrency(salary)}
                sub={profile?.fullName ? `Gaji ${profile.fullName.split(" ")[0]}` : t("budgets.summary.fromProfile")}
                color="bg-emerald-50 border border-emerald-200"
              />
            ) : (
              <SummaryCard
                label={t("budgets.summary.accountBalances")}
                value={formatCurrency(totalAccountBalance)}
                sub={t("budgets.summary.items", { count: accounts.length })}
                color="bg-emerald-50 border border-emerald-200"
              />
            )}
            <SummaryCard
              label={t("budgets.summary.fixedCommitments")}
              value={formatCurrency(totalCommitments)}
              sub={t("budgets.summary.items", { count: (commitments ?? []).length })}
              color="bg-orange-50 border border-orange-200"
            />
            <SummaryCard
              label={view === "plan" ? t("budgets.summary.totalBudgeted") : t("budgets.summary.actuallySpent")}
              value={view === "plan" ? formatCurrency(totalPlanned) : formatCurrency(totalActual)}
              sub={view === "actual" && totalActual > totalPlanned
                ? t("budgets.summary.overPlan")
                : t("budgets.summary.ofPlanned", { amount: formatCurrency(totalPlanned) })}
              color="bg-blue-50 border border-blue-200"
            />
            <SummaryCard
              label={view === "plan" ? t("budgets.summary.availablePool") : t("budgets.summary.readyToAssign")}
              value={formatCurrency(view === "plan" ? pool : readyToAssign)}
              sub={
                view === "plan"
                  ? pool < 0 ? t("budgets.summary.overCommitted") : t("budgets.summary.afterDeductions")
                  : readyToAssign < 0 ? t("budgets.summary.overAssigned") : t("budgets.summary.unallocatedCash")
              }
              color={
                view === "plan"
                  ? pool < 0 ? "bg-red-50 border border-red-200" : "bg-white border"
                  : readyToAssign < 0 ? "bg-red-50 border border-red-200" : "bg-white border"
              }
            />
          </div>

          {/* Income / Account Balances section */}
          {view === "plan" ? (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                  {t("budgets.income.sectionTitle")}
                </h2>
              </div>
              <div className="bg-white border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="font-semibold text-foreground">{t("budgets.income.monthlySalary")}</p>
                    <p className="text-xs text-muted-foreground">
                      {profile?.payday
                        ? t("budgets.income.payday", { day: profile.payday })
                        : t("budgets.income.paydayMissing")}
                    </p>
                  </div>
                  <span className="font-bold text-emerald-700 text-lg">{formatCurrency(salary)}</span>
                </div>
                <div className="bg-emerald-50 px-5 py-2 flex justify-between items-center border-t border-emerald-100">
                  <span className="text-xs font-medium text-emerald-800">{t("budgets.income.totalIncome")}</span>
                  <span className="text-sm font-bold text-emerald-800">{formatCurrency(salary)}</span>
                </div>
              </div>
            </section>
          ) : (
            <section className="space-y-2">
              <button
                className="flex items-center gap-2 w-full text-left"
                onClick={() => setShowAccountsPanel(p => !p)}
              >
                <Building2 className="w-4 h-4 text-emerald-600" />
                <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex-1">
                  {t("budgets.accountBalances.sectionTitle")}
                </h2>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", !showAccountsPanel && "-rotate-90")} />
              </button>
              {showAccountsPanel && (
                <div className="bg-white border rounded-xl overflow-hidden">
                  {accounts.length === 0 ? (
                    <div className="px-5 py-4 text-sm text-muted-foreground">
                      {t("budgets.accountBalances.noAccounts")}{" "}
                      <a href="/accounts" className="text-primary underline">{t("budgets.accountBalances.noAccountsCta")}</a>{" "}
                      {t("budgets.accountBalances.noAccountsHint")}
                    </div>
                  ) : (
                    <>
                      {accounts.map(a => (
                        <div key={a.id} className="flex items-center justify-between px-5 py-3 border-b last:border-0">
                          <div>
                            <span className="text-sm font-medium text-foreground">{a.name}</span>
                            {a.bankName && <span className="text-xs text-muted-foreground ml-2">{a.bankName}</span>}
                          </div>
                          <span className="text-sm font-semibold text-emerald-700">{formatCurrency(parseFloat(a.balance ?? "0"))}</span>
                        </div>
                      ))}
                      <div className="bg-emerald-50 px-5 py-2 flex justify-between items-center border-t border-emerald-100">
                        <span className="text-xs font-medium text-emerald-800">{t("budgets.accountBalances.totalCash")}</span>
                        <span className="text-sm font-bold text-emerald-800">{formatCurrency(totalAccountBalance)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Fixed Commitments section */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-orange-600" />
              <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                {t("budgets.commitments.sectionTitle")}
              </h2>
              <Badge variant="secondary" className="text-xs">auto</Badge>
            </div>
            <div className="bg-white border rounded-xl overflow-hidden divide-y">
              {(commitments ?? []).length === 0 && (
                <p className="px-5 py-4 text-sm text-muted-foreground">{t("budgets.commitments.noCommitments")}</p>
              )}
              {(commitments ?? []).map(c => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-sm font-medium text-foreground">{c.label}</span>
                  <span className="text-sm font-semibold text-orange-700">{formatCurrency(parseFloat(c.amount))}</span>
                </div>
              ))}
              <div className="bg-orange-50 px-5 py-2 flex justify-between items-center">
                <span className="text-xs font-medium text-orange-800">{t("budgets.commitments.totalFixed")}</span>
                <span className="text-sm font-bold text-orange-800">{formatCurrency(totalCommitments)}</span>
              </div>
            </div>
          </section>

          {/* Variable Budget section */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-blue-600" />
              <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                {view === "plan"
                  ? t("budgets.variableBudget.sectionTitle")
                  : t("budgets.variableBudget.actualSectionTitle")}
              </h2>
            </div>

            {/* YNAB-style column header for actual view */}
            {view === "actual" && (
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b bg-gray-50 rounded-t-xl border">
                <span>{t("budgets.variableBudget.colCategory")}</span>
                <span className="w-24 text-right">{t("budgets.variableBudget.colAssigned")}</span>
                <span className="w-24 text-right">{t("budgets.variableBudget.colActivity")}</span>
                <span className="w-24 text-right">{t("budgets.variableBudget.colAvailable")}</span>
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
                          <span className="text-xs text-muted-foreground">{region.currency}</span>
                          <Input
                            type="number"
                            step={decimalStep}
                            min="0"
                            className="w-28 text-right h-8 text-sm"
                            value={displayVal}
                            placeholder={decimalStep === "1" ? "0" : "0.00"}
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
                      </div>
                    ) : (
                      /* YNAB-style row */
                      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center">
                        <span className="text-sm font-medium text-foreground">{cat.name}</span>
                        <span className="w-24 text-right text-sm text-muted-foreground font-mono">
                          {planned > 0 ? formatCurrency(planned) : "—"}
                        </span>
                        <span className="w-24 text-right text-sm font-mono text-foreground">
                          {actual > 0 ? `-${formatCurrency(actual)}` : "—"}
                        </span>
                        <span className={cn(
                          "w-24 text-right text-sm font-semibold font-mono",
                          isOver ? "text-destructive" : planned > 0 ? "text-emerald-700" : "text-muted-foreground"
                        )}>
                          {planned > 0 ? formatCurrency(available) : "—"}
                        </span>
                      </div>
                    )}

                    {view === "actual" && planned > 0 && (
                      <div className="space-y-1">
                        <Progress value={pct} className={cn("h-1", isOver && "[&>div]:bg-destructive")} />
                        {isOver && (
                          <p className="text-xs text-destructive font-medium">
                            {t("budgets.variableBudget.overBudget", { amount: formatCurrency(actual - planned) })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="bg-blue-50 px-5 py-2 flex justify-between items-center">
                {view === "plan" ? (
                  <>
                    <span className="text-xs font-medium text-blue-800">{t("budgets.variableBudget.totalBudgeted")}</span>
                    <span className="text-sm font-bold text-blue-800">{formatCurrency(totalPlanned)}</span>
                  </>
                ) : (
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 w-full text-xs font-bold text-blue-800">
                    <span>{t("budgets.variableBudget.colTotal")}</span>
                    <span className="w-24 text-right">{formatCurrency(totalPlanned)}</span>
                    <span className="w-24 text-right">{formatCurrency(totalActual)}</span>
                    <span className={cn("w-24 text-right", (totalPlanned - totalActual) < 0 ? "text-destructive" : "text-emerald-700")}>
                      {formatCurrency(totalPlanned - totalActual)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Pool / Ready to Assign summary */}
          <section>
            {view === "plan" ? (
            <div className={cn(
              "rounded-xl p-5 flex items-center justify-between",
              pool < 0 ? "bg-red-50 border-2 border-red-300" : "bg-emerald-50 border-2 border-emerald-300"
            )}>
              <div className="flex items-center gap-3">
                <Wallet className={cn("w-6 h-6", pool < 0 ? "text-red-600" : "text-emerald-600")} />
                <div>
                  <p className={cn("font-bold text-base", pool < 0 ? "text-red-800" : "text-emerald-800")}>
                    {t("budgets.pool.availablePool")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(salary)} income − {formatCurrency(totalCommitments)} commitments − {formatCurrency(totalPlanned)} budgeted
                  </p>
                </div>
              </div>
              <span className={cn("text-2xl font-extrabold", pool < 0 ? "text-red-700" : "text-emerald-700")}>
                {formatCurrency(pool)}
              </span>
            </div>
            ) : (
            <div className={cn(
              "rounded-xl p-5",
              readyToAssign < 0 ? "bg-red-50 border-2 border-red-300" : "bg-emerald-50 border-2 border-emerald-300"
            )}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Building2 className={cn("w-6 h-6", readyToAssign < 0 ? "text-red-600" : "text-emerald-600")} />
                  <p className={cn("font-bold text-base", readyToAssign < 0 ? "text-red-800" : "text-emerald-800")}>
                    {t("budgets.pool.readyToAssign")}
                  </p>
                </div>
                <span className={cn("text-2xl font-extrabold", readyToAssign < 0 ? "text-red-700" : "text-emerald-700")}>
                  {formatCurrency(readyToAssign)}
                </span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground border-t pt-3">
                <div className="flex justify-between">
                  <span>{t("budgets.pool.totalAccountBalances")}</span>
                  <span className="font-medium text-emerald-700">{formatCurrency(totalAccountBalance)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("budgets.pool.minusFixedCommitments")}</span>
                  <span className="font-medium text-orange-700">−{formatCurrency(totalCommitments)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("budgets.pool.minusAssigned")}</span>
                  <span className="font-medium text-blue-700">−{formatCurrency(totalPlanned)}</span>
                </div>
              </div>
            </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
