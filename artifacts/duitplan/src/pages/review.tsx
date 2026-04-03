import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useGetImportedRows, useConfirmImport, useListCategories } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Check, X, AlertCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function ReviewImport() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  
  const { data: rows, isLoading } = useGetImportedRows(id!);
  const { data: categories } = useListCategories();
  const confirmMutation = useConfirmImport();

  const [selections, setSelections] = useState<Record<string, { categoryId: string | null, skip: boolean }>>({});
  
  // Initialize selections once rows are loaded
  if (rows && Object.keys(selections).length === 0 && rows.length > 0) {
    const initial: Record<string, { categoryId: string | null, skip: boolean }> = {};
    rows.forEach(r => {
      // Find a category that matches the suggestion if possible
      let matchedCatId = null;
      if (r.categorySuggestion && categories) {
        const cat = categories.find(c => c.name.toLowerCase() === r.categorySuggestion?.toLowerCase());
        if (cat) matchedCatId = cat.id;
      }
      initial[r.id] = { categoryId: matchedCatId, skip: false };
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

    try {
      await confirmMutation.mutateAsync({
        data: { rows: payloadRows }
      });
      setLocation("/transactions");
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) return <div className="p-8">Loading parsed transactions...</div>;

  const validRows = rows?.filter(r => r.status === 'parsed') || [];
  const errorRows = rows?.filter(r => r.status === 'error') || [];

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
                        <td className="px-4 py-3">{row.normalizedDescription}</td>
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
    </div>
  );
}
