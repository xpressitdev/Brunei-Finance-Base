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

const CATEGORY_META = {
  Salary:       { color: "#10b981", bg: "bg-emerald-50",  fg: "text-emerald-700",  glyph: "💰" },
  Refund:       { color: "#10b981", bg: "bg-emerald-50",  fg: "text-emerald-700",  glyph: "↩" },
  Groceries:    { color: "#0a8a6e", bg: "bg-emerald-50",  fg: "text-emerald-800",  glyph: "🛒" },
  "Eating out": { color: "#f59e0b", bg: "bg-amber-50",    fg: "text-amber-800",    glyph: "🍜" },
  Transport:    { color: "#3b82f6", bg: "bg-sky-50",      fg: "text-sky-800",      glyph: "⛽" },
  Utilities:    { color: "#8b5cf6", bg: "bg-violet-50",   fg: "text-violet-800",   glyph: "💡" },
  Loan:         { color: "#f43f5e", bg: "bg-rose-50",     fg: "text-rose-800",     glyph: "🏦" },
  Housing:      { color: "#0ea5e9", bg: "bg-sky-50",      fg: "text-sky-800",      glyph: "🏠" },
  Insurance:    { color: "#6366f1", bg: "bg-indigo-50",   fg: "text-indigo-800",   glyph: "🛡" },
  Family:       { color: "#ec4899", bg: "bg-pink-50",     fg: "text-pink-800",     glyph: "👨‍👩‍👧" },
  Health:       { color: "#14b8a6", bg: "bg-teal-50",     fg: "text-teal-800",     glyph: "💊" },
};
const catMeta = (c) => CATEGORY_META[c] || { color: "#6b7280", bg: "bg-stone-100", fg: "text-stone-700", glyph: "•" };

