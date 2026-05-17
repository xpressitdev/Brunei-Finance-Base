import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  useListIncomeSources,
  useCreateIncomeSource,
  useUpdateIncomeSource,
  useDeleteIncomeSource,
  useGetProfile,
  useListTransactions,
} from "@workspace/api-client-react";
import type { IncomeSource } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, TrendingUp, AlertCircle } from "lucide-react";
import { useRegion } from "@/hooks/useRegion";

function thisMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function IncomeSourcesPage() {
  const { t } = useTranslation();
  const { formatCurrency: fmt, region } = useRegion();
  const currencyLabel = region.currency;
  const { data: profile } = useGetProfile();
  const { data: sources = [], refetch } = useListIncomeSources();
  const createMut = useCreateIncomeSource();
  const updateMut = useUpdateIncomeSource();
  const deleteMut = useDeleteIncomeSource();

  // Sum this-month income transactions (type === "income") to compute actual.
  const monthKey = thisMonthRange();
  const { data: txns = [] } = useListTransactions({ month: monthKey, type: "credit" });
  const actualThisMonth = useMemo(
    () => txns.reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
    [txns]
  );

  const totalExpected = sources
    .filter((s) => s.active)
    .reduce((sum, s) => sum + Number(s.expectedMonthlyAmount || 0), 0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeSource | null>(null);
  const [name, setName] = useState("");
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");

  const openCreate = () => {
    setEditing(null);
    setName("");
    setExpected("");
    setNotes("");
    setDialogOpen(true);
  };
  const openEdit = (s: IncomeSource) => {
    setEditing(s);
    setName(s.name);
    setExpected(String(s.expectedMonthlyAmount));
    setNotes(s.notes ?? "");
    setDialogOpen(true);
  };
  const handleSave = async () => {
    if (!name.trim()) return;
    if (editing) {
      await updateMut.mutateAsync({
        id: editing.id,
        data: { name: name.trim(), expectedMonthlyAmount: expected || "0", notes: notes || null },
      });
    } else {
      await createMut.mutateAsync({
        data: { name: name.trim(), expectedMonthlyAmount: expected || "0", notes: notes || null, active: true },
      });
    }
    setDialogOpen(false);
    refetch();
  };
  const handleDelete = async (id: string) => {
    await deleteMut.mutateAsync({ id });
    refetch();
  };

  const variancePct = totalExpected > 0 ? Math.round((actualThisMonth / totalExpected) * 100) : 0;
  const isVariable = profile?.incomeType === "variable";

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("incomeSources.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("incomeSources.subtitle")}</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> {t("incomeSources.addSource")}
        </Button>
      </div>

      {!isVariable && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-900">{t("incomeSources.fixedHintTitle")}</p>
              <p className="text-amber-800 mt-1">{t("incomeSources.fixedHintBody")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-5 h-5 text-primary" />
            {t("incomeSources.thisMonth")}
          </CardTitle>
          <CardDescription>{t("incomeSources.thisMonthDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("incomeSources.actual")}</p>
              <p className="text-2xl font-bold tabular-nums">{fmt(actualThisMonth)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("incomeSources.expected")}</p>
              <p className="text-lg font-semibold tabular-nums text-muted-foreground">{fmt(totalExpected)}</p>
            </div>
          </div>
          {totalExpected > 0 && (
            <>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${variancePct >= 90 ? "bg-emerald-600" : variancePct >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
                  style={{ width: `${Math.min(100, variancePct)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("incomeSources.variance", { pct: variancePct, currency: currencyLabel })}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {sources.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p>{t("incomeSources.empty")}</p>
              <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
                <Plus className="w-4 h-4" /> {t("incomeSources.addFirst")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          sources.map((s) => (
            <Card key={s.id} className={!s.active ? "opacity-60" : ""}>
              <CardContent className="pt-6 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{s.name}</p>
                  {s.notes && <p className="text-sm text-muted-foreground truncate mt-0.5">{s.notes}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold tabular-nums">{fmt(Number(s.expectedMonthlyAmount))}</p>
                  <p className="text-xs text-muted-foreground">{t("incomeSources.perMonth")}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(s)} aria-label={t("common.edit")}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(s.id)}
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("incomeSources.editTitle") : t("incomeSources.newTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("incomeSources.nameLabel")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("incomeSources.namePlaceholder")}
              />
            </div>
            <div>
              <Label>{t("incomeSources.expectedLabel", { currency: currencyLabel })}</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground mt-1">{t("incomeSources.expectedHelp")}</p>
            </div>
            <div>
              <Label>{t("incomeSources.notesLabel")}</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("incomeSources.notesPlaceholder")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={!name.trim() || createMut.isPending || updateMut.isPending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
