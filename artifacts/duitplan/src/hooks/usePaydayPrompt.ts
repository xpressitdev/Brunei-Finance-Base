import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface PaydayPromptDebt {
  id: string;
  debtType: string;
  lender: string;
  monthlyPayment: string;
}

export interface PaydayPromptData {
  id: string;
  state: string;
  year: number;
  month: number;
  payday: number;
  monthlyIncome: string;
  debts: PaydayPromptDebt[];
}

export interface ConfirmTransaction {
  type: "credit" | "debit";
  amount: string;
  accountId: string | null;
  description: string;
  date: string;
  notes?: string | null;
}

const QUERY_KEY = ["payday-prompt", "current"] as const;

export function usePaydayPrompt() {
  const qc = useQueryClient();

  const query = useQuery<PaydayPromptData | null>({
    queryKey: QUERY_KEY,
    queryFn: () => customFetch<PaydayPromptData | null>("/api/payday-prompt/current"),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: QUERY_KEY });

  const skipMutation = useMutation({
    mutationFn: (id: string) =>
      customFetch(`/api/payday-prompt/${id}/skip`, { method: "POST" }),
    onSuccess: invalidate,
  });

  const remindTomorrowMutation = useMutation({
    mutationFn: (id: string) =>
      customFetch(`/api/payday-prompt/${id}/remind-tomorrow`, { method: "POST" }),
    onSuccess: invalidate,
  });

  const confirmMutation = useMutation({
    mutationFn: ({ id, transactions }: { id: string; transactions: ConfirmTransaction[] }) =>
      customFetch(`/api/payday-prompt/${id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ transactions }),
      }),
    onSuccess: invalidate,
  });

  return {
    prompt: query.data ?? null,
    isLoading: query.isLoading,
    skip: skipMutation.mutateAsync,
    remindTomorrow: remindTomorrowMutation.mutateAsync,
    confirm: confirmMutation.mutateAsync,
    isConfirming: confirmMutation.isPending,
  };
}
