import { useGetDashboardSummary, useGetRecentTransactions, useGetSpendingByCategory } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Link } from "wouter";
import { Wallet, ArrowUpRight, ArrowDownRight, CreditCard, Activity } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

export default function Dashboard() {
  const currentMonth = format(new Date(), "yyyy-MM");
  
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary({
    month: currentMonth
  });
  
  const { data: spending, isLoading: spendingLoading } = useGetSpendingByCategory({
    month: currentMonth
  });
  
  const { data: recentTransactions } = useGetRecentTransactions({ limit: 5 });

  if (summaryLoading || spendingLoading) {
    return <div className="p-8 animate-pulse flex space-x-4">Loading...</div>;
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Overview</h1>
          <p className="text-muted-foreground">{format(new Date(), "MMMM yyyy")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/upload">
            <Button variant="outline" className="bg-white">Upload Statement</Button>
          </Link>
          <Link href="/transactions">
            <Button>Add Transaction</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-muted">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Income</CardTitle>
            <Wallet className="w-4 h-4 text-primary/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary?.monthlyIncome || "0.00"}</div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-muted">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
            <ArrowDownRight className="w-4 h-4 text-destructive/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary?.totalSpent || "0.00"}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fixed Commitments</CardTitle>
            <CreditCard className="w-4 h-4 text-orange-500/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary?.totalCommitments || "0.00"}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-primary">Remaining</CardTitle>
            <Activity className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">${summary?.remaining || "0.00"}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="col-span-1 lg:col-span-2 shadow-sm border-muted">
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {spending && spending.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={spending}
                      dataKey="totalSpent"
                      nameKey="categoryName"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={60}
                      fill="#8884d8"
                      label={false}
                    >
                      {spending.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `$${value}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  No spending data for this month.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-8 col-span-1 lg:col-span-1">
          <Card className="shadow-sm border-muted">
            <CardHeader>
              <CardTitle>Debt Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Monthly Payment</span>
                  <span className="font-medium">${summary?.totalDebtMonthlyPayment || "0.00"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Debt-to-Income</span>
                  <span className="font-medium">{summary?.debtToIncomeRatio || "0"}%</span>
                </div>
                <div className="pt-4 border-t">
                  <Link href="/debts">
                    <Button variant="outline" className="w-full">Manage Debts</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-muted">
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentTransactions && recentTransactions.length > 0 ? (
                  recentTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{tx.description}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(tx.date), "MMM d")} &bull; {tx.categoryName || 'Uncategorized'}</span>
                      </div>
                      <div className={`font-medium ${tx.type === 'debit' ? '' : 'text-primary'}`}>
                        {tx.type === 'debit' ? '-' : '+'}${tx.amount}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    No transactions yet.
                  </div>
                )}
              </div>
              <div className="mt-4">
                <Link href="/transactions">
                  <Button variant="link" className="w-full text-muted-foreground hover:text-foreground">View all</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
