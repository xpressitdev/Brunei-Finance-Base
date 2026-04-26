import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useListAccounts, useCreateGoal } from "@workspace/api-client-react";
import type { Account } from "@workspace/api-client-react";
import { useRegion } from "@/hooks/useRegion";
import { useToast } from "@/hooks/use-toast";
import { ZAKAT_NISAB_REFERENCE, ZAKAT_NISAB_LAST_UPDATED } from "@/config/zakatNisab";
import { ZAKAT_AUTHORITIES } from "@/config/zakatAuthorities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { HandCoins, Info, ExternalLink, Check, X as XIcon, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const ZAKAT_RATE = 0.025;
const ASSET_ACCOUNT_TYPES = new Set(["savings", "current", "checking"]);

function isAssetAccount(account: Account): boolean {
  return ASSET_ACCOUNT_TYPES.has(account.type?.toLowerCase() ?? "");
}

export default function ZakatPage() {
  const { t } = useTranslation();
  const { region, formatCurrency, decimalStep } = useRegion();
  const { toast } = useToast();

  const { data: allAccounts = [], isLoading } = useListAccounts();
  const createGoalMut = useCreateGoal();

  const assetAccounts = useMemo(
    () => allAccounts.filter(isAssetAccount),
    [allAccounts]
  );

  const nisabRef = ZAKAT_NISAB_REFERENCE[region.code] ?? ZAKAT_NISAB_REFERENCE["BN"];

  const [checkedIds, setCheckedIds] = useState<Set<string> | null>(null);
  const [nisabInput, setNisabInput] = useState<string>("");
  const [creatingGoal, setCreatingGoal] = useState(false);

  const effectiveChecked = useMemo(() => {
    if (checkedIds === null) return new Set(assetAccounts.map(a => a.id));
    return checkedIds;
  }, [checkedIds, assetAccounts]);

  const nisabValue = useMemo(() => {
    const parsed = parseFloat(nisabInput);
    return isNaN(parsed) || parsed < 0 ? nisabRef.gold : parsed;
  }, [nisabInput, nisabRef.gold]);

  const { totalWealth, excludedWealth, zakatableWealth, zakatOwed, aboveNisab } = useMemo(() => {
    let total = 0;
    let excluded = 0;
    for (const acc of assetAccounts) {
      const bal = parseFloat(acc.balance) || 0;
      total += bal;
      if (!effectiveChecked.has(acc.id)) excluded += bal;
    }
    const zakatable = total - excluded;
    const above = zakatable >= nisabValue;
    return {
      totalWealth: total,
      excludedWealth: excluded,
      zakatableWealth: zakatable,
      zakatOwed: above ? zakatable * ZAKAT_RATE : 0,
      aboveNisab: above,
    };
  }, [assetAccounts, effectiveChecked, nisabValue]);

  const toggleAccount = (id: string) => {
    const base = checkedIds ?? new Set(assetAccounts.map(a => a.id));
    const next = new Set(base);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCheckedIds(next);
  };

  const handleCreateGoal = async () => {
    if (zakatOwed <= 0) return;
    setCreatingGoal(true);
    try {
      const year = new Date().getFullYear();
      await createGoalMut.mutateAsync({
        data: {
          title: `Zakat ${year}`,
          targetAmount: zakatOwed.toFixed(region.decimals === 0 ? 0 : 2),
          savedAmount: "0",
          category: "savings",
          notes: t('zakat.disclaimer.title'),
        },
      });
      toast({ title: t('zakat.actions.createGoalSuccess') });
    } catch (err) {
      console.error("Failed to create Zakat goal", err);
    } finally {
      setCreatingGoal(false);
    }
  };

  const authority = ZAKAT_AUTHORITIES[region.code] ?? ZAKAT_AUTHORITIES["BN"];

  const visitAuthorityLabel = () => {
    const key = `zakat.actions.visitAuthority${region.code.charAt(0) + region.code.slice(1).toLowerCase()}` as const;
    const mapped: Record<string, string> = {
      BN: t('zakat.actions.visitAuthorityBn'),
      MY: t('zakat.actions.visitAuthorityMy'),
      ID: t('zakat.actions.visitAuthorityId'),
    };
    return mapped[region.code] ?? t('zakat.actions.visitAuthorityBn');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-16">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
          <HandCoins className="w-6 h-6 text-emerald-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('zakat.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('zakat.subtitle')}</p>
        </div>
      </div>

      {/* ── Section 1: Zakatable Wealth ─────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('zakat.wealth.sectionTitle')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('zakat.wealth.sectionDescription')}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 rounded-lg bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : assetAccounts.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">{t('zakat.wealth.noAccounts')}</p>
              <Link href="/accounts">
                <Button variant="outline" size="sm" className="mt-4">{t('nav.accounts')}</Button>
              </Link>
            </div>
          ) : (
            <>
              {assetAccounts.map(account => {
                const balance = parseFloat(account.balance) || 0;
                const checked = effectiveChecked.has(account.id);
                return (
                  <div
                    key={account.id}
                    className={cn(
                      "flex items-center gap-4 rounded-xl border px-4 py-3.5 transition-colors cursor-pointer",
                      checked
                        ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                        : "bg-muted/30 border-border opacity-60"
                    )}
                    onClick={() => toggleAccount(account.id)}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleAccount(account.id)}
                      className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{account.name}</div>
                      {account.bankName && (
                        <div className="text-xs text-muted-foreground">{account.bankName}</div>
                      )}
                    </div>
                    <div className={cn("font-semibold text-sm tabular-nums", checked ? "text-foreground" : "text-muted-foreground")}>
                      {formatCurrency(balance)}
                    </div>
                  </div>
                );
              })}

              <div className="border-t pt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">{t('zakat.wealth.totalLabel')}</span>
                <span className="text-lg font-bold text-emerald-700">{formatCurrency(zakatableWealth)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Section 2: Nisab Threshold ──────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{t('zakat.nisab.label')}</CardTitle>
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  <Info className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 text-sm" side="right">
                <p className="font-semibold mb-2">{t('zakat.nisab.referenceTitle')}</p>
                <div className="space-y-1.5 mb-3">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{t('zakat.nisab.goldBased', { value: formatCurrency(nisabRef.gold) })}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{t('zakat.nisab.silverBased', { value: formatCurrency(nisabRef.silver) })}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground border-t pt-2">{t('zakat.nisab.referenceFooter')}</p>
                <p className="text-xs text-muted-foreground mt-1 italic">{t('zakat.nisab.lastUpdated', { date: ZAKAT_NISAB_LAST_UPDATED })}</p>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">{region.currency}</span>
              <Input
                type="number"
                step={decimalStep}
                min="0"
                placeholder={nisabRef.gold.toString()}
                value={nisabInput}
                onChange={e => setNisabInput(e.target.value)}
                className="pl-14 h-11"
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
              {t('zakat.nisab.helperText')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setNisabInput(nisabRef.gold.toString())}
              className="text-left px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="text-xs text-muted-foreground">Gold-based (85g)</div>
              <div className="text-sm font-semibold">{formatCurrency(nisabRef.gold)}</div>
            </button>
            <button
              type="button"
              onClick={() => setNisabInput(nisabRef.silver.toString())}
              className="text-left px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="text-xs text-muted-foreground">Silver-based (595g)</div>
              <div className="text-sm font-semibold">{formatCurrency(nisabRef.silver)}</div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Calculation Result ───────────────────────────────── */}
      <Card className={cn(
        "border-2",
        assetAccounts.length === 0
          ? "border-border"
          : aboveNisab
          ? "border-emerald-300 dark:border-emerald-700"
          : "border-amber-200 dark:border-amber-800"
      )}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Zakat Calculation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            {/* Total wealth */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{t('zakat.result.totalWealth')}</span>
              <span className="font-medium tabular-nums">{formatCurrency(totalWealth)}</span>
            </div>

            {/* Excluded */}
            {excludedWealth > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{t('zakat.result.excluded')}</span>
                <span className="font-medium tabular-nums text-muted-foreground">
                  −{formatCurrency(excludedWealth)}
                </span>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Zakatable wealth */}
            <div className="flex justify-between items-center text-sm font-semibold">
              <span>{t('zakat.result.zakatableWealth')}</span>
              <span className="tabular-nums">{formatCurrency(zakatableWealth)}</span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{t('zakat.result.nisabThreshold')}</span>
              <span className="font-medium tabular-nums">{formatCurrency(nisabValue)}</span>
            </div>

            {/* Above nisab status */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{t('zakat.result.aboveNisab')}</span>
              {assetAccounts.length === 0 ? (
                <span className="text-muted-foreground">—</span>
              ) : aboveNisab ? (
                <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
                  <Check className="w-4 h-4" /> {t('zakat.result.yes')}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-semibold text-amber-600">
                  <XIcon className="w-4 h-4" /> {t('zakat.result.below')}
                </span>
              )}
            </div>

            {aboveNisab && assetAccounts.length > 0 ? (
              <>
                <div className="border-t border-border" />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{t('zakat.result.zakatRate')}</span>
                  <span className="font-medium">2.5%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-base">{t('zakat.result.zakatOwed')}</span>
                  <span className="font-bold text-xl text-emerald-700 tabular-nums">{formatCurrency(zakatOwed)}</span>
                </div>
              </>
            ) : assetAccounts.length > 0 ? (
              <div className="rounded-lg bg-amber-50 border border-amber-100 dark:bg-amber-950/20 dark:border-amber-900 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 mt-2">
                {t('zakat.result.belowNisabMessage')}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 4: Action Buttons ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          className="flex-1 gap-2 bg-emerald-700 hover:bg-emerald-800 text-white"
          disabled={zakatOwed <= 0 || creatingGoal}
          onClick={handleCreateGoal}
        >
          <Target className="w-4 h-4" />
          {creatingGoal ? "Creating..." : t('zakat.actions.createGoal')}
        </Button>
        <Button
          variant="outline"
          className="gap-2"
          asChild
        >
          <a href={authority.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4" />
            {visitAuthorityLabel()}
          </a>
        </Button>
      </div>

      {/* ── Section 5: Disclaimer ─────────────────────────────────────────── */}
      <div className="rounded-xl border bg-muted/30 p-5 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Info className="w-4 h-4 shrink-0" />
          {t('zakat.disclaimer.title')}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t('zakat.disclaimer.body')}
        </p>
      </div>

    </div>
  );
}
