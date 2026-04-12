import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Download,
  Filter,
  Plus
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// --- Static Data ---
const DATA = {
  user: "Hakem Shah",
  month: "April 2026",
  income: [
    { id: 'i1', name: 'Primary Salary', planned: 3500.00, actual: 3500.00 }
  ],
  fixed: [
    { id: 'f1', name: 'Car Loan', planned: 450.00, actual: 450.00 },
    { id: 'f2', name: 'Housing Loan', planned: 380.00, actual: 380.00 },
    { id: 'f3', name: 'OGDC Electricity', planned: 95.00, actual: 95.00 },
    { id: 'f4', name: 'DST Postpaid', planned: 45.00, actual: 45.00 },
    { id: 'f5', name: 'DST Broadband', planned: 58.00, actual: 58.00 },
    { id: 'f6', name: 'School Fees', planned: 120.00, actual: 120.00 },
    { id: 'f7', name: 'Gym Membership', planned: 55.00, actual: 55.00 },
    { id: 'f8', name: 'Netflix', planned: 22.00, actual: 22.00 },
  ],
  variable: [
    { id: 'v1', name: 'Food & Dining', planned: 350.00, actual: 280.00 },
    { id: 'v2', name: 'Transport', planned: 100.00, actual: 85.00 },
    { id: 'v3', name: 'Groceries', planned: 200.00, actual: 195.00 },
    { id: 'v4', name: 'Entertainment', planned: 80.00, actual: 40.00 },
    { id: 'v5', name: 'Clothing', planned: 50.00, actual: 0.00 },
    { id: 'v6', name: 'Health', planned: 75.00, actual: 20.00 },
    { id: 'v7', name: 'Personal Care', planned: 40.00, actual: 35.00 },
    { id: 'v8', name: 'Miscellaneous', planned: 60.00, actual: 15.00 },
  ]
};

