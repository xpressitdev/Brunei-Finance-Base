import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useListGoals,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
} from "@workspace/api-client-react";
import type { Goal, CreateGoalBodyCategory } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Pencil,
  Trash2,
  Lightbulb,
  PieChart,
  Star,
  Plane,
  Home,
  Car,
  GraduationCap,
  Heart,
  Smartphone,
  TrendingUp,
  Shield,
  Check,
} from "lucide-react";
import { KpiCard } from "@/components/redesign/KpiCard";
import { fmtBND } from "@/lib/format";
import { useRegion } from "@/hooks/useRegion";

// Icon picker — lucide icons keyed by short name. Stored locally per goal in
// localStorage because the API does not persist an icon field.
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Star,
  Plane,
  Home,
  Car,
  GraduationCap,
  Heart,
  Smartphone,
  TrendingUp,
  Shield,
};
const ICON_NAMES = Object.keys(ICONS);

const META_KEY = "duitplan-goal-meta";
type GoalMeta = { icon?: string; monthlyContribution?: number };
type MetaMap = Record<string, GoalMeta>;
function loadMeta(): MetaMap {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as MetaMap) : {};
  } catch {
    return {};
  }
}
function saveMeta(map: MetaMap) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota errors */
  }
}

const BLANK_DRAFT = {
  title: "",
  icon: "Star",
  target: "",
  deadline: "",
  monthlyContribution: "",
};

type Draft = typeof BLANK_DRAFT;

function IconGlyph({ name, className }: { name: string; className?: string }) {
  const I = ICONS[name] ?? Star;
  return <I className={className} />;
}

// Convert YYYY-MM to month input value (already same shape) and back.
function toMonthInput(deadline: string | null | undefined): string {
  if (!deadline) return "";
  // Accept either YYYY-MM or YYYY-MM-DD; <input type=month> wants YYYY-MM.
  return deadline.length >= 7 ? deadline.slice(0, 7) : deadline;
}

