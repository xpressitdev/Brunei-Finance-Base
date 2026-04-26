// All page-level surfaces. Each page is a function component receiving { onNav }.

const Dashboard = ({ onNav, hariGajiOpen, setHariGajiOpen }) => {
  const d = window.duitplanData;
  const I = window.Icons;
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <Topbar
        title="Dashboard"
        subtitle={`Here's how your money is moving in April, ${d.user.firstName}.`}
        actions={<>
          <Button variant="outline" size="sm"><I.Upload width="14" height="14"/>Import Statement</Button>
          <Button size="sm"><I.Plus width="14" height="14"/>Add Transaction</Button>
        </>}
      />

      {hariGajiOpen && (
        <HariGajiBanner user={d.user} salary={d.summary.monthlyIncome}
          onConfirm={() => setHariGajiOpen(false)}
          onSkip={() => setHariGajiOpen(false)}/>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Monthly Salary" value={window.fmtBND(d.summary.monthlyIncome)} glyph="Activity"
                 delta={`+${window.fmtBND(d.summary.actualIncomeThisMonth)}`} deltaLabel="received"/>
        <KpiCard label="Commitments"    value={window.fmtBND(d.summary.totalCommitments)} glyph="Calendar"
                 footer={<div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">{d.commitments.length} fixed</div>}/>
        <KpiCard label="Liabilities"    value={window.fmtBND(d.summary.totalDebtMonthlyPayment)} glyph="Bank"
                 footer={<div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">{d.summary.debtToIncomeRatio}% of income</div>}/>
        <KpiCard label="This Month"     value={window.fmtBND(d.summary.totalSpent)} glyph="Card"
                 footer={<div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">42 transactions</div>}/>
        <KpiCard label="Remaining" hero value={window.fmtBND(d.summary.remaining)} glyph="Activity"
                 footer={
                   <div className="border-t border-[hsl(var(--border))] mt-2 pt-2 space-y-0.5">
                     <div className="flex justify-between text-[11px] text-[hsl(var(--muted-foreground))]"><span>Commitments</span><span>−{window.fmtBND(d.summary.totalCommitments)}</span></div>
                     <div className="flex justify-between text-[11px] text-[hsl(var(--muted-foreground))]"><span>Spending</span><span>−{window.fmtBND(d.summary.totalSpent)}</span></div>
                   </div>
                 }/>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Spending by Category</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">April 2026</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNav("expenses")}>View all<I.Arrow width="13" height="13"/></Button>
          </div>
          <div className="flex items-center gap-6">
            <Donut data={d.spending} size={180}/>
            <div className="flex-1 space-y-2">
              {d.spending.map(s => (
                <div key={s.categoryName} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{background: s.color}}/>
                    <span className="text-sm truncate">{s.categoryName}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{window.fmtBND(s.totalSpent)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold tracking-tight">Recent Transactions</h2>
            <Button variant="ghost" size="sm" onClick={() => onNav("transactions")}><I.Arrow width="13" height="13"/></Button>
          </div>
          <div className="divide-y divide-[hsl(var(--border))]">
            {d.recentTransactions.slice(0, 5).map(t => <TransactionRow key={t.id} tx={t}/>)}
          </div>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Financing Summary</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Debt-to-income {d.summary.debtToIncomeRatio}%</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onNav("debts")}>Manage Financing</Button>
          </div>
          <div className="space-y-3">
            {d.debts.map(loan => (
              <div key={loan.id} className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--border))]">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{loan.name}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">{loan.lender} · {loan.rate}% APR</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold tabular-nums">{window.fmtBND(loan.monthlyPayment)}/mo</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">{window.fmtBND(loan.balance)} left</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 border-orange-200 bg-orange-50">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><I.Flame width="20" height="20"/></div>
              <div>
                <div className="text-sm font-semibold text-orange-900">12-day streak — keep it going</div>
                <div className="text-xs text-orange-800/80 mt-0.5">You've logged a transaction every day this month. Don't break the chain.</div>
              </div>
            </div>
            <Badge className="bg-orange-200 text-orange-900">🔥 12</Badge>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {Array.from({length: 12}).map((_, i) => (
              <div key={i} className="h-8 rounded-md bg-orange-300/70 flex items-center justify-center text-[10px] font-bold text-orange-900">{i+14}</div>
            ))}
            {Array.from({length: 2}).map((_, i) => (
              <div key={"f"+i} className="h-8 rounded-md border border-dashed border-orange-300"/>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

const Expenses = () => {
  const d = window.duitplanData;
  const I = window.Icons;
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Topbar title="Expense Tracker" subtitle="All your spending, categorised."
        actions={<><Button variant="outline" size="sm"><I.Filter width="14" height="14"/>Filter</Button>
                   <Button size="sm"><I.Plus width="14" height="14"/>Add Transaction</Button></>}/>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {d.spending.map((s, i) => (
          <Card key={i} className="p-4">
            <Eyebrow>{s.categoryName}</Eyebrow>
            <div className="text-xl font-bold tabular-nums mt-1">{window.fmtBND(s.totalSpent)}</div>
            <div className="h-1.5 rounded-full bg-[hsl(var(--muted))] mt-3 overflow-hidden">
              <div className="h-full rounded-full" style={{width: `${(s.totalSpent/240)*100}%`, background: s.color}}/>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold tracking-tight">All Transactions</h2>
          <div className="relative">
            <I.Search width="14" height="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"/>
            <input className="h-8 pl-8 pr-3 rounded-md border border-[hsl(var(--input))] bg-white text-sm w-56 outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]" placeholder="Search..."/>
          </div>
        </div>
        <div className="divide-y divide-[hsl(var(--border))]">
          {d.recentTransactions.map(t => <TransactionRow key={t.id} tx={t}/>)}
        </div>
      </Card>
    </div>
  );
};

const Debts = () => {
  const d = window.duitplanData;
  const I = window.Icons;
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Topbar title="Debts" subtitle="Loans, financing, and credit. Pay down with intention."
        actions={<Button size="sm"><I.Plus width="14" height="14"/>Add Loan</Button>}/>
      <div className="grid md:grid-cols-3 gap-3">
        <Card className="p-4">
          <Eyebrow>Total Debt</Eyebrow>
          <div className="text-2xl font-bold tabular-nums mt-1 text-rose-600">{window.fmtBND(d.debts.reduce((s, l) => s + l.balance, 0))}</div>
        </Card>
        <Card className="p-4">
          <Eyebrow>Monthly Payment</Eyebrow>
          <div className="text-2xl font-bold tabular-nums mt-1">{window.fmtBND(d.debts.reduce((s, l) => s + l.monthlyPayment, 0))}</div>
        </Card>
        <Card tinted className="p-4">
          <Eyebrow className="text-[hsl(var(--primary))]">Debt-to-Income</Eyebrow>
          <div className="text-2xl font-bold tabular-nums mt-1 text-[hsl(var(--primary))]">{d.summary.debtToIncomeRatio}%</div>
        </Card>
      </div>
      <div className="space-y-3">
        {d.debts.map(loan => (
          <Card key={loan.id} className="p-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-base font-semibold">{loan.name}</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{loan.lender} · {loan.rate}% APR</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold tabular-nums">{window.fmtBND(loan.monthlyPayment)}<span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">/mo</span></div>
                <div className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">{window.fmtBND(loan.balance)} remaining</div>
              </div>
            </div>
            <div className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
              <div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{width: `${loan.progress*100}%`}}/>
            </div>
            <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))] mt-1.5">
              <span>{Math.round(loan.progress*100)}% paid</span>
              <span>Auto-deducted on Hari Gaji</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

const Goals = () => {
  const d = window.duitplanData;
  const I = window.Icons;
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Topbar title="Goals" subtitle="Long-term savings — locked away from your spending money."
        actions={<Button size="sm"><I.Plus width="14" height="14"/>New Goal</Button>}/>
      <div className="grid md:grid-cols-3 gap-3">
        {d.goals.map(g => {
          const pct = (g.saved/g.target)*100;
          return (
            <Card key={g.id} className="p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="text-base font-semibold">{g.name}</div>
                <img src="../../assets/illustration-vault.png" className="w-10 h-10 object-contain shrink-0" alt=""/>
              </div>
              <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Target by {g.deadline}</div>
              <div className="text-2xl font-bold tabular-nums">{window.fmtBND(g.saved)}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">of {window.fmtBND(g.target)}</div>
              <div className="h-2 rounded-full bg-[hsl(var(--muted))] mt-3 overflow-hidden">
                <div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{width: `${pct}%`}}/>
              </div>
              <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1.5">{Math.round(pct)}% of goal</div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

const Accounts = () => {
  const d = window.duitplanData;
  const I = window.Icons;
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Topbar title="Accounts" subtitle="Connected banks, wallets, and cards."
        actions={<Button size="sm"><I.Plus width="14" height="14"/>Add Account</Button>}/>
      <div className="grid md:grid-cols-2 gap-3">
        {d.accounts.map(a => {
          const isCredit = a.type === "credit";
          return (
            <Card key={a.id} className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{a.bank}</div>
                  <div className="text-base font-semibold mt-0.5">{a.name}</div>
                </div>
                <Badge variant={isCredit ? "rose" : "info"}>{a.type}</Badge>
              </div>
              <div className={`text-2xl font-bold tabular-nums mt-3 ${a.balance < 0 ? "text-rose-600" : ""}`}>{window.fmtBND(Math.abs(a.balance))}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{a.balance < 0 ? "Outstanding" : "Available"}</div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

Object.assign(window, { Dashboard, Expenses, Debts, Goals, Accounts });
