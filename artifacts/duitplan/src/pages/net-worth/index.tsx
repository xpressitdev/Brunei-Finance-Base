import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  useListAssets,
  useCreateAsset,
  useUpdateAsset,
  useDeleteAsset,
  listAssets,
} from "@workspace/api-client-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
} from "recharts";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

const CATEGORY_COLORS: Record<AssetCategory, string> = {
  Savings: "hsl(217, 91%, 60%)",
  Property: "hsl(142, 71%, 45%)",
  Vehicle: "hsl(38, 92%, 50%)",
  Investment: "hsl(271, 91%, 65%)",
  Business: "hsl(0, 84%, 60%)",
  Other: "hsl(220, 9%, 46%)",
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

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS_FULL[m - 1]} ${y}`;
}

function fmt(n: number) {
  return "BND " + n.toLocaleString("en-BN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtCompact(n: number) {
  if (Math.abs(n) >= 1_000_000) return "BND " + (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return "BND " + (n / 1_000).toFixed(1) + "K";
  return fmt(n);
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

type Asset = {
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

const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-card border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="text-primary font-bold">{fmt(payload[0].value)}</p>
    </div>
  );
};

const LineTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-card border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="text-primary font-bold">{fmt(payload[0].value)}</p>
    </div>
  );
};

export default function NetWorth() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const today = currentMonth();

  const { data: currentAssets = [], refetch: refetchCurrent } = useListAssets(
    { month: selectedMonth },
    { query: { queryKey: ["assets", selectedMonth] } }
  );

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

  const assets = currentAssets as Asset[];

  const totalNetWorth = assets.reduce((sum, a) => sum + parseFloat(a.value), 0);

  const byCategory: Record<string, Asset[]> = {};
  ASSET_CATEGORIES.forEach((c) => { byCategory[c] = []; });
  assets.forEach((a) => {
    if (!byCategory[a.category]) byCategory[a.category] = [];
    byCategory[a.category].push(a);
  });

  const barData = ASSET_CATEGORIES
    .map((cat) => ({
      category: cat,
      value: byCategory[cat].reduce((s, a) => s + parseFloat(a.value), 0),
    }))
    .filter((d) => d.value > 0);

  const trendData = last12.map((m, i) => {
    const monthAssets = ((trendResults[i]?.data as Asset[] | undefined) ?? []);
    const total = monthAssets.reduce((s, a) => s + parseFloat(a.value), 0);
    const [, mo] = m.split("-");
    return { month: MONTH_SHORT[parseInt(mo) - 1], value: total, fullMonth: m };
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(selectedMonth));
    setDialogOpen(true);
  };

  const openEdit = (asset: Asset) => {
    setEditingId(asset.id);
    setForm({
      category: asset.category as AssetCategory,
      name: asset.name,
      value: asset.value,
      // Always edit in the context of the currently viewed month so changes
      // are saved as a new snapshot for that month, not overwriting history.
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
      // Check if the asset record already belongs to this month (exact match).
      // If it's a carried-forward entry from an older month, save a new record
      // for selectedMonth instead of overwriting the historical entry.
      const existingAsset = assets.find(a => a.id === editingId);
      const isCarriedForward = existingAsset && existingAsset.month !== selectedMonth;

      if (isCarriedForward) {
        // Create a new entry for the currently viewed month
        await createMutation.mutateAsync({
          data: {
            category: form.category,
            name: form.name.trim(),
            value: val.toFixed(2),
            month: selectedMonth,
          },
        });
      } else {
        // Update the existing record in place (it belongs to this month)
        await updateMutation.mutateAsync({
          id: editingId,
          data: {
            category: form.category,
            name: form.name.trim(),
            value: val.toFixed(2),
            month: form.month,
          },
        });
      }
    } else {
      await createMutation.mutateAsync({
        data: {
          category: form.category,
          name: form.name.trim(),
          value: val.toFixed(2),
          month: form.month,
        },
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Net Worth</h1>
          <p className="text-muted-foreground">Track your assets by category.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Month navigator */}
          <div className="flex items-center gap-1 bg-white border rounded-xl px-3 py-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSelectedMonth((m) => prevMonthStr(m))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold w-36 text-center">{monthLabel(selectedMonth)}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSelectedMonth((m) => nextMonthStr(m))}
              disabled={selectedMonth >= today}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Asset
          </Button>
        </div>
      </div>

      {/* Total net worth */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-6">
        <p className="text-sm text-muted-foreground font-medium">Total Net Worth — {monthLabel(selectedMonth)}</p>
        <p className="text-4xl font-bold text-foreground mt-1">{fmt(totalNetWorth)}</p>
        <p className="text-xs text-muted-foreground mt-1">{assets.length} asset{assets.length !== 1 ? "s" : ""} across {barData.length} categor{barData.length !== 1 ? "ies" : "y"}</p>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar chart - category breakdown */}
        <div className="bg-card border rounded-xl p-5">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">
            Breakdown by Category
          </h2>
          {barData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              No assets for this month yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => fmtCompact(v)}
                  width={70}
                />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {barData.map((entry) => (
                    <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category as AssetCategory] ?? "hsl(var(--primary))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Line chart - 12 month trend */}
        <div className="bg-card border rounded-xl p-5">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">
            12-Month Net Worth Trend
          </h2>
          {trendData.every((d) => d.value === 0) ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              Add assets across multiple months to see the trend.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => fmtCompact(v)}
                  width={70}
                />
                <Tooltip content={<LineTooltip />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Asset list grouped by category */}
      <div className="space-y-4">
        {assets.length === 0 ? (
          <div className="bg-card border rounded-xl p-10 text-center">
            <p className="text-muted-foreground text-sm">No assets recorded for {monthLabel(selectedMonth)}.</p>
            <Button variant="outline" className="mt-4 gap-2" onClick={openCreate}>
              <Plus className="w-4 h-4" />
              Add your first asset
            </Button>
          </div>
        ) : (
          ASSET_CATEGORIES.filter((cat) => byCategory[cat].length > 0).map((cat) => {
            const catAssets = byCategory[cat];
            const subtotal = catAssets.reduce((s, a) => s + parseFloat(a.value), 0);
            return (
              <div key={cat} className="bg-card border rounded-xl overflow-hidden">
                {/* Category header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b bg-muted/30">
                  <div className="flex items-center gap-2.5">
                    <span className={cn("p-1.5 rounded-lg", CATEGORY_BG[cat])}>
                      {CATEGORY_ICONS[cat]}
                    </span>
                    <span className="font-semibold text-foreground">{cat}</span>
                    <span className="text-xs text-muted-foreground">({catAssets.length})</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{fmt(subtotal)}</span>
                </div>
                {/* Asset rows */}
                <div className="divide-y">
                  {catAssets.map((asset) => (
                    <div key={asset.id} className="flex items-center gap-4 px-5 py-3.5 group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{asset.name}</p>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{fmt(parseFloat(asset.value))}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => openEdit(asset)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(asset.id)}
                          disabled={deleteMutation.isPending}
                        >
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
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Asset" : "Add Asset"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v as AssetCategory }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      <div className="flex items-center gap-2">
                        <span className={cn("p-1 rounded", CATEGORY_BG[cat])}>{CATEGORY_ICONS[cat]}</span>
                        {cat}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                placeholder='e.g. "Maybank savings", "Honda Civic"'
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Value (BND)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Month</Label>
              <Input
                type="month"
                value={form.month}
                onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !form.name.trim() || !form.value || !form.month}
            >
              {isSaving ? "Saving..." : editingId ? "Save Changes" : "Add Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
