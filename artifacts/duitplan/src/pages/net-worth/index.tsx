import { useState, useRef } from "react";
import {
  useListNetWorthSnapshots,
  useUpsertNetWorthSnapshot,
  useDeleteNetWorthSnapshot,
} from "@workspace/api-client-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt(n: number) {
  return "BND " + n.toLocaleString("en-BN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtCompact(n: number) {
  if (Math.abs(n) >= 1_000_000) return "BND " + (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return "BND " + (n / 1_000).toFixed(1) + "K";
  return fmt(n);
}

type Snapshot = {
  id: string;
  month: string;
  netWorth: string;
  notes: string | null;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-card border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="text-primary font-bold">{fmt(payload[0].value)}</p>
    </div>
  );
};

export default function NetWorth() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: allSnapshots, refetch } = useListNetWorthSnapshots();
  const upsertMutation = useUpsertNetWorthSnapshot();
  const deleteMutation = useDeleteNetWorthSnapshot();

  const yearStr = String(year);

  const snapshotByMonth: Record<string, Snapshot> = {};
  (allSnapshots ?? []).forEach((s) => {
    snapshotByMonth[s.month] = s as Snapshot;
  });

  const yearSnapshots = (allSnapshots ?? [])
    .filter((s) => s.month.startsWith(yearStr))
    .sort((a, b) => a.month.localeCompare(b.month));

  const chartData = yearSnapshots
    .filter((s) => s.netWorth !== null)
    .map((s) => {
      const [, mo] = s.month.split("-");
      return {
        month: MONTH_SHORT[parseInt(mo) - 1],
        value: parseFloat(s.netWorth),
      };
    });

  const allSortedSnapshots = (allSnapshots ?? [])
    .filter((s) => s.netWorth !== null)
    .sort((a, b) => a.month.localeCompare(b.month));

  const latestSnapshot = allSortedSnapshots[allSortedSnapshots.length - 1];
  const secondLatestSnapshot = allSortedSnapshots[allSortedSnapshots.length - 2];
  const firstSnapshot = allSortedSnapshots[0];

  const latestValue = latestSnapshot ? parseFloat(latestSnapshot.netWorth) : null;
  const prevValue = secondLatestSnapshot ? parseFloat(secondLatestSnapshot.netWorth) : null;
  const firstValue = firstSnapshot ? parseFloat(firstSnapshot.netWorth) : null;

  const monthChange = latestValue !== null && prevValue !== null ? latestValue - prevValue : null;
  const monthChangePct = monthChange !== null && prevValue !== null && prevValue !== 0
    ? (monthChange / Math.abs(prevValue)) * 100 : null;
  const totalChange = latestValue !== null && firstValue !== null ? latestValue - firstValue : null;
  const totalChangePct = totalChange !== null && firstValue !== null && firstValue !== 0
    ? (totalChange / Math.abs(firstValue)) * 100 : null;

  const handleSave = async (monthKey: string) => {
    const raw = editing[monthKey];
    if (raw === undefined || raw.trim() === "") return;
    const val = parseFloat(raw);
    if (isNaN(val)) return;
    await upsertMutation.mutateAsync({
      data: { month: monthKey, netWorth: val.toFixed(2) },
    });
    setEditing((prev) => { const n = { ...prev }; delete n[monthKey]; return n; });
    refetch();
  };

  const handleDelete = async (id: string, monthKey: string) => {
    await deleteMutation.mutateAsync({ id });
    setEditing((prev) => { const n = { ...prev }; delete n[monthKey]; return n; });
    refetch();
  };

  const handleKeyDown = async (e: React.KeyboardEvent, monthKey: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await handleSave(monthKey);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Net Worth</h1>
          <p className="text-muted-foreground">Track your overall financial health over time.</p>
        </div>
        {/* Year navigator */}
        <div className="flex items-center gap-2 bg-white border rounded-xl px-3 py-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold w-12 text-center">{year}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYear((y) => y + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Latest Net Worth"
          value={latestValue !== null ? fmt(latestValue) : "—"}
          sub={latestSnapshot ? latestSnapshot.month : "No data yet"}
          color="text-foreground"
        />
        <SummaryCard
          label="Change (Last Month)"
          value={monthChange !== null ? fmt(Math.abs(monthChange)) : "—"}
          sub={monthChangePct !== null ? `${monthChangePct >= 0 ? "+" : ""}${monthChangePct.toFixed(1)}%` : "Need 2+ months"}
          color={monthChange !== null ? (monthChange >= 0 ? "text-emerald-600" : "text-red-600") : "text-foreground"}
          icon={monthChange !== null ? (monthChange > 0 ? "up" : monthChange < 0 ? "down" : "flat") : undefined}
          negative={monthChange !== null && monthChange < 0}
        />
        <SummaryCard
          label="Change Since Start"
          value={totalChange !== null ? fmt(Math.abs(totalChange)) : "—"}
          sub={totalChangePct !== null ? `${totalChangePct >= 0 ? "+" : ""}${totalChangePct.toFixed(1)}% all time` : "Need 2+ months"}
          color={totalChange !== null ? (totalChange >= 0 ? "text-emerald-600" : "text-red-600") : "text-foreground"}
          icon={totalChange !== null ? (totalChange > 0 ? "up" : totalChange < 0 ? "down" : "flat") : undefined}
          negative={totalChange !== null && totalChange < 0}
        />
      </div>

      {/* Line chart */}
      <div className="bg-card border rounded-xl p-5">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">
          Net Worth — {year}
        </h2>
        {chartData.length < 2 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            Enter at least 2 months to see the trend chart.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
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
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Monthly table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold text-foreground">Monthly Entries — {year}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Enter net worth for each month. Press Enter or click Save to record.</p>
        </div>
        <div className="divide-y">
          {Array.from({ length: 12 }, (_, i) => {
            const mo = String(i + 1).padStart(2, "0");
            const monthKey = `${yearStr}-${mo}`;
            const snapshot = snapshotByMonth[monthKey];
            const editVal = editing[monthKey];
            const hasEdit = editVal !== undefined;
            const savedValue = snapshot ? parseFloat(snapshot.netWorth) : null;
            const isFuture = monthKey > format(new Date());

            return (
              <div
                key={monthKey}
                className={cn(
                  "flex items-center gap-4 px-5 py-3.5",
                  isFuture && "opacity-50"
                )}
              >
                <div className="w-28 flex-shrink-0">
                  <p className="text-sm font-medium text-foreground">{MONTHS[i]}</p>
                  <p className="text-xs text-muted-foreground">{monthKey}</p>
                </div>

                <div className="flex-1 flex items-center gap-2">
                  {!hasEdit && savedValue !== null ? (
                    <>
                      <span className="text-sm font-semibold text-foreground">{fmt(savedValue)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground"
                        onClick={() => setEditing((prev) => ({ ...prev, [monthKey]: snapshot!.netWorth }))}
                      >
                        Edit
                      </Button>
                    </>
                  ) : (
                    <>
                      <Input
                        ref={(el) => { inputRefs.current[monthKey] = el; }}
                        type="number"
                        step="0.01"
                        placeholder={savedValue !== null ? String(savedValue) : "0.00"}
                        value={editVal ?? ""}
                        onChange={(e) => setEditing((prev) => ({ ...prev, [monthKey]: e.target.value }))}
                        onKeyDown={(e) => handleKeyDown(e, monthKey)}
                        className="h-8 w-40 text-sm"
                        disabled={isFuture}
                      />
                      {hasEdit && (
                        <Button
                          size="sm"
                          className="h-8 px-3 gap-1"
                          onClick={() => handleSave(monthKey)}
                          disabled={upsertMutation.isPending || isFuture}
                        >
                          <Save className="w-3.5 h-3.5" />
                          Save
                        </Button>
                      )}
                      {hasEdit && savedValue === null && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          onClick={() => setEditing((prev) => { const n = { ...prev }; delete n[monthKey]; return n; })}
                        >
                          Cancel
                        </Button>
                      )}
                    </>
                  )}

                  {!hasEdit && savedValue === null && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground"
                      disabled={isFuture}
                      onClick={() => {
                        setEditing((prev) => ({ ...prev, [monthKey]: "" }));
                        setTimeout(() => inputRefs.current[monthKey]?.focus(), 50);
                      }}
                    >
                      + Enter
                    </Button>
                  )}
                </div>

                {/* Empty indicator */}
                {savedValue === null && !hasEdit && (
                  <span className="text-sm text-muted-foreground/40 ml-auto">—</span>
                )}

                {/* Delete button */}
                {snapshot && !hasEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive ml-auto"
                    onClick={() => handleDelete(snapshot.id, monthKey)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label, value, sub, color, icon, negative,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  icon?: "up" | "down" | "flat";
  negative?: boolean;
}) {
  return (
    <div className="bg-card border rounded-xl p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1.5 mt-1">
        {icon === "up" && <TrendingUp className={cn("w-4 h-4", negative ? "text-red-500" : "text-emerald-500")} />}
        {icon === "down" && <TrendingDown className={cn("w-4 h-4", negative ? "text-red-500" : "text-emerald-500")} />}
        {icon === "flat" && <Minus className="w-4 h-4 text-muted-foreground" />}
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

function format(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
