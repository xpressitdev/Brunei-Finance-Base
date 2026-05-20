import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGetDashboardSummary, useGetRecentTransactions, useGetSpendingByCategory, useGetProfile, useListIncomeSources, useListTransactions } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Link } from "wouter";
import { ArrowDownRight, CreditCard, Activity, ArrowRight, Upload, Flame, Trophy, Landmark, ArrowUpRight, Calendar, Plus, Briefcase } from "lucide-react";
import { AddTransactionDialog } from "@/components/AddTransactionDialog";
import { KpiCard } from "@/components/redesign/KpiCard";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRegion } from "@/hooks/useRegion";
import { cn } from "@/lib/utils";
import { usePaydayPrompt } from "@/hooks/usePaydayPrompt";
import { PaydayReviewModal } from "@/components/PaydayReviewModal";
import { computeSpendingPace, formatPaceTooltip } from "@/lib/spendingPace";

const ENVELOPE_BAR_COLORS = {
  on_track: "bg-primary",
  warning: "bg-amber-500",
  over: "bg-rose-500",
  no_budget: "bg-muted-foreground/30",
} as const;

const ENVELOPE_TRACK_COLORS = {
  on_track: "bg-primary/10",
  warning: "bg-amber-500/10",
  over: "bg-rose-500/10",
  no_budget: "bg-muted",
} as const;

type EnvelopeStatus = keyof typeof ENVELOPE_BAR_COLORS;

type GamificationSummary = {
  streak: { current: number; longest: number };
  achievements: { key: string; name: string; icon: string; unlocked: boolean; unlockedAt: string | null }[];
  monthlyChallenge: { title: string; description: string; progress: number; target: number; unit: string };
  totalUnlocked: number;
  totalAvailable: number;
};

