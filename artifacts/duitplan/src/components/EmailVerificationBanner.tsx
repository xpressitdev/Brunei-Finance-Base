import { useState } from "react";
import { useResendVerification } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { MailWarning, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DISMISS_KEY = "duitplan.verifyBannerDismissedUntil";

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
    // localStorage unavailable — ignore
  }
}

export function EmailVerificationBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState<boolean>(isDismissed());
  const mutation = useResendVerification();
  const { toast } = useToast();

  if (!user) return null;
  if (user.emailVerified) return null;
  if (dismissed) return null;

  const handleResend = async () => {
    try {
      await mutation.mutateAsync();
      toast({
        title: "Verification email sent",
        description: `Check ${user.email} for a link to verify your account.`,
      });
    } catch {
      toast({ title: "Couldn't resend right now. Try again in a moment.", variant: "destructive" });
    }
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-sm flex items-center gap-3">
      <MailWarning className="w-4 h-4 shrink-0" />
      <p className="flex-1">
        Verify your email so you can reset your password later. We sent a link to <strong>{user.email}</strong>.
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 border-amber-300 bg-white hover:bg-amber-100"
        onClick={handleResend}
        disabled={mutation.isPending}
        data-testid="button-resend-verification"
      >
        {mutation.isPending ? "Sending…" : "Resend"}
      </Button>
      <button
        type="button"
        onClick={() => { dismissForOneDay(); setDismissed(true); }}
        className="text-amber-700 hover:text-amber-900 p-1"
        aria-label="Dismiss for today"
        data-testid="button-dismiss-verify-banner"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
