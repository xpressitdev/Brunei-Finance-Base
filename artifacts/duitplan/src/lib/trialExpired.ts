import { ApiError } from "@workspace/api-client-react";

interface TrialExpiredData {
  code?: string;
  error?: string;
}

export function isTrialExpiredError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  const data = err.data as TrialExpiredData | null;
  return data?.code === "TRIAL_EXPIRED";
}
