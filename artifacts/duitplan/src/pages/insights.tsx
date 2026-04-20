import { useState } from "react";
import { format, subMonths, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useGenerateInsights } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Lightbulb, Sparkles, TrendingUp, TrendingDown, ArrowRight,
  AlertTriangle, CheckCircle, Info, RefreshCw, Repeat,
  PiggyBank, Scale, LayoutGrid, Zap,
} from "lucide-react";
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { TrialExpiredPrompt } from "@/components/subscription/TrialExpiredPrompt";
import { isTrialExpiredError } from "@/lib/trialExpired";

const fmt = (v: number) =>
  `BND ${v.toLocaleString("en-BN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type ComputedInsights = {
  month: string;
  spendingTrend: {
    thisMonth: number;
    lastMonth: number | null;
    changePct: number | null;
    hasData: boolean;
  };
  categoryAnomalies: Array<{
    categoryId: string;
    categoryName: string;
    thisMonth: number;
    avg3m: number;
    pctOver: number;
  }>;
  subscriptions: {
    items: Array<{ merchant: string; amount: number }>;
    total: number;
  };
  savingsRate: { income: number; spent: number; rate: number | null };
  dti: { ratio: number | null; monthlyPayment: number; income: number };
  budgetAdherence: {
    total: number;
    onTrack: number;
    overBudget: number;
    pct: number | null;
  };
};

type AiInsight = {
  id: string;
  title: string;
  message: string;
  severity: string;
};

function useComputedInsights(month: string) {
  return useQuery<ComputedInsights>({
    queryKey: ["insights-computed", month],
    queryFn: async () => {
      const res = await fetch(`/api/insights/computed?month=${month}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load computed insights");
      return res.json();
    },
  });
}

