import { useState } from "react";
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

const ACCOUNT_TYPES = [
  { value: "cash", label: "Cash in Hand", icon: Wallet, color: "bg-emerald-100 text-emerald-800" },
  { value: "savings", label: "Savings Account", icon: PiggyBank, color: "bg-blue-100 text-blue-800" },
  { value: "current", label: "Current Account", icon: Building2, color: "bg-purple-100 text-purple-800" },
  { value: "investment", label: "Investment", icon: TrendingUp, color: "bg-amber-100 text-amber-800" },
  { value: "fixed_deposit", label: "Fixed Deposit", icon: Lock, color: "bg-rose-100 text-rose-800" },
  { value: "other", label: "Other", icon: Landmark, color: "bg-gray-100 text-gray-800" },
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
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

function getTypeInfo(type: string) {
  return ACCOUNT_TYPES.find(t => t.value === type) ?? ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1];
}

function fmt(val: string | number) {
  return `BND ${Number(val || 0).toLocaleString("en-BN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtShort(val: number) {
  if (Math.abs(val) >= 1000) {
    return `${(val / 1000).toFixed(1)}k`;
  }
  return val.toFixed(0);
}

function fmtDate(dateStr: string, days: number) {
  const d = new Date(dateStr + "T00:00:00");
  if (days <= 7) {
    return d.toLocaleDateString("en-BN", { weekday: "short" });
  }
  if (days <= 30) {
    return d.toLocaleDateString("en-BN", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-BN", { month: "short", day: "numeric" });
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
  const [form, setForm] = useState<FormState>(initial);
  const set = (k: keyof FormState, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Account name</Label>
        <Input
          value={form.name}
          onChange={e => set("name", e.target.value)}
          placeholder="e.g. BIBD Savings, Cash Wallet"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label>Account type</Label>
        <Select value={form.type} onValueChange={v => set("type", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACCOUNT_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Bank / Institution</Label>
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
        <Label>Current balance (BND)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">BND</span>
          <Input
            type="number"
            step="0.01"
            min="0"
            className="pl-14 text-right font-mono"
            value={form.balance}
            onChange={e => set("balance", e.target.value)}
            onFocus={e => e.target.select()}
            placeholder="e.g. 5000.00"
          />
        </div>
        <p className="text-xs text-muted-foreground">Enter the current amount in your account today.</p>
      </div>

      <DialogFooter className="pt-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button
          onClick={() => onSave(form)}
          disabled={saving || !form.name.trim()}
        >
          {saving ? "Saving…" : "Save Account"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function BalanceHistoryChart({ account }: { account: Account }) {
  const [days, setDays] = useState(30);
  const { data: history = [], isLoading } = useGetAccountBalanceHistory(account.id, { days });

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
          Daily balance snapshots derived from transaction history
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
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-56 flex items-center justify-center">
          <div className="text-muted-foreground text-sm animate-pulse">Loading chart…</div>
        </div>
      ) : history.length === 0 ? (
        <div className="h-56 flex items-center justify-center rounded-xl border-2 border-dashed border-muted">
          <p className="text-sm text-muted-foreground">No data available</p>
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
                formatter={(value: number) => [fmt(value), "Balance"]}
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
          Lowest: <span className="font-medium text-foreground">{fmt(minBal)}</span>
        </span>
        <span>
          Highest: <span className="font-medium text-foreground">{fmt(maxBal)}</span>
        </span>
        <span>
          Current: <span className="font-semibold text-foreground">{fmt(account.balance)}</span>
        </span>
      </div>
    </div>
  );
}

export default function Accounts() {
  const qc = useQueryClient();
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground">Track your actual cash across all accounts and wallets.</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Add Account
        </Button>
      </div>

      {/* Total balance summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
          <CardTitle className="text-xs font-medium text-primary uppercase tracking-wider">Total Balance</CardTitle>
          <Building2 className="w-4 h-4 text-primary" />
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="text-3xl font-bold text-primary">{fmt(totalBalance)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {accounts.length === 0
              ? "No accounts yet"
              : `Across ${accounts.length} account${accounts.length !== 1 ? "s" : ""}`}
          </p>
        </CardContent>
      </Card>

      {/* Account cards */}
      {accounts.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-muted py-16 text-center">
          <div className="text-5xl mb-4">🏦</div>
          <p className="font-semibold text-lg text-foreground mb-1">No accounts yet</p>
          <p className="text-sm text-muted-foreground mb-6">
            Add your bank accounts, savings, and cash wallets to track your actual balance.
          </p>
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Add your first account
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map(account => {
            const typeInfo = getTypeInfo(account.type);
            const Icon = typeInfo.icon;
            return (
              <Card key={account.id} className="shadow-sm border-muted group relative">
                <CardContent className="p-5 flex flex-col gap-4">
                  {/* Top row: icon + name + badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", typeInfo.color)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm leading-tight">{account.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{account.bankName ?? "—"}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className={cn("text-xs shrink-0", typeInfo.color)}>
                      {typeInfo.label}
                    </Badge>
                  </div>

                  {/* Balance */}
                  <div className="text-2xl font-bold">{fmt(account.balance)}</div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1 border-t">
                    <Link href="/upload" className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                        <Upload className="w-3 h-3" /> Import Statement
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      title="Balance history"
                      onClick={() => setHistoryAccount(account)}
                    >
                      <BarChart2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setEditAccount(account)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteAccount(account)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Balance history dialog */}
      <Dialog open={!!historyAccount} onOpenChange={open => { if (!open) setHistoryAccount(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              Balance History — {historyAccount?.name}
            </DialogTitle>
          </DialogHeader>
          {historyAccount && <BalanceHistoryChart account={historyAccount} />}
        </DialogContent>
      </Dialog>

      {/* Add account dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Account</DialogTitle>
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
            <DialogTitle>Edit Account</DialogTitle>
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
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteAccount?.name}</strong>?
              This will not delete any transactions linked to this account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
