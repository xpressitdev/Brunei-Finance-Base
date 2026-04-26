import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { format, startOfMonth, endOfMonth, isToday, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTransactions,
  useListCategories,
  useListAccounts,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  useScanReceipt,
  getListAccountsQueryKey,
  useGetProfile,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import {
  Camera,
  Plus,
  Trash2,
  Pencil,
  Receipt,
  ShoppingCart,
  Utensils,
  Car,
  Zap,
  Heart,
  Music,
  GraduationCap,
  Package,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ImageIcon,
  CheckCircle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TrialExpiredPrompt } from "@/components/subscription/TrialExpiredPrompt";
import { isTrialExpiredError } from "@/lib/trialExpired";
import { useRegion } from "@/hooks/useRegion";

function getCategoryIcon(name: string | null | undefined) {
  const n = (name ?? "").toLowerCase();
  if (n.includes("food") || n.includes("grocery") || n.includes("restaurant") || n.includes("eat")) return <Utensils className="w-4 h-4" />;
  if (n.includes("transport") || n.includes("car") || n.includes("fuel") || n.includes("bus")) return <Car className="w-4 h-4" />;
  if (n.includes("utility") || n.includes("electric") || n.includes("water") || n.includes("internet")) return <Zap className="w-4 h-4" />;
  if (n.includes("health") || n.includes("medical") || n.includes("pharmacy")) return <Heart className="w-4 h-4" />;
  if (n.includes("entertainment") || n.includes("leisure") || n.includes("movie")) return <Music className="w-4 h-4" />;
  if (n.includes("education") || n.includes("school") || n.includes("book")) return <GraduationCap className="w-4 h-4" />;
  if (n.includes("shopping") || n.includes("clothing") || n.includes("retail")) return <ShoppingCart className="w-4 h-4" />;
  return <Package className="w-4 h-4" />;
}

function getCategoryColor(name: string | null | undefined) {
  const n = (name ?? "").toLowerCase();
  if (n.includes("food") || n.includes("grocery") || n.includes("restaurant")) return "bg-orange-100 text-orange-700";
  if (n.includes("transport") || n.includes("car") || n.includes("fuel")) return "bg-blue-100 text-blue-700";
  if (n.includes("utility") || n.includes("electric")) return "bg-yellow-100 text-yellow-700";
  if (n.includes("health") || n.includes("medical")) return "bg-red-100 text-red-700";
  if (n.includes("entertainment")) return "bg-purple-100 text-purple-700";
  if (n.includes("education")) return "bg-indigo-100 text-indigo-700";
  return "bg-gray-100 text-gray-600";
}

async function compressImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 800;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round((height / width) * maxDim); width = maxDim; }
        else { width = Math.round((width / height) * maxDim); height = maxDim; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      const base64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
      resolve({ base64, mimeType: "image/jpeg" });
    };
    img.onerror = reject;
    img.src = url;
  });
}

type FormState = {
  date: string;
  amount: string;
  description: string;
  merchant: string;
  categoryId: string;
  type: string;
  receiptUrl: string;
};

const defaultForm: FormState = {
  date: format(new Date(), "yyyy-MM-dd"),
  amount: "",
  description: "",
  merchant: "",
  categoryId: "none",
  type: "debit",
  receiptUrl: "",
};

type TransactionItem = {
  id: string;
  date: string;
  amount: string | number;
  type: string;
  description: string;
  categoryId?: string | null;
  categoryName?: string | null;
  accountId?: string | null;
  merchant?: string | null;
  receiptUrl?: string | null;
};

