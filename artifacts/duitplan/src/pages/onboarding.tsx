import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCompleteOnboarding,
  getGetMeQueryKey,
  useUpdateProfile,
  useCreateAccount,
  useCreateCommitment,
  useCreateDebt,
  useCreateGoal,
  useListCategories,
  useUpdateCategory,
  useGetMe,
  type CreateGoalBodyCategory,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Plus,
  Trash2,
  Wallet,
  PiggyBank,
  Building2,
  CreditCard,
  Target,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRegion } from "@/hooks/useRegion";

const TOTAL_STEPS = 8;

const ACCOUNT_PRESETS = [
  { id: "cash", type: "cash", icon: Wallet, i18nKey: "presetCash", bankDefault: "" },
  { id: "savings", type: "savings", icon: PiggyBank, i18nKey: "presetSavings", bankDefault: "BIBD" },
  { id: "current", type: "current", icon: Building2, i18nKey: "presetCurrent", bankDefault: "BIBD" },
];

const COMMITMENT_PRESETS = [
  { id: "rent", icon: "🏢" },
  { id: "utilities", icon: "💡" },
  { id: "internet_phone", icon: "📱" },
  { id: "insurance_takaful", icon: "🛡️" },
  { id: "family_support", icon: "👨‍👩‍👧" },
  { id: "school_fees", icon: "📚" },
  { id: "childcare", icon: "👶" },
  { id: "subscription", icon: "📺" },
];

const DEBT_PRESETS = [
  { id: "car_loan", icon: "🚗", debtType: "car_loan" },
  { id: "personal_financing", icon: "💰", debtType: "personal_loan" },
  { id: "house_financing", icon: "🏠", debtType: "mortgage" },
  { id: "credit_card", icon: "💳", debtType: "credit_card" },
  { id: "other_debt", icon: "📋", debtType: "other" },
];

const GOAL_PRESETS: { id: string; icon: string; category: CreateGoalBodyCategory }[] = [
  { id: "presetEmergency", icon: "🛟", category: "emergency" },
  { id: "presetHariRaya", icon: "🌙", category: "savings" },
  { id: "presetHajj", icon: "🕋", category: "savings" },
  { id: "presetHouse", icon: "🏠", category: "savings" },
  { id: "presetCar", icon: "🚗", category: "savings" },
  { id: "presetWedding", icon: "💍", category: "savings" },
];

type AccountRow = { id: string; name: string; type: string; bankName: string; balance: string };
type SelectedCommitment = { id: string; presetKey: string | null; label: string; amount: string; isCustom?: boolean };
type SelectedDebt = {
  id: string;
  presetKey: string;
  label: string;
  debtType: string;
  monthlyPayment: string;
  outstandingBalance: string;
  paidThisMonth: boolean;
};
type SelectedGoal = { id: string; label: string; category: CreateGoalBodyCategory; targetAmount: string; monthlyContribution: string };

// Default expense categories (seeded in api-server/src/lib/seed.ts) that are
// already covered by the corresponding fixed-bill commitment preset. When the
// user picks one of these commitments in step 5, we hide the matching envelope
// in step 6 so they don't budget the same money twice.
const COMMITMENT_TO_CATEGORY_NAMES: Record<string, string[]> = {
  utilities: ["Bills and Utilities"],
  internet_phone: ["Phone and Internet"],
  insurance_takaful: ["Insurance and Takaful"],
  family_support: ["Family Support"],
};

