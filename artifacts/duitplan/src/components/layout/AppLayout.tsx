import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { PaydayBanner } from "@/components/PaydayBanner";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <PaydayBanner />
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
