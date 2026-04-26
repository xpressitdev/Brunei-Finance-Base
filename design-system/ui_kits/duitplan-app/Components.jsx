const KpiCard = ({ label, value, glyph, hero = false, footer, delta, deltaLabel }) => {
  const I = window.Icons;
  const Glyph = I[glyph] || I.Activity;
  return (
    <Card tinted={hero} className="p-4">
      <div className="flex justify-between items-center">
        <Eyebrow className={hero ? "text-[hsl(var(--primary))]" : ""}>{label}</Eyebrow>
        <Glyph width="14" height="14" style={{ color: hero ? "hsl(var(--primary))" : "hsl(162 70% 40% / .55)" }} />
      </div>
      <div className={`text-[22px] font-bold tabular-nums mt-1 leading-tight ${hero ? "text-[hsl(var(--primary))]" : ""}`}>{value}</div>
      {delta !== undefined && (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
          <I.ArrowUp width="11" height="11"/>
          <span className="tabular-nums">{delta}</span>
          <span className="text-[hsl(var(--muted-foreground))] font-normal">{deltaLabel}</span>
        </div>
      )}
      {footer}
    </Card>
  );
};

const HariGajiBanner = ({ user, salary, onConfirm, onSkip }) => {
  const I = window.Icons;
  return (
    <div className="rounded-xl border border-[hsl(162_70%_35%/.25)] bg-[hsl(162_70%_35%/.05)] p-4 flex items-center justify-between gap-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[hsl(var(--primary))] text-white flex items-center justify-center text-lg">💵</div>
        <div>
          <div className="text-sm font-semibold">Hari Gaji is today, {user.firstName}.</div>
          <div className="text-[13px] text-[hsl(var(--muted-foreground))]">Did you receive your {window.fmtBND(salary)} salary? We'll log it and deduct your auto-debits.</div>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button variant="ghost" size="sm" onClick={onSkip}>Remind tomorrow</Button>
        <Button size="sm" onClick={onConfirm}>Yes, I got paid</Button>
      </div>
    </div>
  );
};

const TransactionRow = ({ tx }) => {
  const isCredit = tx.type === "credit";
  const date = new Date(tx.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0 border-[hsl(var(--border))]">
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{tx.description}</div>
        <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 flex items-center gap-1.5">
          <span>{date}</span><span>·</span><span>{tx.categoryName}</span>
          {tx.accountName && <span className="bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none">{tx.accountName}</span>}
        </div>
      </div>
      <span className={`text-sm font-semibold tabular-nums ${isCredit ? "text-emerald-600" : "text-rose-600"}`}>
        {isCredit ? "+" : "−"}BND {tx.amount.toFixed(2)}
      </span>
    </div>
  );
};

const BudgetRow = ({ b }) => {
  const pct = Math.min(100, (b.spent / b.planned) * 100);
  const fillColor = b.color === "danger" ? "bg-rose-500" : b.color === "warn" ? "bg-amber-500" : "bg-[hsl(var(--primary))]";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{b.category}</span>
        <span className="text-[hsl(var(--muted-foreground))] tabular-nums">{window.fmtBND(b.spent)} <span className="opacity-60">/ {window.fmtBND(b.planned)}</span></span>
      </div>
      <div className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
        <div className={`h-full rounded-full ${fillColor}`} style={{ width: `${pct}%` }}/>
      </div>
    </div>
  );
};

const Donut = ({ data, size = 220 }) => {
  const total = data.reduce((s, d) => s + d.totalSpent, 0);
  const r = size / 2;
  const inner = r - 32;
  let acc = 0;
  const arcs = data.map((d, i) => {
    const start = (acc / total) * 2 * Math.PI;
    acc += d.totalSpent;
    const end = (acc / total) * 2 * Math.PI;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = r + Math.sin(start) * (r - 4);
    const y1 = r - Math.cos(start) * (r - 4);
    const x2 = r + Math.sin(end) * (r - 4);
    const y2 = r - Math.cos(end) * (r - 4);
    const xi1 = r + Math.sin(end) * inner;
    const yi1 = r - Math.cos(end) * inner;
    const xi2 = r + Math.sin(start) * inner;
    const yi2 = r - Math.cos(start) * inner;
    const path = `M ${x1} ${y1} A ${r-4} ${r-4} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${inner} ${inner} 0 ${large} 0 ${xi2} ${yi2} Z`;
    return <path key={i} d={path} fill={d.color}/>;
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {arcs}
      <text x={r} y={r-4} textAnchor="middle" fontSize="12" fill="hsl(var(--muted-foreground))" fontFamily="var(--app-font-sans)">Total</text>
      <text x={r} y={r+14} textAnchor="middle" fontSize="16" fontWeight="700" fill="hsl(var(--foreground))" fontFamily="var(--app-font-sans)">{`BND ${total.toFixed(0)}`}</text>
    </svg>
  );
};

Object.assign(window, { KpiCard, HariGajiBanner, TransactionRow, BudgetRow, Donut });
