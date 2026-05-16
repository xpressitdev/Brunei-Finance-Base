import { useState, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { format, getDaysInMonth, startOfMonth, getDay } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListTransactions, 
  useListCategories,
  useListAccounts,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  useGetProfile,
  getListAccountsQueryKey,
  getListBudgetsQueryKey,
  getListTransactionsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetSpendingByCategoryQueryKey,
  getGetRecentTransactionsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Search, Receipt, TrendingUp, TrendingDown, Pencil, Info } from "lucide-react";
import { TrialExpiredPrompt } from "@/components/subscription/TrialExpiredPrompt";
import { isTrialExpiredError } from "@/lib/trialExpired";
import { useRegion } from "@/hooks/useRegion";

type TransactionItem = {
  id: string;
  date: string;
  amount: string | number;
  type: string;
  description: string;
  categoryId?: string | null;
  categoryName?: string | null;
  accountId?: string | null;
};

export default function Transactions() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { formatCurrency, formatDate, formatMonthYear, region, decimalStep } = useRegion();
  const searchString = useSearch();
  const queryMonth = new URLSearchParams(searchString).get("month");
  const [month, setMonth] = useState(queryMonth && /^\d{4}-\d{2}$/.test(queryMonth) ? queryMonth : "");
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionItem | null>(null);
  const [trialExpiredError, setTrialExpiredError] = useState(false);
  const [editTrialExpiredError, setEditTrialExpiredError] = useState(false);

  const listParams = { 
    ...(month ? { month } : {}), 
    ...(search ? { search } : {}),
    ...(accountFilter ? { accountId: accountFilter } : {}),
    ...(typeFilter ? { type: typeFilter } : {}),
  };
  const currentMonthStr = format(new Date(), "yyyy-MM");
  const { data: transactions, isLoading, refetch } = useListTransactions(listParams);
  const { data: currentMonthTxs } = useListTransactions({ month: currentMonthStr });
  const { data: categories } = useListCategories();
  const { data: accounts } = useListAccounts();
  const { data: profile } = useGetProfile();

  // Heatmap & stats derived from current month's transactions
  const heatmapData = useMemo(() => {
    if (!currentMonthTxs?.length) return { monthSpend: {} as Record<number, number>, income: 0, spent: 0, topMerchants: [] as { merchant: string; total: number; count: number }[] };
    const monthSpend: Record<number, number> = {};
    let income = 0, spent = 0;
    const merchantTotals: Record<string, { total: number; count: number }> = {};
    for (const tx of currentMonthTxs) {
      const day = parseInt(tx.date.split("-")[2]);
      const amt = Number(tx.amount);
      if (tx.type === "debit") {
        monthSpend[day] = (monthSpend[day] || 0) + amt;
        spent += amt;
        const key = tx.description || "Unknown";
        if (!merchantTotals[key]) merchantTotals[key] = { total: 0, count: 0 };
        merchantTotals[key].total += amt;
        merchantTotals[key].count += 1;
      } else {
        income += amt;
      }
    }
    const topMerchants = Object.entries(merchantTotals)
      .map(([merchant, d]) => ({ merchant, ...d }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    return { monthSpend, income, spent, topMerchants };
  }, [currentMonthTxs]);

  const { monthSpend, income: hmIncome, spent: hmSpent, topMerchants } = heatmapData;
  const hmNet = hmIncome - hmSpent;
  const daysInMonth = getDaysInMonth(new Date());
  const maxDaySpend = Math.max(...Object.values(monthSpend), 1);
  const avgPerDay = daysInMonth > 0 ? hmSpent / daysInMonth : 0;
  const noSpendDays = daysInMonth - Object.keys(monthSpend).length;
  const activeDays = Object.keys(monthSpend).length;
  const highestDay = Math.max(...Object.values(monthSpend), 0);
  const firstDow = getDay(startOfMonth(new Date())); // 0=Sun

  const [catFilter, setCatFilter] = useState<string | null>(null);
  const categoryStats = useMemo(() => {
    if (!currentMonthTxs?.length) return [] as { name: string; total: number; color: string }[];
    const totals: Record<string, number> = {};
    for (const tx of currentMonthTxs) {
      if (tx.type === "debit") {
        const cat = tx.categoryName || "Uncategorized";
        totals[cat] = (totals[cat] || 0) + Number(tx.amount);
      }
    }
    const CAT_COLORS: Record<string, string> = { Loan: "#15a06e", Housing: "#0ea5e9", Family: "#f59e0b", Groceries: "#ef4444", "Eating out": "#8b5cf6", Insurance: "#06b6d4", Transport: "#84cc16", Utilities: "#f97316", Health: "#14b8a6", Uncategorized: "#94a3b8" };
    return Object.entries(totals).map(([name, total]) => ({ name, total, color: CAT_COLORS[name] ?? "#64748b" })).sort((a, b) => b.total - a.total);
  }, [currentMonthTxs]);
  const maxCatTotal = categoryStats[0]?.total || 1;

  const heatColor = (amount: number) => {
    if (!amount) return "bg-accent";
    const t = amount / maxDaySpend;
    if (t > 0.75) return "bg-[hsl(162,70%,30%)] text-white";
    if (t > 0.5)  return "bg-[hsl(162,60%,42%)] text-white";
    if (t > 0.25) return "bg-[hsl(162,55%,70%)] text-emerald-900";
    return "bg-[hsl(162,55%,88%)] text-emerald-900";
  };
  
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();

  // Invalidate budget/dashboard caches so envelope `spent`, dashboard KPIs and
  // spending-by-category update live whenever a transaction is created/edited/deleted.
  // The list-transactions key is invalidated WITHOUT params so every variant
  // (filtered list, current-month KPI feed, top-merchants feed) refetches —
  // calling refetch() on the filtered hook alone leaves the other variants stale.
  const invalidateRelated = () => {
    queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListBudgetsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetSpendingByCategoryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetRecentTransactionsQueryKey() });
  };

  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    amount: "",
    type: "debit",
    description: "",
    categoryId: "",
    accountId: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  const [editData, setEditData] = useState({
    date: "",
    amount: "",
    type: "debit",
    description: "",
    categoryId: "",
    accountId: "",
  });
  const [editError, setEditError] = useState<string | null>(null);

  const openEdit = (tx: TransactionItem) => {
    setEditingTx(tx);
    setEditTrialExpiredError(false);
    setEditError(null);
    setEditData({
      date: format(new Date(tx.date), "yyyy-MM-dd"),
      amount: String(tx.amount),
      type: tx.type,
      description: tx.description,
      categoryId: tx.categoryId || "",
      accountId: tx.accountId || "",
    });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrialExpiredError(false);
    setFormError(null);
    if (!formData.accountId) {
      setFormError("Please choose the account this transaction comes from.");
      return;
    }
    if (formData.type === "debit" && (!formData.categoryId || formData.categoryId === "none")) {
      setFormError("Please choose a category so this expense actualises a budget envelope.");
      return;
    }
    try {
      const cat = formData.categoryId && formData.categoryId !== "none" ? formData.categoryId : undefined;
      await createMutation.mutateAsync({
        data: {
          date: new Date(formData.date).toISOString(),
          amount: formData.amount,
          type: formData.type,
          description: formData.description,
          categoryId: cat,
          accountId: formData.accountId,
          source: "manual"
        }
      });
      setIsAddOpen(false);
      refetch();
      invalidateRelated();
      setFormData({
        date: format(new Date(), "yyyy-MM-dd"),
        amount: "",
        type: "debit",
        description: "",
        categoryId: "",
        accountId: "",
      });
    } catch (err) {
      if (isTrialExpiredError(err)) {
        setTrialExpiredError(true);
      }
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    setEditTrialExpiredError(false);
    setEditError(null);
    if (!editData.accountId) {
      setEditError("Please choose the account this transaction comes from.");
      return;
    }
    if (editData.type === "debit" && (!editData.categoryId || editData.categoryId === "none")) {
      setEditError("Please choose a category so this expense actualises a budget envelope.");
      return;
    }
    try {
      const cat = editData.categoryId && editData.categoryId !== "none" ? editData.categoryId : null;
      await updateMutation.mutateAsync({
        id: editingTx.id,
        data: {
          date: new Date(editData.date).toISOString(),
          amount: editData.amount,
          type: editData.type,
          description: editData.description,
          categoryId: cat,
          accountId: editData.accountId,
        }
      });
      setEditingTx(null);
      refetch();
      invalidateRelated();
    } catch (err) {
      if (isTrialExpiredError(err)) {
        setEditTrialExpiredError(true);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(t("transactions.confirmDelete"))) {
      try {
        await deleteMutation.mutateAsync({ id });
        refetch();
        invalidateRelated();
      } catch (err) {
        if (isTrialExpiredError(err)) setLocation("/premium");
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">{t("transactions.title")}</h1>
          <p className="text-muted-foreground">{t("transactions.subtitle")}</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) setTrialExpiredError(false); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> {t("transactions.addDialog.title")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("transactions.addDialog.title")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              {trialExpiredError && (
                <TrialExpiredPrompt action="add transactions" />
              )}
              <div className="space-y-2">
                <Label>{t("transactions.addDialog.date")}</Label>
                <Input 
                  type="date" 
                  value={formData.date} 
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t("transactions.addDialog.description")}</Label>
                <Input 
                  value={formData.description} 
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("transactions.addDialog.amount")}</Label>
                  <Input 
                    type="number" 
                    step={decimalStep} 
                    value={formData.amount} 
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("transactions.addDialog.type")}</Label>
                  <Select value={formData.type} onValueChange={(val) => setFormData({...formData, type: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">{t("transactions.addDialog.expense")}</SelectItem>
                      <SelectItem value="credit">{t("transactions.addDialog.income")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>
                  {t("transactions.addDialog.account")}{" "}
                  <span className="text-rose-600 text-xs">*</span>
                </Label>
                {accounts && accounts.length === 0 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      You need at least one account before adding a transaction.
                      <button
                        type="button"
                        onClick={() => { setIsAddOpen(false); setLocation("/accounts"); }}
                        className="block mt-1 underline font-semibold"
                      >
                        Add an account →
                      </button>
                    </div>
                  </div>
                ) : (
                  <Select value={formData.accountId} onValueChange={(val) => setFormData({...formData, accountId: val})}>
                    <SelectTrigger><SelectValue placeholder="Choose an account" /></SelectTrigger>
                    <SelectContent>
                      {accounts?.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}{a.bankName ? ` — ${a.bankName}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>
                  {t("transactions.addDialog.category")}
                  {formData.type === "debit" && <span className="text-rose-600 text-xs"> *</span>}
                </Label>
                <Select value={formData.categoryId} onValueChange={(val) => setFormData({...formData, categoryId: val})}>
                  <SelectTrigger>
                    <SelectValue placeholder={formData.type === "debit" ? "Choose an envelope category" : "Optional — leave blank for income"} />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.type === "credit" && (
                      <SelectItem value="none">{t("transactions.addDialog.uncategorized")}</SelectItem>
                    )}
                    {categories?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {categories && categories.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No categories yet —{" "}
                    <button
                      type="button"
                      onClick={() => { setIsAddOpen(false); setLocation("/categories"); }}
                      className="underline font-semibold text-foreground"
                    >
                      manage categories
                    </button>
                  </p>
                )}
              </div>
              <div className="rounded-md bg-muted/50 border border-border/60 px-3 py-2 text-[11px] text-muted-foreground flex items-start gap-2">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  When you save, the amount is deducted from the chosen account, and your envelope's spent total updates automatically. One transaction, one source of truth.
                </span>
              </div>
              {formError && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {formError}
                </div>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={createMutation.isPending || (accounts?.length ?? 0) === 0}
              >
                {createMutation.isPending ? t("transactions.addDialog.saving") : t("transactions.addDialog.save")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!editingTx} onOpenChange={(open) => { if (!open) setEditingTx(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("transactions.editDialog.title")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            {editTrialExpiredError && (
              <TrialExpiredPrompt action="edit transactions" />
            )}
            <div className="space-y-2">
              <Label>{t("transactions.editDialog.title") && t("transactions.addDialog.date")}</Label>
              <Input 
                type="date" 
                value={editData.date} 
                onChange={(e) => setEditData({...editData, date: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("transactions.addDialog.description")}</Label>
              <Input 
                value={editData.description} 
                onChange={(e) => setEditData({...editData, description: e.target.value})}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("transactions.addDialog.amount")}</Label>
                <Input 
                  type="number" 
                  step={decimalStep} 
                  value={editData.amount} 
                  onChange={(e) => setEditData({...editData, amount: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t("transactions.addDialog.type")}</Label>
                <Select value={editData.type} onValueChange={(val) => setEditData({...editData, type: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">{t("transactions.editDialog.expense")}</SelectItem>
                    <SelectItem value="credit">{t("transactions.editDialog.income")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editingTx && editData.type !== editingTx.type && (
              <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span className="flex-1">
                  {t("transactions.editDialog.typeChangeWarning", {
                    from: editingTx.type === "debit" ? t("transactions.editDialog.expense") : t("transactions.editDialog.income"),
                    to: editData.type === "debit" ? t("transactions.editDialog.expense") : t("transactions.editDialog.income"),
                  })}
                </span>
                <button
                  type="button"
                  className="underline font-medium ml-2 whitespace-nowrap"
                  onClick={() => setEditData({ ...editData, type: editingTx.type })}
                >
                  {t("transactions.editDialog.revert")}
                </button>
              </div>
            )}
            <div className="space-y-2">
              <Label>
                {t("transactions.addDialog.account")}{" "}
                <span className="text-rose-600 text-xs">*</span>
              </Label>
              <Select value={editData.accountId} onValueChange={(val) => setEditData({...editData, accountId: val})}>
                <SelectTrigger><SelectValue placeholder="Choose an account" /></SelectTrigger>
                <SelectContent>
                  {accounts?.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}{a.bankName ? ` — ${a.bankName}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editingTx && editData.accountId && editData.accountId !== (editingTx.accountId || "") && (
                <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>
                    {(editingTx.accountId || "") !== ""
                      ? t("transactions.editDialog.accountWarningBoth")
                      : t("transactions.editDialog.accountWarningAdded")}
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>
                {t("transactions.addDialog.category")}
                {editData.type === "debit" && <span className="text-rose-600 text-xs"> *</span>}
              </Label>
              <Select value={editData.categoryId} onValueChange={(val) => setEditData({...editData, categoryId: val})}>
                <SelectTrigger>
                  <SelectValue placeholder={editData.type === "debit" ? "Choose an envelope category" : "Optional — leave blank for income"} />
                </SelectTrigger>
                <SelectContent>
                  {editData.type === "credit" && (
                    <SelectItem value="none">{t("transactions.editDialog.uncategorized")}</SelectItem>
                  )}
                  {categories?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categories && categories.length === 0 && editData.type === "debit" && (
                <p className="text-xs text-muted-foreground">
                  No categories yet —{" "}
                  <button
                    type="button"
                    onClick={() => { setEditingTx(null); setLocation("/categories"); }}
                    className="underline font-semibold text-foreground"
                  >
                    manage categories
                  </button>
                </p>
              )}
            </div>
            {editError && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {editError}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? t("transactions.editDialog.saving") : t("transactions.editDialog.save")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Hero stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-3 sm:p-4 relative overflow-hidden min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">Income · {format(new Date(), "MMMM")}</p>
          <div className="text-lg sm:text-2xl font-bold tabular-nums text-emerald-700 mt-1 break-words">+{formatCurrency(hmIncome)}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{currentMonthTxs?.filter(t => t.type === "credit").length ?? 0} deposits</div>
        </div>
        <div className="rounded-xl border bg-card p-3 sm:p-4 relative overflow-hidden min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">Spent · {format(new Date(), "MMMM")}</p>
          <div className="text-lg sm:text-2xl font-bold tabular-nums text-rose-600 mt-1 break-words">−{formatCurrency(hmSpent)}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{currentMonthTxs?.filter(t => t.type === "debit").length ?? 0} purchases</div>
        </div>
        {(() => {
          // Pre-payday detection: if the user has a configured payday, today is
          // before it, and the salary clearly hasn't landed yet (income this
          // month is well below their monthly income), the Net flow card shows
          // a neutral "Pre-payday spending" label instead of a red
          // "Overspending" — it's expected to be net-negative before Hari Gaji.
          const payday = profile?.payday ?? null;
          const monthlyIncome = profile?.monthlyIncome ? Number(profile.monthlyIncome) : 0;
          const today = new Date().getDate();
          const salaryLanded = monthlyIncome > 0 ? hmIncome >= monthlyIncome * 0.5 : hmIncome > 0;
          const prePayday = !!payday && today < payday && !salaryLanded;
          const tone = prePayday
            ? "bg-card border-border"
            : hmNet >= 0
              ? "bg-emerald-50/60 border-emerald-200"
              : "bg-rose-50/60 border-rose-200";
          const valueTone = prePayday
            ? "text-foreground"
            : hmNet >= 0
              ? "text-primary"
              : "text-rose-600";
          const label = prePayday ? "Pre-payday spending" : "Net flow";
          const sub = prePayday
            ? `Hari Gaji on day ${payday}`
            : hmNet >= 0
              ? "Saving this month"
              : "Overspending";
          // Cycle-relative spending vs expected monthly income — shows whether
          // the user is on track for the whole month, regardless of whether
          // their salary has actually landed yet. The cycle is the calendar
          // month (matching the rest of the page's "this month" stats), so it
          // naturally resets on the 1st.
          const spentPctRaw = monthlyIncome > 0 ? (hmSpent / monthlyIncome) * 100 : 0;
          const spentPct = Math.min(spentPctRaw, 100);
          const overBudget = spentPctRaw > 100;
          const barColor = overBudget
            ? "bg-rose-500"
            : spentPctRaw > 80
              ? "bg-amber-500"
              : "bg-primary";
          // Pacing indicator: compares spend ratio to where we are in the
          // month. Cycle is the calendar month so it resets cleanly on the
          // 1st. Only meaningful when we have an income target to compare
          // against.
          const now = new Date();
          const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          const dayOfMonth = now.getDate();
          const monthProgressPct = (dayOfMonth / daysInMonth) * 100;
          const paceDelta = spentPctRaw - monthProgressPct;
          let paceLabel = "";
          let paceTone = "";
          if (monthlyIncome > 0) {
            if (overBudget) {
              paceLabel = "Over budget";
              paceTone = "text-rose-600";
            } else if (paceDelta <= -10) {
              paceLabel = "Ahead of pace";
              paceTone = "text-emerald-700";
            } else if (paceDelta <= 5) {
              paceLabel = "On track";
              paceTone = "text-emerald-700";
            } else if (paceDelta <= 15) {
              paceLabel = "Slightly ahead";
              paceTone = "text-amber-600";
            } else {
              paceLabel = "Burning fast";
              paceTone = "text-rose-600";
            }
          }
          const paceTooltip = monthlyIncome > 0
            ? `Used ${Math.round(spentPctRaw)}% of expected income · day ${dayOfMonth} of ${daysInMonth} (${Math.round(monthProgressPct)}% through the month)`
            : "";
          return (
            <div className={`rounded-xl border p-3 sm:p-4 relative overflow-hidden min-w-0 ${tone}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
              <div className={`text-lg sm:text-2xl font-bold tabular-nums mt-1 break-words ${valueTone}`}>{hmNet >= 0 ? "+" : "−"}{formatCurrency(Math.abs(hmNet))}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>{sub}</span>
                {paceLabel && (
                  <>
                    <span className="text-muted-foreground/60">·</span>
                    <span className={`font-semibold ${paceTone}`} title={paceTooltip}>{paceLabel}</span>
                  </>
                )}
              </div>
              {monthlyIncome > 0 && (
                <div className="mt-2">
                  <div
                    className="h-1 w-full rounded-full bg-muted overflow-hidden relative"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(Math.round(spentPctRaw), 100)}
                    aria-label={`Spent ${formatCurrency(hmSpent)} of expected ${formatCurrency(monthlyIncome)} this month, ${paceLabel.toLowerCase()} on day ${dayOfMonth} of ${daysInMonth}`}
                  >
                    <div className={`h-full ${barColor} transition-all`} style={{ width: `${spentPct}%` }} />
                    <div
                      className="absolute top-[-2px] bottom-[-2px] w-px bg-foreground/40"
                      style={{ left: `${Math.min(monthProgressPct, 100)}%` }}
                      title={`Day ${dayOfMonth} of ${daysInMonth}`}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 tabular-nums truncate">
                    {formatCurrency(hmSpent)} of expected {formatCurrency(monthlyIncome)}
                    {overBudget && <span className="text-rose-600 font-semibold"> · over</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
        <div className="rounded-xl border bg-card p-3 sm:p-4 relative overflow-hidden min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">Avg per day</p>
          <div className="text-lg sm:text-2xl font-bold tabular-nums mt-1 break-words">{formatCurrency(avgPerDay)}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">over {daysInMonth} days</div>
        </div>
      </div>

      {/* Spending heatmap + Top merchants */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Calendar heatmap */}
        <div className="rounded-xl border bg-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Spending heatmap</p>
              <h3 className="text-base font-semibold mt-0.5">{format(new Date(), "MMMM yyyy")}</h3>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>Less</span>
              <div className="flex gap-0.5">
                {["bg-accent", "bg-[hsl(162,55%,88%)]", "bg-[hsl(162,55%,70%)]", "bg-[hsl(162,60%,42%)]", "bg-[hsl(162,70%,30%)]"].map((c, i) => (
                  <span key={i} className={`w-3 h-3 rounded-sm ${c}`} />
                ))}
              </div>
              <span>More</span>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {["S","M","T","W","T","F","S"].map((d, i) => (
              <div key={i} className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{d}</div>
            ))}
            {Array.from({ length: firstDow }).map((_, i) => <div key={`pad-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const amt = monthSpend[day] || 0;
              const isToday = day === new Date().getDate();
              return (
                <div key={day}
                  className={`aspect-square rounded-md flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-110 hover:z-10 ${heatColor(amt)} ${isToday ? "ring-2 ring-primary ring-offset-1" : ""}`}
                  title={amt ? `${formatCurrency(amt)} on ${day} ${format(new Date(), "MMMM")}` : `No spend on ${day} ${format(new Date(), "MMMM")}`}>
                  <div className="text-[11px] font-bold leading-none">{day}</div>
                  {amt > 0 && <div className="text-[8px] tabular-nums opacity-80 leading-none mt-0.5">{amt < 100 ? amt.toFixed(0) : Math.round(amt)}</div>}
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Highest day</div>
              <div className="text-sm font-bold tabular-nums mt-0.5">{formatCurrency(highestDay)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">No-spend days</div>
              <div className="text-sm font-bold tabular-nums mt-0.5">{noSpendDays}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Active days</div>
              <div className="text-sm font-bold tabular-nums mt-0.5">{activeDays}</div>
            </div>
          </div>
        </div>

        {/* Top merchants */}
        <div className="rounded-xl border bg-card p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Top merchants</p>
          <h3 className="text-base font-semibold mt-0.5 mb-4">Where money goes</h3>
          {topMerchants.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No transactions this month</div>
          ) : (
            <div className="space-y-3">
              {topMerchants.map((m, i) => (
                <div key={m.merchant} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center text-sm font-bold text-muted-foreground flex-shrink-0">
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{m.merchant}</div>
                    <div className="text-[11px] text-muted-foreground">{m.count}× this month</div>
                  </div>
                  <div className="text-sm font-bold tabular-nums text-rose-600">{formatCurrency(m.total)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Spending by category filter pills */}
      {categoryStats.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Spending by category</p>
            {catFilter && (
              <button onClick={() => setCatFilter(null)} className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1">
                ✕ Clear filter
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {categoryStats.map(c => {
              const active = catFilter === c.name;
              const pct = (c.total / maxCatTotal) * 100;
              return (
                <button key={c.name} onClick={() => setCatFilter(active ? null : c.name)}
                  className={`relative overflow-hidden flex items-center gap-2 px-3 py-2 rounded-full border transition-all ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary"}`}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                  <span className="text-xs font-semibold">{c.name}</span>
                  <span className="text-xs font-bold tabular-nums text-muted-foreground">{formatCurrency(c.total)}</span>
                  <span className="absolute bottom-0 left-0 h-[3px] rounded-b-full" style={{ width: `${pct}%`, background: c.color }} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-3 items-center bg-white p-4 rounded-xl border flex-wrap">
        <div className="flex items-center gap-2">
          <Input 
            type="month" 
            value={month} 
            onChange={(e) => setMonth(e.target.value)} 
            className="w-44"
            placeholder={t("transactions.filters.allMonths")}
          />
          {month ? (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setMonth("")}>
              {t("transactions.filters.clear")}
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">{t("transactions.filters.allMonths")}</span>
          )}
        </div>
        <div className="w-48">
          <Select value={accountFilter || "all"} onValueChange={(val) => setAccountFilter(val === "all" ? "" : val)}>
            <SelectTrigger>
              <SelectValue placeholder={t("transactions.filters.allAccounts")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("transactions.filters.allAccounts")}</SelectItem>
              {accounts?.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}{a.bankName ? ` — ${a.bankName}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-36">
          <Select value={typeFilter || "all"} onValueChange={(val) => setTypeFilter(val === "all" ? "" : val)}>
            <SelectTrigger>
              <SelectValue placeholder={t("transactions.filters.allTypes")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("transactions.filters.allTypes")}</SelectItem>
              <SelectItem value="debit">{t("transactions.typeLabel.expense")}</SelectItem>
              <SelectItem value="credit">{t("transactions.typeLabel.income")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 min-w-48 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={t("transactions.filters.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">{t("transactions.loading")}</div>
        ) : !transactions?.length ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Receipt className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">{t("transactions.empty.noTransactions")}</h3>
            <p className="text-muted-foreground mb-4">
              {month
                ? t("transactions.empty.noTransactionsForMonth", { month: formatMonthYear(month + "-01") })
                : t("transactions.empty.noTransactionsGeneral")}
            </p>
            {month && (
              <Button variant="outline" size="sm" onClick={() => setMonth("")}>
                {t("transactions.empty.viewAll")}
              </Button>
            )}
          </div>
        ) : (() => {
          // Group transactions by ISO day; render with sticky header per day
          // ("Today" / "Yesterday" / "Tuesday 14 April").
          const groups = new Map<string, typeof transactions>();
          for (const tx of transactions) {
            const day = (tx.date ?? "").slice(0, 10);
            if (!groups.has(day)) groups.set(day, []);
            groups.get(day)!.push(tx);
          }
          const sortedDays = Array.from(groups.keys()).sort((a, b) => (a < b ? 1 : -1));
          const today = format(new Date(), "yyyy-MM-dd");
          const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
          const dayLabel = (day: string) => {
            if (day === today) return "Today";
            if (day === yesterday) return "Yesterday";
            try {
              return format(new Date(day), "EEEE d MMMM");
            } catch {
              return day;
            }
          };
          return (
            <div className="divide-y">
              {sortedDays.map((day) => {
                const dayTxs = groups.get(day)!;
                const dayNet = dayTxs.reduce(
                  (s, tx) => s + (tx.type === "credit" ? 1 : -1) * Number(tx.amount),
                  0,
                );
                return (
                  <div key={day}>
                    <div className="px-4 py-2 bg-muted/40 flex items-center justify-between sticky top-0 z-[1] border-b">
                      <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
                        {dayLabel(day)}
                      </span>
                      <span
                        className={`text-[11px] font-bold tabular-nums ${dayNet >= 0 ? "text-emerald-700" : "text-rose-600"}`}
                      >
                        {dayNet >= 0 ? "+" : "−"}
                        {formatCurrency(Math.abs(dayNet))}
                      </span>
                    </div>
                    <div className="divide-y">
                      {dayTxs.map((tx) => (
                        <div
                          key={tx.id}
                          className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-start gap-4">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === "credit" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"}`}
                            >
                              {tx.type === "credit" ? (
                                <TrendingUp className="w-5 h-5" />
                              ) : (
                                <TrendingDown className="w-5 h-5" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-foreground">{tx.description}</div>
                              <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                                {formatDate(tx.date)}
                                <span>&bull;</span>
                                <span className="bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full text-[11px] font-bold">
                                  {tx.categoryName || t("transactions.uncategorized")}
                                </span>
                                {tx.accountName && (
                                  <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[11px] font-bold">
                                    {tx.accountName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div
                              className={`font-semibold tabular-nums ${tx.type === "credit" ? "text-emerald-600" : "text-red-500"}`}
                            >
                              {tx.type === "credit" ? "+" : "−"}
                              {formatCurrency(Number(tx.amount))}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => openEdit(tx)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(tx.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
