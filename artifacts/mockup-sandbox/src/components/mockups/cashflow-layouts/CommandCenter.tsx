import React, { useState } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Wallet,
  Building,
  CreditCard,
  PieChart,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Info,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// Hardcoded Data
const INCOME = 3500;
const FIXED_COMMITMENTS = [
  { id: "fc1", name: "Car Loan", amount: 450, icon: Wallet },
  { id: "fc2", name: "Housing Loan", amount: 380, icon: Building },
  { id: "fc3", name: "OGDC Electricity", amount: 95, icon: CreditCard },
  { id: "fc4", name: "DST Postpaid", amount: 45, icon: CreditCard },
  { id: "fc5", name: "DST Broadband", amount: 58, icon: CreditCard },
  { id: "fc6", name: "School Fees", amount: 120, icon: Building },
  { id: "fc7", name: "Gym Membership", amount: 55, icon: Wallet },
  { id: "fc8", name: "Netflix", amount: 22, icon: CreditCard },
];

const INITIAL_VARIABLE_BUDGETS = [
  { id: "vb1", name: "Food & Dining", amount: 350, spent: 120 },
  { id: "vb2", name: "Transport", amount: 100, spent: 45 },
  { id: "vb3", name: "Groceries", amount: 200, spent: 150 },
  { id: "vb4", name: "Entertainment", amount: 80, spent: 20 },
  { id: "vb5", name: "Clothing", amount: 50, spent: 0 },
  { id: "vb6", name: "Health", amount: 75, spent: 10 },
  { id: "vb7", name: "Personal Care", amount: 40, spent: 15 },
  { id: "vb8", name: "Miscellaneous", amount: 60, spent: 5 },
];

