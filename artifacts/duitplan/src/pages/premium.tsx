import { useState } from "react";
import { useLocation } from "wouter";
import { Check, Star, Loader2, CreditCard, AlertCircle, Calendar, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/lib/subscription";
import { customFetch, ApiError } from "@workspace/api-client-react";

const FEATURES = [
  "Unlimited transactions",
  "PDF & screenshot statement imports",
  "Advanced debt payoff simulator",
  "AI-driven financial insights",
  "Budget tracking & spending analysis",
  "Goals & net worth tracking",
  "Monthly commitment tracking",
  "Priority support",
];

function BillingStatus() {
  const { data, status, daysRemaining } = useSubscription();

  if (!status) return null;

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="w-4 h-4" /> Billing Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Status</span>
          {status === "active" && <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>}
          {status === "trial" && <Badge variant="outline">Free Trial</Badge>}
          {status === "expired" && <Badge variant="destructive">Expired</Badge>}
        </div>
        {status === "trial" && daysRemaining !== null && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Trial ends</span>
            <span className="font-medium">
              {daysRemaining === 0 ? "Today" : `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`}
            </span>
          </div>
        )}
        {data?.subscription?.nextBillingDate && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Next billing date</span>
            <span className="font-medium flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(data.subscription.nextBillingDate).toLocaleDateString("en-BN", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
        )}
        {data?.subscription?.startDate && status === "active" && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subscribed since</span>
            <span className="font-medium">
              {new Date(data.subscription.startDate).toLocaleDateString("en-BN", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-muted-foreground">Plan</span>
          <span className="font-medium">DuitPlan — BND 10/month</span>
        </div>
        {status === "active" && (
          <p className="text-xs text-muted-foreground pt-1">
            To cancel your subscription, please contact us at support@duitplan.app.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Premium() {
  const { status, isLoading } = useSubscription();
  const [, setLocation] = useLocation();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setIsCheckingOut(true);
    setCheckoutError(null);
    try {
      const { checkoutUrl } = await customFetch<{ checkoutUrl: string; orderId: string }>("/api/subscription/checkout", {
        method: "POST",
      });
      window.location.href = checkoutUrl;
    } catch (err) {
      const data = err instanceof ApiError
        ? (err.data as { message?: string; error?: string } | null)
        : null;
      const msg = data?.message ?? data?.error ?? "Unable to start checkout. Please try again.";
      setCheckoutError(msg);
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-12 max-w-3xl mx-auto animate-in fade-in duration-500 py-8">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto">
          <Star className="w-8 h-8 fill-primary" />
        </div>
        <h1 className="text-4xl font-bold text-foreground tracking-tight">Continue with DuitPlan</h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Full access to everything DuitPlan offers — no feature tiers, no limits.
        </p>
      </div>

      <Card className="border-primary shadow-xl max-w-lg mx-auto">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl text-primary">DuitPlan</CardTitle>
          <div className="mt-4 flex items-baseline justify-center gap-x-2">
            <span className="text-5xl font-bold tracking-tight text-foreground">BND 10</span>
            <span className="text-sm font-semibold leading-6 text-muted-foreground">/month</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">Billed monthly via Pocket Pay</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="space-y-3 text-sm">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex gap-x-3">
                <Check className="h-5 w-5 flex-none text-primary" />
                <span className="text-foreground">{feature}</span>
              </li>
            ))}
          </ul>

          {checkoutError && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{checkoutError}</span>
            </div>
          )}

          {status === "active" ? (
            <Button className="w-full" size="lg" variant="outline" disabled>
              <Check className="mr-2 w-4 h-4" />
              You&apos;re subscribed
            </Button>
          ) : (
            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleSubscribe}
              disabled={isCheckingOut}
            >
              {isCheckingOut ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Preparing checkout...</>
              ) : (
                <><CreditCard className="w-4 h-4" /> Subscribe with Pocket Pay</>
              )}
            </Button>
          )}

          <p className="text-xs text-center text-muted-foreground">
            Payment is processed securely by Pocket Pay (ThreeG Media). You will be redirected to Pocket to complete your payment.
          </p>
        </CardContent>
      </Card>

      <BillingStatus />
    </div>
  );
}
