import { useState } from "react";
import { Link } from "wouter";
import {
  useListCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Plus, Lightbulb, Tag, PiggyBank, PieChart, Pencil, Trash2, Check, X } from "lucide-react";
import { KpiCard } from "@/components/redesign/KpiCard";
import { cn } from "@/lib/utils";

const EMPTY = { name: "", kind: "expense" as "expense" | "savings" };

export default function Categories() {
  const { data: categories = [], isLoading, refetch } = useListCategories();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();
  const [draft, setDraft] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(EMPTY);

  const expenseCount = categories.filter((c) => c.kind === "expense").length;
  const savingsCount = categories.filter((c) => c.kind === "savings").length;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = draft.name.trim();
    if (!name) return;
    try {
      await createMutation.mutateAsync({
        data: { name, kind: draft.kind },
      });
      setDraft(EMPTY);
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category");
    }
  };

  const startEdit = (c: { id: string; name: string; kind: string }) => {
    setEditingId(c.id);
    setEditDraft({ name: c.name, kind: (c.kind as "expense" | "savings") ?? "expense" });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(EMPTY);
  };

  const handleEditSave = async (id: string) => {
    const name = editDraft.name.trim();
    if (!name) return;
    setError(null);
    try {
      await updateMutation.mutateAsync({
        id,
        data: { name, kind: editDraft.kind },
      });
      cancelEdit();
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update category");
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

  if (isLoading) return <div className="p-8">Loading…</div>;

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
          label="Categories"
          value={String(categories.length)}
          footer={`${expenseCount} expense · ${savingsCount} savings`}
        />
        <KpiCard
          label="Expense envelopes"
          value={String(expenseCount)}
          footer="Show up under Expenses"
          tone="emerald"
        />
        <KpiCard
          label="Savings vaults"
          value={String(savingsCount)}
          footer="Friction-locked, drag to unlock"
        />
        <div className="rounded-xl border border-dashed bg-accent/40 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-white border flex items-center justify-center text-primary shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold">How this connects to Budgets</div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
              Every category appears as a draggable envelope on the Budgets tab. Fund it by dragging chips from the money bag.
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
        <form onSubmit={handleAdd} className="grid md:grid-cols-[1fr_180px_120px] gap-3 items-end">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Coffee, Petrol, Subscriptions"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="mt-1 w-full h-9 px-3 rounded-md border bg-white text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Type</label>
            <div className="mt-1 grid grid-cols-2 gap-1 h-9">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, kind: "expense" })}
                className={cn(
                  "rounded-md border text-xs font-semibold transition-colors flex items-center justify-center gap-1",
                  draft.kind === "expense"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white border-border hover:bg-accent/40"
                )}
              >
                <Tag className="w-3 h-3" /> Expense
              </button>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, kind: "savings" })}
                className={cn(
                  "rounded-md border text-xs font-semibold transition-colors flex items-center justify-center gap-1",
                  draft.kind === "savings"
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-white border-border hover:bg-accent/40"
                )}
              >
                <PiggyBank className="w-3 h-3" /> Savings
              </button>
            </div>
          </div>
          <Button type="submit" disabled={createMutation.isPending || !draft.name.trim()}>
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
          <div className="text-[11px] text-muted-foreground">{categories.length} total</div>
        </div>
        <div className="divide-y">
          {categories.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No categories yet. Add one above to start budgeting.
            </div>
          )}
          {categories.map((c) => {
            const isSavings = c.kind === "savings";
            const isEditing = editingId === c.id;
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
                      <div className="grid sm:grid-cols-[1fr_200px] gap-2 items-center">
                        <input
                          type="text"
                          autoFocus
                          value={editDraft.name}
                          onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEditSave(c.id);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          className="h-8 px-2 rounded-md border bg-white text-sm outline-none focus:border-primary"
                        />
                        <div className="grid grid-cols-2 gap-1 h-8">
                          <button
                            type="button"
                            onClick={() => setEditDraft({ ...editDraft, kind: "expense" })}
                            className={cn(
                              "rounded-md border text-[11px] font-semibold transition-colors flex items-center justify-center gap-1",
                              editDraft.kind === "expense"
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-white border-border"
                            )}
                          >
                            Expense
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditDraft({ ...editDraft, kind: "savings" })}
                            className={cn(
                              "rounded-md border text-[11px] font-semibold transition-colors flex items-center justify-center gap-1",
                              editDraft.kind === "savings"
                                ? "bg-amber-500 text-white border-amber-500"
                                : "bg-white border-border"
                            )}
                          >
                            Savings
                          </button>
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
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {isSavings ? "Long-term goal — friction-locked on Budgets" : "Funded from your monthly gaji"}
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
                          onClick={() => handleEditSave(c.id)}
                          disabled={updateMutation.isPending || !editDraft.name.trim()}
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
                      <Link href="/budgets">
                        <Button size="sm" variant="ghost" className="text-[11px]">
                          Allocate →
                        </Button>
                      </Link>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => startEdit(c)}
                          title="Rename"
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
