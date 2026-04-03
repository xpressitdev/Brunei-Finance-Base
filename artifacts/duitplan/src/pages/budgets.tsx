import { useState } from "react";
import { format } from "date-fns";
import { useListBudgets, useUpsertBudget, useListCategories } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Save } from "lucide-react";

export default function Budgets() {
  const currentMonth = format(new Date(), "yyyy-MM");
  const [month, setMonth] = useState(currentMonth);
  
  const { data: budgets, isLoading, refetch } = useListBudgets({ month });
  const { data: categories } = useListCategories();
  
  const upsertMutation = useUpsertBudget();
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});

  const handleSave = async (categoryId: string) => {
    const plannedAmount = editingValues[categoryId];
    if (plannedAmount === undefined) return;
    
    await upsertMutation.mutateAsync({
      data: {
        categoryId,
        month,
        plannedAmount
      }
    });
    refetch();
  };

  if (isLoading || !categories) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Budgets</h1>
          <p className="text-muted-foreground">Plan your spending for the month.</p>
        </div>
        <Input 
          type="month" 
          value={month} 
          onChange={(e) => setMonth(e.target.value)} 
          className="w-48 bg-white"
        />
      </div>

      <div className="grid gap-4">
        {categories.filter(c => c.kind === 'expense').map(category => {
          const budget = budgets?.find(b => b.categoryId === category.id);
          const plannedAmountStr = budget?.plannedAmount || "0.00";
          const actualAmountStr = budget?.actualAmount || "0.00";
          const plannedNum = parseFloat(plannedAmountStr);
          const actualNum = parseFloat(actualAmountStr);
          const percentage = plannedNum > 0 ? Math.min(100, (actualNum / plannedNum) * 100) : 0;
          
          const isEditing = editingValues[category.id] !== undefined;
          const currentVal = isEditing ? editingValues[category.id] : plannedAmountStr;

          return (
            <div key={category.id} className="bg-white p-6 rounded-xl border flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg">{category.name}</h3>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number" 
                    step="0.01"
                    className="w-32 text-right"
                    value={currentVal}
                    onChange={(e) => setEditingValues({...editingValues, [category.id]: e.target.value})}
                    placeholder="Planned"
                  />
                  {isEditing && currentVal !== plannedAmountStr && (
                    <Button size="icon" variant="ghost" className="text-primary hover:text-primary/80 hover:bg-primary/10" onClick={() => handleSave(category.id)}>
                      <Save className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Spent: ${actualAmountStr}</span>
                  <span className={`${percentage >= 100 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                    {percentage >= 100 ? 'Over budget' : `${(plannedNum - actualNum).toFixed(2)} remaining`}
                  </span>
                </div>
                <Progress value={percentage} className={`h-2 ${percentage >= 100 ? '[&>div]:bg-destructive' : ''}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
