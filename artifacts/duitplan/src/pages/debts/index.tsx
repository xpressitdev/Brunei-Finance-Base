import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Link, useLocation } from "wouter";
import {
  useListDebts,
  useCreateDebt,
  useUpdateDebt,
  useGetDebtSchedule,
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
import { Wallet, Plus, ArrowRight, Pencil } from "lucide-react";
import { TrialExpiredPrompt } from "@/components/subscription/TrialExpiredPrompt";
import { isTrialExpiredError } from "@/lib/trialExpired";
import { useRegion } from "@/hooks/useRegion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function DebtTimeline({ debt }: { debt: Debt }) {
  const { data: scheduleData } = useGetDebtSchedule(debt.id);
  const { formatCurrency, region } = useRegion();
  const schedule = scheduleData?.schedule ?? [];

  if (schedule.length === 0) return null;

  const hasLabels = schedule.some((p) => p.label);
  const displayData = schedule.slice(0, Math.min(schedule.length, 60));

  return (
    <div className="mt-3">
      <div className="text-xs text-muted-foreground mb-1">
        Balance timeline — {schedule.length - 1} months to payoff
        {debt.startDate
          ? (() => {
              const [y, mo] = debt.startDate!.split("-");
              const d = new Date(parseInt(y), parseInt(mo) - 1, 1);
              return ` · started ${d.toLocaleDateString(region.locale, { month: "short", year: "numeric" })}`;
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
  const { data: debts, isLoading, refetch } = useListDebts();
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
    debts?.reduce((acc, curr) => acc + parseFloat(curr.outstandingBalance), 0) || 0;
  const totalMonthly =
    debts?.reduce((acc, curr) => acc + parseFloat(curr.monthlyPayment), 0) || 0;

  if (isLoading) return <div className="p-8">Loading...</div>;

  const debtForm = (onSubmit: (e: React.FormEvent) => void, isPending: boolean) => (
    <form onSubmit={onSubmit} className="space-y-4">
      {trialExpiredError && (
        <TrialExpiredPrompt action="manage debts" />
      )}
      <div className="space-y-2">
        <Label>Lender / Bank Name</Label>
        <Input
          value={formData.lender}
          onChange={(e) => setFormData({ ...formData, lender: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Outstanding Balance ({region.currency})</Label>
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
          <Label>Monthly Payment ({region.currency})</Label>
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
          <Label>Interest Rate (% p.a.)</Label>
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
        <Label>Debt Start Date</Label>
        <Input
          type="date"
          value={formData.startDate}
          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Saving..." : "Save"}
      </Button>
    </form>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Debts</h1>
          <p className="text-muted-foreground">Track your loans and plan payoffs.</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) setTrialExpiredError(false); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Add Debt
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Debt</DialogTitle>
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
            <DialogTitle>Edit Debt</DialogTitle>
          </DialogHeader>
          {debtForm(handleEdit, updateMutation.isPending)}
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Total Outstanding</div>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(totalBalance)}
            </div>
          </div>
        </div>
        <div className="bg-white border rounded-xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-600">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              Total Monthly Payment
            </div>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(totalMonthly)}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {!debts || debts.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            No debts added yet.
          </div>
        ) : (
          <div className="divide-y">
            {debts.map((d) => (
              <div key={d.id} className="p-6 hover:bg-muted/30 transition-colors">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3">
                      <h3 className="font-semibold text-lg">{d.lender}</h3>
                      <span className="text-xs text-muted-foreground">
                        {d.updatedAt
                          ? `Last updated ${formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true })}`
                          : "No activity yet"}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-4">
                      <span>
                        Balance:{" "}
                        <strong className="text-foreground">
                          {formatCurrency(parseFloat(d.outstandingBalance))}
                        </strong>
                      </span>
                      <span>
                        Monthly:{" "}
                        <strong className="text-foreground">
                          {formatCurrency(parseFloat(d.monthlyPayment))}
                        </strong>
                      </span>
                      {d.interestRate && (
                        <span>
                          Rate:{" "}
                          <strong className="text-foreground">{d.interestRate}%</strong>
                        </span>
                      )}
                    </div>
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
                        Simulate Payoff <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
