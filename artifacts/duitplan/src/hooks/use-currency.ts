import { useAuth } from "@/lib/auth";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatNumber,
  getCurrencyInputStep,
  getCurrencyPlaceholder,
  formatAmountForApi,
} from "@/lib/formatting";

/**
 * Returns currency/locale-aware formatting helpers sourced from the
 * authenticated user's profile.  Falls back to BND / en-BN for unauthenticated
 * contexts (login page, etc.).
 */
export function useCurrency() {
  const { user } = useAuth();
  const currency: string = user?.profile?.currency ?? "BND";
  const locale: string = user?.profile?.locale ?? "en-BN";

  return {
    currency,
    locale,
    /** Format an amount as currency (e.g. "RM 5,769.36" or "Rp 5.769") */
    fmt: (amount: number) => formatCurrency(amount, currency, locale),
    /** Short compact form, e.g. "RM 5.8K" */
    fmtCompact: (amount: number) => formatCurrencyCompact(amount, currency, locale),
    /** Format a date in locale-appropriate DD/MM/YYYY */
    fmtDate: (date: Date | string | null | undefined) => formatDate(date, locale),
    /** Format date + time */
    fmtDateTime: (date: Date | string | null | undefined) => formatDateTime(date, locale),
    /** Relative time, e.g. "2 hours ago" */
    fmtRelative: (date: Date | string | null | undefined) => formatRelativeTime(date),
    /** Plain number with locale separators */
    fmtNumber: (n: number) => formatNumber(n, locale),
    /** "0.01" or "1" depending on currency decimal rules */
    inputStep: getCurrencyInputStep(currency),
    /** "0.00" or "0" */
    inputPlaceholder: getCurrencyPlaceholder(currency),
    /** Currency code symbol label, e.g. "RM" or "Rp" or "BND" */
    currencyLabel: currency,
    /** Round and stringify an amount correctly for API/DB submission (IDR → integer string, others → 2dp) */
    fmtApi: (amount: number) => formatAmountForApi(amount, currency),
  };
}