function deadlineLabel(deadline: string | null | undefined): string | null {
  if (!deadline) return null;
  const ym = deadline.length >= 7 ? deadline.slice(0, 7) : deadline;
  const [y, m] = ym.split("-");
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  if (Number.isNaN(d.getTime())) return ym;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function Goals() {
  const { data: goals = [], isLoading, refetch } = useListGoals();
  const createMut = useCreateGoal();
  const updateMut = useUpdateGoal();
  const deleteMut = useDeleteGoal();
  const { region } = useRegion();

  const [meta, setMeta] = useState<MetaMap>(() => loadMeta());
  const [draft, setDraft] = useState<Draft>(BLANK_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(BLANK_DRAFT);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    saveMeta(meta);
  }, [meta]);

  const totalSaved = goals.reduce(
    (s, g) => s + parseFloat(g.savedAmount ?? "0") || 0,
    0,
  );
  const totalTarget = goals.reduce(
    (s, g) => s + parseFloat(g.targetAmount) || 0,
    0,
  );
  const overallPct = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
  const totalMonthly = useMemo(
    () =>
      goals.reduce(
        (s, g) => s + (meta[g.id]?.monthlyContribution ?? 0),
        0,
      ),
    [goals, meta],
  );

  const monthsLeft = (g: Goal) => {
    const monthly = meta[g.id]?.monthlyContribution ?? 0;
    const remaining = Math.max(
      0,
      parseFloat(g.targetAmount) - parseFloat(g.savedAmount ?? "0"),
    );
    if (monthly <= 0 || remaining <= 0) return null;
    return Math.ceil(remaining / monthly);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const title = draft.title.trim();
    const target = Number(draft.target);
    const monthly = Number(draft.monthlyContribution || 0);
    if (!title) return;
    if (!Number.isFinite(target) || target <= 0) return;
    if (!Number.isFinite(monthly) || monthly < 0) return;
    try {
      const created = await createMut.mutateAsync({
        data: {
          title,
          targetAmount: String(target),
          savedAmount: "0",
          deadline: draft.deadline || null,
          category: "savings" as CreateGoalBodyCategory,
        },
      });
      setMeta((m) => ({
        ...m,
        [created.id]: { icon: draft.icon, monthlyContribution: monthly },
      }));
      setDraft(BLANK_DRAFT);
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add goal");
    }
  };

  const startEdit = (g: Goal) => {
    setEditingId(g.id);
    setEditDraft({
      title: g.title,
      icon: meta[g.id]?.icon ?? "Star",
      target: g.targetAmount,
      deadline: toMonthInput(g.deadline),
      monthlyContribution: String(meta[g.id]?.monthlyContribution ?? 0),
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const title = editDraft.title.trim();
    const target = Number(editDraft.target);
    const monthly = Number(editDraft.monthlyContribution || 0);
    if (!title) return;
    if (!Number.isFinite(target) || target <= 0) return;
    if (!Number.isFinite(monthly) || monthly < 0) return;
    try {
      await updateMut.mutateAsync({
        id: editingId,
        data: {
          title,
          targetAmount: String(target),
          deadline: editDraft.deadline || null,
        },
      });
      setMeta((m) => ({
        ...m,
        [editingId]: {
          icon: editDraft.icon,
          monthlyContribution: monthly,
        },
      }));
      setEditingId(null);
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save goal");
    }
  };

  const removeGoal = async (g: Goal) => {
    if (!confirm(`Delete "${g.title}"? Its vault will also be removed from Budgets.`)) return;
    try {
      await deleteMut.mutateAsync({ id: g.id });
      setMeta((m) => {
        const next = { ...m };
        delete next[g.id];
        return next;
      });
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete goal");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-muted rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-xl" />
          ))}
        </div>
        <div className="h-40 bg-muted rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Goals</h1>
          <p className="text-muted-foreground">
            Add or edit savings goals. Each one becomes a Vault card on the Budgets page.
          </p>
        </div>
        <Link href="/budgets">
          <Button variant="outline" size="sm">
            <PieChart className="w-4 h-4 mr-2" /> View on Budgets
          </Button>
        </Link>
      </div>

      {error && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Goals"
          value={String(goals.length)}
          footer={<span className="text-[11px] text-muted-foreground">Long-term savings vaults</span>}
        />
        <KpiCard
          label="Saved so far"
          value={fmtBND(totalSaved)}
          tone="primary"
          footer={
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {Math.round(overallPct)}% of {fmtBND(totalTarget)}
            </span>
          }
        />
        <KpiCard
          label="Monthly contribution"
          value={fmtBND(totalMonthly)}
          footer={<span className="text-[11px] text-muted-foreground">Across all goals</span>}
        />
        <div className="rounded-xl border border-dashed bg-accent/40 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-white border flex items-center justify-center text-primary shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold">How this connects to Budgets</div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
              Each goal becomes a card in the <span className="font-semibold">Vault</span> column. Pulling money out is friction-locked.
            </p>
          </div>
        </div>
      </div>

      {/* Add new */}
      <div className="bg-white border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Plus className="w-4 h-4" />
          </div>
          <h2 className="text-base font-semibold tracking-tight">Add a goal</h2>
        </div>
        <form
          onSubmit={submit}
          className="grid md:grid-cols-[1.4fr_140px_140px_140px_140px_auto] gap-2 items-end"
        >
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Name</label>
            <input
              type="text"
              placeholder="e.g. Umrah 2027, Wedding fund"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="mt-1 w-full h-9 px-3 rounded-md border bg-white text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Icon</label>
            <select
              value={draft.icon}
              onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
              className="mt-1 w-full h-9 px-2 rounded-md border bg-white text-sm outline-none focus:border-primary"
            >
              {ICON_NAMES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Target</label>
            <div className="mt-1 flex items-center h-9 px-3 rounded-md border bg-white">
              <span className="text-[11px] font-bold text-muted-foreground mr-1">{region.currency}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={draft.target}
                onChange={(e) => setDraft({ ...draft, target: e.target.value })}
                className="flex-1 bg-transparent text-sm font-bold tabular-nums outline-none w-full"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Deadline</label>
            <input
              type="month"
              value={draft.deadline}
              onChange={(e) => setDraft({ ...draft, deadline: e.target.value })}
              className="mt-1 w-full h-9 px-3 rounded-md border bg-white text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Monthly /mo</label>
            <div className="mt-1 flex items-center h-9 px-3 rounded-md border bg-white">
              <span className="text-[11px] font-bold text-muted-foreground mr-1">{region.currency}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={draft.monthlyContribution}
                onChange={(e) => setDraft({ ...draft, monthlyContribution: e.target.value })}
                className="flex-1 bg-transparent text-sm font-bold tabular-nums outline-none w-full"
              />
            </div>
          </div>
          <Button type="submit" size="default" disabled={createMut.isPending}>
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </form>
      </div>

      {/* List */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between border-b">
          <div className="text-sm font-semibold">Your goals</div>
          <div className="text-[11px] text-muted-foreground">Tap a row to edit</div>
        </div>
        <div className="divide-y">
          {goals.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No goals yet. Add one above to start saving toward something.
            </div>
          )}
          {goals.map((g) => {
            const isEditing = editingId === g.id;
            const target = parseFloat(g.targetAmount) || 0;
            const saved = parseFloat(g.savedAmount ?? "0") || 0;
            const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
            const left = monthsLeft(g);
            const monthly = meta[g.id]?.monthlyContribution ?? 0;
            const iconName = meta[g.id]?.icon ?? "Star";
            const dlLabel = deadlineLabel(g.deadline);

            return (
              <div key={g.id} className="px-5 py-4 hover:bg-accent/30 transition-colors">
                {isEditing ? (
                  <div className="grid md:grid-cols-[40px_1.4fr_140px_140px_140px_140px_auto_auto] gap-2 items-center">
                    <div className="w-9 h-9 rounded-md bg-amber-50 flex items-center justify-center text-amber-700">
                      <IconGlyph name={editDraft.icon} className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={editDraft.title}
                      onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                      className="h-9 px-3 rounded-md border bg-white text-sm outline-none focus:border-primary"
                    />
                    <select
                      value={editDraft.icon}
                      onChange={(e) => setEditDraft({ ...editDraft, icon: e.target.value })}
                      className="h-9 px-2 rounded-md border bg-white text-sm outline-none"
                    >
                      {ICON_NAMES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center h-9 px-3 rounded-md border bg-white">
                      <span className="text-[11px] font-bold text-muted-foreground mr-1">{region.currency}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editDraft.target}
                        onChange={(e) => setEditDraft({ ...editDraft, target: e.target.value })}
                        className="flex-1 bg-transparent text-sm font-bold tabular-nums outline-none w-full"
                      />
                    </div>
                    <input
                      type="month"
                      value={editDraft.deadline}
                      onChange={(e) => setEditDraft({ ...editDraft, deadline: e.target.value })}
                      className="h-9 px-3 rounded-md border bg-white text-sm outline-none focus:border-primary"
                    />
                    <div className="flex items-center h-9 px-3 rounded-md border bg-white">
                      <span className="text-[11px] font-bold text-muted-foreground mr-1">{region.currency}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editDraft.monthlyContribution}
                        onChange={(e) => setEditDraft({ ...editDraft, monthlyContribution: e.target.value })}
                        className="flex-1 bg-transparent text-sm font-bold tabular-nums outline-none w-full"
                      />
                    </div>
                    <Button size="sm" onClick={saveEdit} disabled={updateMut.isPending}>
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-[40px_1fr_auto_auto_auto] gap-3 items-center">
                    <div className="w-9 h-9 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center">
                      <IconGlyph name={iconName} className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm font-semibold truncate">{g.title}</div>
                        {dlLabel && (
                          <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            By {dlLabel}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                        {fmtBND(saved)} of {fmtBND(target)} saved
                        {left !== null && left > 0 && (
                          <span> · ~{left} mo at {fmtBND(monthly)}/mo</span>
                        )}
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden max-w-md">
                        <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                        {Math.round(pct)}% of goal
                      </div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Monthly</div>
                      <div className="text-sm font-bold tabular-nums">{fmtBND(monthly)}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => startEdit(g)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeGoal(g)}
                      className="text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
