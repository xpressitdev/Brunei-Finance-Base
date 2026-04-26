// Budgets page — drag-and-drop allocation of Available income into envelopes.
// Three columns from the founder sketch: Bank (loans) · Envelopes (expenses) · Vault (goals).
// All buckets are user-controlled. Overspend turns the envelope red.
// Vault uses a friction-lock confirm modal before money can be pulled back.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "metaphor": "drag",
  "envelopeStyle": "illustration",
  "animationLevel": "calm",
  "showLoans": true
}/*EDITMODE-END*/;

const seedBuckets = () => ({
  loans: [
    { id: "L1", name: "Toyota Hilux loan",   allocated: 580, target: 580, spent: 580, lender: "BIBD",    illo: "bank",    icon: "Bank",    auto: true },
    { id: "L2", name: "House financing",     allocated: 920, target: 920, spent: 920, lender: "Baiduri", illo: "bank",    icon: "Bank",    auto: true },
    { id: "L3", name: "Personal loan",       allocated: 320, target: 320, spent: 320, lender: "BIBD",    illo: "bank",    icon: "Bank",    auto: true },
  ],
  envelopes: [
    { id: "E1", name: "Rent — Beribi",      allocated: 600, target: 600, spent: 600, fixed: true,  illo: "payslip", icon: "Bank" },
    { id: "E2", name: "Groceries",          allocated: 400, target: 600, spent: 240, fixed: false, illo: "payslip", icon: "Receipt" },
    { id: "E3", name: "Eating out",         allocated: 300, target: 400, spent: 320, fixed: false, illo: "payslip", icon: "Receipt" },
    { id: "E4", name: "Transport",          allocated: 250, target: 500, spent: 580, fixed: false, illo: "payslip", icon: "Activity" },
    { id: "E5", name: "Utilities",          allocated: 95,  target: 95,  spent: 76,  fixed: true,  illo: "payslip", icon: "Lightbulb" },
    { id: "E6", name: "Family support",     allocated: 350, target: 350, spent: 350, fixed: true,  illo: "payslip", icon: "Trophy" },
  ],
  vaults: [
    { id: "V1", name: "Umrah 2027",         allocated: 200, target: 12000, saved: 3450,  illo: "vault", icon: "Star" },
    { id: "V2", name: "Emergency fund",     allocated: 100, target: 9000,  saved: 6200,  illo: "vault", icon: "Trophy" },
    { id: "V3", name: "Kids' education",    allocated: 50,  target: 25000, saved: 4100,  illo: "vault", icon: "Sparkles" },
  ],
});

const totalIncome = 4250;

