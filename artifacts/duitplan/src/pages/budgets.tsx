import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { format, addMonths, subMonths, addYears, subYears } from "date-fns";
import {
  useListBudgets,
  useUpsertBudget,
  useListCategories,
  useDeleteCategory,
  useGetProfile,
  useListCommitments,
  useUpdateCommitment,
  useDeleteCommitment,
  useListAccounts,
  useListDebts,
  useListGoals,
  useUpdateGoal,
} from "@workspace/api-client-react";
import type { Debt, Goal } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  TrendingDown,
  TrendingUp,
  Wallet,
  Lock,
  Table2,
  LayoutList,
  Building2,
  ChevronDown,
  Banknote,
  PiggyBank,
  Sparkles,
  RotateCcw,
  GripVertical,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TrialExpiredPrompt } from "@/components/subscription/TrialExpiredPrompt";
import { isTrialExpiredError } from "@/lib/trialExpired";
import { MoneyBag } from "@/components/redesign/MoneyBag";
import { MinPaymentBar } from "@/components/redesign/MinPaymentBar";
import { fmtBND } from "@/lib/format";

function fmt(n: number) {
  return "BND " + n.toLocaleString("en-BN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtShort(n: number) {
  return n.toLocaleString("en-BN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function safeNum(x: unknown): number {
  const n = typeof x === "number" ? x : parseFloat(String(x ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

// Stable per-group sort: items whose ID is in `order` come first in that
// order; anything not yet ordered keeps its original position appended at
// the end. Lets the user manually reorder buckets via the drag handle while
// brand-new buckets (added later) still show up in a sensible spot.
function sortByOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (!order.length) return items;
  const orderIdx = new Map(order.map((id, i) => [id, i]));
  const ordered: T[] = [];
  const rest: T[] = [];
  for (const it of items) {
    if (orderIdx.has(it.id)) ordered.push(it);
    else rest.push(it);
  }
  ordered.sort((a, b) => orderIdx.get(a.id)! - orderIdx.get(b.id)!);
  return [...ordered, ...rest];
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className={cn("rounded-xl p-4 flex flex-col gap-1", color ?? "bg-white border")}>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-xl font-bold text-foreground leading-tight">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type Bucket = {
  id: string;
  name: string;
  kind: "loan" | "envelope" | "vault";
  allocated: number;
  target?: number;
  spent?: number;
  fixed?: boolean;
  auto?: boolean;
  isDeletable?: boolean;
};

const CHIP_AMOUNTS = [10, 25, 50, 100, 250, 500];

type DragState = { amount: number; fromId?: string; x: number; y: number };

function usePointerDrag(onDrop: (targetId: string, amount: number, fromId?: string) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const onDropRef = useRef(onDrop);

  useEffect(() => { onDropRef.current = onDrop; }, [onDrop]);
  useEffect(() => { dragRef.current = drag; }, [drag]);

  const startDrag = useCallback(
    (amount: number, fromId: string | undefined, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDrag({ amount, fromId, x: e.clientX, y: e.clientY });
    },
    []
  );

  const isActive = !!drag;

  useEffect(() => {
    if (!isActive) return;

    const findTarget = (x: number, y: number): string | null => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const drop = el?.closest("[data-drop-id]") as HTMLElement | null;
      return drop?.getAttribute("data-drop-id") ?? null;
    };

    const move = (e: PointerEvent) => {
      const x = e.clientX, y = e.clientY;
      setDrag(d => (d ? { ...d, x, y } : null));
      setOver(findTarget(x, y));
    };

    const up = (e: PointerEvent) => {
      const target = findTarget(e.clientX, e.clientY);
      const cur = dragRef.current;
      if (target && cur) onDropRef.current(target, cur.amount, cur.fromId);
      setDrag(null);
      setOver(null);
    };

    const cancel = () => { setDrag(null); setOver(null); };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [isActive]);

  return { drag, over, startDrag };
}

function DragGhost({ drag }: { drag: DragState | null }) {
  if (!drag) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: drag.x + 14,
        top: drag.y - 18,
        zIndex: 9999,
        pointerEvents: "none",
      }}
      className="rounded-md px-3 py-2 text-sm font-bold tabular-nums shadow-lg border bg-emerald-100 border-emerald-400 text-emerald-900 select-none"
    >
      BND {drag.amount}
    </div>
  );
}

function AmountStepper({
  step = 10,
  onAdjust,
  disabled,
  canSubtract = true,
  maxAdd,
}: {
  step?: number;
  onAdjust: (delta: number) => void;
  disabled?: boolean;
  canSubtract?: boolean;
  maxAdd?: number;
}) {
  const [text, setText] = useState("");

  const commit = () => {
    const v = parseFloat(text);
    if (Number.isFinite(v) && v > 0) {
      const capped = typeof maxAdd === "number" ? Math.min(v, maxAdd) : v;
      onAdjust(capped);
    }
    setText("");
  };

  const subDisabled = disabled || !canSubtract;
  const addDisabled = disabled || (typeof maxAdd === "number" && maxAdd <= 0);

  return (
    <div className="flex items-center gap-1.5 mt-2">
      <button
        type="button"
        aria-label={`Subtract ${step}`}
        disabled={subDisabled}
        onClick={() => onAdjust(-step)}
        className={cn(
          "h-8 w-8 rounded-md border bg-background grid place-items-center text-base font-bold shrink-0 transition",
          subDisabled
            ? "opacity-40 cursor-not-allowed"
            : "hover:bg-accent active:scale-95"
        )}
      >
        −
      </button>
      <div className="flex-1 flex items-center gap-1.5 rounded-md border border-border bg-background px-2 h-8 min-w-0">
        <span className="text-[10px] font-bold text-muted-foreground tracking-wide shrink-0">+ BND</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={text}
          disabled={disabled}
          placeholder="0"
          onChange={e => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="w-full bg-transparent outline-none text-sm font-bold tabular-nums text-right disabled:opacity-50"
        />
      </div>
      <button
        type="button"
        aria-label={`Add ${step}`}
        disabled={addDisabled}
        onClick={() => onAdjust(step)}
        className={cn(
          "h-8 w-8 rounded-md border bg-background grid place-items-center text-base font-bold shrink-0 transition",
          addDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-accent active:scale-95"
        )}
      >
        +
      </button>
    </div>
  );
}

function MoneyChip({ amount, disabled, onPointerDown }: {
  amount: number; disabled: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      onPointerDown={disabled ? undefined : onPointerDown}
      style={{ touchAction: "none" }}
      className={cn(
        "select-none rounded-md px-3 py-2 text-sm font-bold tabular-nums shadow-sm border transition-all",
        "bg-emerald-50 border-emerald-200 text-emerald-800 hover:-translate-y-0.5 active:scale-95",
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-grab active:cursor-grabbing"
      )}
    >
      BND {amount}
    </div>
  );
}

const PULL_AMOUNTS = [1, 3, 5, 10, 25, 50, 100, 250] as const;

function PullChip({
  amount,
  enabled,
  onPointerDown,
}: {
  amount: number;
  enabled: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={enabled ? 0 : -1}
      aria-label={enabled ? `Drag BND ${amount} out of this bucket` : `Not enough to drag BND ${amount}`}
      title={enabled ? `Drag BND ${amount} elsewhere` : `Not enough in this bucket`}
      onPointerDown={enabled ? onPointerDown : undefined}
      style={{ touchAction: "none" }}
      className={cn(
        "select-none rounded-md border px-1.5 py-0.5 text-[11px] font-bold tabular-nums shrink-0 transition-all",
        enabled
          ? "bg-emerald-50 border-emerald-200 text-emerald-800 cursor-grab active:cursor-grabbing hover:-translate-y-0.5 active:scale-95 shadow-sm"
          : "bg-muted/40 border-muted text-muted-foreground/50 cursor-not-allowed opacity-60"
      )}
    >
      −{amount}
    </div>
  );
}

function CollapsibleColumn({
  title,
  subtitle,
  illoSrc,
  iconBg,
  count,
  total,
  children,
}: {
  title: string;
  subtitle: string;
  illoSrc: string;
  iconBg: string;
  count?: number;
  total?: number;
  children: React.ReactNode;
}) {
  const storageKey = `duitplan-budget-col-collapsed:${title}`;
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(storageKey) === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, collapsed ? "1" : "0"); } catch { /* noop */ }
  }, [collapsed, storageKey]);

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        className="w-full flex items-center gap-3 px-1 group text-left"
      >
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
          <img src={illoSrc} className="w-7 h-7 object-contain" alt="" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight truncate">{title}</h3>
            {typeof count === "number" && (
              <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground tabular-nums">
                {count}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {collapsed && typeof total === "number"
              ? <>{fmt(total)} allocated · click to expand</>
              : subtitle}
          </p>
        </div>
        <div className={cn(
          "w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground group-hover:bg-accent/50 transition-transform",
          !collapsed && "rotate-180"
        )}>
          <ChevronDown className="w-4 h-4" />
        </div>
      </button>
      {!collapsed && <div className="space-y-2 animate-in fade-in duration-200">{children}</div>}
    </section>
  );
}

