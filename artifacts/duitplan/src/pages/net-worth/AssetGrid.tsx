import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAssetMatrix,
  useUpsertAssetCell,
  useDeleteAssetCell,
  getGetAssetMatrixQueryKey,
} from "@workspace/api-client-react";
import type { AssetMatrix, AssetMatrixRow } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Landmark, Home, Car, TrendingUp, Briefcase, Package, Info, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useRegion } from "@/hooks/useRegion";
import { formatMonthShort as _formatMonthShort } from "@/utils/formatting";

const ASSET_CATEGORIES = ["Savings", "Property", "Vehicle", "Investment", "Business", "Other"] as const;
type AssetCategoryLocal = typeof ASSET_CATEGORIES[number];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Savings: <Landmark className="w-3.5 h-3.5" />,
  Property: <Home className="w-3.5 h-3.5" />,
  Vehicle: <Car className="w-3.5 h-3.5" />,
  Investment: <TrendingUp className="w-3.5 h-3.5" />,
  Business: <Briefcase className="w-3.5 h-3.5" />,
  Other: <Package className="w-3.5 h-3.5" />,
};

const CATEGORY_BG: Record<string, string> = {
  Savings: "bg-blue-50 text-blue-600",
  Property: "bg-emerald-50 text-emerald-600",
  Vehicle: "bg-amber-50 text-amber-600",
  Investment: "bg-purple-50 text-purple-600",
  Business: "bg-red-50 text-red-600",
  Other: "bg-gray-50 text-gray-600",
};

function colLabel(month: string, locale: string) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return `${_formatMonthShort(d, locale)} ${String(y).slice(-2)}`;
}

type EffectiveCell = {
  value: number;
  explicit: boolean;
  cellId?: string;
};

/**
 * For a given row and an ascending list of months, compute the effective value at each month:
 *  - if there's an explicit entry that month → use it
 *  - else carry forward the most recent prior explicit entry (within window or from seed)
 *  - else null
 */
function computeEffective(row: AssetMatrixRow, months: string[]): (EffectiveCell | null)[] {
  let carry: number | null = row.seedValue != null ? parseFloat(row.seedValue) : null;
  return months.map((m) => {
    const cell = row.entries[m];
    if (cell) {
      const v = parseFloat(cell.value);
      carry = v;
      return { value: v, explicit: true, cellId: cell.id };
    }
    if (carry == null) return null;
    return { value: carry, explicit: false };
  });
}

