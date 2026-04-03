import { useState } from "react";
import { format } from "date-fns";
import { 
  useListTransactions, 
  useListCategories,
  useCreateTransaction,
  useDeleteTransaction,
  useUpdateTransaction
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
import { Trash2, Edit2, Plus, Search } from "lucide-react";

export default function Transactions() {
  const currentMonth = format(new Date(), "yyyy-MM");
  const [month, setMonth] = useState(currentMonth);
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: transactions, isLoading, refetch } = useListTransactions({ month, search });
  const { data: categories } = useListCategories();
  
  const createMutation = useCreateTransaction();
  const deleteMutation = useDeleteTransaction();

  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    amount: "",
    type: "debit",
    description: "",
    categoryId: "none",
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutateAsync({
      data: {
        date: new Date(formData.date).toISOString(),
        amount: formData.amount,
        type: formData.type,
        description: formData.description,
        categoryId: formData.categoryId === "none" ? undefined : formData.categoryId,
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
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this transaction?")) {
      await deleteMutation.mutateAsync({ id });
      refetch();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">Manage your income and expenses.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Transaction</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Transaction</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input 
                  type="date" 
                  value={formData.date} 
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input 
                  value={formData.description} 
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={formData.amount} 
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={formData.type} onValueChange={(val) => setFormData({...formData, type: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Expense</SelectItem>
                      <SelectItem value="credit">Income</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.categoryId} onValueChange={(val) => setFormData({...formData, categoryId: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Uncategorized</SelectItem>
                    {categories?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 items-center bg-white p-4 rounded-xl border">
        <Input 
          type="month" 
          value={month} 
          onChange={(e) => setMonth(e.target.value)} 
          className="w-48"
        />
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search descriptions..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : !transactions?.length ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Receipt className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No transactions</h3>
            <p className="text-muted-foreground">You don't have any transactions for this period.</p>
          </div>
        ) : (
          <div className="divide-y">
            {transactions.map(tx => (
              <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === 'credit' ? 'bg-primary/10 text-primary' : 'bg-orange-500/10 text-orange-600'}`}>
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">{tx.description}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      {format(new Date(tx.date), "MMM d, yyyy")}
                      <span>&bull;</span>
                      <span className="bg-muted px-2 py-0.5 rounded-full text-xs">{tx.categoryName || 'Uncategorized'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`font-semibold ${tx.type === 'credit' ? 'text-primary' : 'text-foreground'}`}>
                    {tx.type === 'credit' ? '+' : '-'}${tx.amount}
                  </div>
                  <div className="flex gap-1">
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

// Temporary icon imports just to make the code above valid.
import { Receipt, Wallet as WalletIcon } from "lucide-react";
