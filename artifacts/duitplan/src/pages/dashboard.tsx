import { useEffect } from "react";
import { useGetDashboardSummary, useGetRecentTransactions, useGetSpendingByCategory } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Link } from "wouter";
import { Wallet, ArrowDownRight, CreditCard, Activity, ArrowRight, Upload, Flame, Trophy, Landmark, ArrowUpRight } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useQuery, useMutation } from "@tanstack/react-query";

const COLORS = ["#15a06e", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16", "#f97316"];

const fmt = (val?: string | number) =>
  `BND ${Number(val || 0).toLocaleString("en-BN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  const currentMonth = format(new Date(), "yyyy-MM");

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
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground">{format(new Date(), "MMMM yyyy")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/upload">
            <Button variant="outline" className="bg-white gap-2">
              <Upload className="w-4 h-4" /> Import Statement
            </Button>
          </Link>
          <Link href="/transactions">
            <Button className="gap-2">Add Transaction</Button>
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="shadow-sm border-muted">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monthly Salary</CardTitle>
            <Wallet className="w-4 h-4 text-primary/60" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-2xl font-bold">{fmt(summary?.monthlyIncome)}</div>
            {summary?.actualIncomeThisMonth !== undefined && (
              <div className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600">
                <ArrowUpRight className="w-3 h-3" />
                <span className="font-medium">{fmt(summary.actualIncomeThisMonth)}</span>
                <span className="text-muted-foreground">received</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fixed Commitments</CardTitle>
            <CreditCard className="w-4 h-4 text-orange-500/70" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-2xl font-bold">{fmt(summary?.totalCommitments)}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Liabilities</CardTitle>
            <Landmark className="w-4 h-4 text-rose-500/70" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-2xl font-bold">{fmt(summary?.totalDebtMonthlyPayment)}</div>
            <p className="text-xs text-muted-foreground mt-1">Loan monthly payments</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Spent</CardTitle>
            <ArrowDownRight className="w-4 h-4 text-destructive/60" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-2xl font-bold">{fmt(summary?.totalSpent)}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
            <CardTitle className="text-xs font-medium text-primary uppercase tracking-wider">Remaining</CardTitle>
            <Activity className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-2xl font-bold text-primary">{fmt(summary?.remaining)}</div>
            <div className="mt-2 space-y-1 border-t pt-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Commitments</span>
                <span>-{fmt(summary?.totalCommitments)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Debt Repayments</span>
                <span>-{fmt(summary?.totalDebtPayments)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Spending</span>
                <span>-{fmt(summary?.totalSpent)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
                  {gamification.streak.current === 1 ? "Day streak" : "Day streak"}
                </div>
                {gamification.streak.current === 0 && (
                  <div className="text-xs text-muted-foreground">Log a transaction to start</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Monthly challenge */}
          <Card className="sm:col-span-1">
            <CardContent className="pt-5 pb-5 space-y-2">
              <div className="flex justify-between items-center">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">This Month</div>
                {challengePct >= 100 && <span className="text-xs text-primary font-semibold">✓ Done!</span>}
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
                  {latestBadge ? `Latest: ${latestBadge.name}` : "No badges yet"}
                </div>
                <Link href="/achievements">
                  <button className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
                    <Trophy className="w-3 h-3" /> View all badges
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
            <CardTitle className="text-base">Spending by Category</CardTitle>
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
                    <Tooltip formatter={(value: any) => `BND ${Number(value).toFixed(2)}`} />
                    <Legend iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
                  <div className="text-4xl">📊</div>
                  <div>
                    <p className="font-medium text-foreground mb-1">No spending data yet</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload your BIBD or Baiduri statement, or add a transaction manually.
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Link href="/upload">
                        <Button size="sm" variant="outline">Import Statement</Button>
                      </Link>
                      <Link href="/transactions">
                        <Button size="sm">Add Transaction</Button>
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
              <CardTitle className="text-base">Financing Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Monthly Payment</span>
                  <span className="font-semibold">{fmt(summary?.totalDebtMonthlyPayment)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Debt-to-Income</span>
                  <span className="font-semibold">{summary?.debtToIncomeRatio ?? "0"}%</span>
                </div>
                <div className="pt-3 border-t">
                  <Link href="/debts">
                    <Button variant="outline" className="w-full gap-2" size="sm">
                      Manage Financing <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent transactions */}
          <Card className="shadow-sm border-muted">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {hasTransactions ? (
                <div className="space-y-3">
                  {recentTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-1 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm leading-tight">{tx.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                          {format(new Date(tx.date), "d MMM")} &bull; {tx.categoryName || "Uncategorised"}
                          {tx.accountName && (
                            <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-xs leading-none">{tx.accountName}</span>
                          )}
                        </p>
                      </div>
                      <span className={`font-semibold text-sm ${tx.type === "credit" ? "text-emerald-600" : "text-red-500"}`}>
                        {tx.type === "credit" ? "+" : "−"}BND {Number(tx.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <div className="text-3xl mb-2">🧾</div>
                  <p className="text-sm text-muted-foreground mb-1">No transactions recorded yet.</p>
                  <p className="text-xs text-muted-foreground">
                    Try importing your BIBD or Baiduri statement.
                  </p>
                </div>
              )}
              <div className="mt-4">
                <Link href="/transactions">
                  <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground text-sm gap-1">
                    View all transactions <ArrowRight className="w-3 h-3" />
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