const Budgets = () => {
  const I = window.Icons;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [buckets, setBuckets] = React.useState(seedBuckets);
  const [dragging, setDragging] = React.useState(null); // {amount, fromId?}
  const [overTarget, setOverTarget] = React.useState(null);
  const [vaultUnlock, setVaultUnlock] = React.useState(null); // vault id pending unlock
  const [unlockReason, setUnlockReason] = React.useState("");
  const [pulse, setPulse] = React.useState(null); // bucket id flashing on drop

  const allocLoans = buckets.loans.reduce((s, b) => s + b.allocated, 0);
  const allocEnv   = buckets.envelopes.reduce((s, b) => s + b.allocated, 0);
  const allocVault = buckets.vaults.reduce((s, b) => s + b.allocated, 0);
  const allocated  = allocLoans + allocEnv + allocVault;
  const available  = totalIncome - allocated;
  const pctAlloc   = Math.min(100, (allocated / totalIncome) * 100);

  const visibleLoans = t.showLoans ? buckets.loans : [];

  const flashPulse = (id) => {
    setPulse(id);
    setTimeout(() => setPulse(null), t.animationLevel === "satisfying" ? 700 : 350);
  };

  // --- drag mechanics ---
  const startDrag = (amount, fromKind, fromId) => (e) => {
    if (available < amount && !fromId) return;
    setDragging({ amount, fromKind, fromId });
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", String(amount)); } catch {}
  };
  const onDragOver = (kind, id) => (e) => { e.preventDefault(); setOverTarget(`${kind}:${id}`); };
  const onDragLeave = () => setOverTarget(null);

  const applyDrop = (kind, id, amount) => {
    setBuckets(prev => {
      const next = { ...prev };
      const arr = kind === "loans" ? "loans" : kind === "envelopes" ? "envelopes" : "vaults";
      next[arr] = prev[arr].map(b => b.id === id ? { ...b, allocated: b.allocated + amount } : b);
      return next;
    });
    flashPulse(id);
  };

  const onDrop = (kind, id) => (e) => {
    e.preventDefault();
    if (!dragging) return;
    const amt = dragging.amount;
    if (dragging.fromId && dragging.fromKind === "vault" && dragging.fromId !== id) {
      // Trying to MOVE money out of a vault — friction lock
      setVaultUnlock({ fromId: dragging.fromId, toKind: kind, toId: id, amount: amt });
    } else if (dragging.fromId) {
      // Moving from one envelope/loan to another
      setBuckets(prev => {
        const next = { ...prev };
        const arrFrom = dragging.fromKind === "loans" ? "loans" : dragging.fromKind === "envelope" ? "envelopes" : "vaults";
        next[arrFrom] = prev[arrFrom].map(b => b.id === dragging.fromId ? { ...b, allocated: Math.max(0, b.allocated - amt) } : b);
        return next;
      });
      applyDrop(kind, id, amt);
    } else {
      applyDrop(kind, id, amt);
    }
    setDragging(null); setOverTarget(null);
  };

  const confirmVaultUnlock = () => {
    if (!vaultUnlock || !unlockReason.trim()) return;
    setBuckets(prev => {
      const next = { ...prev };
      next.vaults = prev.vaults.map(b => b.id === vaultUnlock.fromId ? { ...b, allocated: Math.max(0, b.allocated - vaultUnlock.amount) } : b);
      const arr = vaultUnlock.toKind === "loans" ? "loans" : vaultUnlock.toKind === "envelope" ? "envelopes" : "vaults";
      next[arr] = next[arr].map(b => b.id === vaultUnlock.toId ? { ...b, allocated: b.allocated + vaultUnlock.amount } : b);
      return next;
    });
    flashPulse(vaultUnlock.toId);
    setVaultUnlock(null); setUnlockReason("");
  };

  const reset = () => { setBuckets(seedBuckets()); };

  const motionMS = t.animationLevel === "satisfying" ? 500 : t.animationLevel === "none" ? 0 : 250;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Topbar
        title="Budgets"
        subtitle="Allocate your gaji. Drag from Available into Bank, Envelopes, or Vault."
        actions={<>
          <Button variant="outline" size="sm" onClick={reset}>Reset</Button>
          <Button size="sm"><I.Check width="14" height="14"/>Confirm allocation</Button>
        </>}
      />

      {/* AVAILABLE STRIP */}
      <Card tinted={available >= 0} className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <Eyebrow className="text-[hsl(var(--primary))]">Available to allocate</Eyebrow>
            <div className="flex items-baseline gap-3 mt-1">
              <div className={`text-4xl font-bold tabular-nums ${available < 0 ? "text-rose-600" : "text-[hsl(var(--primary))]"}`}>
                {available < 0 ? "−" : ""}{window.fmtBND(Math.abs(available))}
              </div>
              <div className="text-sm text-[hsl(var(--muted-foreground))]">of {window.fmtBND(totalIncome)} April gaji</div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden w-full lg:w-96">
              <div className={`h-full rounded-full ${available < 0 ? "bg-rose-500" : "bg-[hsl(var(--primary))]"}`}
                   style={{ width: `${pctAlloc}%`, transition: `width ${motionMS}ms cubic-bezier(.2,.8,.2,1)` }}/>
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5 tabular-nums">
              {window.fmtBND(allocated)} allocated · {Math.round(pctAlloc)}%
            </div>
          </div>

          {/* Money chips — draggable amounts */}
          <div className="flex flex-wrap gap-2 max-w-md">
            {[10, 25, 50, 100, 250, 500].map(amt => (
              <MoneyChip key={amt} amount={amt} disabled={available < amt}
                onDragStart={startDrag(amt)} onDragEnd={() => setDragging(null)}
                metaphor={t.metaphor} animationLevel={t.animationLevel}/>
            ))}
          </div>
        </div>
      </Card>

      {/* THREE COLUMNS */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* BANK / LOANS */}
        <BucketColumn title="Bank" subtitle="Loan repayments — auto on Hari Gaji"
                      illo="bank" iconBg="bg-rose-50" iconColor="text-rose-600">
          {visibleLoans.map(b => (
            <Envelope key={b.id} bucket={b} kind="loans"
              isOver={overTarget === `loans:${b.id}`} pulse={pulse === b.id}
              metaphor={t.metaphor} envelopeStyle={t.envelopeStyle} motionMS={motionMS}
              onDragOver={onDragOver("loans", b.id)} onDragLeave={onDragLeave}
              onDrop={onDrop("loans", b.id)}
              onDragChip={(amt) => startDrag(amt, "loans", b.id)}
              onSlider={(v) => setBuckets(prev => ({ ...prev, loans: prev.loans.map(x => x.id===b.id?{...x, allocated:v}:x) }))}
              onInput={(v) => setBuckets(prev => ({ ...prev, loans: prev.loans.map(x => x.id===b.id?{...x, allocated:v}:x) }))}
              available={available}/>
          ))}
          {!t.showLoans && <EmptyHint>Loans hidden — toggle in Tweaks.</EmptyHint>}
        </BucketColumn>

        {/* ENVELOPES */}
        <BucketColumn title="Envelopes" subtitle="Spending categories — drained as you spend"
                      illo="payslip" iconBg="bg-[hsl(162_70%_35%/.08)]" iconColor="text-[hsl(var(--primary))]">
          {buckets.envelopes.map(b => (
            <Envelope key={b.id} bucket={b} kind="envelope"
              isOver={overTarget === `envelope:${b.id}`} pulse={pulse === b.id}
              metaphor={t.metaphor} envelopeStyle={t.envelopeStyle} motionMS={motionMS}
              onDragOver={onDragOver("envelope", b.id)} onDragLeave={onDragLeave}
              onDrop={onDrop("envelope", b.id)}
              onDragChip={(amt) => startDrag(amt, "envelope", b.id)}
              onSlider={(v) => setBuckets(prev => ({ ...prev, envelopes: prev.envelopes.map(x => x.id===b.id?{...x, allocated:v}:x) }))}
              onInput={(v) => setBuckets(prev => ({ ...prev, envelopes: prev.envelopes.map(x => x.id===b.id?{...x, allocated:v}:x) }))}
              available={available}/>
          ))}
        </BucketColumn>

        {/* VAULT / GOALS */}
        <BucketColumn title="Vault" subtitle="Long-term goals — friction-locked"
                      illo="vault" iconBg="bg-amber-50" iconColor="text-amber-700">
          {buckets.vaults.map(b => (
            <Envelope key={b.id} bucket={b} kind="vault" isVault
              isOver={overTarget === `vault:${b.id}`} pulse={pulse === b.id}
              metaphor={t.metaphor} envelopeStyle={t.envelopeStyle} motionMS={motionMS}
              onDragOver={onDragOver("vault", b.id)} onDragLeave={onDragLeave}
              onDrop={onDrop("vault", b.id)}
              onDragChip={(amt) => startDrag(amt, "vault", b.id)}
              onSlider={(v) => setBuckets(prev => ({ ...prev, vaults: prev.vaults.map(x => x.id===b.id?{...x, allocated:v}:x) }))}
              onInput={(v) => setBuckets(prev => ({ ...prev, vaults: prev.vaults.map(x => x.id===b.id?{...x, allocated:v}:x) }))}
              available={available}/>
          ))}
        </BucketColumn>
      </div>

      {/* VAULT UNLOCK MODAL */}
      {vaultUnlock && (
        <Modal onClose={() => { setVaultUnlock(null); setUnlockReason(""); }}>
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center"><I.Lightbulb width="20" height="20"/></div>
            <div>
              <div className="text-lg font-semibold">Take money out of your vault?</div>
              <div className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                Vaults are for long-term goals. Pulling {window.fmtBND(vaultUnlock.amount)} out will set you back. Tell us why — it'll be logged.
              </div>
            </div>
          </div>
          <textarea value={unlockReason} onChange={e => setUnlockReason(e.target.value)} rows={3}
            placeholder="e.g. Car broke down, need to cover repair this month."
            className="w-full p-3 rounded-md border border-[hsl(var(--input))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"/>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" size="sm" onClick={() => { setVaultUnlock(null); setUnlockReason(""); }}>Cancel</Button>
            <Button size="sm" onClick={confirmVaultUnlock}
              className={!unlockReason.trim() ? "opacity-50 pointer-events-none" : ""}>
              Confirm — take it out
            </Button>
          </div>
        </Modal>
      )}

      {/* TWEAKS */}
      <TweaksPanel>
        <TweakSection label="Allocation"/>
        <TweakRadio label="Metaphor" value={t.metaphor} options={["drag", "slider", "input"]} onChange={v => setTweak("metaphor", v)}/>
        <TweakToggle label="Show loans column" value={t.showLoans} onChange={v => setTweak("showLoans", v)}/>
        <TweakSection label="Visual"/>
        <TweakRadio label="Envelope style" value={t.envelopeStyle} options={["illustration", "flat", "glyph"]} onChange={v => setTweak("envelopeStyle", v)}/>
        <TweakRadio label="Animation" value={t.animationLevel} options={["none", "calm", "satisfying"]} onChange={v => setTweak("animationLevel", v)}/>
      </TweaksPanel>
    </div>
  );
};

window.Budgets = Budgets;