function CustomMoneyChip({ available, value, onChange, onPointerDown }: {
  available: number;
  value: string;
  onChange: (v: string) => void;
  onPointerDown: (amount: number, e: React.PointerEvent) => void;
}) {
  const num = Number(value);
  const valid = Number.isFinite(num) && num > 0;
  const tooMuch = valid && num > available;
  const disabled = !valid || tooMuch;

  return (
    <div
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        if (disabled) return;
        onPointerDown(num, e);
      }}
      style={{ touchAction: "none" }}
      title={tooMuch ? `Only BND ${available.toFixed(2)} left in the bag` : valid ? `Drag BND ${num} onto a bucket` : "Type any amount, then drag"}
      className={cn(
        "flex items-center gap-1 select-none rounded-md border px-2 py-1.5 transition-all",
        disabled
          ? tooMuch
            ? "border-rose-200 bg-rose-50/60 text-rose-700 cursor-not-allowed"
            : "border-dashed border-emerald-300 bg-white/60 text-emerald-700/80 cursor-text"
          : "border-emerald-300 bg-emerald-100 text-emerald-900 cursor-grab active:cursor-grabbing shadow-sm hover:-translate-y-0.5"
      )}
    >
      <span className="text-[11px] font-bold tracking-wide shrink-0">BND</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        placeholder="custom"
        style={{ touchAction: "auto" }}
        className="w-16 bg-transparent outline-none text-sm font-bold tabular-nums placeholder:text-emerald-700/40 placeholder:font-medium"
      />
      {valid && !tooMuch && (
        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60 shrink-0">drag →</span>
      )}
    </div>
  );
}

