import { useState } from "react";
import { Link } from "wouter";
import { useListDebts, useCreateDebt } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Wallet, Plus, ArrowRight } from "lucide-react";

export default function Debts() {
  const { data: debts, isLoading, refetch } = useListDebts();
  const createMutation = useCreateDebt();
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({
    lender: "",
    debtType: "personal_loan",
    outstandingBalance: "",
    monthlyPayment: "",
    interestRate: "",
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutateAsync({
      data: {
        lender: formData.lender,
        debtType: formData.debtType,
        outstandingBalance: formData.outstandingBalance,
        monthlyPayment: formData.monthlyPayment,
        interestRate: formData.interestRate || undefined
      }
    });
    setIsAddOpen(false);
    refetch();
    setFormData({ lender: "", debtType: "personal_loan", outstandingBalance: "", monthlyPayment: "", interestRate: "" });
  };

  const totalBalance = debts?.reduce((acc, curr) => acc + parseFloat(curr.outstandingBalance), 0) || 0;
  const totalMonthly = debts?.reduce((acc, curr) => acc + parseFloat(curr.monthlyPayment), 0) || 0;

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Debts</h1>
          <p className="text-muted-foreground">Track your loans and plan payoffs.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Debt</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Debt</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label>Lender / Bank Name</Label>
                <Input 
                  value={formData.lender} 
                  onChange={(e) => setFormData({...formData, lender: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Outstanding Balance</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={formData.outstandingBalance} 
                  onChange={(e) => setFormData({...formData, outstandingBalance: e.target.value})}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Monthly Payment</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={formData.monthlyPayment} 
                    onChange={(e) => setFormData({...formData, monthlyPayment: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Interest Rate (%)</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={formData.interestRate} 
                    onChange={(e) => setFormData({...formData, interestRate: e.target.value})}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Total Outstanding</div>
            <div className="text-2xl font-bold text-foreground">BND {totalBalance.toFixed(2)}</div>
          </div>
        </div>
        <div className="bg-white border rounded-xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-600">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Total Monthly Payment</div>
            <div className="text-2xl font-bold text-foreground">BND {totalMonthly.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {(!debts || debts.length === 0) ? (
          <div className="p-12 text-center text-muted-foreground">
            No debts added yet.
          </div>
        ) : (
          <div className="divide-y">
            {debts.map(d => (
              <div key={d.id} className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-muted/30 transition-colors">
                <div>
                  <h3 className="font-semibold text-lg">{d.lender}</h3>
                  <div className="text-sm text-muted-foreground mt-1 flex gap-4">
                    <span>Balance: <strong className="text-foreground">${d.outstandingBalance}</strong></span>
                    <span>Monthly: <strong className="text-foreground">${d.monthlyPayment}</strong></span>
                  </div>
                </div>
                <Link href={`/debts/${d.id}`}>
                  <Button variant="outline" className="shrink-0 w-full sm:w-auto">
                    Simulate Payoff <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
