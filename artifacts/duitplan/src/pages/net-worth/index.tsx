import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { useQueries } from "@tanstack/react-query";
import {
  useListAssets,
  useCreateAsset,
  useUpdateAsset,
  useDeleteAsset,
  useListAccounts,
  useListDebts,
  listAssets,
} from "@workspace/api-client-react";
import type { Account, Debt } from "@workspace/api-client-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
  ReferenceLine,
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
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Landmark,
  Home,
  Car,
  TrendingUp,
  Briefcase,
  Package,
  Building2,
  TrendingDown,
  ArrowRight,
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

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function prevMonthStr(month: string) {
  const [y, m] = month.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

function nextMonthStr(month: string) {
  const [y, m] = month.split("-").map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

function monthLabel(month: string, locale = "en-BN") {
  const [y, m] = month.split("-").map(Number);
  return _formatMonthYear(new Date(y, m - 1, 1), locale);
}

function relativeTime(isoString: string | null | undefined, fallback: string): string {
  if (!isoString) return fallback;
  try {
    return formatDistanceToNow(new Date(isoString), { addSuffix: true });
  } catch {
    return fallback;
  }
}

function getLast12Months(fromMonth: string): string[] {
  const months: string[] = [];
  let m = fromMonth;
  for (let i = 0; i < 12; i++) {
    months.unshift(m);
    m = prevMonthStr(m);
  }
  return months;
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

type ComparisonPayload = { name: string; Assets: number; Liabilities: number };

const ComparisonTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  const { formatCurrency } = useRegion();
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-card border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey as string} style={{ color: p.fill }} className="font-bold">
          {p.name}: {formatCurrency(p.value ?? 0)}
        </p>
      ))}
    </div>
  );
};

const LineTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  const { formatCurrency } = useRegion();
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-card border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="text-primary font-bold">{formatCurrency(payload[0].value ?? 0)}</p>
    </div>
  );
};

