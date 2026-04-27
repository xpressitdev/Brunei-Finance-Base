import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import {
  useListDebts,
  useCreateDebt,
  useUpdateDebt,
  useGetDebtSchedule,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Wallet, Plus, ArrowRight, Pencil, Lightbulb, PieChart } from "lucide-react";
import { TrialExpiredPrompt } from "@/components/subscription/TrialExpiredPrompt";
import { isTrialExpiredError } from "@/lib/trialExpired";
import { useRegion } from "@/hooks/useRegion";
import { KpiCard } from "@/components/redesign/KpiCard";
import { safeNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function LifetimeProgress({ debtId, currentBalance }: { debtId: string; currentBalance: number }) {
  const { data } = useGetDebtSchedule(debtId);
  const schedule = data?.schedule ?? [];
  if (schedule.length < 2 || currentBalance <= 0) return null;
  const original = schedule[0]?.balance ?? currentBalance;
  if (original <= 0) return null;
  const pct = Math.max(0, Math.min(100, Math.round(((original - currentBalance) / original) * 100)));
  return (
    <div className="mt-2 max-w-md">
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-rose-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">{pct}% paid off over the loan's lifetime</div>
    </div>
  );
}

function DebtTimeline({ debt }: { debt: Debt }) {
  const { t } = useTranslation();
  const { data: scheduleData } = useGetDebtSchedule(debt.id);
  const { formatCurrency, region } = useRegion();
  const schedule = scheduleData?.schedule ?? [];

  if (schedule.length === 0) return null;

  const hasLabels = schedule.some((p) => p.label);
  const displayData = schedule.slice(0, Math.min(schedule.length, 60));

  return (
    <div className="mt-3">
      <div className="text-xs text-muted-foreground mb-1">
        {t("debts.timeline", { months: schedule.length - 1 })}
        {debt.startDate
          ? (() => {
              const [y, mo] = debt.startDate!.split("-");
              const d = new Date(parseInt(y), parseInt(mo) - 1, 1);
              return ` · ${t("debts.timelineStarted", { date: d.toLocaleDateString(region.locale, { month: "short", year: "numeric" }) })}`;
            })()
          : ""}
      </div>
      <ResponsiveContainer width="100%" height={64}>
        <AreaChart data={displayData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${debt.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey={hasLabels ? "label" : "month"}
            tick={{ fontSize: 9 }}
            interval="preserveStartEnd"
            tickFormatter={(v) =>
              hasLabels ? String(v).slice(2) : `M${v}`
            }
          />
          <YAxis hide domain={[0, "auto"]} />
          <Tooltip
            formatter={(v: number) => [formatCurrency(v), "Balance"]}
            labelFormatter={(l) => (hasLabels ? `Period ${l}` : `Month ${l}`)}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="#ef4444"
            strokeWidth={1.5}
            fill={`url(#grad-${debt.id})`}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const EMPTY_FORM = {
  lender: "",
  debtType: "personal_loan",
  outstandingBalance: "",
  monthlyPayment: "",
  interestRate: "",
  startDate: "",
};

export default function Debts() {
  const { t } = useTranslation();
  const { data: debts, isLoading, refetch } = useListDebts();
  const { data: profile } = useGetProfile();
  const createMutation = useCreateDebt();
  const updateMutation = useUpdateDebt();
  const { formatCurrency, region, decimalStep } = useRegion();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [trialExpiredError, setTrialExpiredError] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({
        data: {
          lender: formData.lender,
          debtType: formData.debtType,
          outstandingBalance: formData.outstandingBalance,
          monthlyPayment: formData.monthlyPayment,
          interestRate: formData.interestRate || undefined,
          startDate: formData.startDate || undefined,
        },
      });
      setIsAddOpen(false);
      refetch();
    } catch (err) {
      if (isTrialExpiredError(err)) {
        setTrialExpiredError(true);
      }
    }
    setFormData(EMPTY_FORM);
  };

  const openEdit = (debt: Debt) => {
    setEditingDebt(debt);
    setFormData({
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
          lender: formData.lender,
          debtType: formData.debtType,
          outstandingBalance: formData.outstandingBalance,
          monthlyPayment: formData.monthlyPayment,
          interestRate: formData.interestRate || null,
          startDate: formData.startDate || null,
        },
      });
      setEditingDebt(null);
      refetch();
      setFormData(EMPTY_FORM);
    } catch (err) {
      if (isTrialExpiredError(err)) {
        setTrialExpiredError(true);
      }
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

  const debtForm = (onSubmit: (e: React.FormEvent) => void, isPending: boolean) => (
    <form onSubmit={onSubmit} className="space-y-4">
      {trialExpiredError && (
        <TrialExpiredPrompt action="manage debts" />
      )}
      <div className="space-y-2">
        <Label>{t("debts.addDialog.lenderLabel")}</Label>
        <Input
          value={formData.lender}
          onChange={(e) => setFormData({ ...formData, lender: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>{t("debts.addDialog.balanceLabel", { currency: region.currency })}</Label>
        <Input
          type="number"
          step={decimalStep}
          value={formData.outstandingBalance}
          onChange={(e) =>
            setFormData({ ...formData, outstandingBalance: e.target.value })
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
            value={formData.monthlyPayment}
            onChange={(e) =>
              setFormData({ ...formData, monthlyPayment: e.target.value })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label>{t("debts.addDialog.interestRateLabel")}</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.interestRate}
            onChange={(e) =>
              setFormData({ ...formData, interestRate: e.target.value })
            }
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("debts.addDialog.startDateLabel")}</Label>
        <Input
          type="date"
          value={formData.startDate}
          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">{t("debts.title")}</h1>
          <p className="text-muted-foreground">{t("debts.subtitle")}</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) setTrialExpiredError(false); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> {t("debts.addButton")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("debts.addDialog.title")}</DialogTitle>
            </DialogHeader>
            {debtForm(handleAdd, createMutation.isPending)}
          </DialogContent>
        </Dialog>
      </div>

      <Dialog
        open={!!editingDebt}
        onOpenChange={(open) => {
          if (!open) { setEditingDebt(null); setFormData(EMPTY_FORM); setTrialExpiredError(false); }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("debts.editDialog.title")}</DialogTitle>
          </DialogHeader>
          {debtForm(handleEdit, updateMutation.isPending)}
        </DialogContent>
      </Dialog>

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
              Each loan becomes a card in the <span className="font-semibold">Bank</span> column. The minimum payment is the monthly target you fund from your gaji.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {!debts || debts.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {t("debts.empty")}
          </div>
        ) : (
          <div className="divide-y">
            {debts.map((d) => {
              const balance = safeNum(d.outstandingBalance);
              const minPay = safeNum(d.monthlyPayment);
              return (
                <div key={d.id} className="p-6 hover:bg-muted/30 transition-colors">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <h3 className="font-semibold text-lg truncate">{d.lender}</h3>
                        <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                          {d.debtType?.replace(/_/g, " ") || "loan"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {d.updatedAt
                            ? t("debts.lastUpdated", { time: formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true }) })
                            : t("debts.noActivity")}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-4 tabular-nums">
                        <span>
                          {t("debts.balanceLabel")}{" "}
                          <strong className="text-foreground">{formatCurrency(balance)}</strong>
                        </span>
                        <span>
                          {t("debts.monthlyLabel")}{" "}
                          <strong className="text-foreground">{formatCurrency(minPay)}</strong>
                        </span>
                        {d.interestRate && (
                          <span>
                            {t("debts.rateLabel")}{" "}
                            <strong className="text-foreground">{d.interestRate}%</strong>
                          </span>
                        )}
                      </div>
                      <LifetimeProgress
                        debtId={d.id}
                        currentBalance={balance}
                      />
                      <DebtTimeline debt={d} />
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(d)}
                        title="Edit debt"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Link href={`/debts/${d.id}`}>
                        <Button variant="outline" className="w-full sm:w-auto">
                          {t("debts.simulatePayoff")} <ArrowRight className="ml-2 w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
