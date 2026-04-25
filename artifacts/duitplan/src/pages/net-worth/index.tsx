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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Assets */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">{t("netWorth.summary.totalAssets")}</p>
          <p className="text-2xl font-bold text-emerald-800">{formatCurrency(totalAssets)}</p>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs text-emerald-700">
              <span>{t("netWorth.summary.assetEntries")}</span>
              <span className="font-medium">{formatCurrency(totalAssetEntries)}</span>
            </div>
            <div className="flex justify-between text-xs text-emerald-700">
              <span>{t("netWorth.summary.accountBalances")}</span>
              <span className="font-medium">{formatCurrency(totalAccountBalance)}</span>
            </div>
          </div>
        </div>

        {/* Total Liabilities */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">{t("netWorth.summary.totalLiabilities")}</p>
          <p className="text-2xl font-bold text-red-800">{formatCurrency(totalLiabilities)}</p>
          <div className="mt-2">
            <p className="text-xs text-red-700">
              {t("netWorth.summary.debtsOutstanding", { count: debts.length })}
            </p>
          </div>
        </div>

        {/* Net Worth */}
        <div className={cn(
          "rounded-xl p-5 border-2",
          netWorthPositive ? "bg-white border-emerald-400" : "bg-red-50 border-red-400"
        )}>
          <p className={cn("text-xs font-semibold uppercase tracking-wide mb-1", netWorthPositive ? "text-emerald-700" : "text-red-700")}>
            {t("netWorth.summary.netWorth")}
          </p>
          <p className={cn("text-3xl font-extrabold", netWorthPositive ? "text-emerald-700" : "text-red-700")}>
            {formatCurrency(netWorth)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {formatCurrency(totalAssets)} − {formatCurrency(totalLiabilities)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Assets vs Liabilities comparison chart */}
        <div className="bg-card border rounded-xl p-5">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">
            {t("netWorth.charts.assetsVsLiabilities")}
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={comparisonData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtCompact(v)} width={70} />
              <Tooltip content={<ComparisonTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Assets" name={t("netWorth.summary.totalAssets")} fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Liabilities" name={t("netWorth.summary.totalLiabilities")} fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 12-month asset entries trend */}
        <div className="bg-card border rounded-xl p-5">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-1">
            {t("netWorth.charts.trendTitle")}
          </h2>
          <p className="text-xs text-muted-foreground mb-3">{t("netWorth.charts.trendSubtitle")}</p>
          {trendData.every((d) => d.value === 0) ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              {t("netWorth.charts.trendEmpty")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtCompact(v)} width={70} />
                <Tooltip content={<LineTooltip />} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
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
