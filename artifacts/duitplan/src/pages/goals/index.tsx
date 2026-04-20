import { useState } from "react";
import { useListGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Target, Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

const CATEGORIES = [
  { value: "savings", label: "Savings" },
  { value: "emergency", label: "Emergency Fund" },
  { value: "debt_payoff", label: "Debt Payoff" },
  { value: "investment", label: "Investment" },
  { value: "custom", label: "Custom" },
];

const CATEGORY_COLORS: Record<string, string> = {
  savings: "bg-emerald-100 text-emerald-800",
  emergency: "bg-red-100 text-red-800",
  debt_payoff: "bg-orange-100 text-orange-800",
  investment: "bg-blue-100 text-blue-800",
  custom: "bg-gray-100 text-gray-800",
};

const emptyForm = {
  title: "",
  category: "savings",
  targetAmount: "",
  savedAmount: "",
  deadline: "",
  notes: "",
};

export default function Goals() {
  const { fmt, currencyLabel, inputStep, inputPlaceholder } = useCurrency();
  const { data: goals, isLoading, refetch } = useListGoals();
  const createMutation = useCreateGoal();
  const updateMutation = useUpdateGoal();
  const deleteMutation = useDeleteGoal();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<null | { id: string; form: typeof emptyForm }>(null);
  const [formData, setFormData] = useState(emptyForm);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutateAsync({
      data: {
        title: formData.title,
        category: formData.category,
        targetAmount: formData.targetAmount,
        savedAmount: formData.savedAmount || undefined,
        deadline: formData.deadline || undefined,
        notes: formData.notes || undefined,
      },
    });
    setIsAddOpen(false);
    setFormData(emptyForm);
    refetch();
  };

  const openEdit = (g: NonNullable<typeof goals>[number]) => {
    setEditGoal({
      id: g.id,
      form: {
        title: g.title,
        category: g.category,
        targetAmount: g.targetAmount,
        savedAmount: g.savedAmount,
        deadline: g.deadline ?? "",
        notes: g.notes ?? "",
      },
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGoal) return;
    await updateMutation.mutateAsync({
      id: editGoal.id,
      data: {
        title: editGoal.form.title,
        category: editGoal.form.category,
        targetAmount: editGoal.form.targetAmount,
        savedAmount: editGoal.form.savedAmount,
        deadline: editGoal.form.deadline || null,
        notes: editGoal.form.notes || null,
      },
    });
    setEditGoal(null);
    refetch();
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync({ id });
    refetch();
  };

  const totalTarget = goals?.reduce((acc, g) => acc + parseFloat(g.targetAmount), 0) ?? 0;
  const totalSaved = goals?.reduce((acc, g) => acc + parseFloat(g.savedAmount), 0) ?? 0;
  const completedCount = goals?.filter((g) => parseFloat(g.savedAmount) >= parseFloat(g.targetAmount)).length ?? 0;

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Financial Goals</h1>
          <p className="text-muted-foreground">Track your savings targets and milestones.</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Goal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Financial Goal</DialogTitle>
            </DialogHeader>
            <GoalForm
              form={formData}
              onChange={setFormData}
              onSubmit={handleAdd}
              loading={createMutation.isPending}
              submitLabel="Add Goal"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Goals"
          value={String(goals?.length ?? 0)}
          sub={`active goal${goals?.length !== 1 ? "s" : ""}`}
          color="text-foreground"
        />
        <SummaryCard
          label="Total Target"
          value={fmt(totalTarget)}
          sub="combined target"
          color="text-foreground"
        />
        <SummaryCard
          label="Total Saved"
          value={fmt(totalSaved)}
          sub={totalTarget > 0 ? `${((totalSaved / totalTarget) * 100).toFixed(1)}% of target` : "—"}
          color="text-emerald-600"
        />
        <SummaryCard
          label="Completed"
          value={String(completedCount)}
          sub={`goal${completedCount !== 1 ? "s" : ""} reached`}
          color="text-blue-600"
        />
      </div>

      {/* Goals list */}
      {!goals || goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Target className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No goals yet</h3>
          <p className="text-muted-foreground mt-1">Set your first financial goal to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => {
            const saved = parseFloat(g.savedAmount);
            const target = parseFloat(g.targetAmount);
            const pct = target > 0 ? Math.min((saved / target) * 100, 100) : 0;
            const done = saved >= target;
            const catLabel = CATEGORIES.find((c) => c.value === g.category)?.label ?? g.category;
            const catColor = CATEGORY_COLORS[g.category] ?? CATEGORY_COLORS.custom;

            return (
              <div key={g.id} className="bg-card border rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground truncate">{g.title}</h3>
                      {done && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                    </div>
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${catColor}`}>
                      {catLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(g)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete goal?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{g.title}". This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(g.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Saved</span>
                    <span className="font-medium">{fmt(saved)} <span className="text-muted-foreground">/ {fmt(target)}</span></span>
                  </div>
                  <Progress value={pct} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{pct.toFixed(1)}% complete</span>
                    {!done && <span>{fmt(target - saved)} remaining</span>}
                    {done && <span className="text-emerald-600 font-medium">Goal reached!</span>}
                  </div>
                </div>

                {(g.deadline || g.notes) && (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {g.deadline && <DeadlineBadge deadline={g.deadline} done={done} />}
                    {g.notes && <p className="truncate">{g.notes}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      {editGoal && (
        <Dialog open={!!editGoal} onOpenChange={(o) => !o && setEditGoal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Goal</DialogTitle>
            </DialogHeader>
            <GoalForm
              form={editGoal.form}
              onChange={(f) => setEditGoal({ ...editGoal, form: f })}
              onSubmit={handleEdit}
              loading={updateMutation.isPending}
              submitLabel="Save Changes"
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function DeadlineBadge({ deadline, done }: { deadline: string; done: boolean }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(deadline);
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffMs / 86400000);

  if (done) {
    return <p>Target date: <span className="text-foreground font-medium">{deadline}</span></p>;
  }
  if (daysLeft < 0) {
    return (
      <p>
        Target date: <span className="text-foreground font-medium">{deadline}</span>
        {" "}<span className="text-red-600 font-medium">({Math.abs(daysLeft)} day{Math.abs(daysLeft) !== 1 ? "s" : ""} overdue)</span>
      </p>
    );
  }
  if (daysLeft === 0) {
    return (
      <p>
        Target date: <span className="text-foreground font-medium">{deadline}</span>
        {" "}<span className="text-amber-600 font-medium">(due today)</span>
      </p>
    );
  }
  return (
    <p>
      Target date: <span className="text-foreground font-medium">{deadline}</span>
      {" "}<span className="text-muted-foreground">({daysLeft} day{daysLeft !== 1 ? "s" : ""} left)</span>
    </p>
  );
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-card border rounded-xl p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

function GoalForm({
  form,
  onChange,
  onSubmit,
  loading,
  submitLabel,
}: {
  form: typeof emptyForm;
  onChange: (f: typeof emptyForm) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  submitLabel: string;
}) {
  const { currencyLabel, inputStep, inputPlaceholder } = useCurrency();
  const set = (key: keyof typeof emptyForm) => (val: string) => onChange({ ...form, [key]: val });
  const setE = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...form, [key]: e.target.value });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Goal Title</Label>
        <Input value={form.title} onChange={setE("title")} placeholder="e.g. Emergency Fund" required />
      </div>
      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={form.category} onValueChange={set("category")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Target Amount ({currencyLabel})</Label>
          <Input type="number" step={inputStep} min="0" value={form.targetAmount} onChange={setE("targetAmount")} placeholder={inputPlaceholder} required />
        </div>
        <div className="space-y-2">
          <Label>Amount Saved ({currencyLabel})</Label>
          <Input type="number" step={inputStep} min="0" value={form.savedAmount} onChange={setE("savedAmount")} placeholder={inputPlaceholder} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Target Date <span className="text-muted-foreground">(optional)</span></Label>
        <Input type="date" value={form.deadline} onChange={setE("deadline")} />
      </div>
      <div className="space-y-2">
        <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
        <Textarea value={form.notes} onChange={setE("notes")} placeholder="Any extra details..." rows={2} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