const Expenses = () => {
  const d = window.duitplanData;
  const I = window.Icons;
  const txs = d.recentTransactions;

  const [query, setQuery]         = React.useState("");
  const [typeFilter, setType]     = React.useState("all"); // all | debit | credit
  const [acctFilter, setAcct]     = React.useState("all");
  const [catFilter, setCat]       = React.useState(null);
  const [sortBy, setSortBy]       = React.useState("date"); // date | amount

  const filtered = React.useMemo(() => {
    let r = txs.filter(t => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (acctFilter !== "all" && t.accountName !== acctFilter) return false;
      if (catFilter && t.categoryName !== catFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!t.description.toLowerCase().includes(q) && !t.merchant.toLowerCase().includes(q) && !t.categoryName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    if (sortBy === "amount") r = [...r].sort((a, b) => b.amount - a.amount);
    else r = [...r].sort((a, b) => new Date(b.date) - new Date(a.date));
    return r;
  }, [txs, query, typeFilter, acctFilter, catFilter, sortBy]);

  // Aggregates over filtered set
  const income  = filtered.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const spent   = filtered.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0);
  const net     = income - spent;
  const avgDay  = spent / 30;

  // Spending by category for breakdown bar (debit only)
  const catTotals = {};
  filtered.filter(t => t.type === "debit").forEach(t => { catTotals[t.categoryName] = (catTotals[t.categoryName] || 0) + t.amount; });
  const catBreakdown = Object.entries(catTotals).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  const maxCat = catBreakdown[0]?.total || 1;

  // Daily groups
  const groups = {};
  filtered.forEach(t => { (groups[t.date] = groups[t.date] || []).push(t); });
  const dayKeys = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));

  // Calendar heatmap — April 2026
  const monthSpend = {};
  txs.filter(t => t.type === "debit" && t.date.startsWith("2026-04")).forEach(t => {
    const day = parseInt(t.date.split("-")[2]);
    monthSpend[day] = (monthSpend[day] || 0) + t.amount;
  });
  const maxDaySpend = Math.max(...Object.values(monthSpend), 1);

  // Top merchants
  const merchTotals = {};
  txs.filter(t => t.type === "debit").forEach(t => { merchTotals[t.merchant] = (merchTotals[t.merchant] || 0) + t.amount; });
  const topMerchants = Object.entries(merchTotals).map(([m, t]) => ({ merchant: m, total: t, count: txs.filter(x => x.merchant === m).length })).sort((a, b) => b.total - a.total).slice(0, 5);

  const accounts = Array.from(new Set(txs.map(t => t.accountName)));

  const dayLabel = (iso) => {
    const date = new Date(iso);
    const today = new Date("2026-04-25");
    const diff = Math.floor((today - date) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  };

  // Heatmap cell color from spend intensity
  const heatColor = (amount) => {
    if (!amount) return "bg-[hsl(var(--accent))]";
    const t = amount / maxDaySpend;
    if (t > 0.75) return "bg-[hsl(162_70%_30%)] text-white";
    if (t > 0.5)  return "bg-[hsl(162_60%_42%)] text-white";
    if (t > 0.25) return "bg-[hsl(162_55%_70%)] text-emerald-900";
    return "bg-[hsl(162_55%_88%)] text-emerald-900";
  };

  const monthDays = 30; // April
  const firstDow = new Date(2026, 3, 1).getDay(); // 0=Sun

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Topbar title="Transactions" subtitle="Every ringgit and sen, accounted for."
        actions={<>
          <Button variant="outline" size="sm"><I.Upload width="14" height="14"/>Import CSV</Button>
          <Button variant="outline" size="sm"><I.Scan width="14" height="14"/>Scan receipt</Button>
          <Button size="sm"><I.Plus width="14" height="14"/>Add transaction</Button>
        </>}/>

      {/* Hero stats — Income / Spent / Net / Avg */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 relative overflow-hidden">
          <Eyebrow>Income · April</Eyebrow>
          <div className="text-2xl font-bold tabular-nums text-emerald-700 mt-1">+{window.fmtBND(income)}</div>
          <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">{filtered.filter(t=>t.type==="credit").length} deposits</div>
          <div className="absolute -right-2 -bottom-2 opacity-[0.08]"><I.ArrowUp width="64" height="64"/></div>
        </Card>
        <Card className="p-4 relative overflow-hidden">
          <Eyebrow>Spent · April</Eyebrow>
          <div className="text-2xl font-bold tabular-nums text-rose-600 mt-1">−{window.fmtBND(spent)}</div>
          <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">{filtered.filter(t=>t.type==="debit").length} purchases</div>
          <div className="absolute -right-2 -bottom-2 opacity-[0.08]"><I.ArrowDown width="64" height="64"/></div>
        </Card>
        <Card className="p-4 relative overflow-hidden" tinted={net >= 0}>
          <Eyebrow>Net flow</Eyebrow>
          <div className={`text-2xl font-bold tabular-nums mt-1 ${net >= 0 ? "text-[hsl(var(--primary))]" : "text-rose-600"}`}>{net >= 0 ? "+" : "−"}{window.fmtBND(Math.abs(net))}</div>
          <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">{net >= 0 ? "Saving this month" : "Overspending"}</div>
          <div className="absolute -right-2 -bottom-2 opacity-[0.08]"><I.Trend width="64" height="64"/></div>
        </Card>
        <Card className="p-4 relative overflow-hidden">
          <Eyebrow>Avg per day</Eyebrow>
          <div className="text-2xl font-bold tabular-nums mt-1">{window.fmtBND(avgDay)}</div>
          <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">Last 30 days</div>
          <div className="absolute -right-2 -bottom-2 opacity-[0.08]"><I.Activity width="64" height="64"/></div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Calendar heatmap */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Eyebrow>Spending heatmap</Eyebrow>
              <h3 className="text-base font-semibold mt-0.5">April 2026</h3>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[hsl(var(--muted-foreground))]">
              <span>Less</span>
              <div className="flex gap-0.5">
                <span className="w-3 h-3 rounded-sm bg-[hsl(var(--accent))]"/>
                <span className="w-3 h-3 rounded-sm bg-[hsl(162_55%_88%)]"/>
                <span className="w-3 h-3 rounded-sm bg-[hsl(162_55%_70%)]"/>
                <span className="w-3 h-3 rounded-sm bg-[hsl(162_60%_42%)]"/>
                <span className="w-3 h-3 rounded-sm bg-[hsl(162_70%_30%)]"/>
              </div>
              <span>More</span>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {["S","M","T","W","T","F","S"].map((d, i) => (
              <div key={i} className="text-center text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">{d}</div>
            ))}
            {Array.from({ length: firstDow }).map((_, i) => <div key={`pad-${i}`}/>)}
            {Array.from({ length: monthDays }).map((_, i) => {
              const day = i + 1;
              const amt = monthSpend[day] || 0;
              const isToday = day === 25;
              return (
                <div key={day}
                     className={`aspect-square rounded-md flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-110 hover:z-10 relative group
                                 ${heatColor(amt)} ${isToday ? "ring-2 ring-[hsl(var(--primary))] ring-offset-1" : ""}`}
                     title={amt ? `BND ${amt.toFixed(2)} on April ${day}` : `No spend on April ${day}`}>
                  <div className="text-[11px] font-bold leading-none">{day}</div>
                  {amt > 0 && <div className="text-[8px] tabular-nums opacity-80 leading-none mt-0.5">{amt < 100 ? amt.toFixed(0) : Math.round(amt)}</div>}
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-[hsl(var(--border))] grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-semibold">Highest day</div>
              <div className="text-sm font-bold tabular-nums mt-0.5">BND {Math.max(...Object.values(monthSpend)).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-semibold">No-spend days</div>
              <div className="text-sm font-bold tabular-nums mt-0.5">{monthDays - Object.keys(monthSpend).length}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-semibold">Active days</div>
              <div className="text-sm font-bold tabular-nums mt-0.5">{Object.keys(monthSpend).length}</div>
            </div>
          </div>
        </Card>

        {/* Top merchants */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Eyebrow>Top merchants</Eyebrow>
              <h3 className="text-base font-semibold mt-0.5">Where money goes</h3>
            </div>
          </div>
          <div className="space-y-3">
            {topMerchants.map((m, i) => (
              <div key={m.merchant} className="flex items-center gap-3 group cursor-pointer">
                <div className="w-9 h-9 rounded-lg bg-[hsl(var(--accent))] flex items-center justify-center text-sm font-bold text-[hsl(var(--muted-foreground))] flex-shrink-0">
                  #{i+1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{m.merchant}</div>
                  <div className="text-[11px] text-[hsl(var(--muted-foreground))]">{m.count}× this month</div>
                </div>
                <div className="text-sm font-bold tabular-nums text-rose-600">{window.fmtBND(m.total)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Category filter pills */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <Eyebrow>Spending by category</Eyebrow>
          {catFilter && (
            <button onClick={() => setCat(null)} className="text-[11px] font-semibold text-[hsl(var(--primary))] hover:underline inline-flex items-center gap-1">
              <I.X width="11" height="11"/>Clear filter
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {catBreakdown.map(c => {
            const meta = catMeta(c.name);
            const active = catFilter === c.name;
            const pct = (c.total / maxCat) * 100;
            return (
              <button key={c.name} onClick={() => setCat(active ? null : c.name)}
                      className={`relative overflow-hidden flex items-center gap-2 px-3 py-2 rounded-full border transition-all
                                  ${active ? "border-[hsl(var(--primary))] bg-[hsl(162_70%_35%/.08)]" : "border-[hsl(var(--card-border))] hover:border-[hsl(var(--primary))]"}`}>
                <span className="text-sm">{meta.glyph}</span>
                <span className="text-xs font-semibold">{c.name}</span>
                <span className="text-xs font-bold tabular-nums text-[hsl(var(--muted-foreground))]">{window.fmtBND(c.total)}</span>
                <span className="absolute bottom-0 left-0 h-[3px]" style={{ width: `${pct}%`, background: meta.color }}/>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Filter bar + transaction list */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <I.Search width="14" height="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"/>
            <input value={query} onChange={e => setQuery(e.target.value)}
                   className="h-9 pl-9 pr-3 rounded-md border border-[hsl(var(--input))] bg-white text-sm w-full outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                   placeholder="Search merchants, descriptions, categories…"/>
          </div>
          {/* Type segment */}
          <div className="flex rounded-md border border-[hsl(var(--input))] bg-white p-0.5">
            {[["all","All"],["debit","Out"],["credit","In"]].map(([v, lbl]) => (
              <button key={v} onClick={() => setType(v)}
                      className={`text-[11px] font-semibold px-3 h-8 rounded ${typeFilter === v ? "bg-[hsl(var(--primary))] text-white" : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"}`}>
                {lbl}
              </button>
            ))}
          </div>
          {/* Account dropdown */}
          <select value={acctFilter} onChange={e => setAcct(e.target.value)}
                  className="h-9 px-3 rounded-md border border-[hsl(var(--input))] bg-white text-xs font-semibold outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]">
            <option value="all">All accounts</option>
            {accounts.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {/* Sort */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  className="h-9 px-3 rounded-md border border-[hsl(var(--input))] bg-white text-xs font-semibold outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]">
            <option value="date">Newest first</option>
            <option value="amount">Largest first</option>
          </select>
          <div className="text-[11px] text-[hsl(var(--muted-foreground))] ml-auto">
            <span className="font-semibold tabular-nums text-[hsl(var(--foreground))]">{filtered.length}</span> of {txs.length}
          </div>
        </div>

        {/* Daily-grouped list */}
        {dayKeys.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-3xl mb-2">🔍</div>
            <div className="text-sm font-semibold">No transactions match</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Try clearing some filters.</div>
          </div>
        ) : (
          <div className="space-y-5">
            {dayKeys.map(date => {
              const items = groups[date];
              const daySpent = items.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0);
              const dayIn    = items.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
              return (
                <div key={date}>
                  <div className="flex items-baseline justify-between mb-2 sticky top-0 bg-[hsl(var(--card))] py-1 z-10">
                    <div className="flex items-baseline gap-2">
                      <h4 className="text-sm font-bold">{dayLabel(date)}</h4>
                      <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{items.length} {items.length === 1 ? "transaction" : "transactions"}</span>
                    </div>
                    <div className="text-[11px] tabular-nums">
                      {dayIn > 0 && <span className="text-emerald-700 font-semibold mr-3">+{window.fmtBND(dayIn)}</span>}
                      {daySpent > 0 && <span className="text-rose-600 font-semibold">−{window.fmtBND(daySpent)}</span>}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {items.map(t => {
                      const meta = catMeta(t.categoryName);
                      const isCredit = t.type === "credit";
                      return (
                        <div key={t.id}
                             className="group flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-[hsl(var(--accent))] transition-colors cursor-pointer">
                          {/* Category icon */}
                          <div className={`w-10 h-10 rounded-lg ${meta.bg} ${meta.fg} flex items-center justify-center text-lg flex-shrink-0`}>
                            {meta.glyph}
                          </div>
                          {/* Description */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold truncate">{t.description}</span>
                              {t.auto && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 flex-shrink-0">
                                  <I.Activity width="9" height="9"/>Auto
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 flex items-center gap-1.5 truncate">
                              <span className="truncate">{t.merchant}</span>
                              <span>·</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${meta.bg} ${meta.fg}`}>{t.categoryName}</span>
                              <span>·</span>
                              <span className="bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded text-[9px] font-bold">{t.accountName}</span>
                              {t.note && <><span>·</span><span className="italic truncate opacity-80">"{t.note}"</span></>}
                            </div>
                          </div>
                          {/* Amount */}
                          <div className="text-right flex-shrink-0">
                            <div className={`text-sm font-bold tabular-nums ${isCredit ? "text-emerald-700" : ""}`}>
                              {isCredit ? "+" : "−"}{window.fmtBND(t.amount)}
                            </div>
                            <div className="text-[10px] text-[hsl(var(--muted-foreground))]">BND</div>
                          </div>
                          {/* Hover actions */}
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="w-7 h-7 rounded hover:bg-white text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] flex items-center justify-center" title="Edit">
                              <I.Edit width="13" height="13"/>
                            </button>
                            <button className="w-7 h-7 rounded hover:bg-white text-[hsl(var(--muted-foreground))] hover:text-rose-600 flex items-center justify-center" title="Delete">
                              <I.X width="13" height="13"/>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer summary */}
        <div className="mt-5 pt-4 border-t border-[hsl(var(--border))] flex items-center justify-between text-xs">
          <span className="text-[hsl(var(--muted-foreground))]">Showing {filtered.length} transactions</span>
          <div className="flex gap-4 tabular-nums">
            <span className="text-emerald-700"><span className="text-[hsl(var(--muted-foreground))] font-normal mr-1">In:</span><span className="font-bold">+{window.fmtBND(income)}</span></span>
            <span className="text-rose-600"><span className="text-[hsl(var(--muted-foreground))] font-normal mr-1">Out:</span><span className="font-bold">−{window.fmtBND(spent)}</span></span>
            <span className={net >= 0 ? "text-[hsl(var(--primary))]" : "text-rose-600"}><span className="text-[hsl(var(--muted-foreground))] font-normal mr-1">Net:</span><span className="font-bold">{net >= 0 ? "+" : "−"}{window.fmtBND(Math.abs(net))}</span></span>
          </div>
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
  const [selected, setSelected] = React.useState(d.accounts[0].id);
  const sel = d.accounts.find(a => a.id === selected);

  const totalAssets = d.accounts.filter(a => a.balance > 0).reduce((s, a) => s + a.balance, 0);
  const totalLiab   = d.accounts.filter(a => a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0);
  const netWorth    = totalAssets - totalLiab;

  const TypePill = ({ type }) => {
    const map = {
      savings: { label: "Savings", bg: "bg-emerald-50", fg: "text-emerald-700", icon: I.Trophy },
      current: { label: "Current", bg: "bg-sky-50",     fg: "text-sky-700",     icon: I.Activity },
      credit:  { label: "Credit",  bg: "bg-rose-50",    fg: "text-rose-700",    icon: I.Card },
      wallet:  { label: "Cash",    bg: "bg-stone-100",  fg: "text-stone-700",   icon: I.Wallet },
    };
    const m = map[type] || map.current;
    const Glyph = m.icon;
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${m.bg} ${m.fg}`}><Glyph width="10" height="10"/>{m.label}</span>;
  };

  // Compact sparkline
  const Spark = ({ data, positive, w = 100, h = 30 }) => {
    const min = Math.min(...data), max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    }).join(" ");
    const stroke = positive ? "#10b981" : "#f43f5e";
    return (
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="overflow-visible">
        <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx={w} cy={h - ((data[data.length-1] - min) / range) * h} r="2.5" fill={stroke}/>
      </svg>
    );
  };

  // Bank-card visual — replaces the boring info card
  const BankCard = ({ a, active, onClick }) => {
    const isCredit = a.type === "credit";
    const isWallet = a.type === "wallet";
    const utilization = isCredit && a.limit ? Math.abs(a.balance) / a.limit : 0;
    const trendUp = a.trend[a.trend.length - 1] >= a.trend[0];
    return (
      <button onClick={onClick}
        className={`relative text-left rounded-2xl overflow-hidden p-5 transition-all duration-300
                    ${active ? "ring-2 ring-[hsl(var(--primary))] ring-offset-2 scale-[1.01]" : "hover:scale-[1.005]"}
                    shadow-[0_2px_8px_rgba(0,0,0,.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,.10)]`}
        style={{
          background: isWallet
            ? "linear-gradient(135deg, #f5f5f4 0%, #e7e5e4 100%)"
            : `linear-gradient(135deg, ${a.color} 0%, ${a.color}dd 60%, ${a.color}aa 100%)`,
          color: isWallet ? "hsl(var(--foreground))" : "white",
          minHeight: 180,
        }}>
        {/* subtle grain — dot pattern overlay */}
        <div className="absolute inset-0 opacity-[.06] pointer-events-none"
             style={{ backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)", backgroundSize: "12px 12px" }}/>

        <div className="relative flex flex-col h-full justify-between">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">{a.bank}</div>
              <div className="text-sm font-semibold mt-0.5">{a.name}</div>
            </div>
            <div className="opacity-90">
              {isCredit ? <I.Card width="28" height="28"/> : isWallet ? <I.Wallet width="28" height="28"/> : <I.Bank width="28" height="28"/>}
            </div>
          </div>

          <div>
            {a.last4 && (
              <div className="text-[11px] tabular-nums tracking-[0.2em] opacity-70 mb-2">•••• •••• •••• {a.last4}</div>
            )}
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">
                  {isCredit ? "Outstanding" : "Balance"}
                </div>
                <div className={`text-2xl font-bold tabular-nums mt-0.5 ${isCredit ? "text-rose-200" : ""}`}>
                  {window.fmtBND(Math.abs(a.balance))}
                </div>
                {isCredit && a.limit && (
                  <div className="mt-1.5">
                    <div className="h-1 rounded-full bg-white/20 overflow-hidden w-32">
                      <div className="h-full bg-white/80 rounded-full" style={{ width: `${utilization*100}%` }}/>
                    </div>
                    <div className="text-[10px] opacity-80 mt-1 tabular-nums">{Math.round(utilization*100)}% of {window.fmtBND(a.limit)} limit</div>
                  </div>
                )}
              </div>
              <div className={`opacity-90 ${isWallet ? "text-stone-700" : ""}`}>
                <Spark data={a.trend} positive={isCredit ? !trendUp : trendUp}/>
              </div>
            </div>
          </div>
        </div>
      </button>
    );
  };

  // Account-related transactions (filter from recent)
  const accountTx = d.recentTransactions.filter(t => t.accountName === sel.bank).slice(0, 5);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Topbar title="Accounts" subtitle="Your money, across every bank, card, and wallet."
        actions={<>
          <Button variant="outline" size="sm"><I.Upload width="14" height="14"/>Import statement</Button>
          <Button size="sm"><I.Plus width="14" height="14"/>Link account</Button>
        </>}/>

      {/* Net worth hero strip */}
      <Card className="p-6 overflow-hidden relative" tinted>
        <div className="grid md:grid-cols-3 gap-6 items-center relative">
          <div>
            <Eyebrow className="text-[hsl(var(--primary))]">Net worth</Eyebrow>
            <div className="text-4xl font-bold tabular-nums text-[hsl(var(--primary))] mt-1">{window.fmtBND(netWorth)}</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5 flex items-center gap-1.5">
              <span className="text-emerald-700 font-semibold inline-flex items-center gap-0.5"><I.ArrowUp width="11" height="11"/>+BND 387.20</span>
              <span>this month</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Eyebrow>Assets</Eyebrow>
              <div className="text-xl font-bold tabular-nums mt-0.5 text-emerald-700">{window.fmtBND(totalAssets)}</div>
              <div className="text-[11px] text-[hsl(var(--muted-foreground))]">{d.accounts.filter(a => a.balance > 0).length} accounts</div>
            </div>
            <div>
              <Eyebrow>Liabilities</Eyebrow>
              <div className="text-xl font-bold tabular-nums mt-0.5 text-rose-600">{window.fmtBND(totalLiab)}</div>
              <div className="text-[11px] text-[hsl(var(--muted-foreground))]">{d.accounts.filter(a => a.balance < 0).length} accounts</div>
            </div>
          </div>
          {/* Composition bar */}
          <div>
            <Eyebrow>Composition</Eyebrow>
            <div className="flex h-3 rounded-full overflow-hidden mt-2 shadow-inner">
              {d.accounts.filter(a => a.balance > 0).map(a => {
                const pct = (a.balance / totalAssets) * 100;
                return <div key={a.id} className="h-full" style={{ width: `${pct}%`, background: a.color }} title={a.name}/>;
              })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {d.accounts.filter(a => a.balance > 0).map(a => (
                <div key={a.id} className="flex items-center gap-1.5 text-[11px]">
                  <span className="w-2 h-2 rounded-sm" style={{ background: a.color }}/>
                  <span className="text-[hsl(var(--muted-foreground))]">{a.bank}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Bank cards grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold tracking-tight">Your accounts</h2>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{d.accounts.length} linked</span>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {d.accounts.map(a => (
            <BankCard key={a.id} a={a} active={a.id === selected} onClick={() => setSelected(a.id)}/>
          ))}
          {/* Add account tile */}
          <button className="rounded-2xl border-2 border-dashed border-[hsl(var(--card-border))] p-5 min-h-[180px]
                             flex flex-col items-center justify-center gap-2 text-[hsl(var(--muted-foreground))]
                             hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(162_70%_35%/.04)]
                             transition-colors group md:col-span-2">
            <I.Plus width="22" height="22"/>
            <div className="text-sm font-semibold">Link another account</div>
            <div className="text-[11px]">BIBD · Baiduri · Maybank · CIMB · BCA · Mandiri</div>
          </button>
        </div>
      </div>

      {/* Account detail panel */}
      {sel && (
        <Card className="p-6">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                   style={{ background: sel.color }}>
                {sel.type === "credit" ? <I.Card width="24" height="24"/> : sel.type === "wallet" ? <I.Wallet width="24" height="24"/> : <I.Bank width="24" height="24"/>}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold tracking-tight">{sel.name}</div>
                  <TypePill type={sel.type}/>
                </div>
                <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  {sel.last4 ? `Account ending in ${sel.last4} · ` : ""}{sel.txCount30d} transactions in last 30 days
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm"><I.Edit width="13" height="13"/>Edit</Button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="rounded-lg bg-[hsl(var(--accent))] p-3">
              <Eyebrow>Available</Eyebrow>
              <div className="text-lg font-bold tabular-nums mt-0.5">{window.fmtBND(sel.available)}</div>
            </div>
            <div className="rounded-lg bg-[hsl(var(--accent))] p-3">
              <Eyebrow>{sel.type === "credit" ? "Outstanding" : "Balance"}</Eyebrow>
              <div className={`text-lg font-bold tabular-nums mt-0.5 ${sel.balance < 0 ? "text-rose-600" : ""}`}>{window.fmtBND(Math.abs(sel.balance))}</div>
            </div>
            <div className="rounded-lg bg-[hsl(var(--accent))] p-3">
              <Eyebrow>Last activity</Eyebrow>
              <div className="text-sm font-semibold mt-0.5">{new Date(sel.lastTx).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
            </div>
            <div className="rounded-lg bg-[hsl(var(--accent))] p-3">
              <Eyebrow>{sel.type === "credit" ? "Payment due" : "30-day flow"}</Eyebrow>
              <div className="text-sm font-semibold mt-0.5">
                {sel.type === "credit" ? new Date(sel.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "+" + window.fmtBND(Math.abs(sel.trend[sel.trend.length-1] - sel.trend[0]))}
              </div>
            </div>
          </div>

          {/* Trend chart */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <Eyebrow>6-month balance</Eyebrow>
              </div>
              <div className="flex gap-1">
                {["1M", "3M", "6M", "1Y"].map((p, i) => (
                  <button key={p} className={`text-[11px] px-2 py-1 rounded-md font-semibold ${i===2 ? "bg-[hsl(var(--primary))] text-white" : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"}`}>{p}</button>
                ))}
              </div>
            </div>
            <div className="h-32 relative bg-[hsl(var(--accent))] rounded-lg p-3">
              <Spark data={sel.trend} positive={sel.trend[5] >= sel.trend[0]} w={500} h={104}/>
            </div>
          </div>

          {/* Recent activity */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Eyebrow>Recent activity</Eyebrow>
              <button className="text-[11px] font-semibold text-[hsl(var(--primary))] hover:underline">View all →</button>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]">
              {accountTx.length > 0 ? accountTx.map(t => <TransactionRow key={t.id} tx={t}/>) : (
                <div className="text-center text-xs text-[hsl(var(--muted-foreground))] py-6">No transactions on this account yet.</div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

Object.assign(window, { Dashboard, Expenses, Debts, Goals, Accounts });
