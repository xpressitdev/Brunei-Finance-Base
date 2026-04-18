import { useState } from "react";
import { useLocation, useSearch } from "wouter";
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
import { Trash2, Plus, Search, Receipt, TrendingUp, TrendingDown, Pencil } from "lucide-react";
import { TrialExpiredPrompt } from "@/components/subscription/TrialExpiredPrompt";
import { isTrialExpiredError } from "@/lib/trialExpired";

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
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const queryMonth = new URLSearchParams(searchString).get("month");
  const [month, setMonth] = useState(queryMonth && /^\d{4}-\d{2}$/.test(queryMonth) ? queryMonth : "");
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionItem | null>(null);
  const [trialExpiredError, setTrialExpiredError] = useState(false);
  const [editTrialExpiredError, setEditTrialExpiredError] = useState(false);

  const { data: transactions, isLoading, refetch } = useListTransactions(month ? { month, search } : { search });
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
    if (confirm("Are you sure you want to delete this transaction?")) {
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
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">Manage your income and expenses.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) setTrialExpiredError(false); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Transaction</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Transaction</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              {trialExpiredError && (
                <TrialExpiredPrompt action="add transactions" />
              )}
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
                <Label>Account <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Select value={formData.accountId} onValueChange={(val) => setFormData({...formData, accountId: val})}>
                  <SelectTrigger><SelectValue placeholder="No account" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No account</SelectItem>
                    {accounts?.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name}{a.bankName ? ` — ${a.bankName}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

      <Dialog open={!!editingTx} onOpenChange={(open) => { if (!open) setEditingTx(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            {editTrialExpiredError && (
              <TrialExpiredPrompt action="edit transactions" />
            )}
            <div className="space-y-2">
              <Label>Date</Label>
              <Input 
                type="date" 
                value={editData.date} 
                onChange={(e) => setEditData({...editData, date: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input 
                value={editData.description} 
                onChange={(e) => setEditData({...editData, description: e.target.value})}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={editData.amount} 
                  onChange={(e) => setEditData({...editData, amount: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={editData.type} onValueChange={(val) => setEditData({...editData, type: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Expense</SelectItem>
                    <SelectItem value="credit">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Account <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select value={editData.accountId} onValueChange={(val) => setEditData({...editData, accountId: val})}>
                <SelectTrigger><SelectValue placeholder="No account" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No account</SelectItem>
                  {accounts?.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}{a.bankName ? ` — ${a.bankName}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={editData.categoryId} onValueChange={(val) => setEditData({...editData, categoryId: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {categories?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
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
            placeholder="All months"
          />
          {month ? (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setMonth("")}>
              Clear
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">All months</span>
          )}
        </div>
        <div className="relative flex-1 min-w-48 max-w-md">
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
            <h3 className="font-semibold text-lg mb-1">No transactions found</h3>
            <p className="text-muted-foreground mb-4">
              {month
                ? `No transactions for ${format(new Date(month + "-01"), "MMMM yyyy")}. Imported transactions may be in a different month.`
                : "No transactions yet. Import a bank statement or add one manually."}
            </p>
            {month && (
              <Button variant="outline" size="sm" onClick={() => setMonth("")}>
                View all transactions
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
                      {format(new Date(tx.date), "MMM d, yyyy")}
                      <span>&bull;</span>
                      <span className="bg-muted px-2 py-0.5 rounded-full text-xs">{tx.categoryName || 'Uncategorized'}</span>
                      {tx.accountName && (
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">{tx.accountName}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`font-semibold ${tx.type === 'credit' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {tx.type === 'credit' ? '+' : '−'}BND {Number(tx.amount).toFixed(2)}
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
