import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import {
  useListAssets,
  useCreateAsset,
  useUpdateAsset,
  useDeleteAsset,
  useListAccounts,
  useListDebts,
  useGetNetWorthTimeline,
} from "@workspace/api-client-react";
import type {
  Account,
  Debt,
  NetWorthTimelinePoint,
} from "@workspace/api-client-react";
import {
  XAxis,
  YAxis,
  ReferenceLine,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import type { TooltipProps } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Landmark,
  Home,
  Car,
  TrendingUp,
  Briefcase,
  Package,
  Building2,
  TrendingDown,
  ArrowRight,
  Info,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useRegion } from "@/hooks/useRegion";
import { formatMonthYear as _formatMonthYear, formatMonthShort as _formatMonthShort } from "@/utils/formatting";


const ASSET_CATEGORIES = ["Savings", "Property", "Vehicle", "Investment", "Business", "Other"] as const;
type AssetCategory = typeof ASSET_CATEGORIES[number];

const CATEGORY_ICONS: Record<AssetCategory, React.ReactNode> = {
  Savings: <Landmark className="w-4 h-4" />,
  Property: <Home className="w-4 h-4" />,
  Vehicle: <Car className="w-4 h-4" />,
  Investment: <TrendingUp className="w-4 h-4" />,
  Business: <Briefcase className="w-4 h-4" />,
  Other: <Package className="w-4 h-4" />,
};

const CATEGORY_BG: Record<AssetCategory, string> = {
  Savings: "bg-blue-50 text-blue-600",
  Property: "bg-emerald-50 text-emerald-600",
  Vehicle: "bg-amber-50 text-amber-600",
  Investment: "bg-purple-50 text-purple-600",
  Business: "bg-red-50 text-red-600",
  Other: "bg-gray-50 text-gray-600",
};

const RANGE_OPTIONS = ["6m", "1y", "5y", "all"] as const;
type RangeKey = typeof RANGE_OPTIONS[number];

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string, locale = "en-BN") {
  const [y, m] = month.split("-").map(Number);
  return _formatMonthYear(new Date(y, m - 1, 1), locale);
}

function shortMonthLabel(month: string, locale: string, includeYear: boolean) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const short = _formatMonthShort(d, locale);
  return includeYear ? `${short} ${String(y).slice(-2)}` : short;
}

function relativeTime(isoString: string | null | undefined, fallback: string): string {
  if (!isoString) return fallback;
  try {
    return formatDistanceToNow(new Date(isoString), { addSuffix: true });
  } catch {
    return fallback;
  }
}

type AssetEntry = {
  id: string;
  userId: string;
  category: string;
  name: string;
  value: string;
  month: string;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  category: AssetCategory;
  name: string;
  value: string;
  month: string;
};

function emptyForm(month: string): FormState {
  return { category: "Savings", name: "", value: "", month };
}

const TimelineTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  const { formatCurrency } = useRegion();
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload as { month: string; netWorth: number; assets: number; liabilities: number };
  return (
    <div className="bg-card border rounded-lg p-3 shadow-lg text-sm space-y-1">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="text-primary font-bold tabular-nums">
        {formatCurrency(row.netWorth)}
      </p>
      <div className="text-[11px] text-muted-foreground tabular-nums">
        <div>Assets: {formatCurrency(row.assets)}</div>
        <div>Liabilities: {formatCurrency(row.liabilities)}</div>
      </div>
    </div>
  );
};

