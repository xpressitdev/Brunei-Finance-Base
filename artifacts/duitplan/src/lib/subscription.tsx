import React, { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type SubscriptionStatus = "trial" | "active" | "expired";

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  daysRemaining: number | null;
  trialEndsAt: string;
  subscription: {
    id: string;
    planId: string;
    startDate: string;
    endDate: string | null;
    nextBillingDate: string | null;
  } | null;
}

interface SubscriptionContextType {
  data: SubscriptionInfo | null;
  isLoading: boolean;
  isExpired: boolean;
  status: SubscriptionStatus | null;
  daysRemaining: number | null;
  refetch: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

async function fetchSubscription(): Promise<SubscriptionInfo> {
  return customFetch<SubscriptionInfo>("/api/subscription/current");
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["subscription", "current"],
    queryFn: fetchSubscription,
    staleTime: 60_000,
    retry: false,
  });

  const isExpired = data?.status === "expired";
  const status = data?.status ?? null;
  const daysRemaining = data?.daysRemaining ?? null;

  return (
    <SubscriptionContext.Provider value={{ data: data ?? null, isLoading, isExpired, status, daysRemaining, refetch }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}
