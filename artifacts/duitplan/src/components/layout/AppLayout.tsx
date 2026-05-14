import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { WeakPasswordBanner } from "@/components/WeakPasswordBanner";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-[100dvh] flex flex-col md:flex-row bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <EmailVerificationBanner />
        <WeakPasswordBanner />
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