function useGamification() {
  return useQuery<GamificationSummary>({
    queryKey: ["gamification-summary"],
    queryFn: async () => {
      const res = await fetch(`/api/gamification/summary`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
}

function useCheckAchievements() {
  return useMutation({
    mutationFn: async () => {
      await fetch(`/api/gamification/achievements/check`, { method: "POST", credentials: "include" });
    },
  });
}

function VariableIncomeBanner({ month }: { month: string }) {
  const { t } = useTranslation();
  const { formatCurrency } = useRegion();
  const { data: sources = [] } = useListIncomeSources();
  const { data: incomeTxns = [] } = useListTransactions({ month, type: "credit" });
  const expected = sources.filter((s) => s.active).reduce((sum, s) => sum + Number(s.expectedMonthlyAmount || 0), 0);
  const actual = incomeTxns.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const pct = expected > 0 ? Math.round((actual / expected) * 100) : 0;
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0">
          <Briefcase className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">
            {t("dashboard.variableIncome.title", { actual: formatCurrency(actual) })}
          </div>
          <div className="text-[13px] text-muted-foreground">
            {expected > 0
              ? t("dashboard.variableIncome.vsExpected", { expected: formatCurrency(expected), pct })
              : t("dashboard.variableIncome.noExpected")}
          </div>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Link href="/income-sources">
          <Button variant="outline" size="sm" className="bg-white">
            {t("dashboard.variableIncome.manageSources")}
          </Button>
        </Link>
        <AddTransactionDialog
          trigger={
            <Button size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" /> {t("dashboard.variableIncome.logIncome")}
            </Button>
          }
        />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const currentMonth = format(new Date(), "yyyy-MM");
  const currentMonthName = format(new Date(), "MMMM");
  const { formatCurrency, formatDate } = useRegion();
  const [payModalOpen, setPayModalOpen] = useState(false);

  const { data: profile } = useGetProfile();
  const { prompt: paydayPrompt, remindTomorrow: remindPaydayTomorrow } = usePaydayPrompt();
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary({ month: currentMonth });
  const { data: spending, isLoading: spendingLoading } = useGetSpendingByCategory({ month: currentMonth });
  const { data: recentTransactions } = useGetRecentTransactions({ limit: 5 });
  const { data: gamification, refetch: refetchGamification } = useGamification();
  const checkAchievements = useCheckAchievements();

  useEffect(() => {
    checkAchievements.mutateAsync().then(() => refetchGamification());
  }, []);

  const isLoading = summaryLoading || spendingLoading;

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-10 w-56 bg-muted rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="col-span-2 h-80 bg-muted rounded-2xl" />
          <div className="h-80 bg-muted rounded-2xl" />
        </div>
      </div>
    );
  }

  const firstName = profile?.fullName?.trim().split(/\s+/)[0] ?? "";
  const hasTransactions = recentTransactions && recentTransactions.length > 0;
  const hasSpending = spending && spending.length > 0;
  const realSpending = (spending ?? []).filter(s => !/^uncategorized$/i.test(s.categoryName ?? "uncategorized"));
  const hasRealSpending = realSpending.length > 0;
  const envelopeRows = realSpending.slice(0, 5);
  const allUnbudgeted = hasRealSpending && envelopeRows.every(s => (s as { budget?: number | null }).budget == null);
  const challenge = gamification?.monthlyChallenge;
  const challengePct = challenge ? Math.min(100, (challenge.progress / challenge.target) * 100) : 0;
  const latestBadge = gamification?.achievements
    .filter(a => a.unlocked && a.unlockedAt)
    .sort((a, b) => new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime())[0];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.overview.title")}</h1>
          <p className="text-muted-foreground">
            Here's how your money is moving in {currentMonthName}{firstName ? `, ${firstName}` : ""}.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/upload">
            <Button variant="outline" className="bg-white gap-2">
              <Upload className="w-4 h-4" /> {t("common.importStatement")}
            </Button>
          </Link>
          <AddTransactionDialog
            trigger={
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> {t("common.addTransaction")}
              </Button>
            }
          />
        </div>
      </div>

      {/* Variable-income summary (replaces Hari Gaji for variable earners) */}
      {profile?.incomeType === "variable" && <VariableIncomeBanner month={currentMonth} />}

      {/* Hari Gaji Banner */}
      {profile?.incomeType !== "variable" && paydayPrompt && (
        <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-lg flex-shrink-0">
              💵
            </div>
            <div>
              <div className="text-sm font-semibold">
                Hari Gaji is today{firstName ? `, ${firstName}` : ""}.
              </div>
              <div className="text-[13px] text-muted-foreground">
                Did you receive your {formatCurrency(parseFloat(paydayPrompt.monthlyIncome))} salary? We'll log it and deduct your auto-debits.
              </div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => remindPaydayTomorrow(paydayPrompt.id)}>
              Remind tomorrow
            </Button>
            <Button size="sm" onClick={() => setPayModalOpen(true)}>
              Yes, I got paid
            </Button>
          </div>
        </div>
      )}
      {paydayPrompt && <PaydayReviewModal open={payModalOpen} onClose={() => setPayModalOpen(false)} prompt={paydayPrompt} />}

      {/* 5 KPI Cards */}
      {(() => {
        const remaining = parseFloat(String(summary?.remaining ?? 0));
        const remainingPositive = remaining >= 0;
        const debtMonthly = parseFloat(String(summary?.totalDebtMonthlyPayment ?? 0));
        const txCount = recentTransactions?.length ?? 0;
        const monthlyIncomeNum = summary?.monthlyIncome ? Number(summary.monthlyIncome) : 0;
        const spentNum = summary?.totalSpent ? Number(summary.totalSpent) : 0;
        const pace = computeSpendingPace(spentNum, monthlyIncomeNum);
        const paceTooltip = formatPaceTooltip(pace);
        return (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KpiCard
              label="Monthly Salary"
              value={formatCurrency(summary?.monthlyIncome)}
              icon={<Activity className="w-3.5 h-3.5" />}
              delta={
                summary?.actualIncomeThisMonth !== undefined
                  ? `+${formatCurrency(summary.actualIncomeThisMonth)}`
                  : undefined
              }
              deltaLabel="received"
              deltaTone="up"
            />
            <KpiCard
              label="Commitments"
              value={formatCurrency(summary?.totalCommitments)}
              icon={<Calendar className="w-3.5 h-3.5" />}
              footer={<div className="text-[11px] text-muted-foreground">fixed</div>}
            />
            <KpiCard
              label="Liabilities"
              value={formatCurrency(summary?.totalDebtMonthlyPayment)}
              icon={<Landmark className="w-3.5 h-3.5" />}
              footer={
                <div className="text-[11px] text-muted-foreground">
                  {summary?.debtToIncomeRatio ?? 0}% of income
                </div>
              }
            />
            <KpiCard
              label="This Month"
              value={formatCurrency(summary?.totalSpent)}
              icon={<CreditCard className="w-3.5 h-3.5" />}
              footer={
                <div className="space-y-1.5">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    <span>{txCount} {txCount === 1 ? "transaction" : "transactions"}</span>
                    {pace.paceLabel && (
                      <>
                        <span className="text-muted-foreground/60">·</span>
                        <span className={`font-semibold ${pace.paceTone}`} title={paceTooltip}>{pace.paceLabel}</span>
                      </>
                    )}
                  </div>
                  {monthlyIncomeNum > 0 && (
                    <div
                      className="h-1 w-full rounded-full bg-muted overflow-hidden relative"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.min(Math.round(pace.spentPctRaw), 100)}
                      aria-label={`Spent ${formatCurrency(spentNum)} of expected ${formatCurrency(monthlyIncomeNum)} this month, ${pace.paceLabel.toLowerCase()} on day ${pace.dayOfMonth} of ${pace.daysInMonth}`}
                    >
                      <div className={`h-full ${pace.barColor} transition-all`} style={{ width: `${pace.spentPct}%` }} />
                      <div
                        className="absolute top-[-2px] bottom-[-2px] w-px bg-foreground/40"
                        style={{ left: `${Math.min(pace.monthProgressPct, 100)}%` }}
                        title={`Day ${pace.dayOfMonth} of ${pace.daysInMonth}`}
                        aria-hidden="true"
                      />
                    </div>
                  )}
                </div>
              }
            />
            <KpiCard
              hero
              label="Remaining"
              value={`${remaining < 0 ? "−" : ""}${formatCurrency(Math.abs(remaining))}`}
              icon={<ArrowDownRight className="w-3.5 h-3.5" />}
              tone={remainingPositive ? "primary" : "rose"}
              footer={
                <div className="border-t border-black/5 mt-2 pt-2 space-y-0.5">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Commitments</span>
                    <span>−{formatCurrency(summary?.totalCommitments)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Spending</span>
                    <span>−{formatCurrency(summary?.totalSpent)}</span>
                  </div>
                  {debtMonthly > 0 && (
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Loan repayments</span>
                      <span>−{formatCurrency(summary?.totalDebtMonthlyPayment)}</span>
                    </div>
                  )}
                </div>
              }
            />
          </div>
        );
      })()}

      {/* Charts + Recent Transactions */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Budget envelopes */}
        <Card className="lg:col-span-2 shadow-sm border-muted">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{t("dashboard.envelopes.title")}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(), "MMMM yyyy")}</p>
              </div>
              <Link href="/budgets">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  {t("dashboard.envelopes.viewAll")} <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {!hasRealSpending ? (
              <div className="w-full min-h-44 flex flex-col items-center justify-center gap-2 text-center py-6">
                <div className="text-4xl">📊</div>
                <p className="text-sm font-medium">{t("dashboard.envelopes.emptyTitle")}</p>
                <p className="text-xs text-muted-foreground max-w-xs">{t("dashboard.envelopes.emptyHint")}</p>
              </div>
            ) : allUnbudgeted ? (
              <div className="w-full min-h-44 flex flex-col items-center justify-center gap-2 text-center py-6">
                <div className="text-4xl">🎯</div>
                <p className="text-sm font-medium">{t("dashboard.envelopes.noBudgetsTitle")}</p>
                <p className="text-xs text-muted-foreground max-w-xs">{t("dashboard.envelopes.noBudgetsHint")}</p>
                <Link href="/categories">
                  <Button variant="outline" size="sm" className="mt-2">{t("dashboard.envelopes.noBudgetsCta")}</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3.5">
                {envelopeRows.map((s) => {
                  const row = s as { categoryName: string; totalSpent: number; budget?: number | null; percentOfBudget?: number | null; status?: EnvelopeStatus };
                  const status: EnvelopeStatus = row.status ?? (row.budget == null ? "no_budget" : "on_track");
                  const barClass = ENVELOPE_BAR_COLORS[status];
                  const trackClass = ENVELOPE_TRACK_COLORS[status];
                  const pct = row.percentOfBudget ?? 0;
                  const barWidth = Math.min(100, pct);
                  const delta = row.budget != null ? row.budget - row.totalSpent : 0;
                  return (
                    <div key={row.categoryName} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium truncate">{row.categoryName}</span>
                        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                          <span className="font-semibold text-foreground">{formatCurrency(row.totalSpent)}</span>
                          {row.budget != null
                            ? <> {t("dashboard.envelopes.ofBudget", { budget: formatCurrency(row.budget) })}</>
                            : <> · {t("dashboard.envelopes.noBudget")}</>
                          }
                        </span>
                      </div>
                      <div className={cn("h-2 w-full rounded-full overflow-hidden", trackClass)}>
                        <div
                          className={cn("h-full rounded-full transition-all", barClass)}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      {row.budget != null && (
                        <div className="text-[11px] text-muted-foreground tabular-nums">
                          {delta < 0
                            ? <span className="text-rose-600 font-medium">{t("dashboard.envelopes.over", { amount: formatCurrency(Math.abs(delta)) })}</span>
                            : t("dashboard.envelopes.left", { amount: formatCurrency(delta) })
                          }
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="shadow-sm border-muted">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("dashboard.recentTransactions.title")}</CardTitle>
              <Link href="/transactions">
                <Button variant="ghost" size="icon" className="h-7 w-7"><ArrowRight className="w-3.5 h-3.5" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {hasTransactions ? (
              <div className="divide-y divide-border">
                {recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm leading-tight truncate">{tx.description}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                        {formatDate(tx.date)}
                        {tx.categoryName && tx.categoryName !== tx.description && <span className="bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{tx.categoryName}</span>}
                        <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{tx.accountName ?? "—"}</span>
                      </p>
                    </div>
                    <span className={cn("font-bold text-sm ml-3 shrink-0 tabular-nums", tx.type === "credit" ? "text-emerald-600" : "text-rose-600")}>
                      {tx.type === "credit" ? "+" : "−"}{formatCurrency(Number(tx.amount))}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center">
                <div className="text-3xl mb-2">🧾</div>
                <p className="text-sm text-muted-foreground">{t("dashboard.recentTransactions.importHint")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Financing Summary + Streak */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Financing Summary */}
        <Card className="shadow-sm border-muted">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{t("dashboard.financing.title")}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Debt-to-income {summary?.debtToIncomeRatio ?? 0}%</p>
              </div>
              <Link href="/debts">
                <Button variant="outline" size="sm">{t("dashboard.financing.manage")}</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t("dashboard.financing.monthlyPayment")}</span>
                <span className="font-semibold">{formatCurrency(summary?.totalDebtMonthlyPayment)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t("dashboard.financing.debtToIncome")}</span>
                <span className="font-semibold">{summary?.debtToIncomeRatio ?? "0"}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Streak card */}
        {gamification && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <Flame className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-orange-900">
                      {gamification.streak.current}-day streak — keep it going
                    </div>
                    <div className="text-xs text-orange-800/80 mt-0.5">
                      You've logged a transaction every day this month. Don't break the chain.
                    </div>
                  </div>
                </div>
                <span className="bg-orange-200 text-orange-900 text-xs font-bold px-2 py-1 rounded-full">🔥 {gamification.streak.current}</span>
              </div>
              {(() => {
                const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                const raw = new Date().getDay();
                const todayIdx = raw === 0 ? 6 : raw - 1;
                const streak = gamification.streak.current;
                return (
                  <div className="mt-4 grid grid-cols-7 gap-1">
                    {labels.map((label, i) => {
                      const isFuture = i > todayIdx;
                      const isLogged = !isFuture && (todayIdx - i) < streak;
                      return (
                        <div key={i} className={cn(
                          "h-7 rounded flex items-center justify-center text-[10px] font-bold",
                          isFuture
                            ? "bg-orange-100/40 text-orange-300"
                            : isLogged
                              ? "bg-orange-300/70 text-orange-900"
                              : "border border-dashed border-orange-300 text-orange-400"
                        )}>
                          {label}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Gamification achievements */}
      {gamification && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Monthly challenge */}
          <Card className="sm:col-span-1">
            <CardContent className="pt-5 pb-5 space-y-2">
              <div className="flex justify-between items-center">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t("dashboard.gamification.thisMonth")}
                </div>
                {challengePct >= 100 && (
                  <span className="text-xs text-primary font-semibold">{t("dashboard.gamification.done")}</span>
                )}
              </div>
              <p className="text-sm font-medium leading-tight">{challenge?.title}</p>
              <Progress value={challengePct} className="h-1.5" />
              <p className="text-xs text-muted-foreground">
                {challenge?.progress} / {challenge?.target} {challenge?.unit}
              </p>
            </CardContent>
          </Card>

          {/* Badges */}
          <Card>
            <CardContent className="pt-5 pb-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center text-xl">
                {latestBadge ? latestBadge.icon : "🏅"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-2xl font-bold">{gamification.totalUnlocked}</div>
                <div className="text-xs text-muted-foreground">
                  {latestBadge
                    ? t("dashboard.gamification.latest", { name: latestBadge.name })
                    : t("dashboard.gamification.noBadgesYet")}
                </div>
                <Link href="/achievements">
                  <button className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
                    <Trophy className="w-3 h-3" /> {t("dashboard.gamification.viewAllBadges")}
                  </button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