export default function NetWorth() {
  const { t } = useTranslation();
  const today = currentMonth();
  const { formatCurrency, region, decimalStep } = useRegion();

  const [range, setRange] = useState<RangeKey>("1y");

  function fmtCompact(n: number) {
    if (Math.abs(n) >= 1_000_000) return formatCurrency(n / 1_000_000) + "M";
    if (Math.abs(n) >= 1_000) return formatCurrency(n / 1_000) + "K";
    return formatCurrency(n);
  }

  // Current carry-forward assets (latest value <= today for each name/category)
  const { data: currentAssets = [], refetch: refetchCurrent } = useListAssets(
    { month: today },
    { query: { queryKey: ["assets", today] } }
  );

  const { data: accounts = [] } = useListAccounts();
  const { data: debts = [] } = useListDebts();

  const { data: timelineData, refetch: refetchTimeline } = useGetNetWorthTimeline(
    { range },
    { query: { queryKey: ["net-worth-timeline", range] } }
  );

  const createMutation = useCreateAsset();
  const updateMutation = useUpdateAsset();
  const deleteMutation = useDeleteAsset();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(today));

  const assets = currentAssets as AssetEntry[];

  const totalAssetEntries = assets.reduce((sum, a) => sum + parseFloat(a.value), 0);
  const totalAccountBalance = (accounts as Account[]).reduce(
    (sum, a) => sum + parseFloat(a.balance ?? "0"),
    0
  );
  const totalAssets = totalAssetEntries + totalAccountBalance;
  const totalLiabilities = (debts as Debt[]).reduce(
    (sum, d) => sum + parseFloat(d.outstandingBalance ?? "0"),
    0
  );
  const netWorth = totalAssets - totalLiabilities;
  const netWorthPositive = netWorth >= 0;

  const byCategory: Record<string, AssetEntry[]> = {};
  ASSET_CATEGORIES.forEach((c) => { byCategory[c] = []; });
  assets.forEach((a) => {
    if (!byCategory[a.category]) byCategory[a.category] = [];
    byCategory[a.category].push(a);
  });

  // Timeline chart data (parsed once)
  const timelineSeries: Array<{ month: string; label: string; netWorth: number; assets: number; liabilities: number }> = useMemo(() => {
    const raw = (timelineData?.series ?? []) as NetWorthTimelinePoint[];
    const includeYear = raw.length > 12;
    return raw.map((p) => ({
      month: p.month,
      label: shortMonthLabel(p.month, region.locale, includeYear),
      netWorth: parseFloat(p.netWorth),
      assets: parseFloat(p.assets),
      liabilities: parseFloat(p.liabilities),
    }));
  }, [timelineData, region.locale]);

  // Deltas vs first point of selected range and vs previous month
  const monthChange = timelineSeries.length >= 2
    ? timelineSeries[timelineSeries.length - 1].netWorth - timelineSeries[timelineSeries.length - 2].netWorth
    : null;
  const rangeChange = timelineSeries.length >= 2
    ? timelineSeries[timelineSeries.length - 1].netWorth - timelineSeries[0].netWorth
    : null;
  const rangeStartVal = timelineSeries[0]?.netWorth ?? 0;
  const rangeChangePct = rangeChange !== null && rangeStartVal !== 0
    ? (rangeChange / Math.abs(rangeStartVal)) * 100
    : null;

  const allZero = timelineSeries.length > 0 && timelineSeries.every((d) => d.netWorth === 0 && d.assets === 0);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(today));
    setDialogOpen(true);
  };

  const openEdit = (asset: AssetEntry) => {
    setEditingId(asset.id);
    setForm({
      category: asset.category as AssetCategory,
      name: asset.name,
      value: asset.value,
      month: asset.month,
    });
    setDialogOpen(true);
  };

  // "Update value" — opens dialog pre-filled with the asset's name/category,
  // value blank, month defaulted to today. Saving creates a NEW entry for
  // today's month, preserving the historical value.
  const openUpdateValue = (asset: AssetEntry) => {
    setEditingId(null);
    setForm({
      category: asset.category as AssetCategory,
      name: asset.name,
      value: "",
      month: today,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.value || !form.month) return;
    const val = parseFloat(form.value);
    if (isNaN(val) || val < 0) return;
    if (!/^\d{4}-\d{2}$/.test(form.month)) return;

    if (editingId) {
      await updateMutation.mutateAsync({
        id: editingId,
        data: { category: form.category, name: form.name.trim(), value: val.toFixed(2), month: form.month },
      });
    } else {
      await createMutation.mutateAsync({
        data: { category: form.category, name: form.name.trim(), value: val.toFixed(2), month: form.month },
      });
    }
    setDialogOpen(false);
    refetchCurrent();
    refetchTimeline();
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync({ id });
    refetchCurrent();
    refetchTimeline();
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const allTimestamps: string[] = [
    ...assets.map((a) => a.updatedAt),
    ...(accounts as Account[]).map((a) => a.updatedAt),
    ...(debts as Debt[]).map((d) => d.updatedAt),
  ].filter(Boolean);
  const mostRecentUpdate = allTimestamps.length > 0
    ? allTimestamps.reduce((latest, ts) => (ts > latest ? ts : latest))
    : null;

  const noActivityText = t("netWorth.noActivity");

  const debtToAsset = totalAssets > 0 ? (totalLiabilities / totalAssets) : null;
  const ratio = totalAssets > 0 ? netWorth / totalAssets : 0;
  const sumAL = totalAssets + totalLiabilities;
  const pctA = sumAL > 0 ? (totalAssets / sumAL) * 100 : 50;
  const pctL = 100 - pctA;
  const monthlyBurn = (debts as Debt[]).reduce((s, d) => s + parseFloat(d.monthlyPayment ?? "0"), 0);
  const runwayMonths = monthlyBurn > 0 ? totalAccountBalance / monthlyBurn : null;

  const healthLabel = debtToAsset === null
    ? "—"
    : debtToAsset < 1
      ? t("netWorth.health.solvent")
      : debtToAsset < 5
        ? t("netWorth.health.leveraged")
        : t("netWorth.health.critical");
  const healthClass = debtToAsset === null
    ? "bg-muted text-muted-foreground"
    : debtToAsset < 1
      ? "bg-emerald-100 text-emerald-700"
      : debtToAsset < 5
        ? "bg-amber-100 text-amber-700"
        : "bg-rose-100 text-rose-700";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header — no month picker; net worth is a "now" snapshot */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">{t("netWorth.title")}</h1>
          <p className="text-muted-foreground">{t("netWorth.subtitle")}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {mostRecentUpdate
              ? t("netWorth.lastUpdated", { time: relativeTime(mostRecentUpdate, noActivityText) })
              : noActivityText}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          {t("netWorth.addAsset")}
        </Button>
      </div>

      {/* Hero card — today's net worth */}
      <div className="rounded-xl border bg-card p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-72 h-72 rounded-full bg-emerald-100/40 blur-3xl pointer-events-none" />
        <div className="relative grid lg:grid-cols-5 gap-6 items-start">
          {/* Left: Net worth headline + deltas */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">{t("netWorth.todaysNetWorth")}</p>
              <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full", healthClass)}>
                {healthLabel}
              </span>
            </div>
            <div className={cn("text-4xl font-extrabold tabular-nums leading-tight whitespace-nowrap", netWorthPositive ? "text-primary" : "text-rose-700")}>
              {netWorth < 0 ? "−" : ""}{formatCurrency(Math.abs(netWorth))}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-white/70 rounded-lg p-2.5 border">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{t("netWorth.vsLastMonth")}</div>
                {monthChange !== null ? (
                  <div className={cn("text-sm font-bold tabular-nums mt-0.5", monthChange >= 0 ? "text-emerald-700" : "text-rose-600")}>
                    {monthChange >= 0 ? "+" : "−"}{formatCurrency(Math.abs(monthChange))}
                  </div>
                ) : (
                  <div className="text-sm font-bold tabular-nums mt-0.5 text-muted-foreground">—</div>
                )}
              </div>
              <div className="bg-white/70 rounded-lg p-2.5 border">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                  {t(`netWorth.vsRange.${range}`)}
                </div>
                {rangeChange !== null ? (
                  <div className={cn("text-sm font-bold tabular-nums mt-0.5", rangeChange >= 0 ? "text-emerald-700" : "text-rose-600")}>
                    {rangeChange >= 0 ? "+" : "−"}{formatCurrency(Math.abs(rangeChange))}
                    {rangeChangePct !== null && (
                      <span className="text-[10px] font-semibold text-muted-foreground ml-1">
                        ({rangeChangePct >= 0 ? "+" : ""}{rangeChangePct.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-sm font-bold tabular-nums mt-0.5 text-muted-foreground">—</div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Assets vs Liabilities proportion */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl p-5 border shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("netWorth.charts.assetsVsLiabilities")}</p>
                <span className="text-[10px] text-muted-foreground">
                  {totalLiabilities > totalAssets ? (
                    <>{t("netWorth.liabilitiesExceedAssetsBy")}{" "}
                      <span className="font-semibold text-rose-700 tabular-nums">
                        {formatCurrency(totalLiabilities - totalAssets)}
                      </span>
                    </>
                  ) : (
                    <>{t("netWorth.assetsExceedLiabilitiesBy")}{" "}
                      <span className="font-semibold text-emerald-700 tabular-nums">
                        {formatCurrency(totalAssets - totalLiabilities)}
                      </span>
                    </>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">{t("netWorth.summary.totalAssets")}</span>
                  </div>
                  <div className="text-xl font-bold text-emerald-800 tabular-nums leading-tight">{formatCurrency(totalAssets)}</div>
                  <div className="text-[10px] text-emerald-700/70 mt-0.5 tabular-nums">
                    {formatCurrency(totalAccountBalance)} {t("netWorth.cashLabel")} · {formatCurrency(totalAssetEntries)} {t("netWorth.otherLabel")}
                  </div>
                </div>
                <div className="rounded-lg border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full bg-rose-600" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">{t("netWorth.summary.totalLiabilities")}</span>
                  </div>
                  <div className="text-xl font-bold text-rose-800 tabular-nums leading-tight">{formatCurrency(totalLiabilities)}</div>
                  <div className="text-[10px] text-rose-700/70 mt-0.5 tabular-nums">
                    {(debts as Debt[]).length} {(debts as Debt[]).length === 1 ? t("netWorth.obligation") : t("netWorth.obligations")}
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  <span className="text-emerald-700 tabular-nums">{pctA.toFixed(1)}%</span>
                  <span className="flex-1 text-center">{t("netWorth.shareOfTotal")}</span>
                  <span className="text-rose-700 tabular-nums">{pctL.toFixed(1)}%</span>
                </div>
                <div className="relative h-7 rounded-full overflow-hidden bg-muted ring-1 ring-inset ring-border flex shadow-inner">
                  <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-700 ease-out flex items-center justify-start pl-2" style={{ width: `${pctA}%` }}>
                    {pctA > 12 && (
                      <span className="text-[10px] font-bold text-white tabular-nums">{formatCurrency(totalAssets)}</span>
                    )}
                  </div>
                  <div className="bg-gradient-to-r from-rose-600 to-rose-500 transition-all duration-700 ease-out flex items-center justify-end pr-2" style={{ width: `${pctL}%` }}>
                    {pctL > 12 && (
                      <span className="text-[10px] font-bold text-white tabular-nums">{formatCurrency(totalLiabilities)}</span>
                    )}
                  </div>
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/60 pointer-events-none" />
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-foreground rounded-[1px]" />
                </div>
                <div className="flex items-center justify-center mt-1">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{t("netWorth.breakEvenAt50")}</span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 pt-3 border-t">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("netWorth.debtToAsset")}</div>
                  <div className="text-sm font-bold tabular-nums mt-0.5">{debtToAsset !== null ? `${debtToAsset.toFixed(2)}×` : "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("netWorth.liquidRunway")}</div>
                  <div className="text-sm font-bold tabular-nums mt-0.5">{runwayMonths !== null ? `${runwayMonths.toFixed(1)} ${t("netWorth.monthsShort")}` : "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("netWorth.equityShare")}</div>
                  <div className="text-sm font-bold tabular-nums mt-0.5">{totalAssets > 0 ? `${(ratio * 100).toFixed(1)}%` : "—"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Net worth over time — line chart with range tabs */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("netWorth.timeline.eyebrow")}</p>
            <h3 className="text-base font-semibold mt-0.5">{t("netWorth.timeline.title")}</h3>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Info className="w-3 h-3" />
              {t("netWorth.timeline.note")}
            </p>
          </div>
          <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-md transition-colors",
                  range === r
                    ? "bg-white text-foreground shadow-sm border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t(`netWorth.timeline.range.${r}`)}
              </button>
            ))}
          </div>
        </div>
        {timelineSeries.length === 0 || allZero ? (
          <div className="flex flex-col items-center justify-center h-48 text-sm text-muted-foreground gap-2">
            <p>{t("netWorth.timeline.empty")}</p>
            <Button variant="outline" size="sm" className="gap-2" onClick={openCreate}>
              <Plus className="w-3.5 h-3.5" />
              {t("netWorth.addAsset")}
            </Button>
          </div>
        ) : (
          (() => {
            const nwVals = timelineSeries.map((p) => p.netWorth);
            const minNw = Math.min(...nwVals);
            const maxNw = Math.max(...nwVals);
            const spread = Math.max(Math.abs(maxNw - minNw), Math.abs(maxNw), Math.abs(minNw), 1);
            const pad = spread * 0.1;
            const domainMin = Math.floor((minNw - pad) / 1000) * 1000;
            const domainMax = Math.ceil((maxNw + pad) / 1000) * 1000;
            const isNegative = maxNw < 0;
            const lineColor = isNegative ? "hsl(0 72% 51%)" : "hsl(var(--primary))";
            const gradId = isNegative ? "nwGradNeg" : "nwGrad";
            return (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={timelineSeries} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="nwGradNeg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0 72% 51%)" stopOpacity={0.02} />
                      <stop offset="95%" stopColor="hsl(0 72% 51%)" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={20} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => fmtCompact(v)}
                    width={80}
                    domain={[domainMin, domainMax]}
                  />
                  {domainMin < 0 && domainMax > 0 ? (
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" />
                  ) : null}
                  <Tooltip content={<TimelineTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="netWorth"
                    stroke={lineColor}
                    strokeWidth={2.5}
                    fill={`url(#${gradId})`}
                    baseValue={isNegative ? "dataMax" : "dataMin"}
                    dot={timelineSeries.length <= 24 ? { r: 3, fill: lineColor, strokeWidth: 0 } : false}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            );
          })()
        )}
      </div>

      {/* Account Balances section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              {t("netWorth.accountBalances.sectionTitle")}
            </h2>
          </div>
          <Link href="/accounts">
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground h-7">
              {t("netWorth.accountBalances.manage")} <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
        <div className="bg-card border rounded-xl overflow-hidden">
          {accounts.length === 0 ? (
            <div className="px-5 py-4 text-sm text-muted-foreground flex items-center justify-between">
              <span>{t("netWorth.accountBalances.noAccounts")}</span>
              <Link href="/accounts">
                <Button variant="outline" size="sm" className="gap-1 text-xs">
                  <Plus className="w-3 h-3" /> {t("netWorth.accountBalances.addAccount")}
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {(accounts as Account[]).map((a) => (
                <div key={a.id} className="flex items-center justify-between px-5 py-3 border-b last:border-0">
                  <div>
                    <span className="text-sm font-medium text-foreground">{a.name}</span>
                    {a.bankName && <span className="text-xs text-muted-foreground ml-2">{a.bankName}</span>}
                  </div>
                  <span className="text-sm font-semibold text-emerald-700">{formatCurrency(parseFloat(a.balance ?? "0"))}</span>
                </div>
              ))}
              <div className="bg-emerald-50 px-5 py-2 flex justify-between items-center">
                <span className="text-xs font-medium text-emerald-800">{t("netWorth.accountBalances.totalAccountBalances")}</span>
                <span className="text-sm font-bold text-emerald-800">{formatCurrency(totalAccountBalance)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Asset Entries section — today's carry-forward values */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              {t("netWorth.assetEntries.currentSectionTitle")}
            </h2>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {t("netWorth.assetEntries.asOf", { month: monthLabel(today, region.locale) })}
          </span>
        </div>

        {assets.length === 0 ? (
          <div className="bg-card border rounded-xl p-10 text-center">
            <p className="text-muted-foreground text-sm">
              {t("netWorth.assetEntries.noEntriesEver")}
            </p>
            <Button variant="outline" className="mt-4 gap-2" onClick={openCreate}>
              <Plus className="w-4 h-4" />
              {t("netWorth.assetEntries.addFirst")}
            </Button>
          </div>
        ) : (
          ASSET_CATEGORIES.filter((cat) => byCategory[cat].length > 0).map((cat) => {
            const catAssets = byCategory[cat];
            const subtotal = catAssets.reduce((s, a) => s + parseFloat(a.value), 0);
            return (
              <div key={cat} className="bg-card border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b bg-muted/30">
                  <div className="flex items-center gap-2.5">
                    <span className={cn("p-1.5 rounded-lg", CATEGORY_BG[cat])}>{CATEGORY_ICONS[cat]}</span>
                    <span className="font-semibold text-foreground">{t(`netWorth.assetCategories.${cat}`)}</span>
                    <span className="text-xs text-muted-foreground">({catAssets.length})</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{formatCurrency(subtotal)}</span>
                </div>
                <div className="divide-y">
                  {catAssets.map((asset) => (
                    <div key={asset.id} className="flex items-center gap-4 px-5 py-3.5 group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{asset.name}</p>
                        {asset.month !== today && (
                          <p className="text-xs text-muted-foreground">
                            {t("netWorth.assetEntries.valueFrom", { month: monthLabel(asset.month, region.locale) })}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-foreground tabular-nums">{formatCurrency(parseFloat(asset.value))}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-primary hover:bg-primary/10"
                          onClick={() => openUpdateValue(asset)}
                          title={t("netWorth.assetEntries.updateValueTooltip")}
                        >
                          <RefreshCw className="w-3 h-3" />
                          {t("netWorth.assetEntries.updateValue")}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(asset)} title={t("netWorth.assetEntries.edit")}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(asset.id)} disabled={deleteMutation.isPending} title={t("netWorth.assetEntries.delete")}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}

        {assets.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 flex justify-between items-center">
            <span className="text-xs font-medium text-blue-800">{t("netWorth.assetEntries.totalEntries")}</span>
            <span className="text-sm font-bold text-blue-800">{formatCurrency(totalAssetEntries)}</span>
          </div>
        )}
      </div>

      {/* Liabilities section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-600" />
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              {t("netWorth.liabilities.sectionTitle")}
            </h2>
          </div>
          <Link href="/debts">
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground h-7">
              {t("netWorth.liabilities.manage")} <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
        <div className="bg-card border rounded-xl overflow-hidden">
          {debts.length === 0 ? (
            <div className="px-5 py-4 text-sm text-muted-foreground flex items-center justify-between">
              <span>{t("netWorth.liabilities.noDebts")}</span>
              <Link href="/debts">
                <Button variant="outline" size="sm" className="gap-1 text-xs">
                  <Plus className="w-3 h-3" /> {t("netWorth.liabilities.addDebt")}
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {(debts as Debt[]).map((d) => (
                <div key={d.id} className="flex items-center justify-between px-5 py-3 border-b last:border-0">
                  <div>
                    <span className="text-sm font-medium text-foreground">{d.lender}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {t(`netWorth.debtTypes.${d.debtType}`) ?? d.debtType}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-red-700">
                    {formatCurrency(parseFloat(d.outstandingBalance ?? "0"))}
                  </span>
                </div>
              ))}
              <div className="bg-red-50 px-5 py-2 flex justify-between items-center">
                <span className="text-xs font-medium text-red-800">{t("netWorth.liabilities.totalOutstanding")}</span>
                <span className="text-sm font-bold text-red-800">{formatCurrency(totalLiabilities)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Asset dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("netWorth.dialog.editTitle") : t("netWorth.dialog.addTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("netWorth.dialog.categoryLabel")}</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as AssetCategory }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSET_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      <div className="flex items-center gap-2">
                        <span className={cn("p-1 rounded", CATEGORY_BG[cat])}>{CATEGORY_ICONS[cat]}</span>
                        {t(`netWorth.assetCategories.${cat}`)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("netWorth.dialog.nameLabel")}</Label>
              <Input
                placeholder={t("netWorth.dialog.namePlaceholder")}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("netWorth.dialog.valueLabel", { currency: region.currency })}</Label>
              <Input
                type="number"
                step={decimalStep}
                min="0"
                placeholder={decimalStep === "1" ? "0" : "0.00"}
                value={form.value}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("netWorth.dialog.monthLabel")}</Label>
              <Input
                type="month"
                value={form.month}
                onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}
              />
              <p className="text-[10px] text-muted-foreground">{t("netWorth.dialog.monthHelp")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={isSaving || !form.name.trim() || !form.value || !form.month}>
              {isSaving
                ? t("common.saving")
                : editingId
                ? t("netWorth.dialog.saveEdit")
                : t("netWorth.dialog.saveAdd")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