function toNum(s: string): number {
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

let __idCounter = 0;
/**
 * Returns a unique-per-session id suffix. Date.now() collides on rapid
 * synchronous clicks (resolution = 1ms), which would break our
 * "each preset click adds a new instance" UX. Pairing time with a counter
 * guarantees uniqueness even under React batching.
 */
function uniqueId(): string {
  __idCounter += 1;
  return `${Date.now()}_${__idCounter}`;
}

/**
 * Returns true when today's day-of-month is at or past the user's payday for
 * the current month, with the payday clamped to the last day of the month so
 * payday=31 is treated as the last day in shorter months (e.g. Feb 28/29).
 */
function computePaidThisMonth(paydayStr: string): boolean {
  const payday = parseInt(paydayStr, 10);
  if (!isFinite(payday) || payday <= 0) return false;
  const now = new Date();
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const effectivePayday = Math.min(payday, lastDayOfMonth);
  return now.getDate() >= effectivePayday;
}

function formatMoney(n: number, currency: string): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${currency} ${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function BranchBadge({ kind }: { kind: "debts" | "bills" | "envelopes" | "goals" }) {
  const { t } = useTranslation();
  const styles = {
    debts: "bg-rose-100 text-rose-800 ring-rose-200",
    bills: "bg-sky-100 text-sky-800 ring-sky-200",
    envelopes: "bg-sky-100 text-sky-800 ring-sky-200",
    goals: "bg-teal-100 text-teal-800 ring-teal-200",
  } as const;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ring-1", styles[kind])}>
      {t(`onboarding.branch.${kind}`)}
    </span>
  );
}

function MoneyFlowDiagram({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={cn("rounded-2xl bg-gradient-to-b from-primary/5 to-background border border-primary/10 p-4", compact ? "" : "p-5")}>
      <div className="flex flex-col items-center gap-2">
        <div className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-semibold">
          💵 {t("onboarding.welcome.flowIncome")}
        </div>
        <div className="text-muted-foreground text-xs">↓</div>
        <div className="px-4 py-2 rounded-lg bg-white border border-border text-sm font-semibold shadow-sm">
          🏦 {t("onboarding.welcome.flowPool")}
        </div>
        <div className="text-muted-foreground text-xs">↓</div>
        <div className="grid grid-cols-3 gap-2 w-full">
          <div className="px-2 py-1.5 rounded-lg bg-rose-100 text-rose-800 text-[11px] font-medium text-center">
            🏛 {t("onboarding.welcome.flowDebts")}
          </div>
          <div className="px-2 py-1.5 rounded-lg bg-sky-100 text-sky-800 text-[11px] font-medium text-center">
            ✉️ {t("onboarding.welcome.flowBills")}
          </div>
          <div className="px-2 py-1.5 rounded-lg bg-teal-100 text-teal-800 text-[11px] font-medium text-center">
            🎯 {t("onboarding.welcome.flowGoals")}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Onboarding() {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const { region, decimalStep } = useRegion();
  const { data: user } = useGetMe();
  const { data: existingCategories } = useListCategories();

  const [accounts, setAccounts] = useState<AccountRow[]>([
    { id: "cash", name: t("onboarding.pool.presetCash"), type: "cash", bankName: "", balance: "" },
    { id: "savings", name: "BIBD Savings", type: "savings", bankName: "BIBD", balance: "" },
  ]);

  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [payday, setPayday] = useState("25");

  const [selectedDebts, setSelectedDebts] = useState<SelectedDebt[]>([]);
  // When the user changes their payday on step 3 we must recompute the
  // "paid this month" default for any debts they've already added — but only
  // for ones they haven't manually toggled (tracked in manuallyTouchedDebtsRef).
  const manuallyTouchedDebtsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    setSelectedDebts((debts) => {
      const next = computePaidThisMonth(payday);
      let changed = false;
      const updated = debts.map((d) => {
        if (manuallyTouchedDebtsRef.current.has(d.id)) return d;
        if (d.paidThisMonth === next) return d;
        changed = true;
        return { ...d, paidThisMonth: next };
      });
      return changed ? updated : debts;
    });
  }, [payday]);
  const [selectedCommitments, setSelectedCommitments] = useState<SelectedCommitment[]>([]);
  const [customCommitment, setCustomCommitment] = useState({ label: "", amount: "" });
  const [showCustomCommitment, setShowCustomCommitment] = useState(false);

  const [envelopes, setEnvelopes] = useState<Record<string, string>>({});
  const [selectedGoals, setSelectedGoals] = useState<SelectedGoal[]>([]);

  const updateProfileMutation = useUpdateProfile();
  const createAccountMutation = useCreateAccount();
  const createCommitmentMutation = useCreateCommitment();
  const createDebtMutation = useCreateDebt();
  const createGoalMutation = useCreateGoal();
  const updateCategoryMutation = useUpdateCategory();
  const completeOnboardingMutation = useCompleteOnboarding();
  const queryClient = useQueryClient();

  // Names of categories already covered by the user's selected commitments.
  // These envelopes are hidden in step 6 to avoid double-budgeting (a fixed
  // bill in step 5 + a variable envelope target for the same category).
  const hiddenCategoryNames = useMemo(() => {
    const names = new Set<string>();
    for (const c of selectedCommitments) {
      if (!c.presetKey) continue;
      const overlaps = COMMITMENT_TO_CATEGORY_NAMES[c.presetKey];
      if (overlaps) overlaps.forEach((n) => names.add(n));
    }
    return names;
  }, [selectedCommitments]);

  const allDefaultExpenseCategories = useMemo(
    () => (existingCategories ?? []).filter((c) => c.kind === "expense" && c.isDefault),
    [existingCategories],
  );

  const expenseCategories = useMemo(
    () => allDefaultExpenseCategories.filter((c) => !hiddenCategoryNames.has(c.name)),
    [allDefaultExpenseCategories, hiddenCategoryNames],
  );

  const hiddenCategoryNamesList = useMemo(
    () =>
      allDefaultExpenseCategories.filter((c) => hiddenCategoryNames.has(c.name)).map((c) => c.name),
    [allDefaultExpenseCategories, hiddenCategoryNames],
  );

  const handleNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const updateAccount = (id: string, field: keyof Omit<AccountRow, "id">, value: string) => {
    setAccounts((a) => a.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const addAccount = (preset?: typeof ACCOUNT_PRESETS[0]) => {
    const id = `acct_${uniqueId()}`;
    if (preset) {
      setAccounts((a) => [
        ...a,
        { id, name: t(`onboarding.pool.${preset.i18nKey}`), type: preset.type, bankName: preset.bankDefault, balance: "" },
      ]);
    } else {
      setAccounts((a) => [...a, { id, name: "", type: "savings", bankName: "", balance: "" }]);
    }
  };

  const removeAccount = (id: string) => {
    setAccounts((a) => a.filter((row) => row.id !== id));
  };

  const poolTotal = accounts.reduce((sum, a) => sum + toNum(a.balance), 0);

  // Each preset click adds a NEW instance. The user can have multiple loans /
  // bills of the same type (e.g. two car loans from different banks) and the
  // unique instance id keeps them independent.
  const addCommitmentFromPreset = (preset: typeof COMMITMENT_PRESETS[0]) => {
    const baseLabel = t(`onboarding.commitmentPresets.${preset.id}`);
    const existingOfPreset = selectedCommitments.filter((c) => c.presetKey === preset.id).length;
    const label = existingOfPreset === 0 ? baseLabel : `${baseLabel} ${existingOfPreset + 1}`;
    const id = `${preset.id}_${uniqueId()}`;
    setSelectedCommitments([...selectedCommitments, { id, presetKey: preset.id, label, amount: "" }]);
  };

  const updateCommitmentAmount = (id: string, amount: string) => {
    setSelectedCommitments(selectedCommitments.map((c) => (c.id === id ? { ...c, amount } : c)));
  };

  const updateCommitmentLabel = (id: string, label: string) => {
    setSelectedCommitments(selectedCommitments.map((c) => (c.id === id ? { ...c, label } : c)));
  };

  const addCustomCommitment = () => {
    if (!customCommitment.label) return;
    const id = `custom_${uniqueId()}`;
    setSelectedCommitments([
      ...selectedCommitments,
      { id, presetKey: null, label: customCommitment.label, amount: customCommitment.amount, isCustom: true },
    ]);
    setCustomCommitment({ label: "", amount: "" });
    setShowCustomCommitment(false);
  };

  const addDebtFromPreset = (preset: typeof DEBT_PRESETS[0]) => {
    const baseLabel = t(`onboarding.debtPresets.${preset.id}`);
    const existingOfPreset = selectedDebts.filter((d) => d.presetKey === preset.id).length;
    const label = existingOfPreset === 0 ? baseLabel : `${baseLabel} ${existingOfPreset + 1}`;
    const id = `${preset.id}_${uniqueId()}`;
    // Auto-tick "already paid this month" when today's day-of-month >= the
    // payday clamped to this month's length (e.g. payday=31 in Feb means
    // payday is treated as the last day of Feb).
    const paidThisMonth = computePaidThisMonth(payday);
    setSelectedDebts([
      ...selectedDebts,
      {
        id,
        presetKey: preset.id,
        label,
        debtType: preset.debtType,
        monthlyPayment: "",
        outstandingBalance: "",
        paidThisMonth,
      },
    ]);
  };

  function updateDebt<K extends keyof Omit<SelectedDebt, "id" | "presetKey" | "debtType">>(
    id: string,
    field: K,
    value: SelectedDebt[K],
  ) {
    setSelectedDebts(selectedDebts.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
  }

  const setEnvelope = (categoryId: string, value: string) => {
    setEnvelopes((prev) => ({ ...prev, [categoryId]: value }));
  };

  const toggleGoalPreset = (preset: typeof GOAL_PRESETS[0]) => {
    const exists = selectedGoals.find((g) => g.id === preset.id);
    if (exists) {
      setSelectedGoals(selectedGoals.filter((g) => g.id !== preset.id));
    } else {
      const label = t(`onboarding.goals.${preset.id}`);
      setSelectedGoals([...selectedGoals, { id: preset.id, label, category: preset.category, targetAmount: "", monthlyContribution: "" }]);
    }
  };

  const updateGoalTarget = (id: string, value: string) => {
    setSelectedGoals(selectedGoals.map((g) => (g.id === id ? { ...g, targetAmount: value } : g)));
  };

  const updateGoalMonthly = (id: string, value: string) => {
    setSelectedGoals(selectedGoals.map((g) => (g.id === id ? { ...g, monthlyContribution: value } : g)));
  };

  const totalDebts = selectedDebts.reduce((sum, d) => sum + toNum(d.monthlyPayment), 0);
  const totalBills = selectedCommitments.reduce((sum, c) => sum + toNum(c.amount), 0);
  const totalEnvelopes = Object.values(envelopes).reduce((sum, v) => sum + toNum(v), 0);
  const totalGoals = selectedGoals.reduce((sum, g) => sum + toNum(g.monthlyContribution), 0);
  const incomeNum = toNum(monthlyIncome);
  const leftover = incomeNum - totalDebts - totalBills - totalEnvelopes - totalGoals;

  const [isFinishing, setIsFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const handleComplete = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    setFinishError(null);
    try {
      for (const a of accounts) {
        if (!a.name) continue;
        await createAccountMutation.mutateAsync({
          data: { name: a.name, type: a.type, bankName: a.bankName || null, balance: a.balance || "0" },
        });
      }
      if (monthlyIncome) {
        await updateProfileMutation.mutateAsync({
          data: { monthlyIncome, payday: parseInt(payday, 10) },
        });
      }
      for (const d of selectedDebts) {
        if (d.monthlyPayment) {
          await createDebtMutation.mutateAsync({
            data: {
              lender: d.label || t(`onboarding.debtPresets.${d.presetKey}`),
              debtType: d.debtType,
              outstandingBalance: d.outstandingBalance || "0",
              monthlyPayment: d.monthlyPayment,
              paidThisMonth: d.paidThisMonth,
            },
          });
        }
      }
      for (const c of selectedCommitments) {
        if (c.label && c.amount) {
          await createCommitmentMutation.mutateAsync({
            data: { label: c.label, amount: c.amount, recurrence: "monthly" },
          });
        }
      }
      for (const [categoryId, value] of Object.entries(envelopes)) {
        if (toNum(value) > 0) {
          const normalized = value.includes(".") ? value : `${value}.00`;
          await updateCategoryMutation.mutateAsync({
            id: categoryId,
            data: { defaultBudget: normalized },
          });
        }
      }
      for (const g of selectedGoals) {
        if (g.label && toNum(g.targetAmount) > 0) {
          await createGoalMutation.mutateAsync({
            data: { title: g.label, category: g.category, targetAmount: g.targetAmount },
          });
        }
      }
      await completeOnboardingMutation.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setLocation("/dashboard");
    } catch (e) {
      console.error("Failed to complete onboarding", e);
      const msg = e instanceof Error ? e.message : String(e);
      setFinishError(msg);
    } finally {
      setIsFinishing(false);
    }
  };

  const rawFirstName = user?.profile?.fullName?.split(" ")[0]?.trim() ?? "";
  const firstName = rawFirstName || null;

  const validPool = accounts.some((a) => a.name && toNum(a.balance) >= 0 && a.balance !== "");

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex justify-between items-center">
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i + 1 === step ? "w-6 bg-primary" : i + 1 < step ? "w-6 bg-primary/40" : "w-3 bg-border",
                )}
              />
            ))}
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {t("onboarding.stepOf", { step, total: TOTAL_STEPS })}
          </span>
        </div>

        <Card className="border-0 shadow-lg overflow-hidden bg-white">
          <div className="h-1 w-full bg-primary/10">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
          <CardContent className="p-8 sm:p-10 min-h-[500px] flex flex-col">

            {step === 1 && (
              <div className="flex-1 flex flex-col justify-center text-center">
                <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-6 shadow-md">
                  <span className="text-white font-bold text-3xl">D</span>
                </div>
                <h1 className="text-3xl font-bold mb-3">
                  {firstName
                    ? t("onboarding.welcome.title", { name: firstName })
                    : t("onboarding.welcome.titleNoName")}
                </h1>
                <p className="text-lg text-muted-foreground mb-2 max-w-md mx-auto">
                  {t("onboarding.welcome.subtitle")}
                </p>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  {t("onboarding.welcome.hint")}
                </p>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {t("onboarding.welcome.flowTitle")}
                </p>
                <div className="max-w-sm mx-auto w-full mb-8">
                  <MoneyFlowDiagram />
                </div>
                <Button size="lg" className="w-full sm:w-auto sm:mx-auto px-10 h-12" onClick={handleNext}>
                  {t("onboarding.welcome.begin")} <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="flex-1 flex flex-col">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">{t("onboarding.pool.title")}</h2>
                  <p className="text-muted-foreground">{t("onboarding.pool.subtitle")}</p>
                </div>

                <div className="space-y-3 mb-4">
                  {accounts.map((a) => {
                    const preset = ACCOUNT_PRESETS.find((p) => p.type === a.type);
                    const Icon = preset?.icon ?? Wallet;
                    return (
                      <div key={a.id} className="border rounded-xl p-4 bg-muted/10">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            <Icon className="w-4 h-4" />
                          </div>
                          <Input
                            placeholder={t("onboarding.pool.namePlaceholder")}
                            value={a.name}
                            onChange={(e) => updateAccount(a.id, "name", e.target.value)}
                            className="flex-1 h-9 text-sm font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => removeAccount(a.id)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{t("onboarding.pool.bankLabel")}</Label>
                            <Input
                              placeholder={t("onboarding.pool.bankPlaceholder")}
                              value={a.bankName}
                              onChange={(e) => updateAccount(a.id, "bankName", e.target.value)}
                              className="h-9 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              {t("onboarding.pool.balanceLabel", { currency: region.currency })}
                            </Label>
                            <Input
                              type="number"
                              step={decimalStep}
                              min="0"
                              placeholder={decimalStep === "1" ? "0" : "0.00"}
                              value={a.balance}
                              onChange={(e) => updateAccount(a.id, "balance", e.target.value)}
                              className="h-9 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {ACCOUNT_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addAccount(p)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-border text-xs font-medium hover:bg-muted/40"
                    >
                      <Plus className="w-3 h-3" /> {t(`onboarding.pool.${p.i18nKey}`)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => addAccount()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-border text-xs font-medium hover:bg-muted/40"
                  >
                    <Plus className="w-3 h-3" /> {t("onboarding.pool.addAccount")}
                  </button>
                </div>

                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-emerald-900">{t("onboarding.pool.totalLabel")}</span>
                  <span className="text-lg font-bold text-emerald-900">{formatMoney(poolTotal, region.currency)}</span>
                </div>

                {!validPool && (
                  <p className="text-xs text-muted-foreground mt-3">{t("onboarding.pool.emptyHint")}</p>
                )}

                <div className="mt-auto pt-6 flex justify-between">
                  <Button variant="outline" onClick={handleBack}>
                    <ArrowLeft className="mr-2 w-4 h-4" /> {t("onboarding.back")}
                  </Button>
                  <Button onClick={handleNext} disabled={!validPool}>
                    {t("onboarding.continue")} <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="flex-1 flex flex-col">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">{t("onboarding.income.title")}</h2>
                  <p className="text-muted-foreground">{t("onboarding.income.subtitle")}</p>
                </div>
                <div className="space-y-6 max-w-sm">
                  <div className="space-y-2">
                    <Label htmlFor="income" className="text-sm font-medium">
                      {t("onboarding.income.salaryLabel")}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                        {region.currency}
                      </span>
                      <Input
                        id="income"
                        type="number"
                        step={decimalStep}
                        min="0"
                        className="pl-14 h-12 text-lg font-semibold"
                        placeholder={decimalStep === "1" ? "0" : "0.00"}
                        value={monthlyIncome}
                        onChange={(e) => setMonthlyIncome(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{t("onboarding.income.salaryHint")}</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("onboarding.income.paydayLabel")}</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 15, 25, 28].map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setPayday(String(day))}
                          className={cn(
                            "h-12 rounded-lg border text-sm font-medium transition-all",
                            payday === String(day)
                              ? "bg-primary text-white border-primary shadow-sm"
                              : "bg-white hover:bg-muted/40 text-foreground",
                          )}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{t("onboarding.income.otherDay")}</span>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        className="w-20 h-8 text-sm"
                        placeholder="e.g. 20"
                        value={![1, 15, 25, 28].includes(Number(payday)) ? payday : ""}
                        onChange={(e) => setPayday(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900">
                  <span className="mt-0.5 shrink-0">🌅</span>
                  <span>{t("onboarding.income.hariGajiHint")}</span>
                </div>

                <div className="mt-auto pt-8 flex justify-between">
                  <Button variant="outline" onClick={handleBack}>
                    <ArrowLeft className="mr-2 w-4 h-4" /> {t("onboarding.back")}
                  </Button>
                  <Button onClick={handleNext} disabled={!monthlyIncome}>
                    {t("onboarding.continue")} <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="flex-1 flex flex-col">
                <div className="mb-6">
                  <div className="mb-2"><BranchBadge kind="debts" /></div>
                  <h2 className="text-2xl font-bold mb-2">{t("onboarding.loans.title")}</h2>
                  <p className="text-muted-foreground">{t("onboarding.loans.subtitle")}</p>
                </div>

                <div className="flex flex-wrap gap-2 mb-5">
                  {DEBT_PRESETS.map((preset) => {
                    const count = selectedDebts.filter((d) => d.presetKey === preset.id).length;
                    const label = t(`onboarding.debtPresets.${preset.id}`);
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => addDebtFromPreset(preset)}
                        title={t("onboarding.loans.tapToAdd")}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all",
                          count > 0
                            ? "bg-primary/10 border-primary/40 text-primary"
                            : "bg-white hover:bg-muted/30 text-foreground",
                        )}
                      >
                        <span>{preset.icon}</span>
                        {label}
                        <Plus className="w-3 h-3 opacity-70" />
                        {count > 0 && (
                          <span className="ml-1 text-[10px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                            ×{count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedDebts.length > 0 && (
                  <div className="space-y-3 mb-4 overflow-y-auto max-h-[340px] pr-1">
                    {selectedDebts.map((d) => (
                      <div key={d.id} className="p-4 rounded-xl border bg-muted/20">
                        <div className="flex justify-between items-start gap-2 mb-3">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              {t("onboarding.loans.lenderLabel")}
                            </Label>
                            <Input
                              className="h-9 text-sm font-medium"
                              placeholder={t("onboarding.loans.lenderPlaceholder")}
                              value={d.label}
                              onChange={(e) => updateDebt(d.id, "label", e.target.value)}
                            />
                          </div>
                          <button
                            onClick={() => setSelectedDebts(selectedDebts.filter((x) => x.id !== d.id))}
                            className="text-muted-foreground hover:text-destructive mt-6"
                            aria-label="Remove debt"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              {t("onboarding.loans.monthlyPaymentLabel", { currency: region.currency })}
                            </Label>
                            <Input
                              type="number"
                              step={decimalStep}
                              placeholder={decimalStep === "1" ? "e.g. 450" : "e.g. 450.00"}
                              className="h-9 text-sm"
                              value={d.monthlyPayment}
                              onChange={(e) => updateDebt(d.id, "monthlyPayment", e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              {t("onboarding.loans.outstandingLabel")}
                            </Label>
                            <Input
                              type="number"
                              step={decimalStep}
                              placeholder={decimalStep === "1" ? "e.g. 18500" : "e.g. 18,500.00"}
                              className="h-9 text-sm"
                              value={d.outstandingBalance}
                              onChange={(e) => updateDebt(d.id, "outstandingBalance", e.target.value)}
                            />
                          </div>
                        </div>
                        <label className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-white border border-emerald-200 cursor-pointer hover:bg-emerald-50/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={d.paidThisMonth}
                            onChange={(e) => {
                              manuallyTouchedDebtsRef.current.add(d.id);
                              updateDebt(d.id, "paidThisMonth", e.target.checked);
                            }}
                            className="mt-0.5 h-4 w-4 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="flex-1 text-xs text-emerald-900 leading-snug">
                            <span className="font-semibold">{t("onboarding.loans.paidThisMonthLabel")}</span>
                            <br />
                            <span className="text-emerald-800/80">
                              {t("onboarding.loans.paidThisMonthHint", {
                                month: new Date().toLocaleDateString(undefined, { month: "long" }),
                              })}
                            </span>
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}

                {selectedDebts.length === 0 && (
                  <div className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-4 mb-4">
                    {t("onboarding.loans.noLoans")}
                  </div>
                )}

                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-900">
                  <span className="mt-0.5 shrink-0">🌅</span>
                  <span>{t("onboarding.loans.hariGajiHint")}</span>
                </div>

                <div className="mt-auto pt-6 flex justify-between">
                  <div>
                    <Button variant="outline" onClick={handleBack}>
                      <ArrowLeft className="mr-2 w-4 h-4" /> {t("onboarding.back")}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    {selectedDebts.length === 0 && (
                      <Button variant="ghost" onClick={handleNext}>
                        {t("onboarding.skip")}
                      </Button>
                    )}
                    <Button onClick={handleNext}>
                      {t("onboarding.continue")} <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="flex-1 flex flex-col">
                <div className="mb-6">
                  <div className="mb-2"><BranchBadge kind="bills" /></div>
                  <h2 className="text-2xl font-bold mb-2">{t("onboarding.commitments.title")}</h2>
                  <p className="text-muted-foreground">{t("onboarding.commitments.subtitle")}</p>
                </div>

                <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 text-sm text-blue-800">
                  <span className="mt-0.5 shrink-0">💡</span>
                  <span>{t("onboarding.commitments.loansHelperNote")}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  {COMMITMENT_PRESETS.map((preset) => {
                    const count = selectedCommitments.filter((c) => c.presetKey === preset.id).length;
                    const label = t(`onboarding.commitmentPresets.${preset.id}`);
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => addCommitmentFromPreset(preset)}
                        title={t("onboarding.loans.tapToAdd")}
                        className={cn(
                          "p-3 rounded-xl border text-left text-sm transition-all relative",
                          count > 0
                            ? "border-primary bg-primary/8 ring-1 ring-primary/40"
                            : "border-border bg-white hover:bg-muted/30",
                        )}
                      >
                        <div className="text-xl mb-1">{preset.icon}</div>
                        <div className={cn("font-medium text-xs", count > 0 ? "text-primary" : "text-foreground")}>
                          {label}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <Plus className="w-3 h-3 text-muted-foreground" />
                          {count > 0 && (
                            <span className="text-[10px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                              ×{count}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedCommitments.length > 0 && (
                  <div className="border rounded-xl bg-muted/20 p-4 mb-4 space-y-2 max-h-[300px] overflow-y-auto">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t("onboarding.commitments.amountHeader", { currency: region.currency })}
                    </p>
                    {selectedCommitments.map((c) => (
                      <div key={c.id} className="flex items-center gap-2">
                        <Input
                          className="flex-1 h-9 text-sm font-medium bg-white"
                          placeholder={t("onboarding.commitments.labelPlaceholder")}
                          value={c.label}
                          onChange={(e) => updateCommitmentLabel(c.id, e.target.value)}
                        />
                        <div className="relative w-32 shrink-0">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            {region.currency}
                          </span>
                          <Input
                            type="number"
                            step={decimalStep}
                            placeholder={decimalStep === "1" ? "0" : "0.00"}
                            className="pl-12 h-9 text-sm bg-white"
                            value={c.amount}
                            onChange={(e) => updateCommitmentAmount(c.id, e.target.value)}
                          />
                        </div>
                        <button
                          onClick={() => setSelectedCommitments(selectedCommitments.filter((x) => x.id !== c.id))}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                          aria-label="Remove bill"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {showCustomCommitment ? (
                  <div className="flex gap-2 items-end mb-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">{t("onboarding.commitments.customLabel")}</Label>
                      <Input
                        placeholder={t("onboarding.commitments.customPlaceholder")}
                        value={customCommitment.label}
                        onChange={(e) => setCustomCommitment({ ...customCommitment, label: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <div className="w-32 space-y-1">
                      <Label className="text-xs">
                        {t("onboarding.commitments.customAmount", { currency: region.currency })}
                      </Label>
                      <Input
                        type="number"
                        step={decimalStep}
                        placeholder={decimalStep === "1" ? "0" : "0.00"}
                        value={customCommitment.amount}
                        onChange={(e) => setCustomCommitment({ ...customCommitment, amount: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <Button size="sm" onClick={addCustomCommitment} disabled={!customCommitment.label}>
                      {t("onboarding.commitments.add")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowCustomCommitment(false)}>
                      {t("onboarding.commitments.cancel")}
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCustomCommitment(true)}
                    className="flex items-center gap-2 text-sm text-primary hover:underline mb-2"
                  >
                    <Plus className="w-4 h-4" /> {t("onboarding.commitments.addCustom")}
                  </button>
                )}

                <div className="mt-auto pt-6 flex justify-between">
                  <Button variant="outline" onClick={handleBack}>
                    <ArrowLeft className="mr-2 w-4 h-4" /> {t("onboarding.back")}
                  </Button>
                  <div className="flex gap-2">
                    {selectedCommitments.length === 0 && (
                      <Button variant="ghost" onClick={handleNext}>
                        {t("onboarding.skip")}
                      </Button>
                    )}
                    <Button onClick={handleNext}>
                      {t("onboarding.continue")} <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="flex-1 flex flex-col">
                <div className="mb-6">
                  <div className="mb-2"><BranchBadge kind="envelopes" /></div>
                  <h2 className="text-2xl font-bold mb-2">{t("onboarding.envelopes.title")}</h2>
                  <p className="text-muted-foreground">{t("onboarding.envelopes.subtitle")}</p>
                </div>

                <div className="space-y-2 mb-4 overflow-y-auto max-h-[320px] pr-1">
                  {expenseCategories.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/10">
                      <span className="text-sm flex-1 font-medium">{c.name}</span>
                      <div className="relative w-36">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          {region.currency}
                        </span>
                        <Input
                          type="number"
                          step={decimalStep}
                          min="0"
                          placeholder={decimalStep === "1" ? "0" : "0.00"}
                          className="pl-12 h-9 text-sm"
                          value={envelopes[c.id] ?? ""}
                          onChange={(e) => setEnvelope(c.id, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {hiddenCategoryNamesList.length > 0 && (
                  <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-3 text-xs text-blue-900">
                    <span className="mt-0.5 shrink-0">💡</span>
                    <span>
                      {t("onboarding.envelopes.coveredByCommitments", {
                        names: hiddenCategoryNamesList.join(", "),
                      })}
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mb-1">{t("onboarding.envelopes.helperNote")}</p>
                <p className="text-xs text-muted-foreground">{t("onboarding.envelopes.skipNote")}</p>

                <div className="mt-auto pt-6 flex justify-between">
                  <Button variant="outline" onClick={handleBack}>
                    <ArrowLeft className="mr-2 w-4 h-4" /> {t("onboarding.back")}
                  </Button>
                  <div className="flex gap-2">
                    {totalEnvelopes === 0 && (
                      <Button variant="ghost" onClick={handleNext}>
                        {t("onboarding.skip")}
                      </Button>
                    )}
                    <Button onClick={handleNext}>
                      {t("onboarding.continue")} <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 7 && (
              <div className="flex-1 flex flex-col">
                <div className="mb-6">
                  <div className="mb-2"><BranchBadge kind="goals" /></div>
                  <h2 className="text-2xl font-bold mb-2">{t("onboarding.goals.title")}</h2>
                  <p className="text-muted-foreground">{t("onboarding.goals.subtitle")}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  {GOAL_PRESETS.map((preset) => {
                    const selected = selectedGoals.find((g) => g.id === preset.id);
                    const label = t(`onboarding.goals.${preset.id}`);
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => toggleGoalPreset(preset)}
                        className={cn(
                          "p-3 rounded-xl border text-left text-sm transition-all",
                          selected
                            ? "border-teal-500 bg-teal-50 ring-1 ring-teal-300"
                            : "border-border bg-white hover:bg-muted/30",
                        )}
                      >
                        <div className="text-xl mb-1">{preset.icon}</div>
                        <div className={cn("font-medium text-xs", selected ? "text-teal-700" : "text-foreground")}>
                          {label}
                        </div>
                        {selected && <Check className="w-3 h-3 text-teal-700 mt-1" />}
                      </button>
                    );
                  })}
                </div>

                {selectedGoals.length > 0 && (
                  <div className="border rounded-xl bg-muted/20 p-4 mb-3 space-y-3">
                    {selectedGoals.map((g) => (
                      <div key={g.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-teal-600 shrink-0" />
                          <span className="text-sm flex-1 font-medium truncate">{g.label}</span>
                          <button
                            onClick={() => setSelectedGoals(selectedGoals.filter((x) => x.id !== g.id))}
                            className="text-muted-foreground hover:text-destructive shrink-0"
                            aria-label={`Remove ${g.label}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 block">
                              {t("onboarding.goals.targetShort")}
                            </Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                {region.currency}
                              </span>
                              <Input
                                type="number"
                                step={decimalStep}
                                placeholder={decimalStep === "1" ? "8000" : "0.00"}
                                className="pl-12 h-9 text-sm"
                                value={g.targetAmount}
                                onChange={(e) => updateGoalTarget(g.id, e.target.value)}
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-[10px] uppercase tracking-wider font-semibold text-teal-700 mb-1 block">
                              {t("onboarding.goals.monthlyShort")}
                            </Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                {region.currency}
                              </span>
                              <Input
                                type="number"
                                step={decimalStep}
                                placeholder={decimalStep === "1" ? "200" : "0.00"}
                                className="pl-12 h-9 text-sm"
                                value={g.monthlyContribution}
                                onChange={(e) => updateGoalMonthly(g.id, e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedGoals.length > 0 && (
                  <p className="text-xs text-muted-foreground mb-4 px-1">
                    {t("onboarding.goals.monthlyHint")}
                  </p>
                )}

                {selectedGoals.length === 0 && (
                  <div className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-4 mb-4">
                    {t("onboarding.goals.emptyHint")}
                  </div>
                )}

                <div className="mt-auto pt-6 flex justify-between">
                  <Button variant="outline" onClick={handleBack}>
                    <ArrowLeft className="mr-2 w-4 h-4" /> {t("onboarding.back")}
                  </Button>
                  <div className="flex gap-2">
                    {selectedGoals.length === 0 && (
                      <Button variant="ghost" onClick={handleNext}>
                        {t("onboarding.skip")}
                      </Button>
                    )}
                    <Button onClick={handleNext}>
                      {t("onboarding.continue")} <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 8 && (
              <div className="flex-1 flex flex-col">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">{t("onboarding.recap.title")}</h2>
                  <p className="text-muted-foreground">{t("onboarding.recap.subtitle")}</p>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    <span className="text-sm font-medium text-emerald-900">💵 {t("onboarding.recap.income")}</span>
                    <span className="font-semibold text-emerald-900">{formatMoney(incomeNum, region.currency)}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-2.5 rounded-lg bg-white border-2 border-primary/30">
                    <span className="text-sm font-semibold">🏦 {t("onboarding.recap.pool")}</span>
                    <span className="font-bold">{formatMoney(poolTotal, region.currency)}</span>
                  </div>

                  <div className="text-center text-muted-foreground text-xs">↓ split into ↓</div>

                  <div className="flex justify-between items-center px-4 py-2.5 rounded-lg bg-rose-50 border border-rose-200">
                    <span className="text-sm font-medium text-rose-900 flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5" /> {t("onboarding.recap.debts")}
                    </span>
                    <span className="font-semibold text-rose-900">−{formatMoney(totalDebts, region.currency)}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-2.5 rounded-lg bg-sky-50 border border-sky-200">
                    <span className="text-sm font-medium text-sky-900">📋 {t("onboarding.recap.bills")}</span>
                    <span className="font-semibold text-sky-900">−{formatMoney(totalBills, region.currency)}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-2.5 rounded-lg bg-sky-50 border border-sky-200">
                    <span className="text-sm font-medium text-sky-900">✉️ {t("onboarding.recap.envelopes")}</span>
                    <span className="font-semibold text-sky-900">−{formatMoney(totalEnvelopes, region.currency)}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-2.5 rounded-lg bg-teal-50 border border-teal-200">
                    <span className="text-sm font-medium text-teal-900">🎯 {t("onboarding.recap.goals")}</span>
                    <span className="font-semibold text-teal-900">−{formatMoney(totalGoals, region.currency)}</span>
                  </div>

                  <div className="flex justify-between items-center px-4 py-3 rounded-lg bg-foreground text-background mt-1">
                    <span className="text-sm font-bold">{t("onboarding.recap.leftover")}</span>
                    <span className="text-lg font-bold">{formatMoney(leftover, region.currency)}</span>
                  </div>

                  <p
                    className={cn(
                      "text-xs px-1",
                      leftover > 0 ? "text-emerald-700" : leftover < 0 ? "text-rose-700" : "text-muted-foreground",
                    )}
                  >
                    {leftover > 0
                      ? t("onboarding.recap.leftoverPositiveHint")
                      : leftover < 0
                        ? t("onboarding.recap.leftoverNegativeHint")
                        : t("onboarding.recap.leftoverZeroHint")}
                  </p>
                </div>

                <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 mb-4">
                  <p className="text-sm font-medium text-primary mb-1">{t("onboarding.goals.almostDone")}</p>
                  <p className="text-xs text-muted-foreground">{t("onboarding.goals.almostDoneHint")}</p>
                </div>

                {finishError && (
                  <div
                    role="alert"
                    className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    data-testid="onboarding-finish-error"
                  >
                    {finishError}
                  </div>
                )}
                <div className="mt-auto flex justify-between gap-3">
                  <Button variant="outline" onClick={handleBack} disabled={isFinishing}>
                    <ArrowLeft className="mr-2 w-4 h-4" /> {t("onboarding.back")}
                  </Button>
                  <Button
                    onClick={handleComplete}
                    disabled={isFinishing}
                    className="flex-1 sm:flex-none"
                    data-testid="onboarding-finish-button"
                  >
                    {isFinishing
                      ? t("onboarding.goals.saving")
                      : t("onboarding.recap.finish")}
                  </Button>
                </div>
              </div>
            )}

          </CardContent>
        </Card>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
          <span>
            {t(
              "onboarding.trustStrip.text",
              "Your data is encrypted and never sold.",
            )}
          </span>
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
          >
            {t("onboarding.trustStrip.link", "Privacy & Trust")}
          </Link>
        </div>
      </div>
    </div>
  );
}
