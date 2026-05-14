import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { ShieldAlert, X } from "lucide-react";

const DISMISS_KEY = "duitplan.weakPasswordBannerDismissedUntil";

function isDismissed(): boolean {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) || "0");
    return until > Date.now();
  } catch {
    return false;
  }
}

function dismissForOneDay() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
  } catch {
    // ignore
  }
}

export function WeakPasswordBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState<boolean>(isDismissed());

  if (!user || !user.passwordWeak || dismissed) return null;

  return (
    <div className="bg-rose-50 border-b border-rose-200 text-rose-900 px-4 py-2.5 text-sm flex items-center gap-3">
      <ShieldAlert className="w-4 h-4 shrink-0" />
      <p className="flex-1">
        Your password is below our current strength requirement. Please update it for better security.
      </p>
      <Link href="/settings?tab=security">
        <span className="underline cursor-pointer font-medium" data-testid="link-update-password">Update now</span>
      </Link>
      <button
        type="button"
        onClick={() => { dismissForOneDay(); setDismissed(true); }}
        className="text-rose-700 hover:text-rose-900 p-1"
        aria-label="Dismiss for today"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
