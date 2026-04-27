import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, Link, useLocation } from "wouter";
import { useListDebts, useDeleteDebt } from "@workspace/api-client-react";
import { isTrialExpiredError } from "@/lib/trialExpired";
import { useRegion } from "@/hooks/useRegion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, TrendingDown, Clock, Trash2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtMonths, safeNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function computePayoffCurve(
  balance: number,
  payment: number,
  rate: number,
  maxMonths = 1200
): { month: number; balance: number; totalInterest: number }[] {
  const points: { month: number; balance: number; totalInterest: number }[] = [];
  let bal = balance;
  let totalInterest = 0;
  points.push({ month: 0, balance: Math.round(bal * 100) / 100, totalInterest: 0 });
  for (let m = 1; m <= maxMonths; m++) {
    const interestCharged = rate > 0 ? bal * rate : 0;
    totalInterest += interestCharged;
    const principalPaid = Math.min(payment - interestCharged, bal);
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
  accelerated: { month: number; balance: number }[]
): { month: number; standard: number; accelerated: number }[] {
  const maxMonth = Math.max(
    standard[standard.length - 1]?.month ?? 0,
    accelerated[accelerated.length - 1]?.month ?? 0
  );
  const result: { month: number; standard: number; accelerated: number }[] = [];
  const stdMap = new Map(standard.map((p) => [p.month, p.balance]));
  const accMap = new Map(accelerated.map((p) => [p.month, p.balance]));

  for (let m = 0; m <= maxMonth; m++) {
    const stdBal = stdMap.has(m) ? stdMap.get(m)! : m > (standard[standard.length - 1]?.month ?? 0) ? 0 : null;
    const accBal = accMap.has(m) ? accMap.get(m)! : m > (accelerated[accelerated.length - 1]?.month ?? 0) ? 0 : null;
    if (stdBal !== null || accBal !== null) {
      result.push({
        month: m,
        standard: stdBal ?? 0,
        accelerated: accBal ?? 0,
      });
    }
  }
  return result;
}

export default function DebtDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { data: debts, isLoading } = useListDebts();
  const deleteMutation = useDeleteDebt();
  const { formatCurrency, region, decimalStep } = useRegion();

  const debt = debts?.find((d) => d.id === id);

  // Slider-driven extra-payment simulation. Auto-recomputes as user drags.
  const baseBalance = safeNum(debt?.outstandingBalance);
  const basePayment = safeNum(debt?.monthlyPayment);
  const ratePerMonth = debt?.interestRate ? safeNum(debt.interestRate) / 100 / 12 : 0;
  const sliderMax = Math.max(500, Math.round(basePayment * 0.5 / 10) * 10);
  const [extra, setExtra] = useState(0);

  const standardCurve = useMemo(
    () => computePayoffCurve(baseBalance, basePayment, ratePerMonth),
    [baseBalance, basePayment, ratePerMonth]
  );
  const acceleratedCurve = useMemo(
    () => computePayoffCurve(baseBalance, basePayment + extra, ratePerMonth),
    [baseBalance, basePayment, extra, ratePerMonth]
  );
  const baseMonths = standardCurve[standardCurve.length - 1]?.month ?? 0;
  const newMonths = acceleratedCurve[acceleratedCurve.length - 1]?.month ?? 0;
  const monthsSaved = Math.max(0, baseMonths - newMonths);
  const baseTotalInterest = standardCurve[standardCurve.length - 1]?.totalInterest ?? 0;
  const accTotalInterest = acceleratedCurve[acceleratedCurve.length - 1]?.totalInterest ?? 0;
  const interestSaved = Math.max(0, baseTotalInterest - accTotalInterest);
  const chartData = useMemo(
    () => mergeCurves(standardCurve, acceleratedCurve),
    [standardCurve, acceleratedCurve]
  );
  const cannotPayoff = ratePerMonth > 0 && basePayment <= baseBalance * ratePerMonth;
  const scenarioActive = extra > 0 && !cannotPayoff;

  const handleDelete = async () => {
    if (confirm(t("debts.detail.confirmDelete"))) {
      try {
        await deleteMutation.mutateAsync({ id: id! });
        setLocation("/debts");
      } catch (err) {
        if (isTrialExpiredError(err)) setLocation("/premium");
      }
    }
  };

  if (isLoading) return <div className="p-8">{t("debts.loading")}</div>;
  if (!debt) return <div className="p-8">{t("debts.detail.notFound")}</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/debts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          {debt.lender}
        </h1>
        <div className="ml-auto">
          <Button variant="destructive" size="icon" onClick={handleDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("debts.detail.currentStatus")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">{t("debts.detail.outstandingBalance")}</span>
              <span className="font-bold text-lg">
                {formatCurrency(parseFloat(debt.outstandingBalance))}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">{t("debts.detail.monthlyPayment")}</span>
              <span className="font-bold text-lg">
                {formatCurrency(parseFloat(debt.monthlyPayment))}
              </span>
            </div>
            {debt.interestRate && (
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">{t("debts.detail.interestRate")}</span>
                <span className="font-bold text-lg">{debt.interestRate}% p.a.</span>
              </div>
            )}
            {debt.startDate && (
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">{t("debts.detail.startDate")}</span>
                <span className="font-bold text-lg">
                  {(() => {
                    const [y, m] = debt.startDate!.split("-");
                    const d = new Date(parseInt(y), parseInt(m) - 1, 1);
                    return d.toLocaleDateString(region.locale, { year: "numeric", month: "short" });
                  })()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/20 shadow-md">
          <CardHeader className="bg-primary/5 border-b border-primary/10">
            <CardTitle className="text-primary flex items-center gap-2">
              <Sparkles className="w-5 h-5" /> What if I pay extra each month?
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {cannotPayoff && (
              <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
                {t("debts.detail.simulator.payoffWarning")}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Extra /mo</Label>
                <div className="text-sm font-bold tabular-nums">{formatCurrency(extra)}</div>
              </div>
              <input
                type="range"
                min={0}
                max={sliderMax}
                step={10}
                value={extra}
                onChange={(e) => setExtra(Number(e.target.value))}
                className="w-full accent-primary"
                aria-label="Extra monthly payment"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums mt-0.5">
                <span>0</span><span>{formatCurrency(sliderMax)}</span>
              </div>
              <div className="flex gap-1.5 mt-2">
                {[50, 100, 200, 500].filter(v => v <= sliderMax).map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setExtra(v)}
                    className={cn(
                      "flex-1 h-7 rounded-md text-[11px] font-semibold tabular-nums border transition-colors",
                      extra === v
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-white border-border hover:bg-accent/40"
                    )}
                  >
                    +{v}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md bg-accent/40 border p-3">
                <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">Paid off in</div>
                <div className="text-base font-bold tabular-nums mt-0.5">{fmtMonths(newMonths)}</div>
                {monthsSaved > 0 && (
                  <div className="text-[10px] font-semibold text-emerald-700 tabular-nums mt-0.5">
                    −{fmtMonths(monthsSaved)} sooner
                  </div>
                )}
              </div>
              <div className="rounded-md bg-accent/40 border p-3">
                <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">Interest saved</div>
                <div className="text-base font-bold tabular-nums mt-0.5 text-emerald-700">
                  {formatCurrency(interestSaved)}
                </div>
                <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">vs minimum-only</div>
              </div>
            </div>

            {scenarioActive && (
              <div className="pt-3 border-t flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-base text-primary">
                    {t("debts.detail.simulator.monthsSaved", { months: monthsSaved })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("debts.detail.simulator.monthsSavedSub", { amount: formatCurrency(extra) })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-primary" />
            {t("debts.detail.chart.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 24, left: 16, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                label={{
                  value: t("debts.detail.chart.xLabel"),
                  position: "insideBottomRight",
                  offset: -8,
                }}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(v) => formatCurrency(v)}
                tick={{ fontSize: 11 }}
                width={90}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value)]}
                labelFormatter={(label) => t("debts.detail.chart.monthLabel", { n: label })}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="standard"
                name={t("debts.detail.chart.standardPayoff")}
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="accelerated"
                name={t("debts.detail.chart.acceleratedPayoff")}
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground text-center mt-2">
            {t("debts.detail.chart.caption", { currency: region.currency })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
