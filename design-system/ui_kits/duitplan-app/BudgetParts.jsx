// Helpers used by Budgets.jsx — money chips, bucket columns, envelope cards, modal.

const MoneyChip = ({ amount, disabled, onDragStart, onDragEnd, metaphor, animationLevel }) => {
  if (metaphor !== "drag") return null;
  const motion = animationLevel === "satisfying" ? "hover:-translate-y-1 active:scale-95 hover:rotate-[-2deg]" : "hover:-translate-y-0.5";
  return (
    <div draggable={!disabled} onDragStart={onDragStart} onDragEnd={onDragEnd}
      className={`select-none cursor-grab active:cursor-grabbing
        ${disabled ? "opacity-40 pointer-events-none" : ""}
        rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800
        px-3 py-2 text-sm font-bold tabular-nums shadow-sm
        transition-all duration-150 ${motion}`}>
      BND {amount}
    </div>
  );
};

const BucketColumn = ({ title, subtitle, illo, iconBg, iconColor, children }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-3 px-1">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
        <img src={`../../assets/illustration-${illo}.png`} className="w-7 h-7 object-contain" alt=""/>
      </div>
      <div>
        <div className="text-base font-semibold tracking-tight">{title}</div>
        <div className="text-xs text-[hsl(var(--muted-foreground))]">{subtitle}</div>
      </div>
    </div>
    <div className="space-y-2">{children}</div>
  </div>
);

const Envelope = ({ bucket: b, kind, isOver, pulse, isVault, metaphor, envelopeStyle, motionMS,
                   onDragOver, onDragLeave, onDrop, onDragChip, onSlider, onInput, available }) => {
  const I = window.Icons;
  // For envelopes: spent vs allocated. For vaults: saved vs target. For loans: allocated vs target.
  const isEnvelope = kind === "envelope";
  const denom = isVault ? b.target : isEnvelope ? Math.max(b.allocated, b.spent, 1) : b.target;
  const numer = isVault ? (b.saved + b.allocated) : isEnvelope ? b.spent : b.allocated;
  const remaining = isEnvelope ? b.allocated - b.spent : null;
  const overspent = isEnvelope && b.spent > b.allocated;
  const pct = Math.min(100, (isEnvelope ? (b.spent / Math.max(b.allocated, 1)) : (numer / Math.max(denom, 1))) * 100);
  const isFunded = !isEnvelope && b.target && b.allocated >= b.target;

  const fillColor = overspent ? "bg-rose-500"
                  : isVault ? "bg-amber-400"
                  : kind === "loans" ? "bg-rose-400"
                  : "bg-[hsl(var(--primary))]";

  const borderState = overspent ? "border-rose-400"
                    : isOver ? "border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary)/.25)]"
                    : "border-[hsl(var(--card-border))]";

  const Glyph = I[b.icon] || I.Wallet;
  const showIllo = envelopeStyle === "illustration";
  const showGlyph = envelopeStyle === "glyph";

  const transition = `all ${motionMS}ms cubic-bezier(.2,.8,.2,1)`;

  return (
    <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
         className={`relative bg-white rounded-xl border ${borderState}
                    ${pulse ? "scale-[1.015]" : "scale-100"}
                    p-4 shadow-[var(--shadow-sm)]`}
         style={{ transition }}>
      {pulse && (
        <div className="absolute inset-0 rounded-xl bg-[hsl(var(--primary)/.08)] pointer-events-none animate-pulse"/>
      )}

      <div className="flex items-start gap-3">
        {showIllo && (
          <img src={`../../assets/illustration-${b.illo}.png`} className="w-9 h-9 object-contain shrink-0" alt=""/>
        )}
        {showGlyph && (
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0
            ${isVault ? "bg-amber-50 text-amber-700" : kind === "loans" ? "bg-rose-50 text-rose-600" : "bg-[hsl(162_70%_35%/.08)] text-[hsl(var(--primary))]"}`}>
            <Glyph width="18" height="18"/>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold truncate">{b.name}</div>
            {b.fixed && <Badge variant="outline" className="text-[10px] py-0">fixed</Badge>}
            {b.auto && <Badge variant="outline" className="text-[10px] py-0">auto</Badge>}
            {isFunded && <Badge variant="success" className="text-[10px] py-0"><I.Check width="10" height="10"/>funded</Badge>}
            {overspent && <Badge variant="rose" className="text-[10px] py-0">over</Badge>}
          </div>

          <div className="flex items-baseline justify-between mt-0.5">
            <div className="text-lg font-bold tabular-nums">{window.fmtBND(b.allocated)}</div>
            {isEnvelope && (
              <div className={`text-xs tabular-nums ${overspent ? "text-rose-600 font-semibold" : "text-[hsl(var(--muted-foreground))]"}`}>
                {overspent ? `${window.fmtBND(b.spent - b.allocated)} over` : `${window.fmtBND(remaining)} left`}
              </div>
            )}
            {!isEnvelope && b.target && (
              <div className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">
                of {window.fmtBND(b.target)}{isVault ? " goal" : ""}
              </div>
            )}
          </div>

          <div className="h-1.5 rounded-full bg-[hsl(var(--muted))] mt-2 overflow-hidden">
            <div className={`h-full rounded-full ${fillColor}`}
                 style={{ width: `${pct}%`, transition }}/>
          </div>
          {isEnvelope && b.spent > 0 && (
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 tabular-nums">
              {window.fmtBND(b.spent)} spent of {window.fmtBND(b.allocated)} allocated
            </div>
          )}

          {/* Metaphor controls */}
          {metaphor === "slider" && (
            <input type="range" min="0" max={Math.max(b.target || 1500, b.allocated)} step="10"
              value={b.allocated} onChange={(e) => onSlider(Number(e.target.value))}
              className="w-full mt-3 accent-[hsl(var(--primary))]"/>
          )}
          {metaphor === "input" && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">BND</span>
              <input type="number" value={b.allocated} min="0" step="10"
                onChange={(e) => onInput(Number(e.target.value))}
                className="flex-1 h-8 px-2 rounded-md border border-[hsl(var(--input))] text-sm tabular-nums outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"/>
              <button onClick={() => onInput(b.allocated + 50)}
                className="h-8 px-2 rounded-md bg-[hsl(var(--accent))] text-xs font-semibold">+50</button>
            </div>
          )}
          {metaphor === "drag" && b.allocated >= 50 && !b.auto && !b.fixed && (
            <button draggable onDragStart={(e) => onDragChip(50)(e)}
              className="mt-2 text-[11px] font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-grab active:cursor-grabbing inline-flex items-center gap-1">
              <I.Activity width="11" height="11"/> drag −50 elsewhere
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const EmptyHint = ({ children }) => (
  <div className="rounded-xl border border-dashed border-[hsl(var(--card-border))] p-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
    {children}
  </div>
);

const Modal = ({ onClose, children }) => (
  <div className="fixed inset-0 z-40 flex items-center justify-center p-4 animate-in fade-in" style={{background: "rgba(0,0,0,.40)"}}>
    <div className="bg-white rounded-xl border border-[hsl(var(--card-border))] shadow-xl max-w-lg w-full p-6"
         onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  </div>
);

Object.assign(window, { MoneyChip, BucketColumn, Envelope, EmptyHint, Modal });
