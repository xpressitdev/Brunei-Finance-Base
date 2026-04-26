const Sidebar = ({ active, onNav }) => {
  const I = window.Icons;
  const items = [
    { key: "ai",          label: "DuitPlan AI",   icon: I.Bot },
    { key: "expenses",    label: "Expense Tracker", icon: I.Scan },
    { key: "dashboard",   label: "Dashboard",     icon: I.Layout },
    { key: "accounts",    label: "Accounts",      icon: I.Bank },
    { key: "transactions",label: "Transactions",  icon: I.Receipt },
    { key: "budgets",     label: "Budgets",       icon: I.Pie },
    { key: "commitments", label: "Commitments",   icon: I.Calendar },
    { key: "debts",       label: "Debts",         icon: I.Wallet },
    { key: "goals",       label: "Goals",         icon: I.Target },
    { key: "networth",    label: "Net Worth",     icon: I.Trend },
    { key: "upload",      label: "Upload",        icon: I.Upload },
    { key: "insights",    label: "Insights",      icon: I.Lightbulb },
    { key: "achievements",label: "Achievements",  icon: I.Trophy },
    { key: "settings",    label: "Settings",      icon: I.Settings },
    { key: "premium",     label: "Premium",       icon: I.Star },
  ];
  const u = window.duitplanData.user;
  return (
    <aside className="w-64 bg-[hsl(var(--sidebar))] border-r border-[hsl(var(--sidebar-border))] flex flex-col h-full">
      <div className="px-6 py-5 flex items-center gap-2">
        <img src="../../assets/logo-mark.png" alt="" className="w-8 h-8 object-contain"/>
        <span className="text-xl font-bold text-[hsl(var(--foreground))] tracking-tight">DuitPlan</span>
      </div>
      <nav className="flex-1 px-3 pb-3 overflow-y-auto space-y-0.5">
        {items.map(({ key, label, icon: Ic }) => {
          const isActive = key === active;
          return (
            <button key={key} onClick={() => onNav(key)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left ${isActive
                ? "bg-[hsl(var(--primary))] text-white shadow-[var(--shadow-xs)]"
                : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]"}`}>
              <Ic width="18" height="18" />
              {label}
            </button>
          );
        })}
      </nav>
      <div className="p-4 border-t border-[hsl(var(--sidebar-border))]">
        <div className="text-sm font-medium truncate">{u.fullName}</div>
        <div className="text-xs text-[hsl(var(--muted-foreground))] truncate mb-3">{u.email}</div>
        <Button variant="outline" size="sm" className="w-full">Sign out</Button>
      </div>
    </aside>
  );
};

const Topbar = ({ title, subtitle, actions }) => (
  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
    <div>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex gap-2">{actions}</div>}
  </div>
);

Object.assign(window, { Sidebar, Topbar });
