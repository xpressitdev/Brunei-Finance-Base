import { useState } from "react";
import { Link } from "wouter";
import {
  useListCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useListCommitments,
  useCreateCommitment,
  useUpdateCommitment,
  useDeleteCommitment,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Plus, Lightbulb, Tag, PiggyBank, PieChart, Pencil, Trash2, Check, X, Receipt } from "lucide-react";
import { KpiCard } from "@/components/redesign/KpiCard";
import { cn } from "@/lib/utils";

// "type" drives both UI choice and which API gets called on save.
//   variable → category (kind: expense, defaultBudget = optional target)
//   fixed    → commitment (label + monthly amount)
//   savings  → category (kind: savings, defaultBudget = suggested contribution)
type CatType = "variable" | "fixed" | "savings";
const EMPTY = { name: "", type: "variable" as CatType, defaultBudget: "" };

function safeNum(x: unknown): number {
  const n = typeof x === "number" ? x : parseFloat(String(x ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

function fmtBND(n: number) {
  return "BND " + n.toLocaleString("en-BN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Categories() {
  const { data: categories = [], isLoading, refetch } = useListCategories();
  const {
    data: commitments = [],
    isLoading: isLoadingCommitments,
    error: commitmentsError,
    refetch: refetchCommitments,
  } = useListCommitments();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();
  const createCommitmentMutation = useCreateCommitment();
  const updateCommitmentMutation = useUpdateCommitment();
  const deleteCommitmentMutation = useDeleteCommitment();
  const [draft, setDraft] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  // Edit state tracks both source (category vs commitment) and the row id so the
  // right mutation runs on save.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<"category" | "commitment">("category");
  const [editDraft, setEditDraft] = useState(EMPTY);

  const expenseCount = categories.filter((c) => c.kind === "expense").length;
  const savingsCount = categories.filter((c) => c.kind === "savings").length;
  const fixedCount = commitments.length;
  const totalMonthlyBudget =
    categories.reduce((s, c) => s + safeNum(c.defaultBudget), 0) +
    commitments.reduce((s, c) => s + safeNum(c.amount), 0);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = draft.name.trim();
    if (!name) return;
    const budgetNum = draft.defaultBudget.trim() === "" ? 0 : Number(draft.defaultBudget);
    if (!Number.isFinite(budgetNum) || budgetNum < 0) {
      setError("Amount must be a non-negative number");
      return;
    }
    try {
      if (draft.type === "fixed") {
        // Fixed bills are stored as commitments (separate entity from categories
        // so they can carry a fixed monthly amount + recurrence).
        if (budgetNum <= 0) {
          setError("Fixed bills need a monthly amount");
          return;
        }
        await createCommitmentMutation.mutateAsync({
          data: { label: name, amount: budgetNum.toFixed(2), recurrence: "monthly" },
        });
        refetchCommitments();
      } else {
        await createMutation.mutateAsync({
          data: {
            name,
            kind: draft.type === "savings" ? "savings" : "expense",
            defaultBudget: budgetNum.toFixed(2),
          },
        });
        refetch();
      }
      setDraft(EMPTY);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    }
  };

  const startEditCategory = (c: { id: string; name: string; kind: string; defaultBudget: string }) => {
    setEditingId(c.id);
    setEditingSource("category");
    setEditDraft({
      name: c.name,
      type: (c.kind === "savings" ? "savings" : "variable"),
      defaultBudget: safeNum(c.defaultBudget) > 0 ? String(safeNum(c.defaultBudget)) : "",
    });
    setError(null);
  };

  const startEditCommitment = (c: { id: string; label: string; amount: string }) => {
    setEditingId(c.id);
    setEditingSource("commitment");
    setEditDraft({
      name: c.label,
      type: "fixed",
      defaultBudget: safeNum(c.amount) > 0 ? String(safeNum(c.amount)) : "",
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingSource("category");
    setEditDraft(EMPTY);
  };

  const handleEditSave = async (id: string, isDefault: boolean) => {
    const name = editDraft.name.trim();
    if (!name) return;
    const budgetNum = editDraft.defaultBudget.trim() === "" ? 0 : Number(editDraft.defaultBudget);
    if (!Number.isFinite(budgetNum) || budgetNum < 0) {
      setError("Amount must be a non-negative number");
      return;
    }
    setError(null);
    try {
      if (editingSource === "commitment") {
        if (budgetNum <= 0) {
          setError("Fixed bills need a monthly amount");
          return;
        }
        await updateCommitmentMutation.mutateAsync({
          id,
          data: { label: name, amount: budgetNum.toFixed(2) },
        });
        refetchCommitments();
      } else {
        // System defaults can only have their budget edited; name/kind are protected server-side.
        const data = isDefault
          ? { defaultBudget: budgetNum.toFixed(2) }
          : {
              name,
              kind: editDraft.type === "savings" ? "savings" as const : "expense" as const,
              defaultBudget: budgetNum.toFixed(2),
            };
        await updateMutation.mutateAsync({ id, data });
        refetch();
      }
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"? Existing transactions and budgets in this category will be uncategorized.`)) {
      return;
    }
    setError(null);
    try {
      await deleteMutation.mutateAsync({ id });
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category");
    }
  };

  const handleDeleteCommitment = async (id: string, name: string) => {
    if (!confirm(`Delete fixed bill "${name}"? This cannot be undone.`)) return;
    setError(null);
    try {
      await deleteCommitmentMutation.mutateAsync({ id });
      refetchCommitments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete fixed bill");
    }
  };

  if (isLoading || isLoadingCommitments) return <div className="p-8">Loading…</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Expense Categories</h1>
          <p className="text-muted-foreground">
            Add categories to organize your spending. Each becomes an envelope on the Budgets page.
          </p>
        </div>
        <Link href="/budgets">
          <Button variant="outline" size="sm">
            <PieChart className="w-4 h-4 mr-2" /> View on Budgets
          </Button>
        </Link>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total monthly budget"
          value={fmtBND(totalMonthlyBudget)}
          footer={`${fixedCount} fixed + ${expenseCount} variable + ${savingsCount} savings · Savings funded via Goals`}
          tone="emerald"
        />
        <KpiCard
          label="Categories"
          value={String(categories.length + commitments.length)}
          footer={`${fixedCount} fixed · ${expenseCount} variable · ${savingsCount} savings`}
        />
        <KpiCard
          label="Fixed bills"
          value={String(fixedCount)}
          footer="Same amount every month — auto-allocated"
        />
        <div className="rounded-xl border border-dashed bg-accent/40 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-white border flex items-center justify-center text-primary shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold">How this connects to Budgets</div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
              The default budget you set here is the suggested monthly target shown on each envelope's bar. Fund by dragging chips on the Budgets tab.
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
          <h2 className="text-base font-semibold tracking-tight">Add a category</h2>
        </div>
        <form onSubmit={handleAdd} className="grid md:grid-cols-[1fr_260px_160px_120px] gap-3 items-end">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Name</label>
            <input
              type="text"
              required
              placeholder={
                draft.type === "fixed"
                  ? "e.g. Internet, Subscriptions, Insurance"
                  : "e.g. Coffee, Petrol, Groceries"
              }
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="mt-1 w-full h-9 px-3 rounded-md border bg-white text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Type</label>
            <div className="mt-1 grid grid-cols-3 gap-1 h-9">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, type: "variable" })}
                title="Spending that varies month to month — set a target budget"
                className={cn(
                  "rounded-md border text-[11px] font-semibold transition-colors flex items-center justify-center gap-1",
                  draft.type === "variable"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white border-border hover:bg-accent/40"
                )}
              >
                <Tag className="w-3 h-3" /> Variable
              </button>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, type: "fixed" })}
                title="Fixed monthly bill — same amount each month"
                className={cn(
                  "rounded-md border text-[11px] font-semibold transition-colors flex items-center justify-center gap-1",
                  draft.type === "fixed"
                    ? "bg-sky-600 text-white border-sky-600"
                    : "bg-white border-border hover:bg-accent/40"
                )}
              >
                <Receipt className="w-3 h-3" /> Fixed
              </button>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, type: "savings" })}
                title="Savings vault — funded via Goals"
                className={cn(
                  "rounded-md border text-[11px] font-semibold transition-colors flex items-center justify-center gap-1",
                  draft.type === "savings"
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-white border-border hover:bg-accent/40"
                )}
              >
                <PiggyBank className="w-3 h-3" /> Savings
              </button>
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              {draft.type === "fixed" ? "Monthly amount" : "Default budget"}
            </label>
            <div className="mt-1 relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">BND</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={draft.defaultBudget}
                onChange={(e) => setDraft({ ...draft, defaultBudget: e.target.value })}
                className="w-full h-9 pl-10 pr-2 rounded-md border bg-white text-sm tabular-nums outline-none focus:border-primary"
              />
            </div>
          </div>
          <Button type="submit" disabled={createMutation.isPending || createCommitmentMutation.isPending || !draft.name.trim()}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </form>
        {error && (
          <div className="mt-3 text-xs text-rose-600">{error}</div>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between border-b">
          <div className="text-sm font-semibold">Your categories</div>
          <div className="text-[11px] text-muted-foreground">
            {categories.length + commitments.length} total
            {fixedCount > 0 && <span className="ml-2">· {fixedCount} fixed</span>}
          </div>
        </div>
        {commitmentsError && (
          <div className="px-5 py-2 text-[11px] bg-rose-50 text-rose-700 border-b border-rose-200 flex items-center justify-between">
            <span>Couldn't load fixed bills.</span>
            <button
              type="button"
              onClick={() => refetchCommitments()}
              className="underline font-semibold"
            >
              Retry
            </button>
          </div>
        )}
        <div className="divide-y">
          {categories.length === 0 && commitments.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No categories yet. Add one above to start budgeting.
            </div>
          )}
          {/* Fixed bills (commitments) — rendered first so users see fixed
              outflows up top. Each row supports edit + delete inline. */}
          {commitments.map((c) => {
            const isEditing = editingId === c.id && editingSource === "commitment";
            return (
              <div key={`commit-${c.id}`} className="px-5 py-3 hover:bg-accent/30 transition-colors">
                <div className="grid grid-cols-[40px_1fr_auto] gap-3 items-center">
                  <div className="w-9 h-9 rounded-md flex items-center justify-center bg-sky-50 text-sky-700">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    {isEditing ? (
                      <div className="grid sm:grid-cols-[1fr_140px] gap-2 items-center">
                        <input
                          type="text"
                          autoFocus
                          value={editDraft.name}
                          onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEditSave(c.id, false);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          className="h-8 px-2 rounded-md border bg-white text-sm outline-none focus:border-primary"
                        />
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">BND</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={editDraft.defaultBudget}
                            onChange={(e) => setEditDraft({ ...editDraft, defaultBudget: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleEditSave(c.id, false);
                              if (e.key === "Escape") cancelEdit();
                            }}
                            className="w-full h-8 pl-10 pr-2 rounded-md border bg-white text-xs tabular-nums outline-none focus:border-primary"
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-sm font-semibold truncate">{c.label}</div>
                          <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                            Fixed
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                          <span>Same amount every month — auto-allocated on Budgets</span>
                          <span className="tabular-nums font-semibold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">
                            {fmtBND(safeNum(c.amount))} / mo
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-emerald-700"
                          onClick={() => handleEditSave(c.id, false)}
                          disabled={updateCommitmentMutation.isPending || !editDraft.name.trim()}
                          title="Save"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground"
                          onClick={cancelEdit}
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => startEditCommitment(c)}
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600"
                          onClick={() => handleDeleteCommitment(c.id, c.label)}
                          disabled={deleteCommitmentMutation.isPending}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {categories.map((c) => {
            const isSavings = c.kind === "savings";
            const isEditing = editingId === c.id && editingSource === "category";
            return (
              <div key={c.id} className="px-5 py-3 hover:bg-accent/30 transition-colors">
                <div className="grid grid-cols-[40px_1fr_auto] gap-3 items-center">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-md flex items-center justify-center",
                      isSavings ? "bg-amber-50 text-amber-700" : "bg-primary/10 text-primary"
                    )}
                  >
                    {isSavings ? <PiggyBank className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    {isEditing ? (
                      <div className="grid sm:grid-cols-[1fr_180px_140px] gap-2 items-center">
                        <input
                          type="text"
                          autoFocus
                          disabled={c.isDefault}
                          value={editDraft.name}
                          onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEditSave(c.id, c.isDefault);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          className="h-8 px-2 rounded-md border bg-white text-sm outline-none focus:border-primary disabled:bg-muted/40 disabled:text-muted-foreground"
                          title={c.isDefault ? "Default category names can't be changed" : undefined}
                        />
                        <div className="grid grid-cols-2 gap-1 h-8">
                          <button
                            type="button"
                            disabled={c.isDefault}
                            onClick={() => setEditDraft({ ...editDraft, type: "variable" })}
                            className={cn(
                              "rounded-md border text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 disabled:opacity-50",
                              editDraft.type === "variable"
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-white border-border"
                            )}
                          >
                            Expense
                          </button>
                          <button
                            type="button"
                            disabled={c.isDefault}
                            onClick={() => setEditDraft({ ...editDraft, type: "savings" })}
                            className={cn(
                              "rounded-md border text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 disabled:opacity-50",
                              editDraft.type === "savings"
                                ? "bg-amber-500 text-white border-amber-500"
                                : "bg-white border-border"
                            )}
                          >
                            Savings
                          </button>
                        </div>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">BND</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={editDraft.defaultBudget}
                            onChange={(e) => setEditDraft({ ...editDraft, defaultBudget: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleEditSave(c.id, c.isDefault);
                              if (e.key === "Escape") cancelEdit();
                            }}
                            className="w-full h-8 pl-10 pr-2 rounded-md border bg-white text-xs tabular-nums outline-none focus:border-primary"
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-sm font-semibold truncate">{c.name}</div>
                          {c.isDefault && (
                            <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              Default
                            </span>
                          )}
                          {isSavings && (
                            <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              Vault
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                          <span>{isSavings ? "Long-term goal — friction-locked on Budgets" : "Funded from your monthly gaji"}</span>
                          <span
                            className={cn(
                              "tabular-nums font-semibold px-1.5 py-0.5 rounded",
                              safeNum(c.defaultBudget) > 0
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-muted text-muted-foreground"
                            )}
                            title={
                              isSavings
                                ? "Suggested monthly contribution — savings are actually funded via Goals"
                                : "Suggested monthly budget shown on the envelope bar"
                            }
                          >
                            {safeNum(c.defaultBudget) > 0
                              ? `${fmtBND(safeNum(c.defaultBudget))} / mo`
                              : "no budget set"}
                          </span>
                          {isSavings && (
                            <span
                              className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200"
                              title="Savings categories are funded via Goals, not the monthly envelope target"
                            >
                              via Goals
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-emerald-700"
                          onClick={() => handleEditSave(c.id, c.isDefault)}
                          disabled={updateMutation.isPending || (!c.isDefault && !editDraft.name.trim())}
                          title="Save"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground"
                          onClick={cancelEdit}
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : c.isDefault ? (
                      <>
                        {/* Default categories: name/kind are locked in the
                            edit form (only budget is editable), but the row
                            can still be deleted. */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => startEditCategory(c)}
                          title="Set monthly budget"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600"
                          onClick={() => handleDelete(c.id, c.name)}
                          disabled={deleteMutation.isPending}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => startEditCategory(c)}
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600"
                          onClick={() => handleDelete(c.id, c.name)}
                          disabled={deleteMutation.isPending}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
