import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListTransactions, 
  useListCategories,
  useListAccounts,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  getListAccountsQueryKey,
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
  const { data: transactions, isLoading, refetch } = useListTransactions(listParams);
  const { data: categories } = useListCategories();
  const { data: accounts } = useListAccounts();
  
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();

  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    amount: "",
    type: "debit",
    description: "",
    categoryId: "none",
    accountId: "none",
  });

  const [editData, setEditData] = useState({
    date: "",
    amount: "",
    type: "debit",
    description: "",
    categoryId: "none",
    accountId: "none",
  });

  const openEdit = (tx: TransactionItem) => {
    setEditingTx(tx);
    setEditTrialExpiredError(false);
    setEditData({
      date: format(new Date(tx.date), "yyyy-MM-dd"),
      amount: String(tx.amount),
      type: tx.type,
      description: tx.description,
      categoryId: tx.categoryId || "none",
      accountId: tx.accountId || "none",
    });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrialExpiredError(false);
    try {
      await createMutation.mutateAsync({
        data: {
          date: new Date(formData.date).toISOString(),
          amount: formData.amount,
          type: formData.type,
          description: formData.description,
          categoryId: formData.categoryId === "none" ? undefined : formData.categoryId,
          accountId: formData.accountId === "none" ? undefined : formData.accountId,
          source: "manual"
        }
      });
      setIsAddOpen(false);
      refetch();
      setFormData({
        date: format(new Date(), "yyyy-MM-dd"),
        amount: "",
        type: "debit",
        description: "",
        categoryId: "none",
        accountId: "none",
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
    try {
      await updateMutation.mutateAsync({
        id: editingTx.id,
        data: {
          date: new Date(editData.date).toISOString(),
          amount: editData.amount,
          type: editData.type,
          description: editData.description,
          categoryId: editData.categoryId === "none" ? null : editData.categoryId,
          accountId: editData.accountId === "none" ? null : editData.accountId,
        }
      });
      setEditingTx(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
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
                  <span className="text-muted-foreground text-xs">{t("transactions.addDialog.optional")}</span>
                </Label>
                <Select value={formData.accountId} onValueChange={(val) => setFormData({...formData, accountId: val})}>
                  <SelectTrigger><SelectValue placeholder={t("transactions.addDialog.noAccount")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("transactions.addDialog.noAccount")}</SelectItem>
                    {accounts?.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name}{a.bankName ? ` — ${a.bankName}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("transactions.addDialog.category")}</Label>
                <Select value={formData.categoryId} onValueChange={(val) => setFormData({...formData, categoryId: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("transactions.addDialog.uncategorized")}</SelectItem>
                    {categories?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
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
                <span className="text-muted-foreground text-xs">{t("transactions.addDialog.optional")}</span>
              </Label>
              <Select value={editData.accountId} onValueChange={(val) => setEditData({...editData, accountId: val})}>
                <SelectTrigger><SelectValue placeholder={t("transactions.editDialog.noAccount")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("transactions.editDialog.noAccount")}</SelectItem>
                  {accounts?.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}{a.bankName ? ` — ${a.bankName}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editingTx && editData.accountId !== (editingTx.accountId || "none") && (
                <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>
                    {editData.accountId !== "none" && (editingTx.accountId || "none") !== "none"
                      ? t("transactions.editDialog.accountWarningBoth")
                      : editData.accountId === "none"
                        ? t("transactions.editDialog.accountWarningRemoved")
                        : t("transactions.editDialog.accountWarningAdded")}
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t("transactions.addDialog.category")}</Label>
              <Select value={editData.categoryId} onValueChange={(val) => setEditData({...editData, categoryId: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("transactions.editDialog.uncategorized")}</SelectItem>
                  {categories?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? t("transactions.editDialog.saving") : t("transactions.editDialog.save")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

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
        ) : (
          <div className="divide-y">
            {transactions.map(tx => (
              <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === 'credit' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                    {tx.type === 'credit'
                      ? <TrendingUp className="w-5 h-5" />
                      : <TrendingDown className="w-5 h-5" />
                    }
                  </div>
                  <div>
                    <div className="font-medium text-foreground">{tx.description}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                      {formatDate(tx.date)}
                      <span>&bull;</span>
                      <span className="bg-muted px-2 py-0.5 rounded-full text-xs">
                        {tx.categoryName || t("transactions.uncategorized")}
                      </span>
                      {tx.accountName && (
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">{tx.accountName}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`font-semibold ${tx.type === 'credit' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {tx.type === 'credit' ? '+' : '−'}{formatCurrency(Number(tx.amount))}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(tx)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(tx.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