const formatBND = (amount: number) => {
  return `BND ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export function CompactTable() {
  const [viewMode, setViewMode] = useState<"plan" | "actual">("plan");

  const totalIncomePlanned = DATA.income.reduce((sum, item) => sum + item.planned, 0);
  const totalIncomeActual = DATA.income.reduce((sum, item) => sum + item.actual, 0);

  const totalFixedPlanned = DATA.fixed.reduce((sum, item) => sum + item.planned, 0);
  const totalFixedActual = DATA.fixed.reduce((sum, item) => sum + item.actual, 0);

  const totalVariablePlanned = DATA.variable.reduce((sum, item) => sum + item.planned, 0);
  const totalVariableActual = DATA.variable.reduce((sum, item) => sum + item.actual, 0);

  const totalExpensesPlanned = totalFixedPlanned + totalVariablePlanned;
  const totalExpensesActual = totalFixedActual + totalVariableActual;

  const poolPlanned = totalIncomePlanned - totalExpensesPlanned;
  const poolActual = totalIncomeActual - totalExpensesActual;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      
      {/* Header Area */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold tracking-tight">Cash Flow Plan</h1>
              <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
              
              {/* Month Navigator */}
              <div className="flex items-center bg-slate-100 rounded-md p-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded hover:bg-white hover:shadow-sm">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2 px-3 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  {DATA.month}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded hover:bg-white hover:shadow-sm">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as any)} className="bg-slate-100 p-0.5 rounded-md">
                <ToggleGroupItem value="plan" className="h-8 px-4 text-xs font-medium data-[state=on]:bg-white data-[state=on]:shadow-sm">
                  Plan Mode
                </ToggleGroupItem>
                <ToggleGroupItem value="actual" className="h-8 px-4 text-xs font-medium data-[state=on]:bg-white data-[state=on]:shadow-sm">
                  Actual Mode
                </ToggleGroupItem>
              </ToggleGroup>
              
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </Button>
              <Button size="sm" className="h-9 gap-2 bg-slate-900 hover:bg-slate-800">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Item</span>
              </Button>
            </div>

          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Total Income</div>
            <div className="text-lg font-mono font-semibold text-slate-900">{formatBND(viewMode === 'plan' ? totalIncomePlanned : totalIncomeActual)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Fixed Commits</div>
            <div className="text-lg font-mono font-medium text-slate-700">{formatBND(viewMode === 'plan' ? totalFixedPlanned : totalFixedActual)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Variable Budget</div>
            <div className="text-lg font-mono font-medium text-slate-700">{formatBND(viewMode === 'plan' ? totalVariablePlanned : totalVariableActual)}</div>
          </div>
          <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 shadow-sm text-white">
            <div className="text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Available Pool</div>
            <div className="text-lg font-mono font-bold text-emerald-400">{formatBND(viewMode === 'plan' ? poolPlanned : poolActual)}</div>
          </div>
        </div>

        {/* The Spreadsheet Table */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="whitespace-nowrap [&_td]:py-2 [&_th]:py-3 text-sm">
              <TableHeader className="bg-slate-50 border-b border-slate-200">
                <TableRow className="hover:bg-slate-50">
                  <TableHead className="w-[300px] font-semibold text-slate-700">Item Name</TableHead>
                  <TableHead className="font-semibold text-slate-700">Type</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Planned</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Actual</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                
                {/* --- INCOME SECTION --- */}
                <TableRow className="bg-slate-100/50 hover:bg-slate-100/80 border-b-slate-200">
                  <TableCell colSpan={5} className="font-semibold text-xs uppercase tracking-wider text-slate-500 pt-4 pb-2">
                    Inflows
                  </TableCell>
                </TableRow>
                {DATA.income.map((item, idx) => {
                  const remaining = item.planned - item.actual;
                  return (
                    <TableRow key={item.id} className="even:bg-slate-50/50">
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200">Income</Badge></TableCell>
                      <TableCell className="text-right font-mono text-slate-600">{formatBND(item.planned)}</TableCell>
                      <TableCell className="text-right font-mono text-slate-600">{formatBND(item.actual)}</TableCell>
                      <TableCell className="text-right font-mono text-slate-400">-</TableCell>
                    </TableRow>
                  );
                })}

                {/* --- FIXED COMMITMENTS SECTION --- */}
                <TableRow className="bg-slate-100/50 hover:bg-slate-100/80 border-t-slate-300 border-b-slate-200">
                  <TableCell colSpan={5} className="font-semibold text-xs uppercase tracking-wider text-slate-500 pt-4 pb-2">
                    Fixed Commitments
                  </TableCell>
                </TableRow>
                {DATA.fixed.map((item, idx) => {
                  const remaining = item.planned - item.actual;
                  return (
                    <TableRow key={item.id} className="even:bg-slate-50/50">
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] font-medium bg-slate-100 text-slate-600 border-slate-200">Fixed</Badge></TableCell>
                      <TableCell className="text-right font-mono text-slate-600">{formatBND(item.planned)}</TableCell>
                      <TableCell className="text-right font-mono text-slate-600">{formatBND(item.actual)}</TableCell>
                      <TableCell className={`text-right font-mono ${remaining === 0 ? 'text-slate-300' : remaining < 0 ? 'text-red-500 font-medium' : 'text-slate-600'}`}>
                        {remaining === 0 ? '-' : formatBND(remaining)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-slate-50 font-medium border-y-slate-200">
                  <TableCell colSpan={2} className="text-slate-600 text-right">Fixed Subtotal</TableCell>
                  <TableCell className="text-right font-mono text-slate-900">{formatBND(totalFixedPlanned)}</TableCell>
                  <TableCell className="text-right font-mono text-slate-900">{formatBND(totalFixedActual)}</TableCell>
                  <TableCell className="text-right font-mono text-slate-500">{formatBND(totalFixedPlanned - totalFixedActual)}</TableCell>
                </TableRow>

                {/* --- VARIABLE BUDGET SECTION --- */}
                <TableRow className="bg-slate-100/50 hover:bg-slate-100/80 border-t-slate-300 border-b-slate-200">
                  <TableCell colSpan={5} className="font-semibold text-xs uppercase tracking-wider text-slate-500 pt-4 pb-2">
                    Variable Budgets
                  </TableCell>
                </TableRow>
                {DATA.variable.map((item, idx) => {
                  const remaining = item.planned - item.actual;
                  return (
                    <TableRow key={item.id} className="even:bg-slate-50/50 group">
                      <TableCell className="font-medium group-hover:text-blue-600 transition-colors cursor-pointer">
                        {item.name}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] font-medium bg-blue-50 text-blue-700 border-blue-200">Variable</Badge></TableCell>
                      <TableCell className="text-right font-mono text-slate-600">
                        {viewMode === 'plan' ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-slate-400 group-hover:hidden">{formatBND(item.planned)}</span>
                            <div className="hidden group-hover:flex items-center gap-1">
                              <span className="text-slate-400 font-sans text-xs">BND</span>
                              <input 
                                type="text" 
                                defaultValue={item.planned.toFixed(2)} 
                                className="w-20 text-right border border-blue-200 rounded px-1 py-0.5 text-sm font-mono outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>
                        ) : (
                          formatBND(item.planned)
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-slate-600">{formatBND(item.actual)}</TableCell>
                      <TableCell className={`text-right font-mono ${remaining === 0 ? 'text-slate-300' : remaining < 0 ? 'text-red-500 font-medium' : 'text-slate-600'}`}>
                        {remaining === 0 ? '-' : formatBND(remaining)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-slate-50 font-medium border-y-slate-200">
                  <TableCell colSpan={2} className="text-slate-600 text-right">Variable Subtotal</TableCell>
                  <TableCell className="text-right font-mono text-slate-900">{formatBND(totalVariablePlanned)}</TableCell>
                  <TableCell className="text-right font-mono text-slate-900">{formatBND(totalVariableActual)}</TableCell>
                  <TableCell className="text-right font-mono text-slate-500">{formatBND(totalVariablePlanned - totalVariableActual)}</TableCell>
                </TableRow>

                {/* --- GRAND TOTAL / POOL --- */}
                <TableRow className="bg-slate-900 hover:bg-slate-900 border-t-2 border-slate-900 text-white">
                  <TableCell colSpan={2} className="font-semibold text-right text-slate-300">Available Pool</TableCell>
                  <TableCell className="text-right font-mono font-bold text-emerald-400">{formatBND(poolPlanned)}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-emerald-400">{formatBND(poolActual)}</TableCell>
                  <TableCell className="text-right font-mono text-slate-500">-</TableCell>
                </TableRow>

              </TableBody>
            </Table>
          </div>
        </div>

      </main>
    </div>
  );
}
