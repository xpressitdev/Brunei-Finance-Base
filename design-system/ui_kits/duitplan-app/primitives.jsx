// Primitive components matching production shadcn/ui shapes.

const Button = ({ variant = "default", size = "default", className = "", children, ...p }) => {
  const variants = {
    default:     "bg-[hsl(var(--primary))] text-white border border-[hsl(162_70%_27%)]",
    outline:     "bg-white text-[hsl(var(--foreground))] border border-black/10 shadow-[var(--shadow-xs)]",
    secondary:   "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] border border-[hsl(160_20%_82%)]",
    ghost:       "bg-transparent text-[hsl(var(--foreground))] border border-transparent",
    destructive: "bg-[hsl(var(--destructive))] text-white",
  };
  const sizes = {
    default: "h-9 px-4 text-sm",
    sm:      "h-8 px-3 text-xs",
    lg:      "h-11 px-7 text-[15px]",
    icon:    "h-9 w-9",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors hover:brightness-[.97] active:brightness-[.94] ${variants[variant]} ${sizes[size]} ${className}`}
      {...p}>
      {children}
    </button>
  );
};

const Card = ({ className = "", children, tinted = false, ...p }) => (
  <div className={`rounded-xl border ${tinted ? "bg-[hsl(162_70%_35%/.05)] border-[hsl(162_70%_35%/.2)]" : "bg-white border-[hsl(var(--card-border))]"} shadow-[var(--shadow-sm)] ${className}`} {...p}>
    {children}
  </div>
);

const Badge = ({ variant = "default", className = "", children }) => {
  const v = {
    default:     "bg-[hsl(var(--primary))] text-white",
    secondary:   "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]",
    outline:     "bg-white text-[hsl(var(--foreground))] border border-black/10",
    success:     "bg-emerald-50 text-emerald-700",
    warn:        "bg-amber-50 text-amber-700",
    rose:        "bg-rose-50 text-rose-700",
    info:        "bg-sky-50 text-sky-700",
  };
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${v[variant]} ${className}`}>{children}</span>;
};

const Input = ({ prefix, className = "", ...p }) => {
  if (prefix) {
    return (
      <div className="flex items-stretch border border-[hsl(var(--input))] rounded-md bg-white overflow-hidden shadow-[var(--shadow-xs)] focus-within:ring-2 focus-within:ring-[hsl(var(--ring))]">
        <span className="flex items-center px-3 bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] text-sm font-semibold tabular-nums">{prefix}</span>
        <input className={`flex-1 px-3 py-2 text-sm bg-transparent outline-none tabular-nums ${className}`} {...p}/>
      </div>
    );
  }
  return <input className={`h-9 w-full px-3 rounded-md border border-[hsl(var(--input))] bg-white text-sm shadow-[var(--shadow-xs)] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] ${className}`} {...p}/>;
};

const Eyebrow = ({ children, className = "" }) => (
  <span className={`text-[11px] uppercase tracking-wider font-semibold text-[hsl(var(--muted-foreground))] ${className}`}>{children}</span>
);

Object.assign(window, { Button, Card, Badge, Input, Eyebrow });
