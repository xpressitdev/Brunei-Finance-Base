import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useListDebts, useGetProfile } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { X, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

export function MigrationNoticeBanner() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const { data: debts } = useListDebts();
  const { data: profile } = useGetProfile();

  const migratedDebts = (debts ?? []).filter(
    (d: { migrationSource?: string | null }) => d.migrationSource === "commitment_auto_migrated"
  );

  const shouldShow =
    !dismissed &&
    profile &&
    !(profile as { migrationNoticeDismissed?: boolean }).migrationNoticeDismissed &&
    migratedDebts.length > 0;

  const handleDismiss = async () => {
    setDismissed(true);
    try {
      await customFetch("/api/profile/dismiss-migration-notice", { method: "POST" });
    } catch {
      // best-effort
    }
  };

  const handleUpdate = (debtId: string) => {
    setLocation(`/debts?edit=${debtId}`);
    handleDismiss();
  };

  if (!shouldShow) return null;

  const firstDebt = migratedDebts[0] as { id: string; lender: string };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-lg flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900 mb-0.5">
            {t("migration.commitmentToDebt.title")}
          </p>
          <p className="text-sm text-amber-800">
            {t("migration.commitmentToDebt.body", { loanName: firstDebt.lender })}
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-amber-300 text-amber-900 hover:bg-amber-100"
              onClick={() => handleUpdate(firstDebt.id)}
            >
              {t("migration.commitmentToDebt.update", { loanName: firstDebt.lender })}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-amber-700 hover:bg-amber-100"
              onClick={handleDismiss}
            >
              {t("migration.commitmentToDebt.dismiss")}
            </Button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-amber-500 hover:text-amber-700 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