function useAiInsights(month: string) {
  return useQuery<AiInsight[]>({
    queryKey: ["insights-ai", month],
    queryFn: async () => {
      const res = await fetch(`/api/insights?month=${month}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
}

function SeverityIcon({ s }: { s: string }) {
  if (s === "warning") return <AlertTriangle className="w-5 h-5 text-orange-500" />;
  if (s === "success") return <CheckCircle className="w-5 h-5 text-emerald-500" />;
  return <Info className="w-5 h-5 text-blue-500" />;
}

function borderColor(s: string) {
  if (s === "warning") return "border-l-orange-400";
  if (s === "success") return "border-l-emerald-500";
  return "border-l-blue-400";
}

function InsightSkeleton() {
  return (
    <Card className="border-l-4 border-l-muted">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-full" />
      </CardContent>
    </Card>
  );
}

export default function Insights() {
  const currentMonth = format(new Date(), "yyyy-MM");
  const [month, setMonth] = useState(currentMonth);
  const [trialExpiredError, setTrialExpiredError] = useState(false);

  const { data: computed, isLoading: computedLoading } = useComputedInsights(month);
  const { data: aiInsights, isLoading: aiLoading, refetch: refetchAi } = useAiInsights(month);
  const generateMutation = useGenerateInsights();

  const handleGenerate = async () => {
    setTrialExpiredError(false);
    try {
      await generateMutation.mutateAsync({ data: { month } });
      refetchAi();
    } catch (err) {
      if (isTrialExpiredError(err)) setTrialExpiredError(true);
    }
  };

  const prevMonthLabel = format(subMonths(parseISO(`${month}-01`), 1), "MMM");
  const thisMonthLabel = format(parseISO(`${month}-01`), "MMM");

  const st = computed?.spendingTrend;
  const sr = computed?.savingsRate;
  const dti = computed?.dti;
  const ba = computed?.budgetAdherence;
  const subs = computed?.subscriptions;
  const anomalies = computed?.categoryAnomalies ?? [];

  const trendChartData = (st?.lastMonth != null)
    ? [
        { label: prevMonthLabel, value: st.lastMonth },
        { label: thisMonthLabel, value: st.thisMonth },
      ]
    : null;

  const spendSeverity = st?.changePct == null ? "info"
    : st.changePct > 20 ? "warning"
    : st.changePct < -5 ? "success"
    : "info";

  const savingsSeverity = sr?.rate == null ? "info"
    : sr.rate >= 20 ? "success"
    : sr.rate >= 10 ? "info"
    : "warning";

  const dtiSeverity = dti?.ratio == null ? "info"
    : dti.ratio > 40 ? "warning"
    : dti.ratio < 20 ? "success"
    : "info";

  const baSeverity = ba?.pct == null ? "info"
    : ba.pct === 100 ? "success"
    : ba.pct < 50 ? "warning"
    : "info";

  const anomalySeverity = anomalies.length === 0 ? "success" : "warning";
  const subsSeverity = (subs?.total ?? 0) > 300 ? "warning" : "info";

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Insights</h1>
          <p className="text-muted-foreground">Deep analysis of your spending habits.</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-44 bg-white"
          />
          <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
            {generateMutation.isPending
              ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Analyzing...</>
              : <><Sparkles className="w-4 h-4 mr-2" />AI Summary</>
            }
          </Button>
        </div>
      </div>

      {trialExpiredError && <TrialExpiredPrompt action="generate insights" />}

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4" /> Data Insights
        </h2>

        {computedLoading ? (
          <div className="grid gap-4">
            {[...Array(6)].map((_, i) => <InsightSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid gap-4">

            {/* ── 1. Spending Trend ── */}
            <Card className={`border-l-4 ${borderColor(spendSeverity)}`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  {st?.changePct == null
                    ? <ArrowRight className="w-5 h-5 text-muted-foreground" />
                    : st.changePct > 0
                    ? <TrendingUp className="w-5 h-5 text-orange-500" />
                    : <TrendingDown className="w-5 h-5 text-emerald-500" />
                  }
                  Spending Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!st?.hasData ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <p className="text-muted-foreground text-sm flex-1">
                      We need at least 2 months of data to show spending trends.
                    </p>
                    <div className="h-20 w-full sm:w-48 shrink-0 opacity-25 pointer-events-none select-none">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[{ label: prevMonthLabel, value: 60 }, { label: thisMonthLabel, value: 60 }]}
                          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                        >
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis hide />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#94a3b8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-2xl font-bold">{fmt(st.thisMonth)}</p>
                      {st.changePct != null && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {st.changePct > 0 ? "▲" : "▼"}{" "}
                          <span className={st.changePct > 0 ? "text-orange-500 font-medium" : "text-emerald-600 font-medium"}>
                            {Math.abs(st.changePct)}%
                          </span>{" "}
                          vs {prevMonthLabel} ({fmt(st.lastMonth!)})
                        </p>
                      )}
                    </div>
                    {trendChartData && (
                      <div className="h-24 w-full sm:w-48 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={trendChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis hide />
                            <Tooltip
                              formatter={(v: number) => fmt(v)}
                              contentStyle={{ fontSize: 12 }}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                              {trendChartData.map((entry, index) => (
                                <Cell key={index} fill={index === 1
                                  ? (st.changePct != null && st.changePct > 0 ? "#f97316" : "#10b981")
                                  : "#94a3b8"} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── 2. Category Anomalies ── */}
            <Card className={`border-l-4 ${borderColor(anomalySeverity)}`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <SeverityIcon s={anomalySeverity} />
                  Category Anomalies
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!st?.hasData ? (
                  <p className="text-muted-foreground text-sm">Not enough history to detect anomalies — check back after 2+ months of data.</p>
                ) : anomalies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No unusual spending detected this month — all categories are within normal range.</p>
                ) : (
                  <div className="space-y-2">
                    {anomalies.slice(0, 3).map(a => (
                      <div key={a.categoryId} className="flex items-center justify-between rounded-lg bg-orange-50 dark:bg-orange-900/10 px-3 py-2">
                        <div>
                          <span className="font-medium text-sm">{a.categoryName}</span>
                          <span className="text-xs text-muted-foreground ml-2">3-mo avg {fmt(a.avg3m)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-orange-600">▲ {a.pctOver}%</span>
                          <div className="text-xs text-muted-foreground">{fmt(a.thisMonth)}</div>
                        </div>
                      </div>
                    ))}
                    {anomalies.length > 3 && (
                      <p className="text-xs text-muted-foreground">{anomalies.length - 3} more {anomalies.length - 3 === 1 ? "category" : "categories"} above usual.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── 3. Subscription Creep ── */}
            <Card className={`border-l-4 ${borderColor(subsSeverity)}`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Repeat className="w-5 h-5 text-violet-500" />
                  Subscription Creep
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(subs?.items.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No recurring charges detected this month.</p>
                ) : (
                  <div>
                    <p className="text-2xl font-bold">{fmt(subs!.total)}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {subs!.items.length} recurring {subs!.items.length === 1 ? "charge" : "charges"} detected this month.
                    </p>
                    <div className="mt-3 space-y-1">
                      {subs!.items.slice(0, 5).map((s, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-muted-foreground truncate max-w-[60%]">{s.merchant}</span>
                          <span className="font-medium">{fmt(s.amount)}</span>
                        </div>
                      ))}
                      {subs!.items.length > 5 && (
                        <p className="text-xs text-muted-foreground">+{subs!.items.length - 5} more</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── 4. Savings Rate ── */}
            <Card className={`border-l-4 ${borderColor(savingsSeverity)}`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PiggyBank className="w-5 h-5 text-emerald-500" />
                  Savings Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sr?.income === 0 && (sr?.spent ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">Configure your salary in Settings to see your savings rate.</p>
                ) : sr?.income === 0 && (sr?.spent ?? 0) > 0 ? (
                  <p className="text-sm text-muted-foreground">Spending exceeds income this month.</p>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-2xl font-bold">
                        {`${sr?.rate ?? 0}%`}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {sr?.rate != null && sr.rate >= 20
                          ? "Excellent — above the 20% healthy benchmark."
                          : sr?.rate != null && sr.rate >= 10
                          ? "On track. Aim for 20%+ for long-term security."
                          : sr?.rate != null && sr.rate >= 0
                          ? `Saving ${sr.rate}% this month. Healthy range: 20%+.`
                          : "Spending exceeds income this month."}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Income {fmt(sr?.income ?? 0)} · Spent {fmt(sr?.spent ?? 0)}
                      </p>
                    </div>
                    <div className="w-full sm:w-40 shrink-0">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Saved</span>
                        <span className="font-medium">{sr?.rate != null ? `${Math.max(0, sr.rate)}%` : "0%"} / 20%</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            savingsSeverity === "success" ? "bg-emerald-500"
                            : savingsSeverity === "warning" ? "bg-orange-400"
                            : "bg-blue-400"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, ((sr?.rate ?? 0) / 20) * 100))}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>0%</span><span>20%</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── 5. Debt-to-Income ── */}
            <Card className={`border-l-4 ${borderColor(dtiSeverity)}`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Scale className="w-5 h-5 text-blue-500" />
                  Debt-to-Income Ratio
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dti?.income === 0 ? (
                  <p className="text-sm text-muted-foreground">Configure your income in Settings to calculate DTI.</p>
                ) : dti?.ratio == null ? (
                  <p className="text-sm text-muted-foreground">No debt payments recorded.</p>
                ) : (
                  <div>
                    <p className="text-2xl font-bold">{dti.ratio}%</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {dti.ratio > 43
                        ? "High — lenders typically reject loans above 43% DTI. Focus on debt reduction."
                        : dti.ratio > 36
                        ? "Moderate — aim to get below 36% for better financial flexibility."
                        : dti.ratio > 20
                        ? "Manageable — within acceptable range."
                        : "Excellent — well within healthy debt levels."}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {fmt(dti.monthlyPayment)} / mo in debt payments · income {fmt(dti.income)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── 6. Budget Adherence ── */}
            <Card className={`border-l-4 ${borderColor(baSeverity)}`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <LayoutGrid className="w-5 h-5 text-violet-500" />
                  Budget Adherence
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!ba || ba.total === 0 ? (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      No budgets set for {format(parseISO(`${month}-01`), "MMMM yyyy")}. Set budgets in the Cash Flow Plan to track adherence.
                    </p>
                    <div className="mt-3 opacity-25 pointer-events-none select-none">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>On track</span><span>— / — budgets</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full w-0 rounded-full bg-blue-400" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">0% of budgets on track</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-2xl font-bold">
                      {ba.onTrack} of {ba.total}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {ba.pct === 100
                        ? "All budgets on track — great discipline!"
                        : ba.onTrack === 0
                        ? "All budgets over-spent this month."
                        : `${ba.onTrack} on track, ${ba.overBudget} over-budget.`}
                    </p>
                    <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${baSeverity === "success" ? "bg-emerald-500" : baSeverity === "warning" ? "bg-orange-400" : "bg-blue-400"}`}
                        style={{ width: `${ba.pct ?? 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{ba.pct ?? 0}% of budgets on track</p>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        )}
      </div>

      {/* ── AI Insights Section ── */}
      {(aiInsights && aiInsights.length > 0) && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> AI Analysis
          </h2>
          <div className="grid gap-4">
            {generateMutation.isPending
              ? [...Array(3)].map((_, i) => <InsightSkeleton key={i} />)
              : aiInsights.map((insight) => (
                  <Card key={insight.id} className={`border-l-4 ${borderColor(insight.severity)}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <SeverityIcon s={insight.severity} />
                        {insight.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground text-sm">{insight.message}</p>
                    </CardContent>
                  </Card>
                ))
            }
          </div>
        </div>
      )}

      {(!aiInsights || aiInsights.length === 0) && !generateMutation.isPending && (
        <div className="bg-muted/30 border border-dashed rounded-xl p-6 text-center">
          <Lightbulb className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Click <strong>AI Summary</strong> above to get a personalised AI analysis of your spending patterns.
          </p>
        </div>
      )}
    </div>
  );
}
