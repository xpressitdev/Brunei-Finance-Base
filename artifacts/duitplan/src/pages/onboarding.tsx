import { useState } from "react";
import { useLocation } from "wouter";
import {
  useCompleteOnboarding,
  useUpdateProfile,
  useCreateCommitment,
  useCreateDebt,
  useGetMe
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, Check, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TOTAL_STEPS = 6;

// ── Presets ───────────────────────────────────────────────────────────────────

const COMMITMENT_PRESETS = [
  { id: "car_loan", label: "Car Loan", icon: "🚗" },
  { id: "personal_loan", label: "Personal Loan", icon: "💰" },
  { id: "house_financing", label: "House Financing", icon: "🏠" },
  { id: "rent", label: "Rent", icon: "🏢" },
  { id: "utilities", label: "Utilities", icon: "💡" },
  { id: "internet_phone", label: "Internet / Phone", icon: "📱" },
  { id: "insurance_takaful", label: "Insurance / Takaful", icon: "🛡️" },
  { id: "family_support", label: "Family Support", icon: "👨‍👩‍👧" },
  { id: "school_fees", label: "School Fees", icon: "📚" },
  { id: "credit_card", label: "Credit Card", icon: "💳" },
  { id: "childcare", label: "Childcare", icon: "👶" },
  { id: "subscription", label: "Subscriptions", icon: "📺" },
];

const EXPENSE_PRESETS = [
  { id: "groceries", label: "Groceries", icon: "🛒" },
  { id: "eating_out", label: "Eating Out", icon: "🍜" },
  { id: "fuel", label: "Fuel", icon: "⛽" },
  { id: "transport", label: "Transport", icon: "🚌" },
  { id: "shopping", label: "Shopping", icon: "🛍️" },
  { id: "entertainment", label: "Entertainment", icon: "🎬" },
  { id: "health", label: "Health", icon: "💊" },
  { id: "education", label: "Education", icon: "📖" },
  { id: "savings", label: "Savings", icon: "🏦" },
  { id: "emergency", label: "Emergency Fund", icon: "🆘" },
];

const DEBT_PRESETS = [
  { id: "car_loan", label: "Car Loan", icon: "🚗", debtType: "car_loan" },
  { id: "personal_financing", label: "Personal Financing", icon: "💰", debtType: "personal_loan" },
  { id: "house_financing", label: "House Financing", icon: "🏠", debtType: "mortgage" },
  { id: "credit_card", label: "Credit Card", icon: "💳", debtType: "credit_card" },
  { id: "other_debt", label: "Other Debt", icon: "📋", debtType: "other" },
];

const GOAL_OPTIONS = [
  { id: "savings", label: "Build savings every month", desc: "I want to set aside money regularly", icon: "🏦" },
  { id: "debt", label: "Pay off debt faster", desc: "I want to clear my loans sooner", icon: "📉" },
  { id: "spending", label: "Control my spending", desc: "I want to stay within budget", icon: "🎯" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type SelectedCommitment = { id: string; label: string; amount: string; isCustom?: boolean };
type SelectedExpense = { id: string; label: string; amount: string };
type SelectedDebt = { id: string; label: string; debtType: string; monthlyPayment: string; outstandingBalance: string };

// ── Component ─────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const { data: user } = useGetMe({ query: { enabled: true } });

  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [payday, setPayday] = useState("25");

  const [selectedCommitments, setSelectedCommitments] = useState<SelectedCommitment[]>([]);
  const [customCommitment, setCustomCommitment] = useState({ label: "", amount: "" });
  const [showCustomCommitment, setShowCustomCommitment] = useState(false);

  const [selectedExpenses, setSelectedExpenses] = useState<SelectedExpense[]>([]);
  const [selectedDebts, setSelectedDebts] = useState<SelectedDebt[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  const updateProfileMutation = useUpdateProfile();
  const createCommitmentMutation = useCreateCommitment();
  const createDebtMutation = useCreateDebt();
  const completeOnboardingMutation = useCompleteOnboarding();

  const handleNext = () => setStep(s => Math.min(s + 1, TOTAL_STEPS));
  const handleBack = () => setStep(s => Math.max(s - 1, 1));

  const toggleCommitmentPreset = (preset: typeof COMMITMENT_PRESETS[0]) => {
    const exists = selectedCommitments.find(c => c.id === preset.id);
    if (exists) {
      setSelectedCommitments(selectedCommitments.filter(c => c.id !== preset.id));
    } else {
      setSelectedCommitments([...selectedCommitments, { id: preset.id, label: preset.label, amount: "" }]);
    }
  };

  const updateCommitmentAmount = (id: string, amount: string) => {
    setSelectedCommitments(selectedCommitments.map(c => c.id === id ? { ...c, amount } : c));
  };

  const addCustomCommitment = () => {
    if (!customCommitment.label) return;
    const id = `custom_${Date.now()}`;
    setSelectedCommitments([...selectedCommitments, { id, label: customCommitment.label, amount: customCommitment.amount, isCustom: true }]);
    setCustomCommitment({ label: "", amount: "" });
    setShowCustomCommitment(false);
  };

  const toggleExpensePreset = (preset: typeof EXPENSE_PRESETS[0]) => {
    const exists = selectedExpenses.find(e => e.id === preset.id);
    if (exists) {
      setSelectedExpenses(selectedExpenses.filter(e => e.id !== preset.id));
    } else {
      setSelectedExpenses([...selectedExpenses, { id: preset.id, label: preset.label, amount: "" }]);
    }
  };

  const updateExpenseAmount = (id: string, amount: string) => {
    setSelectedExpenses(selectedExpenses.map(e => e.id === id ? { ...e, amount } : e));
  };

  const toggleDebtPreset = (preset: typeof DEBT_PRESETS[0]) => {
    const exists = selectedDebts.find(d => d.id === preset.id);
    if (exists) {
      setSelectedDebts(selectedDebts.filter(d => d.id !== preset.id));
    } else {
      setSelectedDebts([...selectedDebts, { id: preset.id, label: preset.label, debtType: preset.debtType, monthlyPayment: "", outstandingBalance: "" }]);
    }
  };

  const updateDebt = (id: string, field: "monthlyPayment" | "outstandingBalance", value: string) => {
    setSelectedDebts(selectedDebts.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const toggleGoal = (id: string) => {
    if (selectedGoals.includes(id)) {
      setSelectedGoals(selectedGoals.filter(g => g !== id));
    } else {
      setSelectedGoals([...selectedGoals, id]);
    }
  };

  const handleComplete = async () => {
    try {
      if (monthlyIncome) {
        await updateProfileMutation.mutateAsync({
          data: { monthlyIncome, payday: parseInt(payday, 10) }
        });
      }
      for (const c of selectedCommitments) {
        if (c.label && c.amount) {
          await createCommitmentMutation.mutateAsync({
            data: { label: c.label, amount: c.amount, recurrence: "monthly" }
          });
        }
      }
      for (const d of selectedDebts) {
        if (d.monthlyPayment) {
          await createDebtMutation.mutateAsync({
            data: {
              lender: d.label,
              debtType: d.debtType,
              outstandingBalance: d.outstandingBalance || "0",
              monthlyPayment: d.monthlyPayment,
            }
          });
        }
      }
      await completeOnboardingMutation.mutateAsync();
      window.location.href = "/dashboard";
    } catch (e) {
      console.error("Failed to complete onboarding", e);
    }
  };

  const firstName = user?.profile?.fullName?.split(" ")[0] || "there";

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">

        {/* Progress */}
        <div className="mb-6 flex justify-between items-center">
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i + 1 === step ? "w-8 bg-primary" : i + 1 < step ? "w-8 bg-primary/40" : "w-4 bg-border"
                )}
              />
            ))}
          </div>
          <span className="text-xs font-medium text-muted-foreground">Step {step} of {TOTAL_STEPS}</span>
        </div>

        <Card className="border-0 shadow-lg overflow-hidden bg-white">
          <div className="h-1 w-full bg-primary/10">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
          </div>
          <CardContent className="p-8 sm:p-10 min-h-[460px] flex flex-col">

            {/* ── Step 1: Welcome ─────────────────────────────────────────── */}
            {step === 1 && (
              <div className="flex-1 flex flex-col justify-center text-center">
                <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-6 shadow-md">
                  <span className="text-white font-bold text-3xl">D</span>
                </div>
                <h1 className="text-3xl font-bold mb-3">Selamat datang, {firstName}!</h1>
                <p className="text-lg text-muted-foreground mb-2 max-w-md mx-auto">
                  Welcome to DuitPlan — your Brunei personal finance assistant.
                </p>
                <p className="text-sm text-muted-foreground mb-10 max-w-md mx-auto">
                  We'll guide you through a quick setup so your dashboard feels right from day one. Takes about 2 minutes.
                </p>
                <div className="grid grid-cols-3 gap-4 text-center text-sm text-muted-foreground mb-10">
                  <div className="p-3 rounded-xl bg-muted/40">
                    <div className="text-xl mb-1">💵</div>
                    <div>Your salary & payday</div>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/40">
                    <div className="text-xl mb-1">📋</div>
                    <div>Monthly bills & loans</div>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/40">
                    <div className="text-xl mb-1">🎯</div>
                    <div>Your money goals</div>
                  </div>
                </div>
                <Button size="lg" className="w-full sm:w-auto sm:mx-auto px-10 h-12" onClick={handleNext}>
                  Let's Begin <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            )}

            {/* ── Step 2: Income ──────────────────────────────────────────── */}
            {step === 2 && (
              <div className="flex-1 flex flex-col">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-2">Your salary & payday</h2>
                  <p className="text-muted-foreground">This helps us calculate your monthly budget accurately.</p>
                </div>
                <div className="space-y-6 max-w-sm">
                  <div className="space-y-2">
                    <Label htmlFor="income" className="text-sm font-medium">Monthly Salary</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">BND</span>
                      <Input
                        id="income"
                        type="number"
                        step="0.01"
                        min="0"
                        className="pl-14 h-12 text-lg font-semibold"
                        placeholder="0.00"
                        value={monthlyIncome}
                        onChange={(e) => setMonthlyIncome(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Enter your take-home (nett) salary in Brunei Dollars.</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Payday — which day of the month?</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 15, 25, 28].map(day => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setPayday(String(day))}
                          className={cn(
                            "h-12 rounded-lg border text-sm font-medium transition-all",
                            payday === String(day)
                              ? "bg-primary text-white border-primary shadow-sm"
                              : "bg-white hover:bg-muted/40 text-foreground"
                          )}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Other day:</span>
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
                <div className="mt-auto pt-8 flex justify-between">
                  <Button variant="outline" onClick={handleBack}><ArrowLeft className="mr-2 w-4 h-4" /> Back</Button>
                  <Button onClick={handleNext} disabled={!monthlyIncome}>
                    Continue <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ── Step 3: Fixed Commitments ───────────────────────────────── */}
            {step === 3 && (
              <div className="flex-1 flex flex-col">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">Monthly fixed commitments</h2>
                  <p className="text-muted-foreground">Select the ones that apply to you, then enter the monthly amount.</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  {COMMITMENT_PRESETS.map(preset => {
                    const selected = selectedCommitments.find(c => c.id === preset.id);
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => toggleCommitmentPreset(preset)}
                        className={cn(
                          "p-3 rounded-xl border text-left text-sm transition-all",
                          selected
                            ? "border-primary bg-primary/8 ring-1 ring-primary/40"
                            : "border-border bg-white hover:bg-muted/30"
                        )}
                      >
                        <div className="text-xl mb-1">{preset.icon}</div>
                        <div className={cn("font-medium text-xs", selected ? "text-primary" : "text-foreground")}>{preset.label}</div>
                        {selected && <Check className="w-3 h-3 text-primary mt-1" />}
                      </button>
                    );
                  })}
                </div>

                {selectedCommitments.length > 0 && (
                  <div className="border rounded-xl bg-muted/20 p-4 mb-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Enter monthly amounts (BND)</p>
                    {selectedCommitments.map(c => (
                      <div key={c.id} className="flex items-center gap-3">
                        <span className="text-sm flex-1 font-medium">{c.label}</span>
                        <div className="relative w-36">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">BND</span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="pl-12 h-9 text-sm"
                            value={c.amount}
                            onChange={e => updateCommitmentAmount(c.id, e.target.value)}
                          />
                        </div>
                        <button onClick={() => setSelectedCommitments(selectedCommitments.filter(x => x.id !== c.id))} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {showCustomCommitment ? (
                  <div className="flex gap-2 items-end mb-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input placeholder="e.g. Gym membership" value={customCommitment.label} onChange={e => setCustomCommitment({ ...customCommitment, label: e.target.value })} className="h-9" />
                    </div>
                    <div className="w-32 space-y-1">
                      <Label className="text-xs">BND/month</Label>
                      <Input type="number" placeholder="0.00" value={customCommitment.amount} onChange={e => setCustomCommitment({ ...customCommitment, amount: e.target.value })} className="h-9" />
                    </div>
                    <Button size="sm" onClick={addCustomCommitment} disabled={!customCommitment.label}>Add</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowCustomCommitment(false)}>Cancel</Button>
                  </div>
                ) : (
                  <button onClick={() => setShowCustomCommitment(true)} className="flex items-center gap-2 text-sm text-primary hover:underline mb-2">
                    <Plus className="w-4 h-4" /> Add a custom commitment
                  </button>
                )}

                <div className="mt-auto pt-6 flex justify-between">
                  <Button variant="outline" onClick={handleBack}><ArrowLeft className="mr-2 w-4 h-4" /> Back</Button>
                  <Button onClick={handleNext}>Continue <ArrowRight className="ml-2 w-4 h-4" /></Button>
                </div>
              </div>
            )}

            {/* ── Step 4: Living Expenses ─────────────────────────────────── */}
            {step === 4 && (
              <div className="flex-1 flex flex-col">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">Typical monthly spending</h2>
                  <p className="text-muted-foreground">Estimate how much you usually spend in each category. You can refine these after uploading your bank statement.</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  {EXPENSE_PRESETS.map(preset => {
                    const selected = selectedExpenses.find(e => e.id === preset.id);
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => toggleExpensePreset(preset)}
                        className={cn(
                          "p-3 rounded-xl border text-left text-sm transition-all",
                          selected
                            ? "border-primary bg-primary/8 ring-1 ring-primary/40"
                            : "border-border bg-white hover:bg-muted/30"
                        )}
                      >
                        <div className="text-xl mb-1">{preset.icon}</div>
                        <div className={cn("font-medium text-xs", selected ? "text-primary" : "text-foreground")}>{preset.label}</div>
                        {selected && <Check className="w-3 h-3 text-primary mt-1" />}
                      </button>
                    );
                  })}
                </div>

                {selectedExpenses.length > 0 && (
                  <div className="border rounded-xl bg-muted/20 p-4 mb-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estimated monthly amount (BND)</p>
                    {selectedExpenses.map(e => (
                      <div key={e.id} className="flex items-center gap-3">
                        <span className="text-sm flex-1 font-medium">{e.label}</span>
                        <div className="relative w-36">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">BND</span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="pl-12 h-9 text-sm"
                            value={e.amount}
                            onChange={ev => updateExpenseAmount(e.id, ev.target.value)}
                          />
                        </div>
                        <button onClick={() => setSelectedExpenses(selectedExpenses.filter(x => x.id !== e.id))} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  💡 Not sure of the exact amounts? Rough estimates are fine — you can update them after importing your bank statement.
                </p>

                <div className="mt-auto pt-6 flex justify-between">
                  <Button variant="outline" onClick={handleBack}><ArrowLeft className="mr-2 w-4 h-4" /> Back</Button>
                  <Button onClick={handleNext}>Continue <ArrowRight className="ml-2 w-4 h-4" /></Button>
                </div>
              </div>
            )}

            {/* ── Step 5: Loans & Financing ───────────────────────────────── */}
            {step === 5 && (
              <div className="flex-1 flex flex-col">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">Loans & financing</h2>
                  <p className="text-muted-foreground">Select any active loans or financing. We'll track your payoff progress.</p>
                </div>

                <div className="flex flex-wrap gap-2 mb-5">
                  {DEBT_PRESETS.map(preset => {
                    const selected = selectedDebts.find(d => d.id === preset.id);
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => toggleDebtPreset(preset)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all",
                          selected
                            ? "bg-primary text-white border-primary"
                            : "bg-white hover:bg-muted/30 text-foreground"
                        )}
                      >
                        <span>{preset.icon}</span>
                        {preset.label}
                        {selected && <Check className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>

                {selectedDebts.length > 0 && (
                  <div className="space-y-4 mb-4 overflow-y-auto max-h-[240px] pr-1">
                    {selectedDebts.map(d => (
                      <div key={d.id} className="p-4 rounded-xl border bg-muted/20">
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-semibold text-sm">{d.label}</span>
                          <button onClick={() => setSelectedDebts(selectedDebts.filter(x => x.id !== d.id))} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Monthly Payment (BND)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="e.g. 450.00"
                              className="h-9 text-sm"
                              value={d.monthlyPayment}
                              onChange={e => updateDebt(d.id, "monthlyPayment", e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Outstanding Balance (optional)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="e.g. 18,500.00"
                              className="h-9 text-sm"
                              value={d.outstandingBalance}
                              onChange={e => updateDebt(d.id, "outstandingBalance", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedDebts.length === 0 && (
                  <div className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-4 mb-4">
                    No active loans? That's great! You can skip this step.
                  </div>
                )}

                <div className="mt-auto pt-6 flex justify-between">
                  <Button variant="outline" onClick={handleBack}><ArrowLeft className="mr-2 w-4 h-4" /> Back</Button>
                  <Button onClick={handleNext}>Continue <ArrowRight className="ml-2 w-4 h-4" /></Button>
                </div>
              </div>
            )}

            {/* ── Step 6: Goals + Finish ──────────────────────────────────── */}
            {step === 6 && (
              <div className="flex-1 flex flex-col">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">What matters most to you?</h2>
                  <p className="text-muted-foreground">Choose what you'd like DuitPlan to help you with. You can pick more than one.</p>
                </div>

                <div className="space-y-3 mb-8">
                  {GOAL_OPTIONS.map(goal => {
                    const selected = selectedGoals.includes(goal.id);
                    return (
                      <button
                        key={goal.id}
                        type="button"
                        onClick={() => toggleGoal(goal.id)}
                        className={cn(
                          "w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all",
                          selected ? "border-primary bg-primary/8 ring-1 ring-primary/30" : "border-border bg-white hover:bg-muted/30"
                        )}
                      >
                        <span className="text-2xl">{goal.icon}</span>
                        <div className="flex-1">
                          <div className={cn("font-semibold text-sm", selected ? "text-primary" : "text-foreground")}>{goal.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{goal.desc}</div>
                        </div>
                        {selected && <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 mb-6">
                  <p className="text-sm font-medium text-primary mb-1">🎉 You're almost done!</p>
                  <p className="text-xs text-muted-foreground">
                    Your financial foundation is set. Next, try uploading your BIBD or Baiduri bank statement screenshot to get real transaction data instantly.
                  </p>
                </div>

                <div className="mt-auto flex justify-between gap-3">
                  <Button variant="outline" onClick={handleBack}><ArrowLeft className="mr-2 w-4 h-4" /> Back</Button>
                  <Button
                    onClick={handleComplete}
                    disabled={completeOnboardingMutation.isPending}
                    className="flex-1 sm:flex-none"
                  >
                    {completeOnboardingMutation.isPending ? "Saving..." : "Go to Dashboard →"}
                  </Button>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
