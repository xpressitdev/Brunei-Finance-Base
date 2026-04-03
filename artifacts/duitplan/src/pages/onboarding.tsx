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
import { Plus, Trash2, ArrowRight, ArrowLeft, Check } from "lucide-react";

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const { data: user } = useGetMe({ query: { enabled: true } });
  
  // Profile data
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [payday, setPayday] = useState("25");
  
  // Commitments
  const [commitments, setCommitments] = useState<{label: string, amount: string, dueDay: string}[]>([]);
  
  // Debts
  const [debts, setDebts] = useState<{lender: string, debtType: string, outstandingBalance: string, monthlyPayment: string}[]>([]);

  const updateProfileMutation = useUpdateProfile();
  const createCommitmentMutation = useCreateCommitment();
  const createDebtMutation = useCreateDebt();
  const completeOnboardingMutation = useCompleteOnboarding();

  const handleNext = () => setStep(s => Math.min(s + 1, 5));
  const handleBack = () => setStep(s => Math.max(s - 1, 1));

  const addCommitment = () => {
    setCommitments([...commitments, { label: "", amount: "", dueDay: "1" }]);
  };

  const removeCommitment = (index: number) => {
    setCommitments(commitments.filter((_, i) => i !== index));
  };

  const addDebt = () => {
    setDebts([...debts, { lender: "", debtType: "personal_loan", outstandingBalance: "", monthlyPayment: "" }]);
  };

  const removeDebt = (index: number) => {
    setDebts(debts.filter((_, i) => i !== index));
  };

  const handleComplete = async () => {
    try {
      // 1. Update Profile
      if (monthlyIncome) {
        await updateProfileMutation.mutateAsync({
          data: {
            monthlyIncome,
            payday: parseInt(payday, 10)
          }
        });
      }

      // 2. Create commitments
      for (const c of commitments) {
        if (c.label && c.amount) {
          await createCommitmentMutation.mutateAsync({
            data: {
              label: c.label,
              amount: c.amount,
              dueDay: c.dueDay ? parseInt(c.dueDay, 10) : undefined,
              recurrence: "monthly"
            }
          });
        }
      }

      // 3. Create debts
      for (const d of debts) {
        if (d.lender && d.outstandingBalance && d.monthlyPayment) {
          await createDebtMutation.mutateAsync({
            data: {
              lender: d.lender,
              debtType: d.debtType,
              outstandingBalance: d.outstandingBalance,
              monthlyPayment: d.monthlyPayment
            }
          });
        }
      }

      // 4. Complete onboarding
      await completeOnboardingMutation.mutateAsync();
      
      // Redirect to dashboard
      window.location.href = "/dashboard";
    } catch (e) {
      console.error("Failed to complete onboarding", e);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex justify-between items-center">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div 
                key={i} 
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === step ? "w-8 bg-primary" : i < step ? "w-8 bg-primary/30" : "w-4 bg-border"
                }`}
              />
            ))}
          </div>
          <span className="text-sm font-medium text-muted-foreground">Step {step} of 5</span>
        </div>

        <Card className="border-none shadow-md overflow-hidden bg-white">
          <div className="h-2 w-full bg-primary/10">
            <div 
              className="h-full bg-primary transition-all duration-500 ease-in-out" 
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
          <CardContent className="p-8 sm:p-12 min-h-[400px] flex flex-col">
            {step === 1 && (
              <div className="flex-1 flex flex-col justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-xl">D</div>
                </div>
                <h1 className="text-3xl font-bold mb-4">Welcome to DuitPlan, {user?.profile?.fullName?.split(' ')[0] || 'Friend'}</h1>
                <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
                  Let's set up your financial foundation. This will only take a couple of minutes and will help us personalize your dashboard.
                </p>
                <div className="mt-auto">
                  <Button size="lg" className="w-full sm:w-auto px-8" onClick={handleNext}>
                    Let's Begin <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="flex-1 flex flex-col">
                <h2 className="text-2xl font-bold mb-2">Income & Payday</h2>
                <p className="text-muted-foreground mb-8">When do you get paid, and how much?</p>
                
                <div className="space-y-6 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="income">Monthly Salary (BND)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input 
                        id="income" 
                        type="number" 
                        step="0.01"
                        className="pl-7" 
                        placeholder="0.00"
                        value={monthlyIncome}
                        onChange={(e) => setMonthlyIncome(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="payday">Payday (Day of month)</Label>
                    <Input 
                      id="payday" 
                      type="number" 
                      min="1" 
                      max="31" 
                      value={payday}
                      onChange={(e) => setPayday(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-auto pt-8 flex justify-between">
                  <Button variant="outline" onClick={handleBack}>
                    <ArrowLeft className="mr-2 w-4 h-4" /> Back
                  </Button>
                  <Button onClick={handleNext} disabled={!monthlyIncome}>
                    Continue <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="flex-1 flex flex-col">
                <h2 className="text-2xl font-bold mb-2">Monthly Commitments</h2>
                <p className="text-muted-foreground mb-8">Fixed expenses like rent, utilities, or subscriptions.</p>
                
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                  {commitments.map((commitment, index) => (
                    <div key={index} className="flex gap-3 items-start p-4 rounded-lg bg-muted/40 border border-muted">
                      <div className="flex-1 space-y-2">
                        <Label className="text-xs">Label</Label>
                        <Input 
                          placeholder="e.g. Rent, DST" 
                          value={commitment.label}
                          onChange={(e) => {
                            const newC = [...commitments];
                            newC[index].label = e.target.value;
                            setCommitments(newC);
                          }}
                        />
                      </div>
                      <div className="w-32 space-y-2">
                        <Label className="text-xs">Amount</Label>
                        <Input 
                          type="number" 
                          placeholder="0.00" 
                          value={commitment.amount}
                          onChange={(e) => {
                            const newC = [...commitments];
                            newC[index].amount = e.target.value;
                            setCommitments(newC);
                          }}
                        />
                      </div>
                      <div className="pt-7">
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => removeCommitment(index)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  <Button variant="outline" className="w-full border-dashed" onClick={addCommitment}>
                    <Plus className="w-4 h-4 mr-2" /> Add Commitment
                  </Button>
                </div>

                <div className="mt-auto pt-8 flex justify-between">
                  <Button variant="outline" onClick={handleBack}>
                    <ArrowLeft className="mr-2 w-4 h-4" /> Back
                  </Button>
                  <Button onClick={handleNext}>
                    Continue <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="flex-1 flex flex-col">
                <h2 className="text-2xl font-bold mb-2">Current Debts</h2>
                <p className="text-muted-foreground mb-8">Loans, credit cards, or car financing.</p>
                
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                  {debts.map((debt, index) => (
                    <div key={index} className="flex flex-col sm:flex-row gap-3 items-start p-4 rounded-lg bg-muted/40 border border-muted">
                      <div className="flex-1 space-y-2 w-full">
                        <Label className="text-xs">Lender / Bank</Label>
                        <Input 
                          placeholder="e.g. BIBD, Baiduri" 
                          value={debt.lender}
                          onChange={(e) => {
                            const newD = [...debts];
                            newD[index].lender = e.target.value;
                            setDebts(newD);
                          }}
                        />
                      </div>
                      <div className="w-full sm:w-32 space-y-2">
                        <Label className="text-xs">Balance</Label>
                        <Input 
                          type="number" 
                          placeholder="0.00" 
                          value={debt.outstandingBalance}
                          onChange={(e) => {
                            const newD = [...debts];
                            newD[index].outstandingBalance = e.target.value;
                            setDebts(newD);
                          }}
                        />
                      </div>
                      <div className="w-full sm:w-32 space-y-2">
                        <Label className="text-xs">Monthly</Label>
                        <Input 
                          type="number" 
                          placeholder="0.00" 
                          value={debt.monthlyPayment}
                          onChange={(e) => {
                            const newD = [...debts];
                            newD[index].monthlyPayment = e.target.value;
                            setDebts(newD);
                          }}
                        />
                      </div>
                      <div className="sm:pt-7 self-end sm:self-auto">
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => removeDebt(index)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  <Button variant="outline" className="w-full border-dashed" onClick={addDebt}>
                    <Plus className="w-4 h-4 mr-2" /> Add Debt
                  </Button>
                </div>

                <div className="mt-auto pt-8 flex justify-between">
                  <Button variant="outline" onClick={handleBack}>
                    <ArrowLeft className="mr-2 w-4 h-4" /> Back
                  </Button>
                  <Button onClick={handleNext}>
                    Continue <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="flex-1 flex flex-col justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-6">
                  <Check className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold mb-4">You're all set!</h2>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  We've created some standard budget categories for you. You can adjust these anytime in your settings.
                </p>
                <div className="mt-auto flex justify-center gap-4">
                  <Button variant="outline" onClick={handleBack}>
                    Review Entries
                  </Button>
                  <Button onClick={handleComplete} disabled={completeOnboardingMutation.isPending}>
                    {completeOnboardingMutation.isPending ? "Saving..." : "Go to Dashboard"}
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
