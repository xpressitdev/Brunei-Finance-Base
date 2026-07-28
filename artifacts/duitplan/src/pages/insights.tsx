import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  ResponsiveContainer,
} from "recharts";
import { useRegion } from "@/hooks/useRegion";

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
  const { t } = useTranslation();
  const currentMonth = format(new Date(), "yyyy-MM");
  const [month, setMonth] = useState(currentMonth);
  const { formatCurrency, formatMonthYear, formatMonthShort } = useRegion();

  const { data: computed, isLoading: computedLoading } = useComputedInsights(month);
  const { data: aiInsights, isLoading: aiLoading, refetch: refetchAi } = useAiInsights(month);
  const generateMutation = useGenerateInsights();

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync({ data: { month } });
      refetchAi();
    } catch {
      // errors are surfaced by the query state
    }
  };

  const prevMonthLabel = formatMonthShort(subMonths(parseISO(`${month}-01`), 1));
  const thisMonthLabel = formatMonthShort(parseISO(`${month}-01`));

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
          <h1 className="text-3xl font-bold text-foreground tracking-tight">{t("insights.title")}</h1>
          <p className="text-muted-foreground">{t("insights.subtitle")}</p>
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
              ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />{t("insights.analyzing")}</>
              : <><Sparkles className="w-4 h-4 mr-2" />{t("insights.aiSummary")}</>
            }
          </Button>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4" /> {t("insights.sections.dataInsights")}
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
                  {t("insights.cards.spendingTrend")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!st?.hasData ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <p className="text-muted-foreground text-sm flex-1">
                      {t("insights.spendingTrend.needMoreData")}
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
                      <p className="text-2xl font-bold">{formatCurrency(st.thisMonth)}</p>
                      {st.changePct != null && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {st.changePct > 0 ? "▲" : "▼"}{" "}
                          <span className={st.changePct > 0 ? "text-orange-500 font-medium" : "text-emerald-600 font-medium"}>
                            {Math.abs(st.changePct)}%
                          </span>{" "}
                          {t("insights.spendingTrend.vsLastMonth", {
                            month: prevMonthLabel,
                            amount: formatCurrency(st.lastMonth!)
                          })}
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
                              formatter={(v: number) => formatCurrency(v)}
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
                  {t("insights.cards.categoryAnomalies")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!st?.hasData ? (
                  <p className="text-muted-foreground text-sm">{t("insights.anomalies.notEnoughHistory")}</p>
                ) : anomalies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("insights.anomalies.noAnomalies")}</p>
                ) : (
                  <div className="space-y-2">
                    {anomalies.slice(0, 3).map(a => (
                      <div key={a.categoryId} className="flex items-center justify-between rounded-lg bg-orange-50 dark:bg-orange-900/10 px-3 py-2">
                        <div>
                          <span className="font-medium text-sm">{a.categoryName}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {t("insights.anomalies.avg3m", { amount: formatCurrency(a.avg3m) })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-orange-600">▲ {a.pctOver}%</span>
                          <div className="text-xs text-muted-foreground">{formatCurrency(a.thisMonth)}</div>
                        </div>
                      </div>
                    ))}
                    {anomalies.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        {t("insights.anomalies.moreCategories", { count: anomalies.length - 3 })}
                      </p>
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
                  {t("insights.cards.subscriptionCreep")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(subs?.items.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("insights.subscriptions.noCharges")}</p>
                ) : (
                  <div>
                    <p className="text-2xl font-bold">{formatCurrency(subs!.total)}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("insights.subscriptions.chargesDetected", { count: subs!.items.length })}
                    </p>
                    <div className="mt-3 space-y-1">
                      {subs!.items.slice(0, 5).map((s, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-muted-foreground truncate max-w-[60%]">{s.merchant}</span>
                          <span className="font-medium">{formatCurrency(s.amount)}</span>
                        </div>
                      ))}
                      {subs!.items.length > 5 && (
                        <p className="text-xs text-muted-foreground">
                          {t("insights.subscriptions.more", { count: subs!.items.length - 5 })}
                        </p>
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
                  {t("insights.cards.savingsRate")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sr?.income === 0 && (sr?.spent ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("insights.savingsRate.configureSalary")}</p>
                ) : sr?.income === 0 && (sr?.spent ?? 0) > 0 ? (
                  <p className="text-sm text-muted-foreground">{t("insights.savingsRate.spendingExceedsIncome")}</p>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-2xl font-bold">{`${sr?.rate ?? 0}%`}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {sr?.rate != null && sr.rate >= 20
                          ? t("insights.savingsRate.excellent")
                          : sr?.rate != null && sr.rate >= 10
                          ? t("insights.savingsRate.onTrack")
                          : sr?.rate != null && sr.rate >= 0
                          ? t("insights.savingsRate.saving", { rate: sr.rate })
                          : t("insights.savingsRate.spendingExceedsIncome")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("insights.savingsRate.incomeLegend", {
                          income: formatCurrency(sr?.income ?? 0),
                          spent: formatCurrency(sr?.spent ?? 0)
                        })}
                      </p>
                    </div>
                    <div className="w-full sm:w-40 shrink-0">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{t("insights.savingsRate.saved")}</span>
                        <span className="font-medium">{sr?.rate != null ? `${Math.max(0, sr.rate)}%` : "0%"} {t("insights.savingsRate.benchmark")}</span>
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
                  {t("insights.cards.dti")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dti?.income === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("insights.dti.configureIncome")}</p>
                ) : dti?.ratio == null ? (
                  <p className="text-sm text-muted-foreground">{t("insights.dti.noDebtPayments")}</p>
                ) : (
                  <div>
                    <p className="text-2xl font-bold">{dti.ratio}%</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {dti.ratio > 43
                        ? t("insights.dti.high")
                        : dti.ratio > 36
                        ? t("insights.dti.moderate")
                        : dti.ratio > 20
                        ? t("insights.dti.manageable")
                        : t("insights.dti.excellent")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("insights.dti.breakdown", {
                        payment: formatCurrency(dti.monthlyPayment),
                        income: formatCurrency(dti.income)
                      })}
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
                  {t("insights.cards.budgetAdherence")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!ba || ba.total === 0 ? (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("insights.budgetAdherence.noBudgets", { month: formatMonthYear(parseISO(`${month}-01`)) })}
                    </p>
                    <div className="mt-3 opacity-25 pointer-events-none select-none">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{t("insights.budgetAdherence.onTrackLabel")}</span>
                        <span>{t("insights.budgetAdherence.empty")}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full w-0 rounded-full bg-blue-400" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{t("insights.budgetAdherence.emptyPct")}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-2xl font-bold">
                      {ba.onTrack} of {ba.total}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {ba.pct === 100
                        ? t("insights.budgetAdherence.allOnTrack")
                        : ba.onTrack === 0
                        ? t("insights.budgetAdherence.allOverSpent")
                        : t("insights.budgetAdherence.mixed", { onTrack: ba.onTrack, overBudget: ba.overBudget })}
                    </p>
                    <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${baSeverity === "success" ? "bg-emerald-500" : baSeverity === "warning" ? "bg-orange-400" : "bg-blue-400"}`}
                        style={{ width: `${ba.pct ?? 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("insights.budgetAdherence.pctOnTrack", { pct: ba.pct ?? 0 })}
                    </p>
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
            <Sparkles className="w-4 h-4" /> {t("insights.sections.aiAnalysis")}
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
            {t("insights.aiEmpty")}
          </p>
        </div>
      )}
    </div>
  );
}