export function AssetGrid({ onMutate }: { onMutate?: () => void }) {
  const { t } = useTranslation();
  const { formatCurrency, region, decimalStep } = useRegion();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [monthsCount, setMonthsCount] = useState<number>(12);

  const { data, isLoading } = useGetAssetMatrix({ months: monthsCount });

  const matrix: AssetMatrix | undefined = data;
  const months = useMemo(() => matrix?.months ?? [], [matrix]);
  const serverRows = useMemo(() => matrix?.rows ?? [], [matrix]);

  // Locally-added rows that haven't received their first value yet. Once the server matrix
  // includes a matching (name, category), it falls out of this list automatically.
  const [pendingRows, setPendingRows] = useState<Array<{ name: string; category: AssetCategoryLocal }>>([]);
  // When set, the next render should focus the first month input for this (name, category).
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (pendingRows.length === 0) return serverRows;
    const existing = new Set(serverRows.map((r) => `${r.name}|${r.category}`));
    const stillPending: AssetMatrixRow[] = pendingRows
      .filter((p) => !existing.has(`${p.name}|${p.category}`))
      .map((p) => ({
        name: p.name,
        category: p.category as AssetMatrixRow["category"],
        entries: {},
        seedValue: null,
      } as AssetMatrixRow));
    return [...serverRows, ...stillPending];
  }, [serverRows, pendingRows]);

  // Drop pending rows that have been confirmed by the server.
  useEffect(() => {
    if (pendingRows.length === 0) return;
    const existing = new Set(serverRows.map((r) => `${r.name}|${r.category}`));
    const next = pendingRows.filter((p) => !existing.has(`${p.name}|${p.category}`));
    if (next.length !== pendingRows.length) setPendingRows(next);
  }, [serverRows, pendingRows]);

  const upsert = useUpsertAssetCell();
  const remove = useDeleteAssetCell();

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: getGetAssetMatrixQueryKey({ months: monthsCount }) });
    qc.invalidateQueries({ queryKey: ["assets"] });
    qc.invalidateQueries({ queryKey: ["nw-timeline"] });
    qc.invalidateQueries({ queryKey: ["net-worth-timeline"] });
    onMutate?.();
  }, [qc, monthsCount, onMutate]);

  // Column totals (sum of effective values per month, only when at least one row contributes)
  const totals = useMemo(() => {
    return months.map((_, colIdx) => {
      let sum = 0;
      let any = false;
      for (const r of rows) {
        const eff = computeEffective(r, months)[colIdx];
        if (eff) { sum += eff.value; any = true; }
      }
      return any ? sum : null;
    });
  }, [rows, months]);

  const isPending = upsert.isPending || remove.isPending;

  if (isLoading) {
    return (
      <div className="bg-card border rounded-xl p-10 text-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-foreground">{t("netWorth.grid.title")}</span>
          <span className="text-[11px] text-muted-foreground hidden sm:inline-flex items-center gap-1">
            <Info className="w-3 h-3" />
            {t("netWorth.grid.help")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(monthsCount)} onValueChange={(v) => setMonthsCount(parseInt(v, 10))}>
            <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="6">{t("netWorth.grid.months", { count: 6 })}</SelectItem>
              <SelectItem value="12">{t("netWorth.grid.months", { count: 12 })}</SelectItem>
              <SelectItem value="24">{t("netWorth.grid.months", { count: 24 })}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/20">
              <th className="sticky left-0 z-10 bg-muted/20 text-left px-3 py-2 font-medium text-xs text-muted-foreground border-b border-r min-w-[200px]">
                {t("netWorth.grid.assetCol")}
              </th>
              {months.map((m, i) => (
                <th
                  key={m}
                  className={cn(
                    "px-2 py-2 text-right font-medium text-xs text-muted-foreground border-b min-w-[110px]",
                    i === months.length - 1 && "bg-primary/5 text-primary"
                  )}
                >
                  {colLabel(m, region.locale)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const effective = computeEffective(row, months);
              return (
                <tr key={`${row.category}|${row.name}`} className="border-b last:border-0 hover:bg-muted/10">
                  <td className="sticky left-0 z-10 bg-card hover:bg-muted/10 px-3 py-1.5 border-r">
                    <div className="flex items-center gap-2">
                      <span className={cn("p-1 rounded", CATEGORY_BG[row.category] ?? CATEGORY_BG.Other)}>
                        {CATEGORY_ICONS[row.category] ?? CATEGORY_ICONS.Other}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate" title={row.name}>{row.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {t(`netWorth.assetCategories.${row.category}`)}
                        </p>
                      </div>
                    </div>
                  </td>
                  {months.map((m, i) => {
                    const eff = effective[i];
                    const shouldFocus = focusKey === `${row.name}|${row.category}` && i === 0;
                    return (
                      <td key={m} className="p-0.5">
                        <Cell
                          row={row}
                          month={m}
                          eff={eff}
                          decimalStep={decimalStep}
                          disabled={isPending}
                          autoFocus={shouldFocus}
                          onFocused={shouldFocus ? () => setFocusKey(null) : undefined}
                          onSave={async (next) => {
                            try {
                              if (next === "") {
                                if (eff?.explicit) {
                                  await remove.mutateAsync({
                                    params: { name: row.name, category: row.category, month: m },
                                  });
                                  invalidate();
                                }
                                return;
                              }
                              const numeric = parseFloat(next);
                              if (!isFinite(numeric) || numeric < 0) {
                                toast({ title: t("netWorth.grid.invalidValue"), variant: "destructive" });
                                return;
                              }
                              if (eff?.explicit && eff.value === numeric) return;
                              await upsert.mutateAsync({
                                data: {
                                  name: row.name,
                                  category: row.category as AssetMatrixRow["category"],
                                  month: m,
                                  value: String(numeric),
                                },
                              });
                              invalidate();
                            } catch (err) {
                              toast({
                                title: t("netWorth.grid.saveFailed"),
                                description: err instanceof Error ? err.message : String(err),
                                variant: "destructive",
                              });
                            }
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="border-b last:border-0 bg-muted/5">
              <td
                colSpan={months.length + 1}
                className="sticky left-0 px-3 py-1.5"
              >
                <AddAssetRow
                  disabled={isPending}
                  onAdd={(name, category) => {
                    const key = `${name}|${category}`;
                    const existsServer = serverRows.some((r) => `${r.name}|${r.category}` === key);
                    const existsPending = pendingRows.some((p) => `${p.name}|${p.category}` === key);
                    if (existsServer || existsPending) {
                      toast({
                        title: t("netWorth.grid.addRow.duplicate"),
                        variant: "destructive",
                      });
                      return false;
                    }
                    setPendingRows((prev) => [...prev, { name, category }]);
                    setFocusKey(key);
                    return true;
                  }}
                />
              </td>
            </tr>
            <tr className="bg-primary/5 font-semibold">
              <td className="sticky left-0 z-10 bg-primary/5 px-3 py-2 text-xs text-foreground border-r">
                {t("netWorth.grid.totalRow")}
              </td>
              {totals.map((tot, i) => (
                <td key={months[i]} className="px-2 py-2 text-right text-xs tabular-nums text-foreground">
                  {tot != null ? formatCurrency(tot) : "—"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cell({
  row,
  month,
  eff,
  decimalStep,
  disabled,
  autoFocus,
  onFocused,
  onSave,
}: {
  row: AssetMatrixRow;
  month: string;
  eff: EffectiveCell | null;
  decimalStep: string;
  disabled: boolean;
  autoFocus?: boolean;
  onFocused?: () => void;
  onSave: (next: string) => Promise<void> | void;
}) {
  // Display string. Empty when no value at all; explicit values render as plain text; carry-forward
  // values render with muted styling. The user can overwrite either to create/update an explicit entry,
  // or clear an explicit cell to revert to carry-forward.
  const initial = eff?.explicit ? eff.value.toString() : "";
  const [draft, setDraft] = useState<string>(initial);
  const ref = useRef<HTMLInputElement>(null);

  // Reset draft when underlying value changes (e.g. after server invalidation).
  useEffect(() => {
    if (document.activeElement !== ref.current) {
      setDraft(initial);
    }
  }, [initial]);

  // Move focus into this cell when requested (e.g. after adding a new asset row).
  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
      ref.current.select();
      onFocused?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  const placeholder = eff && !eff.explicit
    ? eff.value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : "—";

  return (
    <input
      ref={ref}
      type="number"
      inputMode="decimal"
      step={decimalStep}
      min="0"
      value={draft}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={async () => {
        const trimmed = draft.trim();
        if (trimmed === initial) return;
        await onSave(trimmed);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.currentTarget as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          setDraft(initial);
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      className={cn(
        "w-full h-8 px-2 text-right text-xs tabular-nums rounded border border-transparent",
        "focus:outline-none focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary/30",
        eff?.explicit
          ? "text-foreground font-medium"
          : "text-muted-foreground/60 italic",
        !eff && "placeholder:text-muted-foreground/30"
      )}
    />
  );
}

function AddAssetRow({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (name: string, category: AssetCategoryLocal) => boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<AssetCategoryLocal>("Savings");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && nameRef.current) nameRef.current.focus();
  }, [open]);

  const reset = () => {
    setName("");
    setCategory("Savings");
    setOpen(false);
  };

  const confirm = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      nameRef.current?.focus();
      return;
    }
    const ok = onAdd(trimmed, category);
    if (ok) reset();
  };

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground",
          "px-2 py-1 rounded transition-colors",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span className="p-1 rounded bg-muted text-muted-foreground">
          <Plus className="w-3.5 h-3.5" />
        </span>
        {t("netWorth.grid.addRow.cta")}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Input
        ref={nameRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            confirm();
          } else if (e.key === "Escape") {
            reset();
          }
        }}
        placeholder={t("netWorth.dialog.namePlaceholder")}
        disabled={disabled}
        className="h-8 text-xs w-[200px]"
      />
      <Select value={category} onValueChange={(v) => setCategory(v as AssetCategoryLocal)}>
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ASSET_CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>
              {t(`netWorth.assetCategories.${c}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" size="sm" onClick={confirm} disabled={disabled} className="h-8 text-xs">
        {t("netWorth.grid.addRow.confirm")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={reset}
        disabled={disabled}
        className="h-8 px-2"
        aria-label={t("common.cancel")}
      >
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
