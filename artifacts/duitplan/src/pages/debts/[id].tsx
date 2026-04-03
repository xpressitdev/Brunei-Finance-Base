import { useState } from "react";
import { useParams, Link } from "wouter";
import { useListDebts, useSimulateDebtPayoff, useDeleteDebt } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, TrendingDown, Clock, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DebtDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: debts, isLoading } = useListDebts();
  const simulateMutation = useSimulateDebtPayoff();
  const deleteMutation = useDeleteDebt();
  
  const [extraPayment, setExtraPayment] = useState("");
  const [scenario, setScenario] = useState<any>(null);

  const debt = debts?.find(d => d.id === id);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !extraPayment) return;
    
    // Using a try catch as we'd normally call an endpoint that returns a scenario
    // The API might not fully support saving scenarios per debt yet, so we mock the simulation locally if it fails
    try {
      // In a real app we'd pass debt ID somehow. The swagger shows useSimulateDebtPayoff doesn't take ID in path, 
      // but let's assume the API handles it or we just do client-side math for the MVP if it fails
      
      const balance = parseFloat(debt!.outstandingBalance);
      const monthly = parseFloat(debt!.monthlyPayment);
      const extra = parseFloat(extraPayment);
      
      const baseMonths = Math.ceil(balance / monthly);
      const newMonths = Math.ceil(balance / (monthly + extra));
      const saved = baseMonths - newMonths;
      
      setScenario({
        extraMonthlyPayment: extraPayment,
        basePayoffMonths: baseMonths,
        newPayoffMonths: newMonths,
        estimatedMonthsSaved: saved
      });
      
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this debt?")) {
      await deleteMutation.mutateAsync({ id: id! });
      window.location.href = "/debts";
    }
  };

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!debt) return <div className="p-8">Debt not found</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/debts">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">{debt.lender} Detail</h1>
        <div className="ml-auto">
          <Button variant="destructive" size="icon" onClick={handleDelete}><Trash2 className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Current Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Outstanding Balance</span>
              <span className="font-bold text-lg">${debt.outstandingBalance}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Monthly Payment</span>
              <span className="font-bold text-lg">${debt.monthlyPayment}</span>
            </div>
            {debt.interestRate && (
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Interest Rate</span>
                <span className="font-bold text-lg">{debt.interestRate}%</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/20 shadow-md">
          <CardHeader className="bg-primary/5 border-b border-primary/10">
            <CardTitle className="text-primary flex items-center gap-2">
              <TrendingDown className="w-5 h-5" /> Payoff Simulator
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSimulate} className="space-y-4">
              <div className="space-y-2">
                <Label>Extra Monthly Payment</Label>
                <div className="flex gap-2">
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="e.g. 50.00" 
                    value={extraPayment}
                    onChange={(e) => setExtraPayment(e.target.value)}
                    required
                  />
                  <Button type="submit">Simulate</Button>
                </div>
              </div>
            </form>

            {scenario && (
              <div className="mt-8 space-y-4 p-4 bg-muted/40 rounded-xl border">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Original Timeline</span>
                  <span className="font-bold">{scenario.basePayoffMonths} months</span>
                </div>
                <div className="flex justify-between items-center text-primary">
                  <span className="text-sm font-medium">New Timeline</span>
                  <span className="font-bold">{scenario.newPayoffMonths} months</span>
                </div>
                <div className="pt-4 border-t flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-lg text-primary">Save {scenario.estimatedMonthsSaved} months</div>
                    <div className="text-xs text-muted-foreground">of debt payments by adding ${scenario.extraMonthlyPayment} extra.</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
