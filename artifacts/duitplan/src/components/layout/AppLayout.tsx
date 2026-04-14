import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TrialBanner } from "@/components/subscription/TrialBanner";
import { ExpiredOverlay } from "@/components/subscription/ExpiredOverlay";
import { SubscriptionProvider } from "@/lib/subscription";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SubscriptionProvider>
      <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <TrialBanner />
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            {children}
          </div>
        </main>
        <ExpiredOverlay />
      </div>
    </SubscriptionProvider>
  );
}
