import { useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCategories,
  useListAccounts,
  useCreateTransaction,
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
import { Info } from "lucide-react";
import { useRegion } from "@/hooks/useRegion";

type Props = {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved?: () => void;
};

export function AddTransactionDialog({ trigger, open: openProp, onOpenChange, onSaved }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { decimalStep } = useRegion();
  const { data: categories } = useListCategories();
  const { data: accounts } = useListAccounts();
  const createMutation = useCreateTransaction();

  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? !!openProp : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };

  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    amount: "",
    type: "debit",
    description: "",
    categoryId: "",
    accountId: "",
  });

  const invalidateRelated = () => {
    queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListBudgetsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetSpendingByCategoryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetRecentTransactionsQueryKey() });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
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
          source: "manual",
        },
      });
      setOpen(false);
      invalidateRelated();
      onSaved?.();
      setFormData({
        date: format(new Date(), "yyyy-MM-dd"),
        amount: "",
        type: "debit",
        description: "",
        categoryId: "",
        accountId: "",
      });
    } catch {
      // mutation error state is surfaced by react-query
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("transactions.addDialog.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("transactions.addDialog.date")}</Label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t("transactions.addDialog.description")}</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("transactions.addDialog.type")}</Label>
              <Select value={formData.type} onValueChange={(val) => setFormData({ ...formData, type: val })}>
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
              {t("transactions.addDialog.account")} <span className="text-rose-600 text-xs">*</span>
            </Label>
            {accounts && accounts.length === 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  You need at least one account before adding a transaction.
                  <button
                    type="button"
                    onClick={() => { setOpen(false); setLocation("/accounts"); }}
                    className="block mt-1 underline font-semibold"
                  >
                    Add an account →
                  </button>
                </div>
              </div>
            ) : (
              <Select value={formData.accountId} onValueChange={(val) => setFormData({ ...formData, accountId: val })}>
                <SelectTrigger><SelectValue placeholder="Choose an account" /></SelectTrigger>
                <SelectContent>
                  {accounts?.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}{a.bankName ? ` — ${a.bankName}` : ""}
                    </SelectItem>
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
            <Select value={formData.categoryId} onValueChange={(val) => setFormData({ ...formData, categoryId: val })}>
              <SelectTrigger>
                <SelectValue placeholder={formData.type === "debit" ? "Choose an envelope category" : "Optional — leave blank for income"} />
              </SelectTrigger>
              <SelectContent>
                {formData.type === "credit" && (
                  <SelectItem value="none">{t("transactions.addDialog.uncategorized")}</SelectItem>
                )}
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categories && categories.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No categories yet —{" "}
                <button
                  type="button"
                  onClick={() => { setOpen(false); setLocation("/categories"); }}
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
  );
}
