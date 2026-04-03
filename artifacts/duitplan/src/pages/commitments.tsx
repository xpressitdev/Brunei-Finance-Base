import { useState } from "react";
import { useListCommitments, useCreateCommitment, useDeleteCommitment } from "@workspace/api-client-react";
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
import { Trash2, Plus, CalendarDays } from "lucide-react";

export default function Commitments() {
  const { data: commitments, isLoading, refetch } = useListCommitments();
  const createMutation = useCreateCommitment();
  const deleteMutation = useDeleteCommitment();
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({
    label: "",
    amount: "",
    dueDay: "",
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutateAsync({
      data: {
        label: formData.label,
        amount: formData.amount,
        dueDay: formData.dueDay ? parseInt(formData.dueDay, 10) : undefined,
        recurrence: "monthly"
      }
    });
    setIsAddOpen(false);
    refetch();
    setFormData({ label: "", amount: "", dueDay: "" });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure?")) {
      await deleteMutation.mutateAsync({ id });
      refetch();
    }
  };

  const totalCommitments = commitments?.reduce((acc, curr) => acc + parseFloat(curr.amount), 0) || 0;

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Commitments</h1>
          <p className="text-muted-foreground">Fixed monthly expenses you can't avoid.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Commitment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Monthly Commitment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label>Label</Label>
                <Input 
                  value={formData.label} 
                  onChange={(e) => setFormData({...formData, label: e.target.value})}
                  required
                />
              </div>
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
                <Label>Due Day (1-31, Optional)</Label>
                <Input 
                  type="number" 
                  min="1" 
                  max="31" 
                  value={formData.dueDay} 
                  onChange={(e) => setFormData({...formData, dueDay: e.target.value})}
                />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-primary/5 border-primary/20 border rounded-xl p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Total Fixed Commitments</div>
            <div className="text-2xl font-bold text-foreground">${totalCommitments.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {commitments?.map(c => (
          <div key={c.id} className="bg-white p-6 rounded-xl border flex flex-col gap-4 relative group">
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-4 right-4 h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" 
              onClick={() => handleDelete(c.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            
            <div>
              <h3 className="font-semibold text-lg pr-8">{c.label}</h3>
              {c.dueDay && <p className="text-sm text-muted-foreground">Due on day {c.dueDay}</p>}
            </div>
            <div className="text-2xl font-bold mt-auto">${c.amount}</div>
          </div>
        ))}
        {(!commitments || commitments.length === 0) && (
          <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
            No commitments added yet.
          </div>
        )}
      </div>
    </div>
  );
}
