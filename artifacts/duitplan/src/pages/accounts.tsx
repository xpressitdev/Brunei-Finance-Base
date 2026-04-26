import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useListAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount, useGetAccountBalanceHistory } from "@workspace/api-client-react";
import type { Account } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Building2, Plus, Pencil, Trash2, Upload, Wallet, PiggyBank, Landmark, TrendingUp, Lock, BarChart2 } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useRegion } from "@/hooks/useRegion";

const ACCOUNT_TYPES = [
  { value: "cash", icon: Wallet, color: "bg-emerald-100 text-emerald-800" },
  { value: "savings", icon: PiggyBank, color: "bg-blue-100 text-blue-800" },
  { value: "current", icon: Building2, color: "bg-purple-100 text-purple-800" },
  { value: "investment", icon: TrendingUp, color: "bg-amber-100 text-amber-800" },
  { value: "fixed_deposit", icon: Lock, color: "bg-rose-100 text-rose-800" },
  { value: "other", icon: Landmark, color: "bg-gray-100 text-gray-800" },
];

const BANKS = [
  "BIBD",
  "Baiduri Bank",
  "Standard Chartered",
  "Citibank",
  "HSBC",
  "Other",
];

const PERIOD_OPTIONS = [
  { value: 7 },
  { value: 30 },
  { value: 90 },
];

function getTypeInfo(type: string) {
  return ACCOUNT_TYPES.find(t => t.value === type) ?? ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1];
}

function fmtShort(val: number) {
  if (Math.abs(val) >= 1000) {
    return `${(val / 1000).toFixed(1)}k`;
  }
  return val.toFixed(0);
}

type FormState = {
  name: string;
  type: string;
  bankName: string;
  balance: string;
};

const EMPTY_FORM: FormState = { name: "", type: "savings", bankName: "BIBD", balance: "" };

function AccountForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormState;
  onSave: (data: FormState) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(initial);
  const { region, decimalStep } = useRegion();
  const set = (k: keyof FormState, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t("accounts.addDialog.nameLabel")}</Label>
        <Input
          value={form.name}
          onChange={e => set("name", e.target.value)}
          placeholder={t("accounts.addDialog.namePlaceholder")}
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label>{t("accounts.addDialog.typeLabel")}</Label>
        <Select value={form.type} onValueChange={v => set("type", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACCOUNT_TYPES.map(typeOpt => (
              <SelectItem key={typeOpt.value} value={typeOpt.value}>
                {t(`accounts.types.${typeOpt.value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>{t("accounts.addDialog.bankLabel")}</Label>
        <Select value={form.bankName} onValueChange={v => set("bankName", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BANKS.map(b => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>{t("accounts.addDialog.balanceLabel", { currency: region.currency })}</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">{region.currency}</span>
          <Input
            type="number"
            step={decimalStep}
            min="0"
            className="pl-14 text-right font-mono"
            value={form.balance}
            onChange={e => set("balance", e.target.value)}
            onFocus={e => e.target.select()}
            placeholder={decimalStep === "1" ? "e.g. 5000" : "e.g. 5000.00"}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t("accounts.addDialog.balanceHint")}</p>
      </div>

      <DialogFooter className="pt-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>{t("common.cancel")}</Button>
        <Button
          onClick={() => onSave(form)}
          disabled={saving || !form.name.trim()}
        >
          {saving ? t("common.saving") : t("accounts.addDialog.save")}
        </Button>
      </DialogFooter>
    </div>
  );
}

function BalanceHistoryChart({ account }: { account: Account }) {
  const { t } = useTranslation();
  const [days, setDays] = useState(30);
  const { formatCurrency, region } = useRegion();
  const { data: history = [], isLoading } = useGetAccountBalanceHistory(account.id, { days });

  function fmtDate(dateStr: string, periodDays: number) {
    const d = new Date(dateStr + "T00:00:00");
    if (periodDays <= 7) {
      return d.toLocaleDateString(region.locale, { weekday: "short" });
    }
    return d.toLocaleDateString(region.locale, { month: "short", day: "numeric" });
  }

  const minBal = history.length > 0 ? Math.min(...history.map(p => p.balance)) : 0;
  const maxBal = history.length > 0 ? Math.max(...history.map(p => p.balance)) : 0;
  const padding = (maxBal - minBal) * 0.1 || 100;
  const yMin = Math.floor((minBal - padding) / 100) * 100;
  const yMax = Math.ceil((maxBal + padding) / 100) * 100;

  const chartData = history.map(p => ({
    date: p.date,
    balance: p.balance,
    label: fmtDate(p.date, days),
  }));

  const tickInterval = days <= 7 ? 0 : days <= 30 ? 4 : 14;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("accounts.history.subtitle")}
        </p>
        <div className="flex gap-1">
          {PERIOD_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              variant={days === opt.value ? "default" : "outline"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setDays(opt.value)}
            >
              {t(`accounts.periods.${opt.value}`)}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-56 flex items-center justify-center">
          <div className="text-muted-foreground text-sm animate-pulse">{t("accounts.history.loading")}</div>
        </div>
      ) : history.length === 0 ? (
        <div className="h-56 flex items-center justify-center rounded-xl border-2 border-dashed border-muted">
          <p className="text-sm text-muted-foreground">{t("accounts.history.noData")}</p>
        </div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                interval={tickInterval}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[yMin, yMax]}
                tickFormatter={fmtShort}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={42}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), "Balance"]}
                labelFormatter={(label) => `Date: ${label}`}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex justify-between text-xs text-muted-foreground border-t pt-3">
        <span>
          {t("accounts.history.lowest")}: <span className="font-medium text-foreground">{formatCurrency(minBal)}</span>
        </span>
        <span>
          {t("accounts.history.highest")}: <span className="font-medium text-foreground">{formatCurrency(maxBal)}</span>
        </span>
        <span>
          {t("accounts.history.current")}: <span className="font-semibold text-foreground">{formatCurrency(account.balance)}</span>
        </span>
      </div>
    </div>
  );
}

export default function Accounts() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { formatCurrency } = useRegion();
  const { data: accounts = [], isLoading } = useListAccounts();
  const createMut = useCreateAccount();
  const updateMut = useUpdateAccount();
  const deleteMut = useDeleteAccount();

  const [addOpen, setAddOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<Account | null>(null);
  const [historyAccount, setHistoryAccount] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/accounts"] });

  const totalBalance = accounts.reduce((s, a) => s + parseFloat(a.balance ?? "0"), 0);
  const assets      = accounts.filter(a => parseFloat(a.balance ?? "0") >= 0).reduce((s, a) => s + parseFloat(a.balance ?? "0"), 0);
  const liabilities = accounts.filter(a => parseFloat(a.balance ?? "0") < 0).reduce((s, a) => s + Math.abs(parseFloat(a.balance ?? "0")), 0);
  const netWorth    = assets - liabilities;

  function safeBalance(raw: string): string {
    const n = parseFloat(raw);
    return isNaN(n) ? "0.00" : n.toFixed(2);
  }

  async function handleCreate(form: FormState) {
    setSaving(true);
    try {
      await createMut.mutateAsync({
        data: {
          name: form.name.trim(),
          type: form.type,
          bankName: form.bankName || null,
          balance: safeBalance(form.balance),
        },
      });
      await invalidate();
      setAddOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(form: FormState) {
    if (!editAccount) return;
    setSaving(true);
    try {
      await updateMut.mutateAsync({
        id: editAccount.id,
        data: {
          name: form.name.trim(),
          type: form.type,
          bankName: form.bankName || null,
          balance: safeBalance(form.balance),
        },
      });
      await invalidate();
      setEditAccount(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteAccount) return;
    await deleteMut.mutateAsync({ id: deleteAccount.id });
    await invalidate();
    setDeleteAccount(null);
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-muted rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-36 bg-muted rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const BANK_COLORS: Record<string, string> = {
    "BIBD": "#15a06e",
    "Baiduri Bank": "#1e3a5f",
    "Standard Chartered": "#0070f3",
    "Citibank": "#003b7a",
    "HSBC": "#c41230",
    "Other": "#475569",
  };
  const bankColor = (a: Account) => {
    if (a.type === "cash") return null;
    return BANK_COLORS[a.bankName ?? ""] ?? "#475569";
  };
  const assetAccounts = accounts.filter(a => parseFloat(a.balance ?? "0") >= 0);
  const totalAssetForComposition = assetAccounts.reduce((s, a) => s + parseFloat(a.balance ?? "0"), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("accounts.title")}</h1>
          <p className="text-muted-foreground">Your money, across every bank, card, and wallet.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/upload">
            <Button variant="outline" className="gap-2 bg-white">
              <Upload className="w-4 h-4" /> Import statement
            </Button>
          </Link>
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Link account
          </Button>
        </div>
      </div>

      {/* Net Worth hero strip */}
      <Card className="border-primary/20 bg-primary/5 overflow-hidden">
        <CardContent className="p-6">
          <div className="grid md:grid-cols-3 gap-6 items-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Net Worth</p>
              <div className="text-4xl font-bold text-primary mt-1 tabular-nums">{formatCurrency(netWorth)}</div>
              <p className="text-xs text-muted-foreground mt-1.5">
                across {accounts.length} account{accounts.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Assets</p>
                <div className="text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">{formatCurrency(assets)}</div>
                <p className="text-[11px] text-muted-foreground">{assetAccounts.length} accounts</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Liabilities</p>
                <div className="text-xl font-bold text-rose-600 mt-0.5 tabular-nums">{formatCurrency(liabilities)}</div>
                <p className="text-[11px] text-muted-foreground">{accounts.length - assetAccounts.length} accounts</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Composition</p>
              <div className="flex h-2.5 rounded-full overflow-hidden shadow-inner bg-muted">
                {assetAccounts.map(a => {
                  const pct = totalAssetForComposition > 0 ? (parseFloat(a.balance ?? "0") / totalAssetForComposition) * 100 : 0;
                  const color = bankColor(a) ?? "#94a3b8";
                  return <div key={a.id} className="h-full" style={{ width: `${pct}%`, background: color }} title={a.name} />;
                })}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {assetAccounts.map(a => (
                  <div key={a.id} className="flex items-center gap-1.5 text-[11px]">
                    <span className="w-2 h-2 rounded-sm" style={{ background: bankColor(a) ?? "#94a3b8" }} />
                    <span className="text-muted-foreground">{a.bankName ?? a.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold tracking-tight">Your accounts</h2>
          <span className="text-xs text-muted-foreground">{accounts.length} linked</span>
        </div>
        {accounts.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-muted py-16 text-center">
            <div className="text-5xl mb-4">🏦</div>
            <p className="font-semibold text-lg text-foreground mb-1">{t("accounts.noAccounts")}</p>
            <p className="text-sm text-muted-foreground mb-6">{t("accounts.noAccountsSub")}</p>
            <Button onClick={() => setAddOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> {t("accounts.addFirstAccount")}
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {accounts.map(account => {
              const typeInfo   = getTypeInfo(account.type);
              const Icon       = typeInfo.icon;
              const cardColor  = bankColor(account);
              const isCredit   = account.type === "credit";
              const isCash     = account.type === "cash";
              const bal        = parseFloat(account.balance ?? "0");
              const utilPct    = 0; // creditLimit not tracked in schema yet

              return (
                <div
                  key={account.id}
                  className={cn(
                    "relative rounded-2xl overflow-hidden p-5 shadow-sm group",
                    "transition-all hover:shadow-md",
                  )}
                  style={{
                    background: isCash
                      ? "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)"
                      : cardColor
                      ? `linear-gradient(135deg, ${cardColor} 0%, ${cardColor}dd 60%, ${cardColor}99 100%)`
                      : "linear-gradient(135deg, #475569 0%, #334155 100%)",
                    color: isCash ? "hsl(var(--foreground))" : "white",
                    minHeight: 170,
                  }}
                >
                  {/* dot pattern overlay */}
                  <div className="absolute inset-0 opacity-[.05] pointer-events-none"
                    style={{ backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)", backgroundSize: "12px 12px" }} />

                  <div className="relative flex flex-col h-full justify-between gap-4">
                    {/* Top */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className={cn("text-[10px] font-bold uppercase tracking-[0.18em]", isCash ? "text-muted-foreground" : "opacity-70")}>
                          {account.bankName ?? "—"}
                        </div>
                        <div className={cn("text-sm font-semibold mt-0.5", isCash ? "" : "")}>{account.name}</div>
                      </div>
                      <div className={isCash ? "text-muted-foreground" : "opacity-80"}>
                        <Icon className="w-7 h-7" />
                      </div>
                    </div>

                    {/* Balance */}
                    <div>
                      <div className={cn("text-[10px] uppercase tracking-wider font-semibold", isCash ? "text-muted-foreground" : "opacity-70")}>
                        {isCredit ? "Outstanding" : "Balance"}
                      </div>
                      <div className={cn("text-2xl font-bold tabular-nums mt-0.5", isCredit && !isCash ? "text-rose-200" : "")}>
                        {formatCurrency(Math.abs(bal))}
                      </div>
                      {isCredit && utilPct > 0 && (
                        <div className="mt-1.5">
                          <div className={cn("h-1 rounded-full overflow-hidden w-32", isCash ? "bg-muted" : "bg-white/20")}>
                            <div className={cn("h-full rounded-full", isCash ? "bg-primary" : "bg-white/80")} style={{ width: `${utilPct}%` }} />
                          </div>
                          <div className={cn("text-[10px] mt-1 tabular-nums", isCash ? "text-muted-foreground" : "opacity-80")}>
                            {Math.round(utilPct)}% utilised
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hover action row */}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded-b-2xl">
                    <button
                      className="h-7 w-7 rounded flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20"
                      title="Balance history"
                      onClick={() => setHistoryAccount(account)}
                    >
                      <BarChart2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="h-7 w-7 rounded flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20"
                      onClick={() => setEditAccount(account)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="h-7 w-7 rounded flex items-center justify-center text-white/80 hover:text-rose-300 hover:bg-white/20"
                      onClick={() => setDeleteAccount(account)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Link another account */}
            <button
              onClick={() => setAddOpen(true)}
              className="rounded-2xl border-2 border-dashed border-muted p-5 min-h-[170px]
                         flex flex-col items-center justify-center gap-2 text-muted-foreground
                         hover:border-primary hover:text-primary hover:bg-primary/5
                         transition-colors group"
            >
              <Plus className="w-5 h-5" />
              <div className="text-sm font-semibold">Link another account</div>
              <div className="text-[11px]">BIBD · Baiduri · Standard Chartered · HSBC</div>
            </button>
          </div>
        )}
      </div>

      {/* Balance history dialog */}
      <Dialog open={!!historyAccount} onOpenChange={open => { if (!open) setHistoryAccount(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              {t("accounts.history.dialogTitle", { name: historyAccount?.name })}
            </DialogTitle>
          </DialogHeader>
          {historyAccount && <BalanceHistoryChart account={historyAccount} />}
        </DialogContent>
      </Dialog>

      {/* Add account dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("accounts.addDialog.title")}</DialogTitle>
          </DialogHeader>
          <AccountForm
            initial={EMPTY_FORM}
            onSave={handleCreate}
            onCancel={() => setAddOpen(false)}
            saving={saving}
          />
        </DialogContent>
      </Dialog>

      {/* Edit account dialog */}
      <Dialog open={!!editAccount} onOpenChange={open => { if (!open) setEditAccount(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("accounts.editDialog.title")}</DialogTitle>
          </DialogHeader>
          {editAccount && (
            <AccountForm
              initial={{
                name: editAccount.name,
                type: editAccount.type,
                bankName: editAccount.bankName ?? "BIBD",
                balance: parseFloat(editAccount.balance ?? "0").toFixed(2),
              }}
              onSave={handleUpdate}
              onCancel={() => setEditAccount(null)}
              saving={saving}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteAccount} onOpenChange={open => { if (!open) setDeleteAccount(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("accounts.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("accounts.deleteDialog.description", { name: deleteAccount?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              {t("accounts.deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
