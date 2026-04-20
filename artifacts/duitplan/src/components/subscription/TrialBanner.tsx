import { useState } from "react";
import { useLocation } from "wouter";
import { X, AlertCircle, Clock } from "lucide-react";
import { useSubscription } from "@/lib/subscription";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "duitplan_trial_banner_dismissed";

function isDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function saveDismissed(): void {
  try {
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
  }
}

export function TrialBanner() {
  const { status, daysRemaining } = useSubscription();
  const [dismissed, setDismissed] = useState(isDismissed);
  const [, setLocation] = useLocation();

  if (status !== "trial" || daysRemaining === null) return null;

  const isUrgent = daysRemaining <= 7;

  // Dismissed state is overridden when urgent (≤7 days) — too important to hide
  if (dismissed && !isUrgent) return null;

  const isWarning = daysRemaining > 7 && daysRemaining <= 14;

  const label = daysRemaining === 0
    ? "Your trial ends today!"
    : daysRemaining === 1
      ? "1 day left in your trial"
      : `${daysRemaining} days left in your trial`;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    saveDismissed();
    setDismissed(true);
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2 text-sm font-medium cursor-pointer select-none",
        isUrgent
          ? "bg-red-600 text-white"
          : isWarning
            ? "bg-amber-500 text-white"
            : "bg-primary/10 text-primary border-b border-primary/20"
      )}
      onClick={() => setLocation("/premium")}
    >
      <div className="flex items-center gap-2">
        {isUrgent || isWarning ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <Clock className="w-4 h-4 flex-shrink-0" />}
        <span>{label} — Subscribe for BND 10/month to keep access.</span>
      </div>
      <button
        className="ml-4 flex-shrink-0 opacity-70 hover:opacity-100"
        onClick={handleDismiss}
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