const formatBND = (amount: number) => {
  return `BND ${amount.toLocaleString("en-BN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export function CommandCenter() {
  const [mode, setMode] = useState<"plan" | "actual">("plan");
  const [budgets, setBudgets] = useState(INITIAL_VARIABLE_BUDGETS);

  const totalFixed = FIXED_COMMITMENTS.reduce((sum, item) => sum + item.amount, 0);
  const totalBudgeted = budgets.reduce((sum, item) => sum + item.amount, 0);
  const totalSpent = budgets.reduce((sum, item) => sum + item.spent, 0);
  
  const poolPlan = INCOME - totalFixed - totalBudgeted;
  const poolActual = INCOME - totalFixed - totalSpent;

  const currentPool = mode === "plan" ? poolPlan : poolActual;
  const currentVariable = mode === "plan" ? totalBudgeted : totalSpent;

  const handleBudgetChange = (id: string, value: string) => {
    const numValue = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
    setBudgets(budgets.map(b => b.id === id ? { ...b, amount: numValue } : b));
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-[#F8F9FA] overflow-hidden font-sans text-slate-900">
      
      {/* HEADER: Dark, Dense, Professional Dashboard Style */}
      <header className="flex-none bg-[#0B132B] text-white border-b border-slate-800 shadow-sm z-10">
        
        {/* Top Utility Bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800/60 bg-[#070D1F]">
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-slate-300 bg-slate-800/50 rounded-md p-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-700">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center px-3 text-sm font-medium tracking-wide">
                <Calendar className="h-4 w-4 mr-2 text-slate-400" />
                APRIL 2026
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-700">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <Badge variant="outline" className="bg-[#1C2541]/50 text-[#6FFFE9] border-[#6FFFE9]/30 font-mono text-xs uppercase px-2 py-0.5">
              Payday: 25th
            </Badge>
          </div>

          <div className="flex items-center space-x-4">
            <ToggleGroup 
              type="single" 
              value={mode} 
              onValueChange={(v) => v && setMode(v as "plan" | "actual")}
              className="bg-slate-800/80 p-0.5 rounded-md border border-slate-700/50"
            >
              <ToggleGroupItem value="plan" className={`h-7 px-4 text-xs font-medium ${mode === 'plan' ? 'bg-[#3A506B] text-white' : 'text-slate-400'}`}>
                Plan
              </ToggleGroupItem>
              <ToggleGroupItem value="actual" className={`h-7 px-4 text-xs font-medium ${mode === 'actual' ? 'bg-[#3A506B] text-white' : 'text-slate-400'}`}>
                Actual
              </ToggleGroupItem>
            </ToggleGroup>
            
            <div className="h-6 w-px bg-slate-700"></div>
            
            <div className="flex items-center text-sm">
              <span className="text-slate-400 mr-2">User:</span>
              <span className="font-semibold text-slate-200">Hakem Shah</span>
            </div>
          </div>
        </div>

        {/* Core Metrics Bar */}
        <div className="flex items-stretch justify-between px-6 py-5">
          {/* Income */}
          <div className="flex-1 pr-6 border-r border-slate-800">
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center">
              <TrendingUp className="h-3.5 w-3.5 mr-1.5 text-emerald-400" /> Total Income
            </div>
            <div className="text-3xl font-light tracking-tight text-white">
              <span className="text-slate-500 text-xl font-normal mr-1">BND</span>
              {INCOME.toLocaleString("en-BN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          
          {/* Fixed */}
          <div className="flex-1 px-6 border-r border-slate-800">
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center">
              <Building className="h-3.5 w-3.5 mr-1.5 text-blue-400" /> Fixed Commitments
            </div>
            <div className="text-3xl font-light tracking-tight text-slate-200">
              <span className="text-slate-500 text-xl font-normal mr-1">BND</span>
              {totalFixed.toLocaleString("en-BN", { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-1.5 text-xs text-slate-500">
              {(totalFixed / INCOME * 100).toFixed(1)}% of income
            </div>
          </div>
          
          {/* Variable */}
          <div className="flex-1 px-6 border-r border-slate-800">
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center">
              <PieChart className="h-3.5 w-3.5 mr-1.5 text-amber-400" /> 
              {mode === "plan" ? "Variable Budget" : "Variable Spent"}
            </div>
            <div className="text-3xl font-light tracking-tight text-slate-200">
              <span className="text-slate-500 text-xl font-normal mr-1">BND</span>
              {currentVariable.toLocaleString("en-BN", { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-1.5 text-xs text-slate-500 flex items-center">
              <Progress value={(currentVariable / INCOME) * 100} className="h-1 w-16 mr-2 bg-slate-800 [&>div]:bg-amber-500" />
              {(currentVariable / INCOME * 100).toFixed(1)}% of income
            </div>
          </div>
          
          {/* Pool */}
          <div className="flex-1 pl-6">
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center justify-between">
              <span className="flex items-center"><Wallet className="h-3.5 w-3.5 mr-1.5 text-[#6FFFE9]" /> Available Pool</span>
              {currentPool >= 0 ? 
                <Badge className="bg-emerald-500/10 text-emerald-400 border-none hover:bg-emerald-500/10 text-[10px] px-1.5 py-0">Healthy</Badge> : 
                <Badge className="bg-rose-500/10 text-rose-400 border-none hover:bg-rose-500/10 text-[10px] px-1.5 py-0">Deficit</Badge>
              }
            </div>
            <div className={`text-4xl font-semibold tracking-tight ${currentPool >= 0 ? 'text-[#6FFFE9]' : 'text-rose-400'}`}>
              <span className="text-slate-500 text-xl font-normal mr-1 opacity-70">BND</span>
              {currentPool.toLocaleString("en-BN", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </header>

      {/* BODY: Two Column Layout */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* LEFT COLUMN: Fixed Commitments (Read-Only) */}
        <div className="w-1/2 flex flex-col border-r border-slate-200 bg-white">
          <div className="flex-none px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Fixed Commitments</h2>
              <p className="text-xs text-slate-500 mt-0.5">Automated recurring deductions</p>
            </div>
            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">
              Locked
            </Badge>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-6">
              <div className="space-y-3">
                {FIXED_COMMITMENTS.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 mr-3 group-hover:bg-white group-hover:shadow-sm">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{item.name}</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-900 font-mono">
                      {formatBND(item.amount)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-100 flex items-start">
                <Info className="h-4 w-4 text-slate-400 mt-0.5 mr-2 shrink-0" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  Fixed commitments are deduced automatically based on your active loans and subscriptions. To modify these, visit the Commitments management page.
                </p>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT COLUMN: Variable Budgets (Editable) */}
        <div className="w-1/2 flex flex-col bg-[#F8F9FA]">
          <div className="flex-none px-6 py-4 border-b border-slate-200/60 flex items-center justify-between bg-white shadow-sm z-10">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Variable Budgets</h2>
              <p className="text-xs text-slate-500 mt-0.5">Flexible spending limits for the month</p>
            </div>
            {mode === "plan" && (
               <Badge className="bg-amber-100 text-amber-700 border-none hover:bg-amber-100">
                 Editable
               </Badge>
            )}
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-6">
              
              {mode === "plan" ? (
                // PLAN MODE - EDITABLE
                <div className="space-y-4">
                  {budgets.map((item) => (
                    <div key={item.id} className="flex items-center p-3 rounded-lg bg-white border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all">
                      <div className="w-1/3 flex items-center">
                        <div className="h-2 w-2 rounded-full bg-amber-400 mr-3"></div>
                        <span className="text-sm font-medium text-slate-700">{item.name}</span>
                      </div>
                      
                      <div className="w-2/3 flex items-center justify-end">
                        <div className="relative w-40">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">BND</span>
                          <Input 
                            type="text" 
                            value={item.amount.toString()}
                            onChange={(e) => handleBudgetChange(item.id, e.target.value)}
                            className="pl-12 text-right font-mono text-sm border-slate-200 h-9 focus-visible:ring-0 focus-visible:border-slate-200 bg-slate-50 focus:bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-4 flex justify-end">
                    <Button variant="outline" className="text-xs mr-2">Reset</Button>
                    <Button className="bg-[#0B132B] hover:bg-[#1C2541] text-xs">Save Plan</Button>
                  </div>
                </div>
              ) : (
                // ACTUAL MODE - READ ONLY WITH PROGRESS
                <div className="space-y-5">
                  {budgets.map((item) => {
                    const percent = Math.min((item.spent / item.amount) * 100, 100);
                    const isOver = item.spent > item.amount;
                    
                    return (
                      <div key={item.id} className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-end mb-2">
                          <div className="flex items-center">
                            <span className="text-sm font-medium text-slate-800">{item.name}</span>
                            {isOver && <AlertCircle className="h-3.5 w-3.5 text-rose-500 ml-2" />}
                          </div>
                          <div className="text-right">
                            <span className={`text-sm font-bold font-mono ${isOver ? 'text-rose-600' : 'text-slate-900'}`}>
                              {formatBND(item.spent)}
                            </span>
                            <span className="text-xs text-slate-500 font-mono ml-1">
                              / {formatBND(item.amount)}
                            </span>
                          </div>
                        </div>
                        <Progress 
                          value={percent} 
                          className={`h-1.5 ${isOver ? '[&>div]:bg-rose-500' : '[&>div]:bg-blue-500'}`} 
                        />
                        <div className="flex justify-between mt-1.5">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">{percent.toFixed(0)}% used</span>
                          <span className={`text-[10px] font-medium ${isOver ? 'text-rose-500' : 'text-emerald-600'}`}>
                            {isOver ? 'Over budget by ' + formatBND(item.spent - item.amount) : formatBND(item.amount - item.spent) + ' left'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              
            </div>
          </ScrollArea>
        </div>

      </main>
    </div>
  );
}
