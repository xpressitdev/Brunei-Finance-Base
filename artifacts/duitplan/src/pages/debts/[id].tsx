import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, Link, useLocation } from "wouter";
import { useListDebts, useDeleteDebt } from "@workspace/api-client-react";
import { isTrialExpiredError } from "@/lib/trialExpired";
import { useRegion } from "@/hooks/useRegion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, TrendingDown, Clock, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
): { month: number; balance: number; totalInterest: number } {
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

  const [extraPayment, setExtraPayment] = useState("");
  const [scenario, setScenario] = useState<{
    extraMonthlyPayment: string;
    basePayoffMonths: number;
    newPayoffMonths: number;
    estimatedMonthsSaved: number;
    totalInterestSaved: number;
    chartData: { month: number; standard: number; accelerated: number }[];
  } | null>(null);

  const debt = debts?.find((d) => d.id === id);

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!debt || !extraPayment) return;

    const balance = parseFloat(debt.outstandingBalance);
    const basePayment = parseFloat(debt.monthlyPayment);
    const extra = parseFloat(extraPayment);
    const rate = debt.interestRate ? parseFloat(debt.interestRate) / 100 / 12 : 0;

    if (rate > 0 && basePayment <= balance * rate) {
      alert(t("debts.detail.simulator.payoffWarning"));
      return;
    }

    const standardCurve = computePayoffCurve(balance, basePayment, rate);
    const acceleratedCurve = computePayoffCurve(balance, basePayment + extra, rate);

    const baseMonths = standardCurve[standardCurve.length - 1]?.month ?? 0;
    const newMonths = acceleratedCurve[acceleratedCurve.length - 1]?.month ?? 0;
    const monthsSaved = Math.max(0, baseMonths - newMonths);

    const baseTotalInterest = standardCurve[standardCurve.length - 1]?.totalInterest ?? 0;
    const accTotalInterest = acceleratedCurve[acceleratedCurve.length - 1]?.totalInterest ?? 0;
    const interestSaved = Math.max(0, baseTotalInterest - accTotalInterest);

    const chartData = mergeCurves(standardCurve, acceleratedCurve);

    setScenario({
      extraMonthlyPayment: extraPayment,
      basePayoffMonths: baseMonths,
      newPayoffMonths: newMonths,
      estimatedMonthsSaved: monthsSaved,
      totalInterestSaved: parseFloat(interestSaved.toFixed(2)),
      chartData,
    });
  };

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
              <TrendingDown className="w-5 h-5" /> {t("debts.detail.simulator.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSimulate} className="space-y-4">
              <div className="space-y-2">
                <Label>{t("debts.detail.simulator.extraPaymentLabel", { currency: region.currency })}</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step={decimalStep}
                    min={decimalStep}
                    placeholder={decimalStep === "1" ? "e.g. 50" : "e.g. 50.00"}
                    value={extraPayment}
                    onChange={(e) => setExtraPayment(e.target.value)}
                    required
                  />
                  <Button type="submit">{t("debts.detail.simulator.simulate")}</Button>
                </div>
              </div>
            </form>

            {scenario && (
              <div className="mt-6 space-y-3 p-4 bg-muted/40 rounded-xl border">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">
                    {t("debts.detail.simulator.originalTimeline")}
                  </span>
                  <span className="font-bold">{scenario.basePayoffMonths} months</span>
                </div>
                <div className="flex justify-between items-center text-primary">
                  <span className="text-sm font-medium">{t("debts.detail.simulator.newTimeline")}</span>
                  <span className="font-bold">{scenario.newPayoffMonths} months</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">
                    {t("debts.detail.simulator.interestSaved")}
                  </span>
                  <span className="font-bold text-green-600">
                    {formatCurrency(scenario.totalInterestSaved)}
                  </span>
                </div>
                <div className="pt-3 border-t flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-lg text-primary">
                      {t("debts.detail.simulator.monthsSaved", { months: scenario.estimatedMonthsSaved })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("debts.detail.simulator.monthsSavedSub", { amount: formatCurrency(parseFloat(scenario.extraMonthlyPayment)) })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {scenario && (
        <Card>
          <CardHeader>
            <CardTitle>{t("debts.detail.chart.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart
                data={scenario.chartData}
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
      )}
    </div>
  );
}
