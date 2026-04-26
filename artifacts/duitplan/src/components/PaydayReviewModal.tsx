import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Pencil, Check } from "lucide-react";
import { useListAccounts } from "@workspace/api-client-react";
import type { Account } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useRegion } from "@/hooks/useRegion";
import { usePaydayPrompt, type PaydayPromptData, type ConfirmTransaction } from "@/hooks/usePaydayPrompt";
import { customFetch } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface LineItem {
  id: string;
  type: "income" | "debt";
  label: string;
  sublabel?: string;
  checked: boolean;
  amount: string;
  accountId: string;
  date: string;
  description: string;
  editing: boolean;
  debtId?: string;
}

function formatDebtLabel(debtType: string): string {
  return debtType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const ASSET_TYPES = new Set(["savings", "current", "checking"]);

function getDefaultAccount(accounts: Account[]): Account | undefined {
  return accounts.find((a) => ASSET_TYPES.has(a.type?.toLowerCase() ?? "")) ?? accounts[0];
}

function todayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface EditPanelProps {
  item: LineItem;
  accounts: Account[];
  onChange: (updates: Partial<LineItem>) => void;
  onClose: () => void;
  t: (key: string) => string;
  currency: string;
  decimalStep: string;
}

function EditPanel({ item, accounts, onChange, onClose, t, currency, decimalStep }: EditPanelProps) {
  return (
    <div className="mt-3 ml-7 space-y-3 p-3 rounded-lg bg-muted/40 border border-border">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{t("paydayPrompt.modal.amount")}</Label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currency}</span>
            <Input
              type="number"
              step={decimalStep}
              min="0"
              value={item.amount}
              onChange={(e) => onChange({ amount: e.target.value })}
              className="pl-10 h-8 text-sm"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("paydayPrompt.modal.date")}</Label>
          <Input
            type="date"
            value={item.date}
            onChange={(e) => onChange({ date: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t("paydayPrompt.modal.description")}</Label>
        <Input
          type="text"
          value={item.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className="h-8 text-sm"
        />
      </div>
      {accounts.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs">
            {item.type === "income" ? t("paydayPrompt.modal.toAccount") : t("paydayPrompt.modal.fromAccount")}
          </Label>
          <select
            value={item.accountId}
            onChange={(e) => onChange({ accountId: e.target.value })}
            className="w-full h-8 text-sm rounded-md border border-input bg-background px-2"
          >
            {accounts.filter(a => ASSET_TYPES.has(a.type?.toLowerCase() ?? "")).map((acc) => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        </div>
      )}
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        onClick={onClose}
      >
        <Check className="w-3 h-3 mr-1" />
        {t("paydayPrompt.modal.done")}
      </Button>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  prompt: PaydayPromptData;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function PaydayReviewModal({ open, onClose, prompt }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { region, formatCurrency, decimalStep } = useRegion();
  const { confirm, isConfirming } = usePaydayPrompt();

  const { data: allAccounts = [] } = useListAccounts();
  const assetAccounts = useMemo(
    () => allAccounts.filter((a) => ASSET_TYPES.has(a.type?.toLowerCase() ?? "")),
    [allAccounts]
  );

  const [items, setItems] = useState<LineItem[]>([]);
  const [hasDuplicate, setHasDuplicate] = useState(false);
  const [duplicateChecked, setDuplicateChecked] = useState(false);

  const defaultAccountId = getDefaultAccount(assetAccounts)?.id ?? "";
  const monthName = MONTH_NAMES[(prompt.month - 1) % 12];
  const salaryDesc = t("paydayPrompt.modal.salaryDescription", { month: monthName, year: prompt.year });

  // Initialize line items when modal opens
  useEffect(() => {
    if (!open || assetAccounts.length === 0) return;

    const accId = getDefaultAccount(assetAccounts)?.id ?? "";
    const today = todayIsoDate();

    const incomeItem: LineItem = {
      id: "income",
      type: "income",
      label: t("paydayPrompt.modal.income"),
      checked: true,
      amount: parseFloat(prompt.monthlyIncome).toFixed(2),
      accountId: accId,
      date: today,
      description: salaryDesc,
      editing: false,
    };

    const debtItems: LineItem[] = prompt.debts.map((debt) => ({
      id: debt.id,
      type: "debt",
      label: formatDebtLabel(debt.debtType),
      sublabel: debt.lender,
      checked: true,
      amount: parseFloat(debt.monthlyPayment).toFixed(2),
      accountId: accId,
      date: today,
      description: `${formatDebtLabel(debt.debtType)} — ${debt.lender}`,
      editing: false,
      debtId: debt.id,
    }));

    setItems([incomeItem, ...debtItems]);
    setDuplicateChecked(false);
  }, [open, assetAccounts.length, prompt.id]);

  // Duplicate detection — check for recent credit transactions today
  useEffect(() => {
    if (!open || duplicateChecked) return;

    const check = async () => {
      try {
        const today = new Date();
        const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
        const txns = await customFetch<any[]>(`/api/transactions?type=credit&month=${month}`);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const hasSalaryToday = txns.some((tx) => {
          const txDate = new Date(tx.date);
          return txDate >= todayStart;
        });

        if (hasSalaryToday) {
          setHasDuplicate(true);
          setItems((prev) =>
            prev.map((item) =>
              item.type === "income" ? { ...item, checked: false } : item
            )
          );
        }
      } catch {
        // ignore — duplicate detection is best-effort
      }
      setDuplicateChecked(true);
    };

    check();
  }, [open, duplicateChecked]);

  const updateItem = (id: string, updates: Partial<LineItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const netCashflow = useMemo(() => {
    let net = 0;
    for (const item of items) {
      if (!item.checked) continue;
      const amt = parseFloat(item.amount) || 0;
      net += item.type === "income" ? amt : -amt;
    }
    return net;
  }, [items]);

  const incomeItems = items.filter((i) => i.type === "income");
  const debtItems = items.filter((i) => i.type === "debt");

  const hasNoAccount = assetAccounts.length === 0;
  const hasNoIncome = parseFloat(prompt.monthlyIncome) <= 0;

  const handleConfirm = async () => {
    const selected = items.filter((i) => i.checked);
    if (selected.length === 0) {
      onClose();
      return;
    }

    const transactions: ConfirmTransaction[] = selected.map((item) => ({
      type: item.type === "income" ? "credit" : "debit",
      amount: parseFloat(item.amount).toFixed(2),
      accountId: item.accountId || null,
      description: item.description,
      date: item.date,
    }));

    try {
      await confirm({ id: prompt.id, transactions });
      toast({
        title: t("paydayPrompt.toast.confirmed", {
          amount: formatCurrency(Math.abs(netCashflow)),
        }),
      });
      onClose();
    } catch (err) {
      toast({
        title: t("paydayPrompt.errors.transactionFailed"),
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("paydayPrompt.modal.title")}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {t("paydayPrompt.modal.subtitle")}
        </p>

        {hasDuplicate && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {t("paydayPrompt.modal.duplicateWarning")}
            </p>
          </div>
        )}

        {hasNoAccount && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{t("paydayPrompt.errors.noPrimaryAccount")}</p>
          </div>
        )}

        {hasNoIncome && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{t("paydayPrompt.errors.noMonthlyIncome")}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* ── Income section ── */}
          <div className="rounded-xl border p-4 space-y-2">
            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide text-xs">
              {t("paydayPrompt.modal.income")}
            </div>
            {incomeItems.map((item) => (
              <div key={item.id}>
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={item.checked}
                    onCheckedChange={(v) => updateItem(item.id, { checked: !!v })}
                    className="mt-0.5 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-sm font-medium", !item.checked && "text-muted-foreground line-through")}>
                        {item.description}
                      </span>
                      <button
                        onClick={() => updateItem(item.id, { editing: !item.editing })}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 flex-shrink-0"
                      >
                        <Pencil className="w-3 h-3" />
                        {t("paydayPrompt.modal.edit")}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm font-semibold text-emerald-700">
                        +{formatCurrency(parseFloat(item.amount) || 0)}
                      </span>
                      {item.accountId && assetAccounts.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          → {assetAccounts.find((a) => a.id === item.accountId)?.name ?? ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {item.editing && (
                  <EditPanel
                    item={item}
                    accounts={assetAccounts}
                    onChange={(updates) => updateItem(item.id, updates)}
                    onClose={() => updateItem(item.id, { editing: false })}
                    t={t}
                    currency={region.currency}
                    decimalStep={decimalStep}
                  />
                )}
              </div>
            ))}
          </div>

          {/* ── Debt Payments section ── */}
          <div className="rounded-xl border p-4 space-y-3">
            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide text-xs">
              {t("paydayPrompt.modal.debtPayments")}
            </div>
            {debtItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("paydayPrompt.modal.noDebts")}</p>
            ) : (
              debtItems.map((item) => (
                <div key={item.id}>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={item.checked}
                      onCheckedChange={(v) => updateItem(item.id, { checked: !!v })}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className={cn("text-sm font-medium block", !item.checked && "text-muted-foreground line-through")}>
                            {item.label}
                          </span>
                          {item.sublabel && (
                            <span className="text-xs text-muted-foreground">{item.sublabel}</span>
                          )}
                        </div>
                        <button
                          onClick={() => updateItem(item.id, { editing: !item.editing })}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 flex-shrink-0"
                        >
                          <Pencil className="w-3 h-3" />
                          {t("paydayPrompt.modal.edit")}
                        </button>
                      </div>
                      <span className={cn("text-sm font-semibold mt-0.5 block", item.checked ? "text-red-600" : "text-muted-foreground")}>
                        −{formatCurrency(parseFloat(item.amount) || 0)}
                      </span>
                    </div>
                  </div>
                  {item.editing && (
                    <EditPanel
                      item={item}
                      accounts={assetAccounts}
                      onChange={(updates) => updateItem(item.id, updates)}
                      onClose={() => updateItem(item.id, { editing: false })}
                      t={t}
                      currency={region.currency}
                      decimalStep={decimalStep}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Net cashflow ── */}
        <div className="flex justify-between items-center rounded-xl bg-muted/40 px-4 py-3">
          <span className="text-sm font-semibold">{t("paydayPrompt.modal.netCashflow")}</span>
          <span className={cn(
            "text-base font-bold tabular-nums",
            netCashflow >= 0 ? "text-emerald-700" : "text-red-600"
          )}>
            {netCashflow >= 0 ? "+" : "−"}{formatCurrency(Math.abs(netCashflow))}
          </span>
        </div>

        {/* ── Footer buttons ── */}
        <div className="flex gap-3 justify-end pt-1">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isConfirming}
          >
            {t("paydayPrompt.modal.cancel")}
          </Button>
          <Button
            className="bg-emerald-700 hover:bg-emerald-800 text-white"
            disabled={isConfirming || hasNoAccount}
            onClick={handleConfirm}
          >
            {isConfirming ? "..." : t("paydayPrompt.modal.confirmAll")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