export default function NetWorth() {
  const { t } = useTranslation();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const today = currentMonth();
  const { formatCurrency, region, decimalStep } = useRegion();

  function fmtCompact(n: number) {
    if (Math.abs(n) >= 1_000_000) return formatCurrency(n / 1_000_000) + "M";
    if (Math.abs(n) >= 1_000) return formatCurrency(n / 1_000) + "K";
    return formatCurrency(n);
  }

  const { data: currentAssets = [], refetch: refetchCurrent } = useListAssets(
    { month: selectedMonth },
    { query: { queryKey: ["assets", selectedMonth] } }
  );

  const { data: accounts = [] } = useListAccounts();
  const { data: debts = [] } = useListDebts();

  const last12 = getLast12Months(today);
  const trendResults = useQueries({
    queries: last12.map((m) => ({
      queryKey: ["assets", m],
      queryFn: () => listAssets({ month: m }),
      staleTime: 60_000,
    })),
  });

  const createMutation = useCreateAsset();
  const updateMutation = useUpdateAsset();
  const deleteMutation = useDeleteAsset();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(currentMonth()));

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

  const comparisonData: ComparisonPayload[] = [
    { name: t("netWorth.charts.assetsVsLiabilities"), Assets: totalAssets, Liabilities: totalLiabilities },
  ];

  const trendData = last12.map((m, i) => {
    const monthAssets = ((trendResults[i]?.data as AssetEntry[] | undefined) ?? []);
    const total = monthAssets.reduce((s, a) => s + parseFloat(a.value), 0);
    const [, mo] = m.split("-");
    const shortMonth = _formatMonthShort(new Date(parseInt(m.split("-")[0]), parseInt(mo) - 1, 1), region.locale);
    return { month: shortMonth, value: total, fullMonth: m };
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(selectedMonth));
    setDialogOpen(true);
  };

  const openEdit = (asset: AssetEntry) => {
    setEditingId(asset.id);
    setForm({
      category: asset.category as AssetCategory,
      name: asset.name,
      value: asset.value,
      month: selectedMonth,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.value || !form.month) return;
    const val = parseFloat(form.value);
    if (isNaN(val) || val < 0) return;
    if (!/^\d{4}-\d{2}$/.test(form.month)) return;

    if (editingId) {
      const existingAsset = assets.find((a) => a.id === editingId);
      const isCarriedForward = existingAsset && existingAsset.month !== selectedMonth;

      if (isCarriedForward) {
        await createMutation.mutateAsync({
          data: { category: form.category, name: form.name.trim(), value: val.toFixed(2), month: selectedMonth },
        });
      } else {
        await updateMutation.mutateAsync({
          id: editingId,
          data: { category: form.category, name: form.name.trim(), value: val.toFixed(2), month: form.month },
        });
      }
    } else {
      await createMutation.mutateAsync({
        data: { category: form.category, name: form.name.trim(), value: val.toFixed(2), month: form.month },
      });
    }
    setDialogOpen(false);
    refetchCurrent();
    trendResults.forEach((r) => r.refetch());
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync({ id });
    refetchCurrent();
    trendResults.forEach((r) => r.refetch());
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white border rounded-xl px-3 py-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedMonth((m) => prevMonthStr(m))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold w-36 text-center">{monthLabel(selectedMonth, region.locale)}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedMonth((m) => nextMonthStr(m))} disabled={selectedMonth >= today}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            {t("netWorth.addAsset")}
          </Button>
        </div>
      </div>

      {/* Net Worth Hero — balance scale + deltas */}
      {(() => {
        const maxSide = Math.max(totalAssets, totalLiabilities, 1);
        const tiltDeg = Math.max(-22, Math.min(22, ((totalLiabilities - totalAssets) / maxSide) * 22));
        const debtToAsset = totalAssets > 0 ? (totalLiabilities / totalAssets) : null;
        const equityPct = totalAssets > 0 ? ((netWorth / totalAssets) * 100) : null;
        const debtLoadPct = (totalAssets + totalLiabilities) > 0 ? (totalLiabilities / (totalAssets + totalLiabilities) * 100) : null;
        const lastMonthVal = trendData[trendData.length - 2]?.value ?? null;
        const yearAgoVal = trendData[0]?.value ?? null;
        const vsLastMonthStr = trendData.length >= 2 && lastMonthVal !== null
          ? ((totalAssetEntries - lastMonthVal) >= 0 ? "+" : "") + formatCurrency(totalAssetEntries - lastMonthVal)
          : null;
        const vsYearStr = trendData.length >= 12 && yearAgoVal !== null
          ? ((totalAssetEntries - yearAgoVal) >= 0 ? "+" : "") + formatCurrency(totalAssetEntries - yearAgoVal)
          : null;

        return (
          <>
            {/* Hero card */}
            <div className="grid lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3 rounded-xl border bg-card p-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Today's Net Worth</p>
                    <div className={cn("text-4xl font-extrabold tabular-nums mt-1", netWorthPositive ? "text-primary" : "text-rose-600")}>
                      {formatCurrency(netWorth)}
                    </div>
                    <span className={cn("inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold", netWorthPositive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                      {netWorthPositive ? "✓ Healthy" : "⚠ Critical"}
                    </span>
                    <div className="mt-4 flex gap-6">
                      {vsLastMonthStr && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">vs Last Month</p>
                          <p className={cn("text-sm font-bold tabular-nums mt-0.5", (totalAssetEntries - (lastMonthVal ?? 0)) >= 0 ? "text-primary" : "text-rose-600")}>{vsLastMonthStr}</p>
                        </div>
                      )}
                      {vsYearStr && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">vs 12 Months Ago</p>
                          <p className={cn("text-sm font-bold tabular-nums mt-0.5", (totalAssetEntries - (yearAgoVal ?? 0)) >= 0 ? "text-primary" : "text-rose-600")}>{vsYearStr}</p>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 pt-4 border-t flex gap-6 text-xs text-muted-foreground">
                      <span>Assets: <span className="font-semibold text-foreground">{formatCurrency(totalAssets)}</span></span>
                      <span>Liabilities: <span className="font-semibold text-foreground">{formatCurrency(totalLiabilities)}</span></span>
                    </div>
                  </div>

                  {/* Balance scale SVG */}
                  <div className="flex-shrink-0 flex flex-col items-center select-none" aria-label={`Balance scale: Assets ${formatCurrency(totalAssets)}, Liabilities ${formatCurrency(totalLiabilities)}`}>
                    <svg width="160" height="130" viewBox="0 0 160 130" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="assetGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#15a06e" stopOpacity="0.9" />
                          <stop offset="100%" stopColor="#0d7a52" stopOpacity="1" />
                        </linearGradient>
                        <linearGradient id="liabGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.9" />
                          <stop offset="100%" stopColor="#dc2626" stopOpacity="1" />
                        </linearGradient>
                      </defs>
                      {/* Stand */}
                      <rect x="77" y="80" width="6" height="42" rx="3" fill="#94a3b8" />
                      <ellipse cx="80" cy="122" rx="20" ry="5" fill="#e2e8f0" />
                      {/* Pivot circle */}
                      <circle cx="80" cy="80" r="5" fill="#64748b" />
                      {/* Beam — rotates from pivot (80,80) */}
                      <g transform={`rotate(${tiltDeg} 80 80)`}>
                        <rect x="14" y="77" width="132" height="6" rx="3" fill="#64748b" />
                        {/* Left string + pan (Assets) */}
                        <line x1="22" y1="80" x2="22" y2="98" stroke="#94a3b8" strokeWidth="1.5" />
                        <rect x="8" y="98" width="28" height="16" rx="4" fill="url(#assetGrad)" />
                        <text x="22" y="110" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold">ASSETS</text>
                        {/* Right string + pan (Liabilities) */}
                        <line x1="138" y1="80" x2="138" y2="98" stroke="#94a3b8" strokeWidth="1.5" />
                        <rect x="124" y="98" width="28" height="16" rx="4" fill="url(#liabGrad)" />
                        <text x="138" y="110" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="bold">LIAB.</text>
                      </g>
                    </svg>
                    <p className="text-[10px] text-muted-foreground -mt-1 font-medium">
                      {Math.abs(tiltDeg) < 2 ? "Balanced" : netWorthPositive ? "Assets outweigh debts" : "Debts outweigh assets"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="lg:col-span-2 grid grid-cols-1 gap-3">
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Debt-to-Asset Ratio</p>
                  <div className={cn("text-3xl font-extrabold tabular-nums mt-1", debtToAsset !== null && debtToAsset > 0.5 ? "text-rose-600" : "text-primary")}>
                    {debtToAsset !== null ? debtToAsset.toFixed(2) : "—"}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{debtToAsset !== null ? (debtToAsset <= 0.3 ? "Excellent — well under control" : debtToAsset <= 0.6 ? "Manageable" : "High — focus on reducing debt") : "Add assets to track"}</p>
                  {debtToAsset !== null && (
                    <div className="mt-2 h-1.5 rounded-full bg-accent overflow-hidden">
                      <div className={cn("h-full rounded-full", debtToAsset <= 0.3 ? "bg-emerald-500" : debtToAsset <= 0.6 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${Math.min(debtToAsset * 100, 100)}%` }} />
                    </div>
                  )}
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Equity %</p>
                  <div className={cn("text-3xl font-extrabold tabular-nums mt-1", equityPct !== null && equityPct < 40 ? "text-rose-600" : "text-primary")}>
                    {equityPct !== null ? `${equityPct.toFixed(1)}%` : "—"}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">of total assets owned free of debt</p>
                  {equityPct !== null && (
                    <div className="mt-2 h-1.5 rounded-full bg-accent overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(equityPct, 100))}%` }} />
                    </div>
                  )}
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Debt Load</p>
                  <div className={cn("text-3xl font-extrabold tabular-nums mt-1", debtLoadPct !== null && debtLoadPct > 50 ? "text-rose-600" : "text-amber-600")}>
                    {debtLoadPct !== null ? `${debtLoadPct.toFixed(1)}%` : "—"}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">of total portfolio is liabilities</p>
                  {debtLoadPct !== null && (
                    <div className="mt-2 h-1.5 rounded-full bg-accent overflow-hidden">
                      <div className={cn("h-full rounded-full", debtLoadPct <= 30 ? "bg-emerald-500" : debtLoadPct <= 50 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${debtLoadPct}%` }} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 12-month trajectory area chart */}
            <div className="rounded-xl border bg-card p-5">
              <div className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">12-Month Asset Trajectory</p>
                <h3 className="text-base font-semibold mt-0.5">{t("netWorth.charts.trendSubtitle")}</h3>
              </div>
              {trendData.every((d) => d.value === 0) ? (
                <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                  {t("netWorth.charts.trendEmpty")}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <defs>
                      <linearGradient id="trajGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtCompact(v)} width={70} />
                    <Tooltip content={<LineTooltip />} />
                    <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#trajGrad)" dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </>
        );
      })()}

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

      {/* Asset Entries section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-600" />
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            {t("netWorth.assetEntries.sectionTitle", { month: monthLabel(selectedMonth, region.locale) })}
          </h2>
        </div>

        {assets.length === 0 ? (
          <div className="bg-card border rounded-xl p-10 text-center">
            <p className="text-muted-foreground text-sm">
              {t("netWorth.assetEntries.noEntries", { month: monthLabel(selectedMonth, region.locale) })}
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
                        {asset.month !== selectedMonth && (
                          <p className="text-xs text-muted-foreground">
                            {t("netWorth.assetEntries.valueFrom", { month: monthLabel(asset.month, region.locale) })}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-foreground">{formatCurrency(parseFloat(asset.value))}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(asset)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(asset.id)} disabled={deleteMutation.isPending}>
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