export default function Expenses() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { formatCurrency, formatDate, formatMonthYear, region, decimalStep } = useRegion();

  const [currentMonth, setCurrentMonth] = useState(format(new Date(), "yyyy-MM"));
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [trialExpiredError, setTrialExpiredError] = useState(false);
  const [, setLocation] = useLocation();

  const [editingTx, setEditingTx] = useState<TransactionItem | null>(null);
  const [editTrialExpiredError, setEditTrialExpiredError] = useState(false);
  const [editData, setEditData] = useState({
    date: "",
    amount: "",
    type: "debit",
    description: "",
    merchant: "",
    categoryId: "none",
    accountId: "none",
  });

  const { data: transactions, refetch } = useListTransactions({ month: currentMonth });
  const { data: categories } = useListCategories();
  const { data: accounts } = useListAccounts();
  const { data: profile } = useGetProfile();
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();
  const scanMutation = useScanReceipt();

  const expenses = (transactions ?? []).filter((t) => t.type === "debit");
  const income = (transactions ?? []).filter((t) => t.type === "credit");

  const totalExpenses = expenses.reduce((s, t) => s + parseFloat(t.amount), 0);
  const configuredSalary = parseFloat(profile?.monthlyIncome ?? "0");
  const totalIncome = income.reduce((s, t) => s + parseFloat(t.amount), 0) + configuredSalary;
  const incomeEntryCount = income.length + (configuredSalary > 0 ? 1 : 0);

  const todayTransactions = expenses.filter((t) => {
    try { return isToday(parseISO(t.date)); } catch { return false; }
  });
  const todayTotal = todayTransactions.reduce((s, t) => s + parseFloat(t.amount), 0);

  const grouped = expenses.reduce<Record<string, typeof expenses>>((acc, t) => {
    const day = t.date.split("T")[0];
    if (!acc[day]) acc[day] = [];
    acc[day].push(t);
    return acc;
  }, {});
  const sortedDays = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const prevMonth = () => {
    const d = new Date(currentMonth + "-01");
    d.setMonth(d.getMonth() - 1);
    setCurrentMonth(format(d, "yyyy-MM"));
  };
  const nextMonth = () => {
    const d = new Date(currentMonth + "-01");
    d.setMonth(d.getMonth() + 1);
    setCurrentMonth(format(d, "yyyy-MM"));
  };

  const openAdd = (prefill?: Partial<FormState>) => {
    setForm({ ...defaultForm, date: format(new Date(), "yyyy-MM-dd"), ...prefill });
    setReceiptPreview(null);
    setScanSuccess(false);
    setTrialExpiredError(false);
    setIsAddOpen(true);
  };

  const openEdit = (tx: TransactionItem) => {
    setEditingTx(tx);
    setEditTrialExpiredError(false);
    setEditData({
      date: format(new Date(tx.date), "yyyy-MM-dd"),
      amount: String(tx.amount),
      type: tx.type,
      description: tx.description,
      merchant: tx.merchant ?? "",
      categoryId: tx.categoryId || "none",
      accountId: tx.accountId || "none",
    });
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
          merchant: editData.merchant || null,
          categoryId: editData.categoryId === "none" ? null : editData.categoryId,
          accountId: editData.accountId === "none" ? null : editData.accountId,
        },
      });
      setEditingTx(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
      toast({ title: "Transaction updated!" });
    } catch (err) {
      if (isTrialExpiredError(err)) {
        setEditTrialExpiredError(true);
      } else {
        toast({ title: "Failed to update transaction", variant: "destructive" });
      }
    }
  };

  const handleReceiptFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }

    const preview = URL.createObjectURL(file);
    setReceiptPreview(preview);
    setIsScanningReceipt(true);
    setScanSuccess(false);

    try {
      const { base64, mimeType } = await compressImage(file);

      const result = await scanMutation.mutateAsync({
        data: { imageBase64: base64, mimeType },
      });

      const updates: Partial<FormState> = {};
      if (result.merchant) updates.merchant = result.merchant;
      if (result.amount) updates.amount = result.amount;
      if (result.date) updates.date = result.date;
      if (result.description) updates.description = result.description;

      if (result.category && categories) {
        const matched = categories.find((c) =>
          c.name.toLowerCase().includes(result.category!.toLowerCase()) ||
          result.category!.toLowerCase().includes(c.name.toLowerCase())
        );
        if (matched) updates.categoryId = matched.id;
      }

      setForm((prev) => ({ ...prev, ...updates }));
      setScanSuccess(true);
      toast({ title: "Receipt scanned!", description: "Details filled in — review and confirm." });
    } catch (err) {
      toast({ title: "Could not read receipt", description: "Please fill in the details manually.", variant: "destructive" });
    } finally {
      setIsScanningReceipt(false);
    }
  }, [scanMutation, categories, toast]);

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleReceiptFile(file);
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.description) return;
    setTrialExpiredError(false);

    try {
      await createMutation.mutateAsync({
        data: {
          date: new Date(form.date).toISOString(),
          amount: parseFloat(form.amount).toFixed(2),
          type: form.type,
          description: form.description,
          merchant: form.merchant || undefined,
          categoryId: form.categoryId === "none" ? undefined : form.categoryId,
          receiptUrl: form.receiptUrl || undefined,
          source: "manual",
        },
      });
      refetch();
      setIsAddOpen(false);
      setReceiptPreview(null);
      setForm(defaultForm);
      toast({ title: "Expense added!" });
    } catch (err) {
      if (isTrialExpiredError(err)) {
        setTrialExpiredError(true);
      } else {
        toast({ title: "Failed to add expense", variant: "destructive" });
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync({ id });
      refetch();
      setDeleteId(null);
    } catch (err) {
      if (isTrialExpiredError(err)) setLocation("/premium");
    }
  };

  const monthLabel = formatMonthYear(currentMonth + "-01");
  const isCurrentMonth = currentMonth === format(new Date(), "yyyy-MM");

  const handleSnapReceipt = () => {
    openAdd();
    setTimeout(() => cameraInputRef.current?.click(), 100);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">{t("expenseTracker.title")}</h1>
          <p className="text-muted-foreground">{t("expenseTracker.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 bg-white border rounded-xl px-3 py-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold w-28 text-center">{monthLabel}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth} disabled={isCurrentMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Action bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          size="lg"
          className="h-14 gap-2 text-base"
          onClick={handleSnapReceipt}
        >
          <Camera className="w-5 h-5" />
          {t("expenseTracker.actions.snapReceipt")}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-14 gap-2 text-base bg-white"
          onClick={() => openAdd()}
        >
          <Plus className="w-5 h-5" />
          {t("expenseTracker.actions.addManually")}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-card border rounded-xl p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("expenseTracker.summary.today")}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(todayTotal)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("expenseTracker.summary.expenseCount", { count: todayTransactions.length })}
          </p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("expenseTracker.summary.monthExpenses")}</p>
          <p className="text-xl font-bold text-red-500 mt-1">{formatCurrency(totalExpenses)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("expenseTracker.summary.entryCount", { count: expenses.length })}
          </p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("expenseTracker.summary.monthIncome")}</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(totalIncome)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("expenseTracker.summary.entryCount", { count: incomeEntryCount })}
            {configuredSalary > 0 && income.length === 0 && (
              <span className="ml-1">{t("expenseTracker.summary.salary")}</span>
            )}
          </p>
        </div>
      </div>

      {/* Transaction list */}
      {sortedDays.length === 0 ? (
        <div className="bg-card border rounded-xl p-12 text-center">
          <Receipt className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-lg font-semibold text-foreground mb-1">{t("expenseTracker.empty.title")}</p>
          <p className="text-sm text-muted-foreground mb-6">{t("expenseTracker.empty.subtitle", { month: monthLabel })}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-sm mx-auto">
            <Button
              size="lg"
              className="h-12 gap-2"
              onClick={handleSnapReceipt}
            >
              <Camera className="w-5 h-5" />
              {t("expenseTracker.actions.snapReceipt")}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 gap-2 bg-white"
              onClick={() => openAdd()}
            >
              <Plus className="w-5 h-5" />
              {t("expenseTracker.actions.addManually")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDays.map((day) => {
            const dayDate = parseISO(day);
            const dayLabel = isToday(dayDate)
              ? t("expenseTracker.today")
              : dayDate.toLocaleDateString(region.locale, { weekday: "long", day: "numeric", month: "short" });
            const dayTotal = grouped[day].reduce((s, t) => s + parseFloat(t.amount), 0);

            return (
              <div key={day} className="bg-card border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b">
                  <span className="text-sm font-semibold text-foreground">{dayLabel}</span>
                  <span className="text-sm font-medium text-muted-foreground">{formatCurrency(dayTotal)}</span>
                </div>
                <div className="divide-y">
                  {grouped[day].map((tx) => (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-3 group">
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", getCategoryColor(tx.categoryName))}>
                        {getCategoryIcon(tx.categoryName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {tx.merchant ? tx.merchant : (tx.categoryName ?? t("expenseTracker.uncategorised"))}
                          {tx.receiptUrl && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-primary">
                              <Receipt className="w-3 h-3" /> {t("expenseTracker.receipt")}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className="text-sm font-semibold text-foreground">{formatCurrency(parseFloat(tx.amount))}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                          onClick={() => openEdit(tx)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                          onClick={() => setDeleteId(tx.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hidden camera/file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraCapture}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCameraCapture}
      />

      {/* Add Expense Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              {t("expenseTracker.addDialog.title")}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {trialExpiredError && (
              <TrialExpiredPrompt action="add expenses" />
            )}
            {/* Receipt scan section */}
            <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 p-3 text-center space-y-2">
              {isScanningReceipt ? (
                <div className="flex flex-col items-center gap-2 py-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">{t("expenseTracker.addDialog.scanning")}</p>
                </div>
              ) : receiptPreview ? (
                <div className="space-y-2">
                  <div className="relative inline-block">
                    <img src={receiptPreview} alt="Receipt" className="max-h-32 rounded-lg mx-auto object-contain" />
                    {scanSuccess && (
                      <div className="absolute -top-2 -right-2 bg-emerald-500 text-white rounded-full p-0.5">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {scanSuccess
                      ? t("expenseTracker.addDialog.scanSuccess")
                      : t("expenseTracker.addDialog.scanFailed")}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="w-3.5 h-3.5 mr-1" /> {t("expenseTracker.addDialog.retake")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 py-1">
                  <p className="text-xs text-muted-foreground">{t("expenseTracker.addDialog.scanHint")}</p>
                  <div className="flex justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      <Camera className="w-4 h-4" /> {t("expenseTracker.addDialog.camera")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImageIcon className="w-4 h-4" /> {t("expenseTracker.addDialog.gallery")}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Type toggle */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={form.type === "debit" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setForm((f) => ({ ...f, type: "debit" }))}
              >
                {t("expenseTracker.addDialog.expense")}
              </Button>
              <Button
                type="button"
                variant={form.type === "credit" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setForm((f) => ({ ...f, type: "credit" }))}
              >
                {t("expenseTracker.addDialog.income")}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("expenseTracker.addDialog.date")}</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("expenseTracker.addDialog.amount", { currency: region.currency })}</Label>
                <Input
                  type="number"
                  step={decimalStep}
                  min="0"
                  placeholder={decimalStep === "1" ? "0" : "0.00"}
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("expenseTracker.addDialog.descriptionLabel")}</Label>
              <Input
                placeholder={t("expenseTracker.addDialog.descriptionPlaceholder")}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("expenseTracker.addDialog.merchant")}</Label>
              <Input
                placeholder={t("expenseTracker.addDialog.merchantPlaceholder")}
                value={form.merchant}
                onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("expenseTracker.addDialog.category")}</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("expenseTracker.addDialog.selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("expenseTracker.uncategorised")}</SelectItem>
                  {(categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t("expenseTracker.addDialog.save")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Dialog */}
      <Dialog open={!!editingTx} onOpenChange={(open) => { if (!open) setEditingTx(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              {t("expenseTracker.editDialog.title")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 mt-2">
            {editTrialExpiredError && (
              <TrialExpiredPrompt action="edit transactions" />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={editData.type === "debit" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setEditData((d) => ({ ...d, type: "debit" }))}
              >
                {t("expenseTracker.editDialog.expense")}
              </Button>
              <Button
                type="button"
                variant={editData.type === "credit" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setEditData((d) => ({ ...d, type: "credit" }))}
              >
                {t("expenseTracker.editDialog.income")}
              </Button>
            </div>
            {editingTx && editData.type !== editingTx.type && (
              <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span className="flex-1">
                  {t("expenseTracker.editDialog.typeChangeWarning", {
                    from: editingTx.type === "debit" ? t("expenseTracker.editDialog.expense") : t("expenseTracker.editDialog.income"),
                    to: editData.type === "debit" ? t("expenseTracker.editDialog.expense") : t("expenseTracker.editDialog.income"),
                  })}
                </span>
                <button
                  type="button"
                  className="underline font-medium ml-2 whitespace-nowrap"
                  onClick={() => setEditData((d) => ({ ...d, type: editingTx.type }))}
                >
                  {t("expenseTracker.editDialog.revert")}
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("expenseTracker.editDialog.date")}</Label>
                <Input
                  type="date"
                  value={editData.date}
                  onChange={(e) => setEditData((d) => ({ ...d, date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("expenseTracker.editDialog.amount", { currency: region.currency })}</Label>
                <Input
                  type="number"
                  step={decimalStep}
                  min="0"
                  placeholder={decimalStep === "1" ? "0" : "0.00"}
                  value={editData.amount}
                  onChange={(e) => setEditData((d) => ({ ...d, amount: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("expenseTracker.editDialog.descriptionLabel")}</Label>
              <Input
                placeholder={t("expenseTracker.editDialog.descriptionPlaceholder")}
                value={editData.description}
                onChange={(e) => setEditData((d) => ({ ...d, description: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("expenseTracker.editDialog.merchant")}</Label>
              <Input
                placeholder={t("expenseTracker.editDialog.merchantPlaceholder")}
                value={editData.merchant}
                onChange={(e) => setEditData((d) => ({ ...d, merchant: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("expenseTracker.editDialog.account")}</Label>
              <Select value={editData.accountId} onValueChange={(v) => setEditData((d) => ({ ...d, accountId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t("expenseTracker.editDialog.noAccount")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("expenseTracker.editDialog.noAccount")}</SelectItem>
                  {(accounts ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}{a.bankName ? ` — ${a.bankName}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("expenseTracker.editDialog.category")}</Label>
              <Select value={editData.categoryId} onValueChange={(v) => setEditData((d) => ({ ...d, categoryId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t("expenseTracker.editDialog.selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("expenseTracker.editDialog.uncategorised")}</SelectItem>
                  {(categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t("expenseTracker.editDialog.save")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("expenseTracker.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("expenseTracker.deleteDialog.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("expenseTracker.deleteDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              {t("expenseTracker.deleteDialog.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
