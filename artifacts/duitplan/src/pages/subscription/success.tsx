import { useEffect } from "react";
import { useLocation } from "wouter";
import { CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/lib/subscription";

export default function SubscriptionSuccess() {
  const { refetch, status } = useSubscription();
  const [, setLocation] = useLocation();

  useEffect(() => {
    refetch();
    const timer = setTimeout(() => refetch(), 2000);
    return () => clearTimeout(timer);
  }, [refetch]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Payment successful!</h1>
          <p className="text-muted-foreground">
            Welcome to DuitPlan. Your subscription is now active and you have full access to all features.
          </p>
        </div>
        {status === "active" ? (
          <Button size="lg" className="w-full" onClick={() => setLocation("/dashboard")}>
            Go to Dashboard
          </Button>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Activating your subscription...</p>
          </div>
        )}
      </div>
    </div>
  );
}
