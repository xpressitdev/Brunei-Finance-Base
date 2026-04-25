import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useGetDashboardSummary, useGetRecentTransactions, useGetSpendingByCategory } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Link } from "wouter";
import { Wallet, ArrowDownRight, CreditCard, Activity, ArrowRight, Upload, Flame, Trophy, Landmark, ArrowUpRight } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRegion } from "@/hooks/useRegion";
import { cn } from "@/lib/utils";

type ColorState = "green" | "amber" | "red";

const COLORS = ["#15a06e", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16", "#f97316"];

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

export default function Dashboard() {
  const { t } = useTranslation();
  const currentMonth = format(new Date(), "yyyy-MM");
  const { formatCurrency, formatDate, formatMonthYear, region } = useRegion();

  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary({ month: currentMonth });
  const { data: spending, isLoading: spendingLoading } = useGetSpendingByCategory({ month: currentMonth });
  const { data: recentTransactions } = useGetRecentTransactions({ limit: 6 });
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

  const hasTransactions = recentTransactions && recentTransactions.length > 0;
  const hasSpending = spending && spending.length > 0;
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
          <p className="text-muted-foreground">{formatMonthYear(new Date())}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/upload">
            <Button variant="outline" className="bg-white gap-2">
              <Upload className="w-4 h-4" /> {t("common.importStatement")}
            </Button>
          </Link>
          <Link href="/transactions">
            <Button className="gap-2">{t("common.addTransaction")}</Button>
          </Link>
        </div>
      </div>

      {/* KPI section — hero Remaining + 4 compact secondaries */}
      {(() => {
        const income = parseFloat(String(summary?.monthlyIncome ?? 0));
        const remaining = parseFloat(String(summary?.remaining ?? 0));
        const remainingPct = income > 0 ? (remaining / income) * 100 : 0;
        const colorState: ColorState =
          remaining < 0 ? "red" : remainingPct <= 15 ? "amber" : "green";

        const heroStyles: Record<ColorState, { card: string; number: string; message: string; icon: string }> = {
          green: {
            card:    "border-emerald-200 bg-emerald-50/60",
            number:  "text-emerald-700",
            message: "text-emerald-700/80",
            icon:    "text-emerald-500",
          },
          amber: {
            card:    "border-amber-200 bg-amber-50/60",
            number:  "text-amber-700",
            message: "text-amber-700/80",
            icon:    "text-amber-500",
          },
          red: {
            card:    "border-rose-200 bg-rose-50/60",
            number:  "text-rose-700",
            message: "text-rose-700/80",
            icon:    "text-rose-500",
          },
        };
        const s = heroStyles[colorState];

        const heroAmount = colorState === "red"
          ? formatCurrency(Math.abs(remaining))
          : formatCurrency(remaining);
        const heroMessage = t(`dashboard.remaining.${colorState}`, { amount: heroAmount });

        return (
          <div className="space-y-4">
            {/* Hero card — Remaining */}
            <Card className={cn("shadow-sm", s.card)}>
              <CardContent className="px-6 pt-6 pb-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      {t("dashboard.kpi.remainingThisMonth")}
                    </p>
                    <div className={cn("text-5xl font-bold leading-none tracking-tight", s.number)}>
                      {formatCurrency(remaining)}
                    </div>
                    <p className={cn("mt-3 text-sm leading-snug", s.message)}>
                      {heroMessage}
                    </p>
                  </div>
                  <Activity className={cn("w-7 h-7 flex-shrink-0 mt-1", s.icon)} />
                </div>
                <div className="mt-4 pt-4 border-t border-black/5 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                  <div>
                    <span className="block font-medium">{t("dashboard.kpi.commitments")}</span>
                    <span>−{formatCurrency(summary?.totalCommitments)}</span>
                  </div>
                  <div>
                    <span className="block font-medium">{t("dashboard.kpi.debtRepayments")}</span>
                    <span>−{formatCurrency(summary?.totalDebtPayments)}</span>
                  </div>
                  <div>
                    <span className="block font-medium">{t("dashboard.kpi.spending")}</span>
                    <span>−{formatCurrency(summary?.totalSpent)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Secondary compact cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="shadow-sm border-muted">
                <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("dashboard.kpi.monthlySalary")}
                  </CardTitle>
                  <Wallet className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-xl font-bold leading-tight">{formatCurrency(summary?.monthlyIncome)}</div>
                  {summary?.actualIncomeThisMonth !== undefined && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                      <ArrowUpRight className="w-3 h-3" />
                      <span className="font-medium">{formatCurrency(summary.actualIncomeThisMonth)}</span>
                      <span className="text-muted-foreground">{t("dashboard.kpi.received")}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm border-muted">
                <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("dashboard.kpi.fixedCommitments")}
                  </CardTitle>
                  <CreditCard className="w-3.5 h-3.5 text-orange-500/70 flex-shrink-0" />
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-xl font-bold leading-tight">{formatCurrency(summary?.totalCommitments)}</div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-muted">
                <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("dashboard.kpi.liabilities")}
                  </CardTitle>
                  <Landmark className="w-3.5 h-3.5 text-rose-500/70 flex-shrink-0" />
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-xl font-bold leading-tight">{formatCurrency(summary?.totalDebtMonthlyPayment)}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.kpi.monthlyPayments")}</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-muted">
                <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("dashboard.kpi.totalSpent")}
                  </CardTitle>
                  <ArrowDownRight className="w-3.5 h-3.5 text-destructive/60 flex-shrink-0" />
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-xl font-bold leading-tight">{formatCurrency(summary?.totalSpent)}</div>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      })()}

      {/* Gamification row */}
      {gamification && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Streak */}
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-5 pb-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-orange-100 flex items-center justify-center">
                <Flame className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{gamification.streak.current}</div>
                <div className="text-xs text-orange-700/70 font-medium">
                  {t("dashboard.gamification.dayStreak")}
                </div>
                {gamification.streak.current === 0 && (
                  <div className="text-xs text-muted-foreground">{t("dashboard.gamification.logToStart")}</div>
                )}
              </div>
            </CardContent>
          </Card>

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

      {/* Charts + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Spending chart */}
        <Card className="col-span-1 lg:col-span-2 shadow-sm border-muted">
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.chart.spendingByCategory")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              {hasSpending ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={spending}
                      dataKey="totalSpent"
                      nameKey="categoryName"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={55}
                    >
                      {spending.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                    <Legend iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
                  <div className="text-4xl">📊</div>
                  <div>
                    <p className="font-medium text-foreground mb-1">{t("dashboard.chart.noSpendingData")}</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t("dashboard.chart.noSpendingHint")}
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Link href="/upload">
                        <Button size="sm" variant="outline">{t("common.importStatement")}</Button>
                      </Link>
                      <Link href="/transactions">
                        <Button size="sm">{t("common.addTransaction")}</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-6">
          {/* Debt summary */}
          <Card className="shadow-sm border-muted">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("dashboard.financing.title")}</CardTitle>
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
                <div className="pt-3 border-t">
                  <Link href="/debts">
                    <Button variant="outline" className="w-full gap-2" size="sm">
                      {t("dashboard.financing.manage")} <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent transactions */}
          <Card className="shadow-sm border-muted">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("dashboard.recentTransactions.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              {hasTransactions ? (
                <div className="space-y-3">
                  {recentTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-1 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm leading-tight">{tx.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                          {formatDate(tx.date)} &bull; {tx.categoryName || t("dashboard.recentTransactions.uncategorised")}
                          {tx.accountName && (
                            <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-xs leading-none">{tx.accountName}</span>
                          )}
                        </p>
                      </div>
                      <span className={`font-semibold text-sm ${tx.type === "credit" ? "text-emerald-600" : "text-red-500"}`}>
                        {tx.type === "credit" ? "+" : "−"}{formatCurrency(Number(tx.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <div className="text-3xl mb-2">🧾</div>
                  <p className="text-sm text-muted-foreground mb-1">{t("dashboard.recentTransactions.noTransactions")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("dashboard.recentTransactions.importHint")}
                  </p>
                </div>
              )}
              <div className="mt-4">
                <Link href="/transactions">
                  <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground text-sm gap-1">
                    {t("dashboard.recentTransactions.viewAll")} <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
