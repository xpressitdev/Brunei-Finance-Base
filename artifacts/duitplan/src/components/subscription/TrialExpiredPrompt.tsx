import { useLocation } from "wouter";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TrialExpiredPrompt({ action = "perform this action" }: { action?: string }) {
  const [, setLocation] = useLocation();

  return (
    <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-medium text-destructive">Trial expired</p>
        <p className="text-muted-foreground mt-0.5">
          Your trial has ended. Subscribe to {action}.
        </p>
      </div>
      <Button size="sm" variant="destructive" onClick={() => setLocation("/premium")}>
        Subscribe
      </Button>
    </div>
  );
}
