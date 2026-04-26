// Net Worth — assets vs liabilities, trend, forecast.

const NetWorth = () => {
  const d = window.duitplanData;
  const I = window.Icons;

  // Assets: positive-balance accounts + saved goal money
  const cashAssets = d.accounts.filter(a => a.balance > 0);
  const cashTotal  = cashAssets.reduce((s, a) => s + a.balance, 0);
  const goalsTotal = d.goals.reduce((s, g) => s + g.saved, 0);
  const totalAssets = cashTotal + goalsTotal;

  // Liabilities: credit balances + loans
  const ccLiab = d.accounts.filter(a => a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0);
  const loans  = d.debts;
  const loanTotal = loans.reduce((s, l) => s + l.balance, 0);
  const totalLiab = ccLiab + loanTotal;

  const netWorth = totalAssets - totalLiab;

  // 12-month synthetic history (ending at current netWorth, rising trajectory)
  const history = [
    -158420, -156100, -154800, -152500, -149800, -148200,
    -147500, -147800, -148900, -150400, -152800, netWorth
  ];
  const monthLabels = ["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];

  const yearAgo = history[0];
  const yearChange = netWorth - yearAgo;
  const yearChangePct = ((yearChange / Math.abs(yearAgo)) * 100);

  const monthAgo = history[10];
  const monthChange = netWorth - monthAgo;

  // Asset positions
  const assetPositions = [
    ...cashAssets.map(a => ({
      label: a.name, sub: a.bank, type: "cash",
      amount: a.balance, color: a.color || "#0a8a6e",
      icon: a.type === "wallet" ? "Wallet" : "Bank",
    })),
    ...d.goals.map(g => ({
      label: g.name, sub: `Savings goal · ${Math.round((g.saved/g.target)*100)}% to ${window.fmtBND(g.target)}`,
      type: "goal", amount: g.saved, color: "#16a34a", icon: "Target",
    })),
  ].sort((a, b) => b.amount - a.amount);

  // Liability positions
  const liabPositions = [
    ...d.accounts.filter(a => a.balance < 0).map(a => ({
      label: a.name, sub: `${a.bank} · ${a.rate ? a.rate + "% APR" : "Revolving credit"}`,
      type: "credit", amount: Math.abs(a.balance), color: "#1f3a5f", icon: "Card",
    })),
    ...loans.map(l => ({
      label: l.name, sub: `${l.lender} · ${l.rate}% APR · ${window.fmtBND(l.monthlyPayment)}/mo`,
      type: "loan", amount: l.balance, color: "#9f1239", icon: "Bank",
    })),
  ].sort((a, b) => b.amount - a.amount);

  // Trend chart (SVG area chart)
  const ChartW = 720, ChartH = 200, padL = 50, padR = 16, padT = 16, padB = 28;
  const minY = Math.min(...history) * 1.05;
  const maxY = Math.max(...history, 0) * 1.1; // include zero line
  const yRange = maxY - minY;
  const xStep = (ChartW - padL - padR) / (history.length - 1);

  const xy = (i, v) => ({
    x: padL + i * xStep,
    y: padT + ((maxY - v) / yRange) * (ChartH - padT - padB),
  });
  const points = history.map((v, i) => xy(i, v));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const zeroY = padT + ((maxY - 0) / yRange) * (ChartH - padT - padB);
  const lastP = points[points.length - 1];
  const areaPath = `${linePath} L${lastP.x.toFixed(1)},${zeroY.toFixed(1)} L${points[0].x.toFixed(1)},${zeroY.toFixed(1)} Z`;

  // Forecast: months to break even (cross zero). Avg monthly improvement over last 6 months
  const recent6 = history.slice(-6);
  const monthlyImprove = (recent6[5] - recent6[0]) / 5;
  const monthsToZero = monthlyImprove > 0 ? Math.ceil(Math.abs(netWorth) / monthlyImprove) : null;
  const yearsTo50k  = monthlyImprove > 0 ? Math.ceil((50000 - netWorth) / monthlyImprove / 12 * 10) / 10 : null;

  // Net worth band
  const debtToAssetRatio = totalLiab / totalAssets;
  const healthLabel = debtToAssetRatio < 1 ? "Solvent" : debtToAssetRatio < 5 ? "Highly leveraged" : "Critical";
  const healthColor = debtToAssetRatio < 1 ? "text-emerald-700 bg-emerald-50" : debtToAssetRatio < 5 ? "text-amber-700 bg-amber-50" : "text-rose-700 bg-rose-50";

  // Tilt of the scale (visual)
  const ratio = totalAssets / (totalAssets + totalLiab); // 0..1; balanced = 0.5
  const tilt = (ratio - 0.5) * 24; // degrees, capped naturally

  const Glyph = ({ name, ...p }) => {
    const Comp = window.Icons[name] || window.Icons.Wallet;
    return <Comp {...p}/>;
  };

  // Milestones list
  const milestones = [
    { label: "BND 0 — Break even",   target: 0,      reached: netWorth >= 0 },
    { label: "BND 25k saved",        target: 25000,  reached: netWorth >= 25000 },
    { label: "BND 50k milestone",    target: 50000,  reached: netWorth >= 50000 },
    { label: "BND 100k milestone",   target: 100000, reached: netWorth >= 100000 },
    { label: "Debt-free",            target: -ccLiab + loanTotal === 0 ? 0 : null, reached: totalLiab === 0 },
  ].filter(m => m.target !== null);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Topbar title="Net Worth" subtitle="The big picture: what you own minus what you owe."
        actions={<>
          <Button variant="outline" size="sm"><I.Calendar width="14" height="14"/>Snapshot</Button>
          <Button size="sm"><I.Sparkles width="14" height="14"/>Run forecast</Button>
        </>}/>

      {/* Hero — net worth + change */}
      <Card tinted className="p-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-72 h-72 rounded-full bg-[hsl(162_60%_60%/.18)] blur-3xl pointer-events-none"/>
        <div className="absolute left-12 bottom-0 w-48 h-48 rounded-full bg-[hsl(162_70%_45%/.12)] blur-3xl pointer-events-none"/>
        <div className="relative grid lg:grid-cols-5 gap-6 items-center">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <Eyebrow className="text-[hsl(var(--primary))]">Today's net worth</Eyebrow>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${healthColor}`}>{healthLabel}</span>
            </div>
            <div className={`text-[44px] leading-[1.05] font-bold tabular-nums whitespace-nowrap ${netWorth < 0 ? "text-rose-700" : "text-[hsl(var(--primary))]"}`}>
              {netWorth < 0 ? "−" : ""}{window.fmtBND(Math.abs(netWorth))}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-white/70 rounded-lg p-2.5 border border-[hsl(var(--card-border))]">
                <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-bold">vs last month</div>
                <div className={`text-sm font-bold tabular-nums mt-0.5 inline-flex items-center gap-1 ${monthChange >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                  {monthChange >= 0 ? <I.ArrowUp width="12" height="12"/> : <I.ArrowDown width="12" height="12"/>}
                  {monthChange >= 0 ? "+" : "−"}{window.fmtBND(Math.abs(monthChange))}
                </div>
              </div>
              <div className="bg-white/70 rounded-lg p-2.5 border border-[hsl(var(--card-border))]">
                <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-bold">vs 12 months ago</div>
                <div className={`text-sm font-bold tabular-nums mt-0.5 ${yearChange >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                  {yearChange >= 0 ? "+" : "−"}{window.fmtBND(Math.abs(yearChange))}
                  <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] ml-1">({yearChangePct >= 0 ? "+" : ""}{yearChangePct.toFixed(1)}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* The Scale — assets vs liabilities visual metaphor */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl p-5 shadow-[0_2px_12px_rgba(0,0,0,.04)] border border-[hsl(var(--card-border))]">
              <div className="flex items-center justify-between mb-4">
                <Eyebrow>Balance scale</Eyebrow>
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Tilts toward larger side</span>
              </div>
              <div className="relative" style={{ height: 160 }}>
                {/* Asset column — left side */}
                <div className="absolute left-[12%] -translate-x-1/2 top-0 flex flex-col items-center" style={{ transform: `translateX(-50%) translateY(${tilt > 0 ? Math.min(tilt*1.5, 32) : 0}px)`, transition: "transform 700ms ease-out" }}>
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-center min-w-[150px] shadow-sm">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Assets</div>
                    <div className="text-base font-bold text-emerald-800 tabular-nums">{window.fmtBND(totalAssets)}</div>
                  </div>
                  <div className="w-0.5 bg-[hsl(var(--foreground)/.4)]" style={{ height: 22 }}/>
                  <div className="w-20 h-2 bg-[hsl(var(--foreground)/.85)] rounded-full"/>
                </div>
                {/* Liability column — right side */}
                <div className="absolute right-[12%] translate-x-1/2 top-0 flex flex-col items-center" style={{ transform: `translateX(50%) translateY(${tilt < 0 ? Math.min(-tilt*1.5, 32) : 0}px)`, transition: "transform 700ms ease-out" }}>
                  <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-center min-w-[150px] shadow-sm">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Liabilities</div>
                    <div className="text-base font-bold text-rose-800 tabular-nums">{window.fmtBND(totalLiab)}</div>
                  </div>
                  <div className="w-0.5 bg-[hsl(var(--foreground)/.4)]" style={{ height: 22 }}/>
                  <div className="w-20 h-2 bg-[hsl(var(--foreground)/.85)] rounded-full"/>
                </div>
                {/* Beam — rotates */}
                <div className="absolute left-1/2 top-[88px] origin-center transition-transform duration-700"
                     style={{ transform: `translateX(-50%) rotate(${tilt}deg)`, width: "76%" }}>
                  <div className="h-1.5 bg-[hsl(var(--foreground)/.85)] rounded-full"/>
                </div>
                {/* Pivot triangle */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-8 w-0 h-0"
                     style={{ borderLeft: "16px solid transparent", borderRight: "16px solid transparent", borderBottom: "26px solid hsl(var(--foreground) / .85)" }}/>
                {/* Pivot base */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-4 w-16 h-1.5 bg-[hsl(var(--foreground)/.85)] rounded-full"/>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-3 pt-3 border-t border-[hsl(var(--border))]">
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-semibold">Debt-to-asset</div>
                  <div className="text-sm font-bold tabular-nums mt-0.5">{debtToAssetRatio.toFixed(2)}×</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-semibold">Liquid runway</div>
                  <div className="text-sm font-bold tabular-nums mt-0.5">{(cashTotal / 1500).toFixed(1)} mo</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-semibold">Equity %</div>
                  <div className="text-sm font-bold tabular-nums mt-0.5">{(ratio * 100).toFixed(1)}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 12-month chart */}
      <Card className="p-6">
        <div className="flex items-end justify-between mb-4">
          <div>
            <Eyebrow>12-month trajectory</Eyebrow>
            <h3 className="text-lg font-semibold mt-0.5">Climbing out of the red</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              Net worth rose <span className="font-semibold text-emerald-700">{window.fmtBND(yearChange)}</span> since {monthLabels[0]} 2025.
            </p>
          </div>
          <div className="flex gap-1">
            {["6M", "1Y", "3Y", "All"].map((p, i) => (
              <button key={p}
                className={`text-[11px] px-3 h-7 rounded-md font-semibold ${i===1 ? "bg-[hsl(var(--primary))] text-white" : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <svg viewBox={`0 0 ${ChartW} ${ChartH}`} className="w-full h-auto" preserveAspectRatio="none">
          <defs>
            <linearGradient id="nwAreaPos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="hsl(162 70% 40%)" stopOpacity="0.35"/>
              <stop offset="100%" stopColor="hsl(162 70% 40%)" stopOpacity="0"/>
            </linearGradient>
            <linearGradient id="nwAreaNeg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(350 70% 50%)" stopOpacity="0"/>
              <stop offset="100%" stopColor="hsl(350 70% 50%)" stopOpacity="0.25"/>
            </linearGradient>
          </defs>
          {/* Y-axis grid lines */}
          {[-150000, -100000, -50000, 0, 50000].filter(v => v >= minY && v <= maxY).map(v => {
            const y = padT + ((maxY - v) / yRange) * (ChartH - padT - padB);
            return (
              <g key={v}>
                <line x1={padL} y1={y} x2={ChartW - padR} y2={y} stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray={v === 0 ? "" : "3 3"}/>
                <text x={padL - 6} y={y + 3} textAnchor="end" className="text-[10px]" fill="hsl(var(--muted-foreground))">
                  {v >= 0 ? "+" : "−"}{Math.abs(v / 1000)}k
                </text>
              </g>
            );
          })}
          {/* Area below zero (negative net worth shown with red tint) */}
          <path d={areaPath} fill="url(#nwAreaNeg)"/>
          {/* Trend line */}
          <path d={linePath} fill="none" stroke="hsl(162 70% 38%)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          {/* Endpoint */}
          <circle cx={lastP.x} cy={lastP.y} r="5" fill="hsl(162 70% 38%)" stroke="white" strokeWidth="2.5"/>
          <circle cx={lastP.x} cy={lastP.y} r="11" fill="hsl(162 70% 38%)" opacity="0.18"/>
          {/* Endpoint label */}
          <g transform={`translate(${lastP.x - 50}, ${lastP.y - 26})`}>
            <rect width="100" height="20" rx="10" fill="hsl(162 70% 38%)"/>
            <text x="50" y="14" textAnchor="middle" fontSize="11" fontWeight="700" fill="white">{window.fmtBND(netWorth)}</text>
          </g>
          {/* X-axis labels */}
          {monthLabels.map((m, i) => {
            if (i % 2 !== 0 && i !== monthLabels.length - 1) return null;
            const x = padL + i * xStep;
            return <text key={i} x={x} y={ChartH - 8} textAnchor="middle" className="text-[10px]" fill="hsl(var(--muted-foreground))">{m}</text>;
          })}
        </svg>
      </Card>

      {/* Two-column: Assets / Liabilities */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Assets column */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center"><I.ArrowUp width="16" height="16"/></div>
              <h3 className="text-base font-semibold">Assets</h3>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold tabular-nums text-emerald-700">{window.fmtBND(totalAssets)}</div>
              <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{assetPositions.length} positions</div>
            </div>
          </div>
          {/* Composition bar */}
          <div className="flex h-2 rounded-full overflow-hidden mt-3 mb-4 shadow-inner bg-[hsl(var(--accent))]">
            {assetPositions.map((p, i) => (
              <div key={i} className="h-full" style={{ width: `${(p.amount/totalAssets)*100}%`, background: p.color }} title={p.label}/>
            ))}
          </div>
          <div className="space-y-1">
            {assetPositions.map((p, i) => (
              <div key={i} className="flex items-center gap-3 py-2 hover:bg-[hsl(var(--accent))] rounded-lg px-2 -mx-2 cursor-pointer group">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                     style={{ background: p.color }}>
                  <Glyph name={p.icon} width="16" height="16"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{p.label}</div>
                  <div className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">{p.sub}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold tabular-nums">{window.fmtBND(p.amount)}</div>
                  <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{Math.round((p.amount/totalAssets)*100)}%</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Liabilities column */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center"><I.ArrowDown width="16" height="16"/></div>
              <h3 className="text-base font-semibold">Liabilities</h3>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold tabular-nums text-rose-600">{window.fmtBND(totalLiab)}</div>
              <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{liabPositions.length} obligations</div>
            </div>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden mt-3 mb-4 shadow-inner bg-[hsl(var(--accent))]">
            {liabPositions.map((p, i) => (
              <div key={i} className="h-full" style={{ width: `${(p.amount/totalLiab)*100}%`, background: p.color }} title={p.label}/>
            ))}
          </div>
          <div className="space-y-1">
            {liabPositions.map((p, i) => (
              <div key={i} className="flex items-center gap-3 py-2 hover:bg-[hsl(var(--accent))] rounded-lg px-2 -mx-2 cursor-pointer group">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                     style={{ background: p.color }}>
                  <Glyph name={p.icon} width="16" height="16"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{p.label}</div>
                  <div className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">{p.sub}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold tabular-nums text-rose-600">−{window.fmtBND(p.amount)}</div>
                  <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{Math.round((p.amount/totalLiab)*100)}%</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Forecast + Milestones */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Forecast */}
        <Card tinted className="p-6 lg:col-span-2 relative overflow-hidden">
          <div className="absolute right-4 top-4 opacity-[0.06]"><I.Sparkles width="120" height="120"/></div>
          <Eyebrow className="text-[hsl(var(--primary))]">If you keep going at this pace…</Eyebrow>
          <div className="grid sm:grid-cols-3 gap-4 mt-3 relative">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-bold">Monthly improvement</div>
              <div className="text-2xl font-bold tabular-nums text-emerald-700 mt-1">+{window.fmtBND(monthlyImprove)}</div>
              <div className="text-[11px] text-[hsl(var(--muted-foreground))]">avg over 6 months</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-bold">Break even</div>
              <div className="text-2xl font-bold tabular-nums mt-1">
                {monthsToZero ? `${(monthsToZero / 12).toFixed(1)} yrs` : "—"}
              </div>
              <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                {monthsToZero ? `~${monthsToZero} months` : "Not on track"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-bold">Hit BND 50k</div>
              <div className="text-2xl font-bold tabular-nums mt-1">
                {yearsTo50k ? `${yearsTo50k} yrs` : "—"}
              </div>
              <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                {yearsTo50k ? `by ${2026 + Math.floor(yearsTo50k)}` : "Increase savings rate"}
              </div>
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-[hsl(var(--border))] relative">
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              <span className="font-semibold text-[hsl(var(--foreground))]">Tip:</span>{" "}
              The Hilux loan ends in ~32 months — once paid off, your monthly improvement jumps to{" "}
              <span className="font-bold text-emerald-700">+{window.fmtBND(monthlyImprove + 580.50)}</span>.
            </div>
          </div>
        </Card>

        {/* Milestones */}
        <Card className="p-5">
          <Eyebrow>Milestones</Eyebrow>
          <h3 className="text-base font-semibold mt-0.5 mb-4">Your roadmap</h3>
          <div className="space-y-3">
            {milestones.map((m, i) => {
              const reached = m.reached;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${reached ? "bg-emerald-500 text-white" : "bg-[hsl(var(--accent))] text-[hsl(var(--muted-foreground))] border-2 border-dashed border-[hsl(var(--card-border))]"}`}>
                    {reached ? <I.Check width="13" height="13"/> : <span className="text-[10px] font-bold">{i+1}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${reached ? "" : "text-[hsl(var(--muted-foreground))]"}`}>{m.label}</div>
                    {!reached && (
                      <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{window.fmtBND(m.target - netWorth)} to go</div>
                    )}
                  </div>
                  {reached && <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Done</span>}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};

window.NetWorth = NetWorth;