function BucketRow({
  bucket,
  isOver,
  pulse,
  onChange,
  startPullDrag,
  groupKey,
  isReordering,
  dropPos,
  onStartReorder,
  onDelete,
}: {
  bucket: Bucket;
  isOver: boolean;
  pulse: boolean;
  onChange: (v: number) => void;
  startPullDrag: (amount: number, fromId: string, e: React.PointerEvent) => void;
  groupKey: string;
  isReordering: boolean;
  dropPos: "before" | "after" | null;
  onStartReorder: (e: React.PointerEvent) => void;
  onDelete?: (bucket: Bucket) => void;
}) {
  const { t } = useTranslation();
  const isVault = bucket.kind === "vault";
  const isLoan  = bucket.kind === "loan";
  const isEnv   = bucket.kind === "envelope";

  const spent = bucket.spent ?? 0;
  // Variable envelopes carry an optional `target` (= category defaultBudget).
  // Present → bar measured against target; absent → fallback to depletion bar.
  const isVariableEnv = isEnv && !bucket.fixed;
  const hasTargetBudget = isVariableEnv && bucket.target !== undefined && bucket.target > 0;
  const targetBudget = bucket.target ?? 0;

  // Overspent if past funded amount OR past target budget.
  const overspentEnvelope = isEnv && spent > bucket.allocated &&
    (hasTargetBudget || bucket.allocated > 0);
  const overspentBudget = hasTargetBudget && spent > targetBudget;
  const overspent = overspentEnvelope || overspentBudget;

  const remaining = isEnv ? bucket.allocated - spent : null;
  const denom = bucket.target ?? Math.max(bucket.allocated, 1);

  const vaultPct = Math.min(100, (bucket.allocated / Math.max(denom, 1)) * 100);

  // Tri-segment bar (target-anchored): spent / funded-unspent / unfunded.
  const targetSpentPct = hasTargetBudget ? Math.min(100, (spent / targetBudget) * 100) : 0;
  const targetFundedPct = hasTargetBudget
    ? Math.max(0, Math.min(100 - targetSpentPct, ((bucket.allocated - spent) / targetBudget) * 100))
    : 0;

  // Legacy depletion bar (fixed envelopes / variable without target).
  const envRemainingPct = bucket.allocated > 0
    ? Math.max(0, Math.min(100, (1 - spent / bucket.allocated) * 100))
    : 0;

  const isFunded = !isEnv && bucket.target !== undefined && bucket.allocated >= bucket.target;

  const envFillColor = overspent             ? "bg-rose-300"
                     : envRemainingPct > 50  ? "bg-emerald-500"
                     : envRemainingPct > 25  ? "bg-amber-400"
                     :                         "bg-rose-400";

  const vaultFillColor = isVault ? "bg-amber-400" : "bg-primary";

  const borderState = overspent ? "border-rose-400"
                    : isOver    ? "border-primary ring-2 ring-primary/25"
                    :             "border-border";

  return (
    <div
      data-drop-id={bucket.id}
      data-row-id={bucket.id}
      data-row-group={groupKey}
      className={cn(
        "relative bg-white rounded-xl border p-4 shadow-sm transition-all",
        borderState,
        pulse && "scale-[1.015]",
        isReordering && "opacity-50"
      )}
    >
      {pulse && <div className="absolute inset-0 rounded-xl bg-primary/10 pointer-events-none animate-pulse" />}
      {dropPos === "before" && (
        <div className="absolute -top-1 left-2 right-2 h-0.5 bg-primary rounded-full pointer-events-none" />
      )}
      {dropPos === "after" && (
        <div className="absolute -bottom-1 left-2 right-2 h-0.5 bg-primary rounded-full pointer-events-none" />
      )}

      <div className="flex items-start gap-2">
        <button
          type="button"
          onPointerDown={onStartReorder}
          aria-label={`Drag ${bucket.name} to reorder`}
          title="Drag to reorder"
          style={{ touchAction: "none" }}
          className="-ml-1 self-stretch flex items-center justify-center px-0.5 text-muted-foreground/40 hover:text-foreground cursor-grab active:cursor-grabbing select-none"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <img
          src={isVault ? "/illustration-vault.png" : isLoan ? "/illustration-bank.png" : "/illustration-payslip.png"}
          className="w-9 h-9 object-contain shrink-0"
          alt=""
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold truncate">{bucket.name}</span>
            <div className="flex items-center gap-1">
              {bucket.fixed && <Badge variant="outline" className="text-[10px] py-0 h-4">fixed</Badge>}
              {bucket.auto && <Badge variant="outline" className="text-[10px] py-0 h-4">auto</Badge>}
              {isFunded && <Badge className="text-[10px] py-0 h-4 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">funded</Badge>}
              {overspent && <Badge variant="destructive" className="text-[10px] py-0 h-4">over</Badge>}
              {bucket.isDeletable && onDelete && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(bucket); }}
                  aria-label={`Delete ${bucket.name}`}
                  title="Delete envelope"
                  className="text-muted-foreground/50 hover:text-rose-600 transition-colors p-0.5 -m-0.5 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-lg font-bold tabular-nums">{fmt(bucket.allocated)}</span>
            {isEnv && hasTargetBudget ? (
              <span className={cn(
                "text-xs tabular-nums",
                overspent ? "text-rose-600 font-semibold" : "text-muted-foreground"
              )}>
                {`${fmt(spent)} spent · ${fmt(targetBudget)} target`}
              </span>
            ) : isEnv && remaining !== null ? (
              <span className={cn(
                "text-xs tabular-nums",
                overspent ? "text-rose-600 font-semibold" : "text-muted-foreground"
              )}>
                {overspent ? `${fmt(spent - bucket.allocated)} over`
                           : `${fmt(remaining)} left`}
              </span>
            ) : null}
            {!isEnv && bucket.target !== undefined && (
              <span className="text-xs text-muted-foreground tabular-nums">
                of {fmt(bucket.target)}{isVault ? " goal" : ""}
              </span>
            )}
          </div>

          {isLoan ? (
            <>
              <MinPaymentBar paid={bucket.allocated} minimum={bucket.target ?? 0} className="mt-2" />
              <div className="text-[10px] text-muted-foreground mt-1 tabular-nums flex items-center justify-between gap-2">
                <span>min {fmt(bucket.target ?? 0)}/mo · paying {fmt(bucket.allocated)}</span>
                {bucket.target !== undefined && bucket.allocated > bucket.target ? (
                  <span className="text-emerald-700 font-semibold">
                    −{Math.max(1, Math.round((bucket.allocated - bucket.target) / 50))} mo on tail
                  </span>
                ) : (
                  <span>add to shorten loan</span>
                )}
              </div>
            </>
          ) : isEnv ? (
            <>
              {hasTargetBudget ? (
                <>
                  {/* Tri-segment target-anchored bar (variable envelopes with a
                      defaultBudget set on /categories). Bar width = target.
                        ▰ solid green / rose  — already spent
                        ▱ lighter green       — funded but unspent (still in envelope)
                        ░ muted               — unfunded headroom toward the target
                  */}
                  <div className={cn(
                    "h-1.5 rounded-full mt-2 overflow-hidden flex",
                    overspent ? "bg-rose-100" : "bg-muted"
                  )}>
                    {targetSpentPct > 0 && (
                      <div
                        className={cn(
                          "h-full transition-all",
                          overspent ? "bg-rose-500" : "bg-emerald-500"
                        )}
                        style={{ width: `${targetSpentPct}%` }}
                      />
                    )}
                    {targetFundedPct > 0 && !overspent && (
                      <div
                        className="h-full transition-all bg-emerald-200"
                        style={{ width: `${targetFundedPct}%` }}
                      />
                    )}
                  </div>
                  <p className={cn(
                    "text-[10px] mt-1 tabular-nums",
                    overspent ? "text-rose-600 font-semibold" : "text-muted-foreground"
                  )}>
                    {overspentBudget
                      ? `${fmt(spent - targetBudget)} over budget · ${fmt(spent)} spent of ${fmt(targetBudget)}`
                      : overspentEnvelope
                      ? `${fmt(spent)} spent · envelope empty (${fmt(spent - bucket.allocated)} past funded) · ${fmt(Math.max(0, targetBudget - spent))} left to target`
                      : `${fmt(spent)} spent · ${fmt(Math.max(0, bucket.allocated - spent))} left in envelope · ${fmt(Math.max(0, targetBudget - bucket.allocated))} unfunded`}
                  </p>
                </>
              ) : (
                <>
                  {/* Legacy depletion bar — fixed envelopes (no spend tracking
                      against commitments) AND variable envelopes with no
                      defaultBudget set. Starts FULL and shrinks as money is
                      spent. */}
                  <div className={cn("h-1.5 rounded-full mt-2 overflow-hidden", overspent ? "bg-rose-100" : "bg-muted")}>
                    <div
                      className={cn("h-full rounded-full transition-all", envFillColor)}
                      style={{ width: `${envRemainingPct}%` }}
                    />
                  </div>
                  {bucket.fixed ? (
                    <p className="text-[10px] mt-1 tabular-nums text-muted-foreground">
                      fixed monthly · {fmt(bucket.allocated)} reserved
                    </p>
                  ) : bucket.allocated > 0 ? (
                    <p className={cn("text-[10px] mt-1 tabular-nums", overspent ? "text-rose-600 font-semibold" : "text-muted-foreground")}>
                      {overspent
                        ? `${fmt(spent - bucket.allocated)} over · envelope empty`
                        : `${fmt(Math.max(0, bucket.allocated - spent))} left of ${fmt(bucket.allocated)}`}
                    </p>
                  ) : null}
                </>
              )}
            </>
          ) : (
            <>
              {/* Vault: bar fills as you save toward the goal. */}
              <div className="h-1.5 rounded-full mt-2 overflow-hidden bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", vaultFillColor)}
                  style={{ width: `${vaultPct}%` }}
                />
              </div>
            </>
          )}

          {/* Stepper: type or step the amount you want to ADD to this bucket.
              Default is 0 — never the current allocation. Loans can't shrink
              below their minimum payment. */}
          {!bucket.fixed && (() => {
            const minVal = isLoan ? (bucket.target ?? 0) : 0;
            return (
              <AmountStepper
                step={isLoan ? 50 : isVault ? 50 : 10}
                canSubtract={bucket.allocated > minVal}
                onAdjust={(delta) => onChange(Math.max(minVal, bucket.allocated + delta))}
              />
            );
          })()}

          {/* Pull-chips rail — drag any chip onto another bucket (or the bag)
              to physically move money out of this one. Available on every
              bucket with a positive allocation: loans (above the min payment),
              envelopes, fixed commitments, and vaults (vault drag triggers
              the unlock-confirmation modal). Fixed commitments are global,
              so editing them changes every month — that caveat is shown in
              the bucket subtitle above. */}
          {bucket.allocated > 0 && (() => {
            const minVal = isLoan ? (bucket.target ?? 0) : 0;
            const headroom = Math.max(0, bucket.allocated - minVal);
            if (headroom <= 0) return null;
            return (
              <div className="mt-3 pt-3 border-t border-dashed border-border">
                <div className="flex items-start gap-1 mb-1.5">
                  <RotateCcw className="w-3 h-3 text-muted-foreground shrink-0 mt-px" />
                  <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground leading-tight break-words min-w-0">
                    {bucket.fixed
                      ? t("budgets.pullChip.dragOutFixed")
                      : t("budgets.pullChip.dragOut")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {PULL_AMOUNTS.map(amt => (
                    <PullChip
                      key={amt}
                      amount={amt}
                      enabled={amt <= headroom}
                      onPointerDown={(e) => startPullDrag(amt, bucket.id, e)}
                    />
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function VaultUnlockModal({
  amount, onConfirm, onCancel,
}: {
  amount: number;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.40)" }}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl border shadow-xl max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-lg font-semibold">Take money out of your vault?</p>
            <p className="text-sm text-muted-foreground mt-1">
              Vaults are for long-term goals. Pulling {fmt(amount)} out will set you back. Tell us why — it'll be logged.
            </p>
          </div>
          <button onClick={onCancel} className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Car broke down, need to cover repair this month."
          className="w-full p-3 rounded-md border text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button
            size="sm"
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason)}
          >
            Confirm — take it out
          </Button>
        </div>
      </div>
    </div>
  );
}

function AllocateView({
  month,
  monthLabel,
  availablePool,
  accountCount,
  commitments,
  debts,
  categories,
  goals,
  budgetMap,
  upsert,
  updateGoal,
  updateCommitment,
  refetch,
  refetchGoals,
  refetchCommitments,
  onTrialExpired,
  resetSignal,
}: {
  month: string;
  monthLabel: string;
  availablePool: number;
  accountCount: number;
  commitments: Array<{ id: string; label: string; amount: string }>;
  debts: Debt[];
  categories: Array<{ id: string; name: string; kind: string; defaultBudget?: string; isDefault?: boolean }>;
  goals: Goal[];
  budgetMap: Record<string, { categoryId: string; plannedAmount?: string; actualAmount?: string }>;
  upsert: ReturnType<typeof useUpsertBudget>;
  updateGoal: ReturnType<typeof useUpdateGoal>;
  updateCommitment: ReturnType<typeof useUpdateCommitment>;
  refetch: () => void;
  refetchGoals: () => void;
  refetchCommitments: () => void;
  onTrialExpired: () => void;
  resetSignal: number;
}) {
  const expenseCats = useMemo(() => categories.filter(c => c.kind === "expense"), [categories]);

  const deleteCategory = useDeleteCategory();
  const deleteCommitment = useDeleteCommitment();

  const handleDeleteBucket = useCallback(async (bucket: Bucket) => {
    const [prefix, rawId] = bucket.id.split(":");
    if (!rawId) return;
    if (prefix === "E") {
      const ok = window.confirm(
        `Delete envelope "${bucket.name}"?\n\nExisting transactions and budgets in this category will become uncategorized. This cannot be undone.`
      );
      if (!ok) return;
      try {
        await deleteCategory.mutateAsync({ id: rawId });
        refetch();
      } catch (err) {
        if (isTrialExpiredError(err)) { onTrialExpired(); return; }
        window.alert(err instanceof Error ? err.message : "Failed to delete envelope");
      }
    } else if (prefix === "F") {
      const ok = window.confirm(
        `Delete fixed commitment "${bucket.name}"?\n\nThis cannot be undone.`
      );
      if (!ok) return;
      try {
        await deleteCommitment.mutateAsync({ id: rawId });
        refetchCommitments();
      } catch (err) {
        if (isTrialExpiredError(err)) { onTrialExpired(); return; }
        window.alert(err instanceof Error ? err.message : "Failed to delete commitment");
      }
    }
  }, [deleteCategory, deleteCommitment, refetch, refetchCommitments, onTrialExpired]);

  const initialBuckets: Bucket[] = useMemo(() => {
    const loans: Bucket[] = debts.map(d => ({
      id: `L:${d.id}`,
      name: d.lender,
      kind: "loan",
      allocated: safeNum(d.monthlyPayment),
      target: safeNum(d.monthlyPayment),
      auto: true,
    }));
    const fixedEnvelopes: Bucket[] = commitments.map(c => ({
      id: `F:${c.id}`,
      name: c.label,
      kind: "envelope",
      allocated: safeNum(c.amount),
      target: safeNum(c.amount),
      fixed: true,
      isDeletable: true,
    }));
    const variableEnvelopes: Bucket[] = expenseCats.map(cat => {
      const b = budgetMap[cat.id];
      const tgt = safeNum(cat.defaultBudget);
      return {
        id: `E:${cat.id}`,
        name: cat.name,
        kind: "envelope",
        allocated: safeNum(b?.plannedAmount),
        spent: safeNum(b?.actualAmount),
        target: tgt > 0 ? tgt : undefined,
        isDeletable: !cat.isDefault,
      };
    });
    // Vaults sourced from /goals — `allocated` mirrors goal.savedAmount.
    const vaults: Bucket[] = goals.map(g => ({
      id: `V:${g.id}`,
      name: g.title,
      kind: "vault",
      allocated: safeNum(g.savedAmount),
      target: safeNum(g.targetAmount),
    }));

    return [...loans, ...fixedEnvelopes, ...variableEnvelopes, ...vaults];
  }, [debts, commitments, expenseCats, goals, budgetMap]);

  const [buckets, setBuckets] = useState<Bucket[]>(initialBuckets);
  const [overTarget, setOverTarget] = useState<string | null>(null);
  const [pulse, setPulse] = useState<string | null>(null);
  const [vaultUnlock, setVaultUnlock] = useState<{ fromId: string; toId: string; amount: number } | null>(null);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [bagOver, setBagOver] = useState(false);

  useEffect(() => { setBuckets(initialBuckets); }, [initialBuckets, resetSignal]);

  // -------- Manual bucket reordering ---------------------------------------
  // The user drags a bucket card by its left-side handle to move it up/down
  // *within its column* (loan / fixed-envelope / variable-envelope / vault).
  // The chosen order is persisted to localStorage so refetches and reloads
  // never auto-shuffle the columns.
  const ORDER_KEY = "duitplan:budgetBucketOrder:v1";
  const [bucketOrder, setBucketOrder] = useState<Record<string, string[]>>(() => {
    try {
      const raw = localStorage.getItem(ORDER_KEY);
      return raw ? (JSON.parse(raw) ?? {}) : {};
    } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(bucketOrder)); } catch { /* noop */ }
  }, [bucketOrder]);

  type RowDrag = { id: string; group: string };
  type RowOver = { id: string; pos: "before" | "after" };
  const [rowDrag, setRowDrag] = useState<RowDrag | null>(null);
  const [rowOver, setRowOver] = useState<RowOver | null>(null);
  const rowDragRef = useRef<RowDrag | null>(null);
  const rowOverRef = useRef<RowOver | null>(null);
  const bucketsRef = useRef<Bucket[]>(buckets);
  useEffect(() => { rowDragRef.current = rowDrag; }, [rowDrag]);
  useEffect(() => { rowOverRef.current = rowOver; }, [rowOver]);
  useEffect(() => { bucketsRef.current = buckets; }, [buckets]);

  const bucketGroupKey = (b: Bucket): string => {
    if (b.kind === "loan") return "loan";
    if (b.kind === "vault") return "vault";
    return b.fixed ? "envFixed" : "envVar";
  };

  const applyRowDrop = useCallback(
    (groupKey: string, draggedId: string, targetId: string, pos: "before" | "after") => {
      setBucketOrder(prev => {
        const groupItems = bucketsRef.current.filter(b => bucketGroupKey(b) === groupKey);
        const sorted = sortByOrder(groupItems, prev[groupKey] ?? []).map(b => b.id);
        const without = sorted.filter(id => id !== draggedId);
        const targetIdx = without.indexOf(targetId);
        if (targetIdx < 0) return prev;
        const insertAt = pos === "after" ? targetIdx + 1 : targetIdx;
        const next = [...without.slice(0, insertAt), draggedId, ...without.slice(insertAt)];
        return { ...prev, [groupKey]: next };
      });
    },
    []
  );

  const startRowDrag = useCallback(
    (id: string, group: string) => (e: React.PointerEvent) => {
      // Stop chip-drag and click-through on inputs / buttons inside the card.
      e.preventDefault();
      e.stopPropagation();
      setRowDrag({ id, group });
      setRowOver(null);
    },
    []
  );

  // Global pointer listeners while a row is being dragged. Mirrors the
  // pattern used by `usePointerDrag` above so we don't fight React's event
  // batching when the pointer leaves the originating element.
  const rowDragActive = !!rowDrag;
  useEffect(() => {
    if (!rowDragActive) return;

    const move = (e: PointerEvent) => {
      const grp = rowDragRef.current?.group;
      const dragId = rowDragRef.current?.id;
      if (!grp || !dragId) return;
      const els = document.elementsFromPoint(e.clientX, e.clientY);
      let found: RowOver | null = null;
      for (const el of els) {
        const node = el as HTMLElement;
        const elId = node.getAttribute?.("data-row-id");
        const elGrp = node.getAttribute?.("data-row-group");
        if (elId && elGrp === grp && elId !== dragId) {
          const rect = node.getBoundingClientRect();
          const mid = rect.top + rect.height / 2;
          found = { id: elId, pos: e.clientY < mid ? "before" : "after" };
          break;
        }
      }
      setRowOver(found);
    };
    const up = () => {
      const d = rowDragRef.current;
      const o = rowOverRef.current;
      if (d && o && o.id !== d.id) {
        applyRowDrop(d.group, d.id, o.id, o.pos);
      }
      setRowDrag(null);
      setRowOver(null);
    };
    const cancel = () => { setRowDrag(null); setRowOver(null); };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [rowDragActive, applyRowDrop]);

  const totalIncome = availablePool;
  const allocated = buckets.reduce((s, b) => s + b.allocated, 0);
  const available = totalIncome - allocated;
  const pctAlloc = totalIncome > 0 ? Math.min(100, (allocated / totalIncome) * 100) : 0;

  const flashPulse = (id: string) => {
    setPulse(id);
    setTimeout(() => setPulse(null), 350);
  };

  const persistEnvelope = async (categoryId: string, amount: number) => {
    try {
      await upsert.mutateAsync({
        data: { categoryId, month, plannedAmount: amount.toFixed(2) },
      });
      refetch();
    } catch (err) {
      if (isTrialExpiredError(err)) onTrialExpired();
    }
  };

  // Vault adjustments persist as goal.savedAmount via useUpdateGoal.
  const persistGoal = async (goalId: string, savedAmount: number) => {
    try {
      await updateGoal.mutateAsync({
        id: goalId,
        data: { savedAmount: savedAmount.toFixed(2) },
      });
      refetchGoals();
    } catch (err) {
      if (isTrialExpiredError(err)) onTrialExpired();
    }
  };

  // Fixed envelopes are backed by Commitments (global, not per-month).
  const persistCommitment = async (commitmentId: string, amount: number) => {
    try {
      await updateCommitment.mutateAsync({
        id: commitmentId,
        data: { amount: amount.toFixed(2) },
      });
      refetchCommitments();
    } catch (err) {
      if (isTrialExpiredError(err)) onTrialExpired();
    }
  };

  const updateBucket = (id: string, delta: number) => {
    setBuckets(prev => {
      const next = prev.map(b => b.id === id ? { ...b, allocated: Math.max(0, b.allocated + delta) } : b);
      const target = next.find(b => b.id === id);
      if (target && id.startsWith("E:")) {
        const catId = id.slice(2);
        persistEnvelope(catId, target.allocated);
      }
      if (target && id.startsWith("F:")) {
        const commitmentId = id.slice(2);
        persistCommitment(commitmentId, target.allocated);
      }
      if (target && id.startsWith("V:")) {
        const goalId = id.slice(2);
        persistGoal(goalId, target.allocated);
      }
      return next;
    });
    flashPulse(id);
  };

  const setBucket = (id: string, value: number) => {
    setBuckets(prev => {
      const next = prev.map(b => b.id === id ? { ...b, allocated: value } : b);
      if (id.startsWith("E:")) {
        const catId = id.slice(2);
        persistEnvelope(catId, value);
      } else if (id.startsWith("F:")) {
        const commitmentId = id.slice(2);
        persistCommitment(commitmentId, value);
      } else if (id.startsWith("V:")) {
        const goalId = id.slice(2);
        persistGoal(goalId, value);
      }
      return next;
    });
  };

  // Drop targets are identified by `data-drop-id`:
  //   "BAG"  → the money bag (deallocate)
  //   "L:…"  → loan bucket
  //   "E:…"  → envelope bucket
  //   "F:…"  → fixed envelope bucket (commitment)
  //   "V:…"  → vault bucket (goal)
  const handleDrop = useCallback(
    (targetId: string, amount: number, fromId?: string) => {
      if (targetId === "BAG") {
        if (!fromId) return; // dropping a fresh chip onto the bag is a no-op
        if (fromId.startsWith("V:")) {
          setVaultUnlock({ fromId, toId: "__BAG__", amount });
          return;
        }
        updateBucket(fromId, -amount);
        return;
      }

      if (fromId && fromId.startsWith("V:") && fromId !== targetId) {
        setVaultUnlock({ fromId, toId: targetId, amount });
        return;
      }

      if (!fromId && available < amount) return;

      if (fromId) updateBucket(fromId, -amount);
      updateBucket(targetId, amount);
    },
    [available, updateBucket]
  );

  const { drag, over: overTargetPtr, startDrag } = usePointerDrag(handleDrop);
  useEffect(() => { setOverTarget(overTargetPtr); }, [overTargetPtr]);
  useEffect(() => { setBagOver(overTargetPtr === "BAG" && !!drag?.fromId); }, [overTargetPtr, drag]);

  const startChipDrag = useCallback(
    (amount: number) => (e: React.PointerEvent) => {
      if (available < amount) return;
      startDrag(amount, undefined, e);
    },
    [available, startDrag]
  );

  const confirmVaultUnlock = (_reason: string) => {
    if (!vaultUnlock) return;
    updateBucket(vaultUnlock.fromId, -vaultUnlock.amount);
    if (vaultUnlock.toId !== "__BAG__") {
      updateBucket(vaultUnlock.toId, vaultUnlock.amount);
    }
    // TODO: POST reason to /api/vault-unlocks for audit log when endpoint exists
    setVaultUnlock(null);
  };

  const reset = () => setBuckets(initialBuckets);

  const loanBuckets = sortByOrder(
    buckets.filter(b => b.kind === "loan"),
    bucketOrder.loan ?? []
  );
  const envBuckets  = buckets.filter(b => b.kind === "envelope");
  const fixedEnvBuckets = sortByOrder(
    envBuckets.filter(b => b.fixed),
    bucketOrder.envFixed ?? []
  );
  const variableEnvBuckets = sortByOrder(
    envBuckets.filter(b => !b.fixed),
    bucketOrder.envVar ?? []
  );
  const vaultBuckets = sortByOrder(
    buckets.filter(b => b.kind === "vault"),
    bucketOrder.vault ?? []
  );

  return (
    <div className="space-y-5">
      {/* Available strip with MoneyBag */}
      <div className={cn(
        "rounded-xl p-5 border-2",
        available < 0 ? "bg-red-50 border-red-300" : "bg-primary/5 border-primary/30"
      )}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex-1 min-w-0">
            <span className={cn(
              "text-xs font-semibold uppercase tracking-wider",
              available < 0 ? "text-red-700" : "text-primary"
            )}>
              Available to allocate
            </span>
            <div className="flex items-baseline gap-3 mt-1 flex-wrap">
              <span className={cn(
                "text-4xl font-bold tabular-nums",
                available < 0 ? "text-red-700" : "text-primary"
              )}>
                {available < 0 ? "−" : ""}{fmt(Math.abs(available))}
              </span>
              <span className="text-sm text-muted-foreground">
                of {fmt(totalIncome)} across {accountCount} account{accountCount === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden w-full lg:w-96">
              <div
                className={cn("h-full rounded-full transition-all", available < 0 ? "bg-red-500" : "bg-primary")}
                style={{ width: `${pctAlloc}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">
              {fmt(allocated)} allocated · {Math.round(pctAlloc)}%
            </p>
          </div>

          {/* Drop-back money bag */}
          <div className="shrink-0">
            <MoneyBag
              available={available}
              total={totalIncome}
              isOver={bagOver}
              dropId="BAG"
            />
          </div>

          <div className="flex flex-col gap-2 max-w-md">
            <span className="text-xs text-muted-foreground font-medium">
              Drag a chip onto any bucket below, or use the +/− on each bucket ↓
            </span>
            <div className="flex flex-wrap gap-2">
              {CHIP_AMOUNTS.map(amt => (
                <MoneyChip
                  key={amt}
                  amount={amt}
                  disabled={available < amt}
                  onPointerDown={startChipDrag(amt)}
                />
              ))}
              <CustomMoneyChip
                available={available}
                value={customAmount}
                onChange={setCustomAmount}
                onPointerDown={(amt, e) => startDrag(amt, undefined, e)}
              />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Button variant="ghost" size="sm" onClick={reset} className="text-xs gap-1">
                <RotateCcw className="w-3 h-3" /> Reset
              </Button>
              <div className="flex items-center gap-2">
                {available < 0 && (
                  <span className="text-xs text-red-600 font-medium">
                    Over by {fmt(Math.abs(available))}
                  </span>
                )}
                <ConfirmAllocationButton available={available} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bank empty-state banner — shown above the grid when no debts */}
      {loanBuckets.length === 0 && (
        <div className="rounded-lg border border-dashed bg-accent/30 px-5 py-3 flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">No loans tracked yet — add your financing on the Debts page to see repayments here.</span>
          <a href="/debts" className="text-primary text-xs font-semibold underline underline-offset-2 shrink-0">Go to Debts →</a>
        </div>
      )}

      {/* Three columns (collapses to 2-col when no debts) */}
      <div className={cn("grid gap-5", loanBuckets.length > 0 ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
        {/* Bank / loans — only shown when debts exist */}
        {loanBuckets.length > 0 && (
        <CollapsibleColumn
          title="Bank"
          subtitle="Loan repayments — auto on Hari Gaji"
          illoSrc="/illustration-bank.png"
          iconBg="bg-rose-50"
          count={loanBuckets.length}
          total={loanBuckets.reduce((s, b) => s + b.allocated, 0)}
        >
          {loanBuckets.map(b => (
            <BucketRow
              key={b.id}
              bucket={b}
              isOver={overTarget === b.id}
              pulse={pulse === b.id}
              onChange={(v) => setBucket(b.id, v)}
              startPullDrag={startDrag}
              groupKey="loan"
              isReordering={rowDrag?.id === b.id}
              dropPos={rowOver?.id === b.id ? rowOver.pos : null}
              onStartReorder={startRowDrag(b.id, "loan")}
              onDelete={handleDeleteBucket}
            />
          ))}
        </CollapsibleColumn>
        )}

        {/* Expenses (Fixed + Variable) */}
        <CollapsibleColumn
          title="Expenses"
          subtitle="Fixed commitments & variable spending"
          illoSrc="/illustration-payslip.png"
          iconBg="bg-primary/10"
          count={envBuckets.length}
          total={envBuckets.reduce((s, b) => s + b.allocated, 0)}
        >
          {fixedEnvBuckets.length > 0 && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-1">Fixed</p>
              {fixedEnvBuckets.map(b => (
                <BucketRow
                  key={b.id}
                  bucket={b}
                  isOver={overTarget === b.id}
                  pulse={pulse === b.id}
                  onChange={(v) => setBucket(b.id, v)}
                  startPullDrag={startDrag}
                  groupKey="envFixed"
                  isReordering={rowDrag?.id === b.id}
                  dropPos={rowOver?.id === b.id ? rowOver.pos : null}
                  onStartReorder={startRowDrag(b.id, "envFixed")}
                  onDelete={handleDeleteBucket}
                />
              ))}
            </>
          )}
          {fixedEnvBuckets.length > 0 && (
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-1">Variable</p>
          )}
          {variableEnvBuckets.length === 0 && (
            <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
              No variable expense categories yet.
            </div>
          )}
          {variableEnvBuckets.map(b => (
            <BucketRow
              key={b.id}
              bucket={b}
              isOver={overTarget === b.id}
              pulse={pulse === b.id}
              onChange={(v) => setBucket(b.id, v)}
              startPullDrag={startDrag}
              groupKey="envVar"
              isReordering={rowDrag?.id === b.id}
              dropPos={rowOver?.id === b.id ? rowOver.pos : null}
              onStartReorder={startRowDrag(b.id, "envVar")}
              onDelete={handleDeleteBucket}
            />
          ))}
        </CollapsibleColumn>

        {/* Vault */}
        <CollapsibleColumn
          title="Vault"
          subtitle="Long-term goals — friction-locked"
          illoSrc="/illustration-vault.png"
          iconBg="bg-amber-50"
          count={vaultBuckets.length}
          total={vaultBuckets.reduce((s, b) => s + b.allocated, 0)}
        >
          {vaultBuckets.length === 0 && (
            <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
              No goals yet —{" "}
              <a href="/goals" className="text-primary font-semibold underline underline-offset-2">
                head to Goals
              </a>{" "}
              to add your first long-term savings target. Each goal you create
              will appear here as a vault.
            </div>
          )}
          {vaultBuckets.map(b => (
            <BucketRow
              key={b.id}
              bucket={b}
              isOver={overTarget === b.id}
              pulse={pulse === b.id}
              onChange={(v) => setBucket(b.id, v)}
              startPullDrag={startDrag}
              groupKey="vault"
              isReordering={rowDrag?.id === b.id}
              dropPos={rowOver?.id === b.id ? rowOver.pos : null}
              onStartReorder={startRowDrag(b.id, "vault")}
              onDelete={handleDeleteBucket}
            />
          ))}
        </CollapsibleColumn>
      </div>

      {/* Floating ghost that follows the pointer while dragging */}
      <DragGhost drag={drag} />

      {vaultUnlock && (
        <VaultUnlockModal
          amount={vaultUnlock.amount}
          onConfirm={confirmVaultUnlock}
          onCancel={() => setVaultUnlock(null)}
        />
      )}

    </div>
  );
}

function ConfirmAllocationButton({ available }: { available: number }) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <Button
      size="sm"
      disabled={available < 0}
      onClick={() => { setConfirmed(true); setTimeout(() => setConfirmed(false), 3000); }}
      className={confirmed ? "bg-emerald-600 hover:bg-emerald-600" : ""}
    >
      <Check className="w-3.5 h-3.5 mr-1" />
      {confirmed ? "Allocation saved!" : "Confirm allocation"}
    </Button>
  );
}

function AnnualView({
  year, salary, commitments, categories,
}: {
  year: number;
  salary: number;
  commitments: Array<{ id: string; label: string; amount: string }>;
  categories: Array<{ id: string; name: string; kind: string }>;
}) {
  const months = MONTH_LABELS.map((_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const expenseCats = categories.filter(c => c.kind === "expense");

  const b = [
    useListBudgets({ month: months[0] }),  useListBudgets({ month: months[1] }),
    useListBudgets({ month: months[2] }),  useListBudgets({ month: months[3] }),
    useListBudgets({ month: months[4] }),  useListBudgets({ month: months[5] }),
    useListBudgets({ month: months[6] }),  useListBudgets({ month: months[7] }),
    useListBudgets({ month: months[8] }),  useListBudgets({ month: months[9] }),
    useListBudgets({ month: months[10] }), useListBudgets({ month: months[11] }),
  ];

  const budgetMaps = b.map(q =>
    Object.fromEntries((q.data ?? []).map((bud: { categoryId: string; plannedAmount?: string; actualAmount?: string }) => [bud.categoryId, bud]))
  );

  const totalFixedYear = commitments.reduce((s, c) => s + parseFloat(c.amount), 0) * 12;
  const catTotals = expenseCats.map(cat => ({
    id: cat.id,
    total: budgetMaps.reduce((s, bm) => s + parseFloat(bm[cat.id]?.plannedAmount ?? "0"), 0),
  }));
  const totalVariableYear = catTotals.reduce((s, c) => s + c.total, 0);
  const totalIncomeYear = salary * 12;
  const totalPoolYear = totalIncomeYear - totalFixedYear - totalVariableYear;

  const cellCls = "text-right px-3 py-2 text-xs font-mono text-foreground whitespace-nowrap min-w-[90px]";
  const zeroCls = "text-muted-foreground/50";

  return (
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-800 text-white">
            <th className="sticky left-0 z-10 bg-gray-800 text-left px-4 py-3 text-xs font-bold uppercase tracking-wider min-w-[180px] border-r border-gray-600">Cash Flow Report</th>
            {MONTH_LABELS.map(m => <th key={m} className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-center min-w-[90px]">{m}</th>)}
            <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-center min-w-[100px] bg-gray-700">Annual Total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="bg-emerald-700 text-white">
            <td className="sticky left-0 z-10 bg-emerald-700 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-r border-emerald-600">Net Income</td>
            {MONTH_LABELS.map((_, i) => <td key={i} className="px-3 py-2" />)}
            <td className="px-3 py-2" />
          </tr>
          <tr className="hover:bg-gray-50 border-b border-gray-100">
            <td className="sticky left-0 z-10 bg-white hover:bg-gray-50 px-4 py-2 text-xs font-medium border-r border-gray-100 pl-6">Salary / Gaji</td>
            {MONTH_LABELS.map((_, i) => <td key={i} className={cellCls}><span className="text-emerald-700">{fmtShort(salary)}</span></td>)}
            <td className={cn(cellCls, "bg-emerald-50 font-bold text-emerald-800")}>{fmtShort(totalIncomeYear)}</td>
          </tr>
          <tr className="bg-emerald-50 border-b-2 border-emerald-200">
            <td className="sticky left-0 z-10 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 border-r border-emerald-200">Total Net Income</td>
            {MONTH_LABELS.map((_, i) => <td key={i} className={cn(cellCls, "font-bold text-emerald-800")}>{fmtShort(salary)}</td>)}
            <td className={cn(cellCls, "font-bold text-emerald-800 bg-emerald-100")}>{fmtShort(totalIncomeYear)}</td>
          </tr>

          <tr className="bg-orange-700 text-white">
            <td className="sticky left-0 z-10 bg-orange-700 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-r border-orange-600">Fixed Commitments</td>
            {MONTH_LABELS.map((_, i) => <td key={i} className="px-3 py-2" />)}
            <td className="px-3 py-2" />
          </tr>
          {commitments.length === 0 && (
            <tr className="border-b border-gray-100"><td colSpan={14} className="px-4 py-3 text-xs text-muted-foreground">No commitments added yet.</td></tr>
          )}
          {commitments.map((c, idx) => (
            <tr key={c.id} className={cn("border-b border-gray-100 hover:bg-gray-50", idx % 2 === 1 && "bg-gray-50/50")}>
              <td className="sticky left-0 z-10 bg-white hover:bg-gray-50 px-4 py-2 text-xs font-medium border-r border-gray-100 pl-6"
                  style={{ background: idx % 2 === 1 ? "rgb(249 250 251 / 0.5)" : "white" }}>{c.label}</td>
              {MONTH_LABELS.map((_, i) => <td key={i} className={cellCls}><span className="text-orange-700">{fmtShort(parseFloat(c.amount))}</span></td>)}
              <td className={cn(cellCls, "bg-orange-50 font-semibold text-orange-800")}>{fmtShort(parseFloat(c.amount) * 12)}</td>
            </tr>
          ))}
          <tr className="bg-orange-50 border-b-2 border-orange-200">
            <td className="sticky left-0 z-10 bg-orange-50 px-4 py-2 text-xs font-bold text-orange-800 border-r border-orange-200">Total Fixed</td>
            {MONTH_LABELS.map((_, i) => <td key={i} className={cn(cellCls, "font-bold text-orange-800")}>{fmtShort(commitments.reduce((s, c) => s + parseFloat(c.amount), 0))}</td>)}
            <td className={cn(cellCls, "font-bold text-orange-800 bg-orange-100")}>{fmtShort(totalFixedYear)}</td>
          </tr>

          <tr className="bg-blue-700 text-white">
            <td className="sticky left-0 z-10 bg-blue-700 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-r border-blue-600">Variable Budgets</td>
            {MONTH_LABELS.map((_, i) => <td key={i} className="px-3 py-2" />)}
            <td className="px-3 py-2" />
          </tr>
          {expenseCats.map((cat, idx) => {
            const yearTotal = budgetMaps.reduce((s, bm) => s + parseFloat(bm[cat.id]?.plannedAmount ?? "0"), 0);
            return (
              <tr key={cat.id} className={cn("border-b border-gray-100 hover:bg-gray-50", idx % 2 === 1 && "bg-gray-50/50")}>
                <td className="sticky left-0 z-10 px-4 py-2 text-xs font-medium border-r border-gray-100 pl-6"
                    style={{ background: idx % 2 === 1 ? "rgb(249 250 251 / 0.5)" : "white" }}>{cat.name}</td>
                {budgetMaps.map((bm, i) => {
                  const planned = parseFloat(bm[cat.id]?.plannedAmount ?? "0");
                  return <td key={i} className={cn(cellCls, planned === 0 && zeroCls)}>{planned === 0 ? "—" : fmtShort(planned)}</td>;
                })}
                <td className={cn(cellCls, "bg-blue-50 font-semibold text-blue-800", yearTotal === 0 && zeroCls)}>
                  {yearTotal === 0 ? "—" : fmtShort(yearTotal)}
                </td>
              </tr>
            );
          })}
          <tr className="bg-blue-50 border-b-2 border-blue-200">
            <td className="sticky left-0 z-10 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-800 border-r border-blue-200">Total Variable</td>
            {budgetMaps.map((bm, i) => {
              const monthTotal = expenseCats.reduce((s, cat) => s + parseFloat(bm[cat.id]?.plannedAmount ?? "0"), 0);
              return <td key={i} className={cn(cellCls, "font-bold text-blue-800")}>{monthTotal === 0 ? <span className={zeroCls}>—</span> : fmtShort(monthTotal)}</td>;
            })}
            <td className={cn(cellCls, "font-bold text-blue-800 bg-blue-100")}>{fmtShort(totalVariableYear)}</td>
          </tr>

          {(() => {
            const monthPools = budgetMaps.map(bm => {
              const varTotal = expenseCats.reduce((s, cat) => s + parseFloat(bm[cat.id]?.plannedAmount ?? "0"), 0);
              const fixedTotal = commitments.reduce((s, c) => s + parseFloat(c.amount), 0);
              return salary - fixedTotal - varTotal;
            });
            const allPositive = monthPools.every(p => p >= 0);
            return (
              <tr className={cn("border-t-2", allPositive ? "bg-emerald-50 border-emerald-300" : "bg-red-50 border-red-300")}>
                <td className={cn("sticky left-0 z-10 px-4 py-3 text-xs font-extrabold uppercase tracking-wider border-r",
                  allPositive ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-red-50 text-red-800 border-red-300")}>
                  Available Pool
                </td>
                {monthPools.map((pool, i) => (
                  <td key={i} className={cn(cellCls, "font-bold text-sm", pool < 0 ? "text-red-700" : "text-emerald-700")}>
                    {fmtShort(pool)}
                  </td>
                ))}
                <td className={cn(cellCls, "font-extrabold text-sm",
                  totalPoolYear < 0 ? "text-red-800 bg-red-100" : "text-emerald-800 bg-emerald-100")}>
                  {fmtShort(totalPoolYear)}
                </td>
              </tr>
            );
          })()}
        </tbody>
      </table>
    </div>
  );
}

export default function Budgets() {
  const [activeDate, setActiveDate] = useState(new Date());
  const [view, setView] = useState<"allocate" | "plan" | "actual" | "annual">("allocate");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [showAccountsPanel, setShowAccountsPanel] = useState(true);
  const [trialExpiredError, setTrialExpiredError] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [confirmed, setConfirmed] = useState(false);

  const month = format(activeDate, "yyyy-MM");
  const monthLabel = format(activeDate, "MMMM yyyy");
  const year = activeDate.getFullYear();

  const { data: profile } = useGetProfile();
  const { data: commitments, refetch: refetchCommitments } = useListCommitments();
  const { data: debts = [] } = useListDebts();
  const { data: budgets, refetch } = useListBudgets({ month });
  const { data: categories } = useListCategories();
  const { data: accounts = [] } = useListAccounts();
  const { data: goals = [], refetch: refetchGoals } = useListGoals();
  const upsert = useUpsertBudget();
  const updateGoal = useUpdateGoal();
  const updateCommitment = useUpdateCommitment();

  const salary = safeNum(profile?.monthlyIncome);
  const totalCommitments = (commitments ?? []).reduce((s, c) => s + safeNum(c.amount), 0);
  const expenseCategories = (categories ?? []).filter(c => c.kind === "expense");
  const budgetMap = Object.fromEntries((budgets ?? []).map(b => [b.categoryId, b]));

  const totalPlanned = expenseCategories.reduce((s, c) => s + safeNum(budgetMap[c.id]?.plannedAmount), 0);
  const totalActual = expenseCategories.reduce((s, c) => s + safeNum(budgetMap[c.id]?.actualAmount), 0);
  const pool = salary - totalCommitments - totalPlanned;
  const totalAccountBalance = accounts.reduce((s, a) => s + safeNum(a.balance), 0);
  const readyToAssign = totalAccountBalance - totalCommitments - totalPlanned;

  const handleSave = async (categoryId: string) => {
    const val = editing[categoryId];
    if (val === undefined) return;
    try {
      await upsert.mutateAsync({ data: { categoryId, month, plannedAmount: parseFloat(val).toFixed(2) } });
      setEditing(prev => { const n = { ...prev }; delete n[categoryId]; return n; });
      refetch();
    } catch (err) {
      if (isTrialExpiredError(err)) setTrialExpiredError(true);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Budgets</h1>
          <p className="text-muted-foreground">
            {view === "allocate"
              ? "Allocate from your accounts. Drag from Available into Bank, Envelopes, or Vault."
              : view === "annual"
              ? "Annual overview of your income and spending."
              : "Plan your income and spending each month."}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {view === "allocate" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetSignal(s => s + 1)}
            >
              <RotateCcw className="w-3 h-3 mr-1" /> Reset
            </Button>
          )}
          {view === "annual" ? (
            <div className="flex items-center gap-2 bg-white border rounded-xl px-3 py-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveDate(d => subYears(d, 1))}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-sm font-semibold w-16 text-center">{year}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveDate(d => addYears(d, 1))}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-white border rounded-xl px-3 py-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveDate(d => subMonths(d, 1))}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-sm font-semibold w-32 text-center">{monthLabel}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveDate(d => addMonths(d, 1))}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          )}
        </div>
      </div>

      {trialExpiredError && <TrialExpiredPrompt action="set budgets" />}

      {/* View toggle */}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant={view === "allocate" ? "default" : "outline"} onClick={() => setView("allocate")} className="rounded-full gap-1.5">
          <Wallet className="w-3.5 h-3.5" /> Allocate
        </Button>
        <Button size="sm" variant={view === "plan" ? "default" : "outline"} onClick={() => setView("plan")} className="rounded-full gap-1.5">
          <LayoutList className="w-3.5 h-3.5" /> Forecast Plan
        </Button>
        <Button size="sm" variant={view === "actual" ? "default" : "outline"} onClick={() => setView("actual")} className="rounded-full gap-1.5">
          <TrendingDown className="w-3.5 h-3.5" /> Actual vs Plan
        </Button>
        <Button size="sm" variant={view === "annual" ? "default" : "outline"} onClick={() => setView("annual")} className="rounded-full gap-1.5">
          <Table2 className="w-3.5 h-3.5" /> Annual Report
        </Button>
      </div>

      {/* ── ALLOCATE VIEW ── */}
      {view === "allocate" && categories && commitments && (
        <AllocateView
          month={month}
          monthLabel={format(activeDate, "MMMM")}
          availablePool={totalAccountBalance}
          accountCount={accounts.length}
          commitments={commitments ?? []}
          debts={debts}
          categories={categories ?? []}
          goals={goals ?? []}
          budgetMap={budgetMap}
          upsert={upsert}
          updateGoal={updateGoal}
          updateCommitment={updateCommitment}
          refetch={refetch}
          refetchGoals={refetchGoals}
          refetchCommitments={refetchCommitments}
          onTrialExpired={() => setTrialExpiredError(true)}
          resetSignal={resetSignal}
        />
      )}

      {/* ── ANNUAL VIEW (preserved) ── */}
      {view === "annual" && categories && commitments && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard label="Total Income" value={fmt(salary * 12)} sub={`${year} · BND ${salary.toLocaleString("en-BN", { maximumFractionDigits: 0 })}/mo`} color="bg-emerald-50 border border-emerald-200" />
            <SummaryCard label="Total Fixed" value={fmt(totalCommitments * 12)} sub={`${(commitments ?? []).length} commitments × 12`} color="bg-orange-50 border border-orange-200" />
            <SummaryCard label="Income / mo" value={fmt(salary)} sub="Monthly salary" color="bg-white border" />
            <SummaryCard label="Fixed / mo" value={fmt(totalCommitments)} sub="Monthly commitments" color="bg-white border" />
          </div>
          <AnnualView year={year} salary={salary} commitments={commitments ?? []} categories={categories ?? []} />
        </>
      )}

      {/* ── PLAN / ACTUAL (preserved from your existing file) ── */}
      {(view === "plan" || view === "actual") && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {view === "plan" ? (
              <SummaryCard label="Monthly Income" value={fmt(salary)} sub={profile?.fullName ? `Gaji ${profile.fullName.split(" ")[0]}` : "From profile"} color="bg-emerald-50 border border-emerald-200" />
            ) : (
              <SummaryCard label="Account Balances" value={fmt(totalAccountBalance)} sub={`${accounts.length} account${accounts.length !== 1 ? "s" : ""}`} color="bg-emerald-50 border border-emerald-200" />
            )}
            <SummaryCard label="Fixed Commitments" value={fmt(totalCommitments)} sub={`${(commitments ?? []).length} items`} color="bg-orange-50 border border-orange-200" />
            <SummaryCard label={view === "plan" ? "Total Budgeted" : "Actually Spent"} value={view === "plan" ? fmt(totalPlanned) : fmt(totalActual)} sub={view === "actual" && totalActual > totalPlanned ? "Over plan" : `of ${fmt(totalPlanned)} planned`} color="bg-blue-50 border border-blue-200" />
            <SummaryCard label={view === "plan" ? "Available Pool" : "Ready to Assign"} value={fmt(view === "plan" ? pool : readyToAssign)}
              sub={view === "plan"
                ? pool < 0 ? "Over-committed!" : "After all deductions"
                : readyToAssign < 0 ? "Over-assigned!" : "Unallocated real cash"}
              color={view === "plan"
                ? pool < 0 ? "bg-red-50 border border-red-200" : "bg-white border"
                : readyToAssign < 0 ? "bg-red-50 border border-red-200" : "bg-white border"} />
          </div>

          {view === "plan" ? (
            <section className="space-y-2">
              <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-600" /><h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Income</h2></div>
              <div className="bg-white border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="font-semibold text-foreground">Monthly Salary / Gaji</p>
                    <p className="text-xs text-muted-foreground">Payday: {profile?.payday ? `${profile.payday}th of the month` : "—"}</p>
                  </div>
                  <span className="font-bold text-emerald-700 text-lg">{fmt(salary)}</span>
                </div>
                <div className="bg-emerald-50 px-5 py-2 flex justify-between items-center border-t border-emerald-100">
                  <span className="text-xs font-medium text-emerald-800">Total Income</span>
                  <span className="text-sm font-bold text-emerald-800">{fmt(salary)}</span>
                </div>
              </div>
            </section>
          ) : (
            <section className="space-y-2">
              <button className="flex items-center gap-2 w-full text-left" onClick={() => setShowAccountsPanel(p => !p)}>
                <Building2 className="w-4 h-4 text-emerald-600" />
                <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex-1">Account Balances</h2>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", !showAccountsPanel && "-rotate-90")} />
              </button>
              {showAccountsPanel && (
                <div className="bg-white border rounded-xl overflow-hidden">
                  {accounts.length === 0 ? (
                    <div className="px-5 py-4 text-sm text-muted-foreground">No accounts added yet. <a href="/accounts" className="text-primary underline">Add your accounts</a> to start envelope budgeting.</div>
                  ) : (
                    accounts.map(a => (
                      <div key={a.id} className="flex items-center justify-between px-5 py-3 border-b last:border-0">
                        <div>
                          <span className="text-sm font-medium text-foreground">{a.name}</span>
                          {a.bankName && <span className="text-xs text-muted-foreground ml-2">{a.bankName}</span>}
                        </div>
                        <span className="font-semibold text-emerald-700 text-sm">{fmt(parseFloat(a.balance ?? "0"))}</span>
                      </div>
                    ))
                  )}
                  <div className="bg-emerald-50 px-5 py-2 flex justify-between items-center border-t border-emerald-100">
                    <span className="text-xs font-medium text-emerald-800">Total Cash</span>
                    <span className="text-sm font-bold text-emerald-800">{fmt(totalAccountBalance)}</span>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-orange-600" />
              <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Fixed Commitments</h2>
              <Badge variant="secondary" className="text-xs">auto</Badge>
            </div>
            <div className="bg-white border rounded-xl overflow-hidden divide-y">
              {(commitments ?? []).length === 0 && (
                <p className="px-5 py-4 text-sm text-muted-foreground">No commitments yet. Add them on the Commitments page.</p>
              )}
              {(commitments ?? []).map(c => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-sm font-medium text-foreground">{c.label}</span>
                  <span className="text-sm font-semibold text-orange-700">{fmt(parseFloat(c.amount))}</span>
                </div>
              ))}
              <div className="bg-orange-50 px-5 py-2 flex justify-between items-center">
                <span className="text-xs font-medium text-orange-800">Total Fixed</span>
                <span className="text-sm font-bold text-orange-800">{fmt(totalCommitments)}</span>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-blue-600" />
              <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                {view === "plan" ? "Variable Budget" : "Category Budget — Actual"}
              </h2>
            </div>

            {view === "actual" && (
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b bg-gray-50 rounded-t-xl border">
                <span>Category</span><span className="w-24 text-right">Assigned</span><span className="w-24 text-right">Activity</span><span className="w-24 text-right">Available</span>
              </div>
            )}

            <div className={cn("bg-white border rounded-xl overflow-hidden divide-y", view === "actual" && "rounded-t-none border-t-0")}>
              {expenseCategories.map(cat => {
                const b = budgetMap[cat.id];
                const planned = parseFloat(b?.plannedAmount ?? "0");
                const actual = parseFloat(b?.actualAmount ?? "0");
                const available = planned - actual;
                const pct = planned > 0 ? Math.min(100, (actual / planned) * 100) : 0;
                const isOver = actual > planned && planned > 0;
                const editVal = editing[cat.id];
                const displayVal = editVal !== undefined ? editVal : planned > 0 ? planned.toFixed(2) : "";

                return (
                  <div key={cat.id} className="px-5 py-4 space-y-2">
                    {view === "plan" ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-foreground flex-1">{cat.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">BND</span>
                          <Input type="number" step="0.01" min="0" className="w-28 text-right h-8 text-sm" value={displayVal} placeholder="0.00"
                            onChange={e => setEditing(prev => ({ ...prev, [cat.id]: e.target.value }))}
                            onBlur={() => { if (editVal !== undefined) handleSave(cat.id); }}
                            onKeyDown={e => { if (e.key === "Enter") handleSave(cat.id); }} />
                          {editVal !== undefined && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => handleSave(cat.id)}><Check className="w-4 h-4" /></Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center">
                        <span className="text-sm font-medium text-foreground">{cat.name}</span>
                        <span className="w-24 text-right text-sm text-muted-foreground font-mono">{planned > 0 ? `BND ${planned.toFixed(2)}` : "—"}</span>
                        <span className="w-24 text-right text-sm font-mono text-foreground">{actual > 0 ? `-BND ${actual.toFixed(2)}` : "—"}</span>
                        <span className={cn("w-24 text-right text-sm font-semibold font-mono",
                          isOver ? "text-destructive" : planned > 0 ? "text-emerald-700" : "text-muted-foreground")}>
                          {planned > 0 ? `BND ${available.toFixed(2)}` : "—"}
                        </span>
                      </div>
                    )}
                    {view === "actual" && planned > 0 && (
                      <div className="space-y-1">
                        <Progress value={pct} className={cn("h-1", isOver && "[&>div]:bg-destructive")} />
                        {isOver && <p className="text-xs text-destructive font-medium">BND {(actual - planned).toFixed(2)} over budget</p>}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="bg-blue-50 px-5 py-2 flex justify-between items-center">
                {view === "plan" ? (
                  <><span className="text-xs font-medium text-blue-800">Total Budgeted</span><span className="text-sm font-bold text-blue-800">{fmt(totalPlanned)}</span></>
                ) : (
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 w-full text-xs font-bold text-blue-800">
                    <span>Total</span><span className="w-24 text-right">{fmt(totalPlanned)}</span><span className="w-24 text-right">{fmt(totalActual)}</span>
                    <span className={cn("w-24 text-right", (totalPlanned - totalActual) < 0 ? "text-destructive" : "text-emerald-700")}>{fmt(totalPlanned - totalActual)}</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section>
            {view === "plan" ? (
              <div className={cn("rounded-xl p-5 flex items-center justify-between", pool < 0 ? "bg-red-50 border-2 border-red-300" : "bg-emerald-50 border-2 border-emerald-300")}>
                <div className="flex items-center gap-3">
                  <Wallet className={cn("w-6 h-6", pool < 0 ? "text-red-600" : "text-emerald-600")} />
                  <div>
                    <p className={cn("font-bold text-base", pool < 0 ? "text-red-800" : "text-emerald-800")}>Available Pool</p>
                    <p className="text-xs text-muted-foreground">{fmt(salary)} income − {fmt(totalCommitments)} commitments − {fmt(totalPlanned)} budgeted</p>
                  </div>
                </div>
                <span className={cn("text-2xl font-extrabold", pool < 0 ? "text-red-700" : "text-emerald-700")}>{fmt(pool)}</span>
              </div>
            ) : (
              <div className={cn("rounded-xl p-5", readyToAssign < 0 ? "bg-red-50 border-2 border-red-300" : "bg-emerald-50 border-2 border-emerald-300")}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Building2 className={cn("w-6 h-6", readyToAssign < 0 ? "text-red-600" : "text-emerald-600")} />
                    <p className={cn("font-bold text-base", readyToAssign < 0 ? "text-red-800" : "text-emerald-800")}>Ready to Assign</p>
                  </div>
                  <span className={cn("text-2xl font-extrabold", readyToAssign < 0 ? "text-red-700" : "text-emerald-700")}>{fmt(readyToAssign)}</span>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground border-t pt-3">
                  <div className="flex justify-between"><span>Total Account Balances</span><span className="font-medium text-emerald-700">{fmt(totalAccountBalance)}</span></div>
                  <div className="flex justify-between"><span>− Fixed Commitments</span><span className="font-medium text-orange-700">−{fmt(totalCommitments)}</span></div>
                  <div className="flex justify-between"><span>− Assigned to Categories</span><span className="font-medium text-blue-700">−{fmt(totalPlanned)}</span></div>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
