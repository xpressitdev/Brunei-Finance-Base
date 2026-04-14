import { useLocation } from "wouter";
import { Lock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/lib/subscription";

const EXCLUDED_PATHS = ["/premium", "/subscription/success", "/subscription/failed"];

export function ExpiredOverlay() {
  const { status } = useSubscription();
  const [location, setLocation] = useLocation();

  if (status !== "expired") return null;
  if (EXCLUDED_PATHS.some((p) => location.startsWith(p))) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="max-w-md w-full mx-4 bg-card border rounded-2xl shadow-2xl p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Your trial has ended</h2>
          <p className="text-muted-foreground">
            Your 45-day free trial is over. Subscribe to continue using DuitPlan and keep full access to all your financial data.
          </p>
        </div>
        <div className="bg-muted rounded-xl p-4 text-sm text-left space-y-2">
          <p className="font-medium text-foreground">What you get with a subscription:</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>✓ All your existing data preserved</li>
            <li>✓ Unlimited transactions &amp; uploads</li>
            <li>✓ AI insights &amp; debt simulator</li>
            <li>✓ Budget &amp; goals tracking</li>
          </ul>
        </div>
        <Button className="w-full gap-2" size="lg" onClick={() => setLocation("/premium")}>
          <Star className="w-4 h-4" />
          Subscribe for BND 10/month
        </Button>
        <p className="text-xs text-muted-foreground">
          Click subscribe to restore full access. Your data is safe.
        </p>
      </div>
    </div>
  );
}
