import { useLocation } from "wouter";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SubscriptionFailed() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <XCircle className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Payment failed</h1>
          <p className="text-muted-foreground">
            Your payment could not be processed. No charges have been made. Please try again or contact support if the problem persists.
          </p>
        </div>
        <div className="space-y-3">
          <Button size="lg" className="w-full" onClick={() => setLocation("/premium")}>
            Try again
          </Button>
          <Button size="lg" variant="outline" className="w-full" onClick={() => setLocation("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
