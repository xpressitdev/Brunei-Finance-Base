import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useListGoals,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
} from "@workspace/api-client-react";
import type { Goal } from "@workspace/api-client-react";
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
import { Progress } from "@/components/ui/progress";
import { Plus, Pencil, Trash2, Flag } from "lucide-react";
import { TrialExpiredPrompt } from "@/components/subscription/TrialExpiredPrompt";
import { isTrialExpiredError } from "@/lib/trialExpired";
import { useRegion } from "@/hooks/useRegion";

const CATEGORY_KEYS = [
  "emergency_fund",
  "travel",
  "gadget",
  "home",
  "education",
  "vehicle",
  "investment",
  "other",
] as const;

type GoalCategory = typeof CATEGORY_KEYS[number];

const CATEGORY_ICONS: Record<GoalCategory | string, string> = {
  emergency_fund: "🛡️",
  travel: "✈️",
  gadget: "💻",
  home: "🏡",
  education: "📚",
  vehicle: "🚗",
  investment: "📈",
  other: "🎯",
};

function categoryIcon(c: string) {
  return CATEGORY_ICONS[c] ?? CATEGORY_ICONS.other;
}

function DeadlineBadge({ targetDate }: { targetDate: string | null }) {
  const { t } = useTranslation();
  if (!targetDate) return null;
  const d = new Date(targetDate + "T00:00:00");
  const now = new Date();
  const diff = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const overdue = diff < 0;
  const absDiff = Math.abs(diff);

  let label: string;
  let cls: string;
  if (overdue) {
    label = t("goals.targetDate.overdue", { count: absDiff });
    cls = "bg-red-100 text-red-700";
  } else if (absDiff === 0) {
    label = t("goals.targetDate.today");
    cls = "bg-amber-100 text-amber-700";
  } else if (absDiff === 1) {
    label = t("goals.targetDate.tomorrow");
    cls = "bg-amber-100 text-amber-700";
  } else if (absDiff < 7) {
    label = t("goals.targetDate.inDays", { count: absDiff });
    cls = "bg-amber-100 text-amber-700";
  } else if (absDiff < 30) {
    label = t("goals.targetDate.inWeeks", { count: Math.floor(absDiff / 7) });
    cls = "bg-blue-100 text-blue-700";
  } else if (absDiff < 365) {
    label = t("goals.targetDate.inMonths", { count: Math.floor(absDiff / 30) });
    cls = "bg-blue-100 text-blue-700";
  } else {
    label = t("goals.targetDate.inYears", { count: Math.floor(absDiff / 365) });
    cls = "bg-green-100 text-green-700";
  }

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
  );
}

const EMPTY_FORM = {
  name: "",
  targetAmount: "",
  savedAmount: "0",
  targetDate: "",
  category: "other" as string,
};

type FormState = typeof EMPTY_FORM;

function GoalForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormState;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const { region, decimalStep } = useRegion();
  const [form, setForm] = useState<FormState>(initial);
  const set = (k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t("goals.addDialog.nameLabel")}</Label>
        <Input
          value={form.name}
          onChange={e => set("name", e.target.value)}
          placeholder={t("goals.addDialog.namePlaceholder")}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>{t("goals.addDialog.categoryLabel")}</Label>
        <div className="grid grid-cols-4 gap-2">
          {CATEGORY_KEYS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => set("category", c)}
              className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-xs font-medium transition-colors
                ${form.category === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              <span className="text-xl">{categoryIcon(c)}</span>
              <span className="text-center leading-tight">{t(`goals.categories.${c}`)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("goals.addDialog.targetLabel", { currency: region.currency })}</Label>
        <Input
          type="number"
          step={decimalStep}
          min="0"
          value={form.targetAmount}
          onChange={e => set("targetAmount", e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>{t("goals.addDialog.savedLabel", { currency: region.currency })}</Label>
        <Input
          type="number"
          step={decimalStep}
          min="0"
          value={form.savedAmount}
          onChange={e => set("savedAmount", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("goals.addDialog.targetDateLabel")}</Label>
        <Input
          type="date"
          value={form.targetDate}
          onChange={e => set("targetDate", e.target.value)}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={saving}>
          {t("common.cancel")}
        </Button>
        <Button
          className="flex-1"
          onClick={() => onSave(form)}
          disabled={saving || !form.name.trim() || !form.targetAmount}
        >
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}

export default function Goals() {
  const { t } = useTranslation();
  const { data: goals = [], isLoading, refetch } = useListGoals();
  const createMut = useCreateGoal();
  const updateMut = useUpdateGoal();
  const deleteMut = useDeleteGoal();
  const { formatCurrency } = useRegion();

  const [addOpen, setAddOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [deleteGoal, setDeleteGoal] = useState<Goal | null>(null);
  const [saving, setSaving] = useState(false);
  const [trialExpiredError, setTrialExpiredError] = useState(false);

  const inv = () => refetch();

  async function handleCreate(form: FormState) {
    setSaving(true);
    try {
      await createMut.mutateAsync({
        data: {
          name: form.name.trim(),
          targetAmount: form.targetAmount,
          savedAmount: form.savedAmount || "0",
          targetDate: form.targetDate || null,
          category: form.category,
        },
      });
      await inv();
      setAddOpen(false);
    } catch (err) {
      if (isTrialExpiredError(err)) setTrialExpiredError(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(form: FormState) {
    if (!editGoal) return;
    setSaving(true);
    try {
      await updateMut.mutateAsync({
        id: editGoal.id,
        data: {
          name: form.name.trim(),
          targetAmount: form.targetAmount,
          savedAmount: form.savedAmount || "0",
          targetDate: form.targetDate || null,
          category: form.category,
        },
      });
      await inv();
      setEditGoal(null);
    } catch (err) {
      if (isTrialExpiredError(err)) setTrialExpiredError(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteGoal) return;
    await deleteMut.mutateAsync({ id: deleteGoal.id });
    await inv();
    setDeleteGoal(null);
  }

  const totalSaved = goals.reduce((s, g) => s + parseFloat(g.savedAmount ?? "0"), 0);
  const totalTarget = goals.reduce((s, g) => s + parseFloat(g.targetAmount), 0);
  const overallPct = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-muted rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-muted rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("goals.title")}</h1>
          <p className="text-muted-foreground">{t("goals.subtitle")}</p>
        </div>
        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setTrialExpiredError(false); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> {t("goals.addButton")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("goals.addDialog.title")}</DialogTitle>
            </DialogHeader>
            {trialExpiredError && <TrialExpiredPrompt action="add goals" />}
            <GoalForm initial={EMPTY_FORM} onSave={handleCreate} onCancel={() => setAddOpen(false)} saving={saving} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary card */}
      {goals.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-medium text-muted-foreground">{t("goals.overallProgress")}</div>
              <div className="text-2xl font-bold text-primary">{formatCurrency(totalSaved)} / {formatCurrency(totalTarget)}</div>
            </div>
            <div className="text-3xl font-bold text-primary">{overallPct.toFixed(0)}%</div>
          </div>
          <Progress value={overallPct} className="h-3" />
          <p className="text-xs text-muted-foreground mt-2">{t("goals.goalsCount", { count: goals.length })}</p>
        </div>
      )}

      {/* Goals grid */}
      {goals.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-muted py-16 text-center">
          <div className="text-5xl mb-4">🎯</div>
          <p className="font-semibold text-lg mb-1">{t("goals.empty")}</p>
          <p className="text-sm text-muted-foreground mb-6">{t("goals.emptySub")}</p>
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> {t("goals.addFirstButton")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map(goal => {
            const saved = parseFloat(goal.savedAmount ?? "0");
            const target = parseFloat(goal.targetAmount);
            const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
            const done = saved >= target;

            return (
              <div key={goal.id} className={`bg-white border rounded-xl p-5 flex flex-col gap-4 group relative ${done ? "border-primary/30 bg-primary/5" : ""}`}>
                {/* Actions */}
                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => setEditGoal(goal)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteGoal(goal)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Icon + title */}
                <div className="flex items-start gap-3 pr-16">
                  <span className="text-3xl">{categoryIcon(goal.category ?? "other")}</span>
                  <div>
                    <p className="font-semibold text-base leading-tight">{goal.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t(`goals.categories.${goal.category ?? "other"}`)}</p>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium">{formatCurrency(saved)}</span>
                    <span className="text-muted-foreground">{formatCurrency(target)}</span>
                  </div>
                  <Progress value={pct} className={`h-2.5 ${done ? "[&>div]:bg-primary" : ""}`} />
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                    <DeadlineBadge targetDate={goal.targetDate ?? null} />
                  </div>
                </div>

                {done && (
                  <div className="flex items-center gap-2 text-primary bg-primary/10 rounded-lg px-3 py-2">
                    <Flag className="w-4 h-4" />
                    <span className="text-sm font-medium">{t("goals.completed")}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editGoal} onOpenChange={o => { if (!o) setEditGoal(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("goals.editDialog.title")}</DialogTitle>
          </DialogHeader>
          {trialExpiredError && <TrialExpiredPrompt action="edit goals" />}
          {editGoal && (
            <GoalForm
              initial={{
                name: editGoal.name,
                targetAmount: editGoal.targetAmount,
                savedAmount: editGoal.savedAmount ?? "0",
                targetDate: editGoal.targetDate ?? "",
                category: editGoal.category ?? "other",
              }}
              onSave={handleUpdate}
              onCancel={() => setEditGoal(null)}
              saving={saving}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteGoal} onOpenChange={o => { if (!o) setDeleteGoal(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("goals.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("goals.deleteDialog.description", { name: deleteGoal?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              {t("goals.deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
