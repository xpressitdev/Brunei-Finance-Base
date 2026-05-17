import { useState } from "react";
import { format } from "date-fns";
import { useParams, Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetImportedRows,
  useConfirmImport,
  useListCategories,
  useCreateCategory,
  getListCategoriesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Check, X, AlertCircle, AlertTriangle, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TrialExpiredPrompt } from "@/components/subscription/TrialExpiredPrompt";
import { isTrialExpiredError } from "@/lib/trialExpired";

export default function ReviewImport() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [trialExpiredError, setTrialExpiredError] = useState(false);
  
  const { data: rows, isLoading } = useGetImportedRows(id!);
  const { data: categories } = useListCategories();
  const confirmMutation = useConfirmImport();
  const createCategoryMutation = useCreateCategory();
  const queryClient = useQueryClient();

  const [selections, setSelections] = useState<Record<string, { categoryId: string | null, skip: boolean }>>({});
  // When the user picks the "+ New category…" option in a row's dropdown we
  // remember which row asked so we can auto-assign the newly created category
  // back to that row after the dialog closes.
  const [newCategoryRowId, setNewCategoryRowId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryBudget, setNewCategoryBudget] = useState("");
  const [newCategoryError, setNewCategoryError] = useState<string | null>(null);

  const openNewCategoryDialog = (rowId: string) => {
    setNewCategoryRowId(rowId);
    setNewCategoryName("");
    setNewCategoryBudget("");
    setNewCategoryError(null);
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setNewCategoryError("Please enter a name");
      return;
    }
    const budgetRaw = newCategoryBudget.trim();
    const budgetNum = budgetRaw === "" ? 0 : Number(budgetRaw);
    if (!Number.isFinite(budgetNum) || budgetNum < 0) {
      setNewCategoryError("Budget must be a non-negative number");
      return;
    }
    if (categories?.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      setNewCategoryError("A category with that name already exists");
      return;
    }
    try {
      const created = await createCategoryMutation.mutateAsync({
        data: { name, kind: "expense", defaultBudget: budgetNum.toFixed(2) },
      });
      // Refresh the categories list everywhere (review screen, /categories
      // page, budgets, etc.) and auto-select the new category on the row
      // that opened the dialog.
      await queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
      if (newCategoryRowId && created?.id) {
        setSelections(prev => ({
          ...prev,
          [newCategoryRowId]: { ...prev[newCategoryRowId], categoryId: created.id },
        }));
      }
      setNewCategoryRowId(null);
    } catch (err) {
      setNewCategoryError(err instanceof Error ? err.message : "Failed to create category");
    }
  };
  
  // Initialize selections once rows are loaded. Rows the server marked as
  // possible duplicates are unchecked (skip=true) by default so the user has
  // to opt in to re-importing them.
  if (rows && Object.keys(selections).length === 0 && rows.length > 0) {
    const initial: Record<string, { categoryId: string | null, skip: boolean }> = {};
    rows.forEach(r => {
      let matchedCatId = null;
      if (r.categorySuggestion && categories) {
        const cat = categories.find(c => c.name.toLowerCase() === r.categorySuggestion?.toLowerCase());
        if (cat) matchedCatId = cat.id;
      }
      initial[r.id] = { categoryId: matchedCatId, skip: !!r.isPossibleDuplicate };
    });
    setSelections(initial);
  }

  const handleToggleSkip = (rowId: string, checked: boolean) => {
    setSelections(prev => ({
      ...prev,
      [rowId]: { ...prev[rowId], skip: !checked }
    }));
  };

  const handleCategoryChange = (rowId: string, categoryId: string) => {
    if (categoryId === "__new__") {
      openNewCategoryDialog(rowId);
      return;
    }
    setSelections(prev => ({
      ...prev,
      [rowId]: { ...prev[rowId], categoryId: categoryId === "none" ? null : categoryId }
    }));
  };

  const handleConfirm = async () => {
    if (!id) return;
    
    const payloadRows = Object.entries(selections).map(([rowId, data]) => ({
      rowId,
      categoryId: data.categoryId,
      skip: data.skip
    }));

    setTrialExpiredError(false);
    try {
      await confirmMutation.mutateAsync({
        id: id!,
        data: { rows: payloadRows }
      });
      // Navigate to the month of the first imported row so user sees their transactions immediately
      const firstDate = rows?.find(r => r.normalizedDate)?.normalizedDate;
      const month = firstDate ? firstDate.slice(0, 7) : format(new Date(), "yyyy-MM");
      setLocation(`/transactions?month=${month}`);
    } catch (err) {
      if (isTrialExpiredError(err)) {
        setTrialExpiredError(true);
      }
    }
  };

  if (isLoading) return <div className="p-8">Loading parsed transactions...</div>;

  const validRows = rows?.filter(r => r.status === 'parsed') || [];
  const errorRows = rows?.filter(r => r.status === 'error') || [];
  const duplicateCount = validRows.filter(r => r.isPossibleDuplicate).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/upload">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Review Import</h1>
          <p className="text-muted-foreground">Verify parsed transactions before saving them.</p>
        </div>
        <div className="ml-auto">
          <Button onClick={handleConfirm} disabled={confirmMutation.isPending || validRows.length === 0}>
            {confirmMutation.isPending ? "Importing..." : "Confirm Import"}
          </Button>
        </div>
      </div>

      {trialExpiredError && (
        <TrialExpiredPrompt action="confirm import" />
      )}

      {errorRows.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-destructive flex items-center gap-2 text-lg">
              <AlertCircle className="w-5 h-5" /> Could not parse {errorRows.length} rows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Some rows from the document couldn't be understood. They will be skipped.
            </div>
          </CardContent>
        </Card>
      )}

      {duplicateCount > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-amber-900 dark:text-amber-200 flex items-center gap-2 text-lg">
              <AlertTriangle className="w-5 h-5" /> {duplicateCount} possible duplicate{duplicateCount === 1 ? "" : "s"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-amber-900/80 dark:text-amber-200/80">
              These rows match transactions you already have on the same day with the same amount. They are unchecked by default — tick the box only if you want to import them anyway.
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Transactions to Import ({validRows.length})</CardTitle>
          <CardDescription>Uncheck the box to skip importing a specific row.</CardDescription>
        </CardHeader>
        <CardContent>
          {validRows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No valid transactions found in this document.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 w-10">Import</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3 w-48">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {validRows.map((row) => {
                    const sel = selections[row.id] || { skip: false, categoryId: null };
                    return (
                      <tr key={row.id} className={`border-b last:border-0 ${sel.skip ? 'opacity-50 bg-muted/20' : ''}`}>
                        <td className="px-4 py-3">
                          <Checkbox 
                            checked={!sel.skip}
                            onCheckedChange={(checked) => handleToggleSkip(row.id, !!checked)}
                          />
                        </td>
                        <td className="px-4 py-3 font-medium">{row.normalizedDate}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{row.normalizedDescription}</span>
                            {row.isPossibleDuplicate && (
                              <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700 gap-1">
                                <AlertTriangle className="w-3 h-3" /> Possible duplicate
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className={`px-4 py-3 font-medium ${row.type === 'credit' ? 'text-primary' : 'text-foreground'}`}>
                          {row.type === 'credit' ? '+' : '-'}${row.normalizedAmount}
                        </td>
                        <td className="px-4 py-3">
                          <Select 
                            value={sel.categoryId || "none"} 
                            onValueChange={(val) => handleCategoryChange(row.id, val)}
                            disabled={sel.skip}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Uncategorized</SelectItem>
                              {categories?.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                              <SelectItem value="__new__" className="text-primary font-medium">
                                <span className="flex items-center gap-2">
                                  <Plus className="w-3.5 h-3.5" /> New category…
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={newCategoryRowId !== null} onOpenChange={(open) => { if (!open) setNewCategoryRowId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
            <DialogDescription>
              Add a custom expense category. It will appear here and on the Categories page right away.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-cat-name">Name</Label>
              <Input
                id="new-cat-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. Vehicle expense"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateCategory(); } }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-cat-budget">Monthly budget (optional)</Label>
              <Input
                id="new-cat-budget"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={newCategoryBudget}
                onChange={(e) => setNewCategoryBudget(e.target.value)}
                placeholder="0.00"
              />
            </div>
            {newCategoryError && (
              <div className="text-sm text-destructive">{newCategoryError}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCategoryRowId(null)} disabled={createCategoryMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleCreateCategory} disabled={createCategoryMutation.isPending}>
              {createCategoryMutation.isPending ? "Adding…" : "Add category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
