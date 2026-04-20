import { formatDistanceToNow, format } from "date-fns";

// ─────────────────────────────────────────────
// Currency config
// ─────────────────────────────────────────────

export const SUPPORTED_CURRENCIES = [
  { code: "BND", label: "BND — Brunei Dollar" },
  { code: "MYR", label: "MYR — Malaysian Ringgit" },
  { code: "IDR", label: "IDR — Indonesian Rupiah" },
  { code: "USD", label: "USD — US Dollar" },
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]["code"];

export const SUPPORTED_LOCALES = [
  { code: "en-BN", label: "Brunei (en-BN)" },
  { code: "en-MY", label: "Malaysia (en-MY)" },
  { code: "id-ID", label: "Indonesia (id-ID)" },
  { code: "en-US", label: "Other (en-US)" },
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]["code"];

/** Map locale → default currency */
export const LOCALE_CURRENCY_MAP: Record<string, string> = {
  "en-BN": "BND",
  "en-MY": "MYR",
  "ms-MY": "MYR",
  "id-ID": "IDR",
  "en-ID": "IDR",
  "en-US": "USD",
};

/** Map country code (from ipapi) → { currency, locale } */
export const COUNTRY_MAP: Record<string, { currency: string; locale: string }> = {
  BN: { currency: "BND", locale: "en-BN" },
  MY: { currency: "MYR", locale: "en-MY" },
  ID: { currency: "IDR", locale: "id-ID" },
};

/** Number of fraction digits per currency */
const FRACTION_DIGITS: Record<string, number> = {
  IDR: 0,
  BND: 2,
  MYR: 2,
  USD: 2,
};

function fractionDigits(currency: string): number {
  return FRACTION_DIGITS[currency.toUpperCase()] ?? 2;
}

// ─────────────────────────────────────────────
// formatCurrency
// ─────────────────────────────────────────────

/**
 * Format a number as currency.
 * e.g. formatCurrency(5769.36, "MYR", "en-MY") → "RM 5,769.36"
 * e.g. formatCurrency(5769000, "IDR", "id-ID") → "Rp 5.769.000"
 */
export function formatCurrency(
  amount: number,
  currency: string = "BND",
  locale: string = "en-BN"
): string {
  const decimals = fractionDigits(currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    // Fallback for unsupported locale/currency combos
    const sign = currency.toUpperCase() === "MYR" ? "RM" : currency;
    return `${sign} ${amount.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }
}

/** Compact format e.g. RM 5.8K, Rp 1.5M */
export function formatCurrencyCompact(
  amount: number,
  currency: string = "BND",
  locale: string = "en-BN"
): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    return formatCurrency(amount / 1_000_000, currency, locale).replace(
      /[\d.,]+$/,
      (m) => m + "M"
    );
  }
  if (abs >= 1_000) {
    return formatCurrency(amount / 1_000, currency, locale).replace(
      /[\d.,]+$/,
      (m) => m + "K"
    );
  }
  return formatCurrency(amount, currency, locale);
}

// ─────────────────────────────────────────────
// formatNumber
// ─────────────────────────────────────────────

export function formatNumber(value: number, locale: string = "en-BN"): string {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return value.toLocaleString();
  }
}

// ─────────────────────────────────────────────
// formatDate / formatDateTime / formatRelativeTime
// ─────────────────────────────────────────────

/** DD/MM/YYYY for MY/ID locales, otherwise locale-default */
export function formatDate(
  date: Date | string | null | undefined,
  locale: string = "en-BN"
): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  try {
    // All our supported locales use DD/MM/YYYY
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return format(d, "dd/MM/yyyy");
  }
}

export function formatDateTime(
  date: Date | string | null | undefined,
  locale: string = "en-BN"
): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return format(d, "dd/MM/yyyy HH:mm");
  }
}

export function formatRelativeTime(
  date: Date | string | null | undefined
): string {
  if (!date) return "No activity yet";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "No activity yet";
  try {
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "Unknown";
  }
}

// ─────────────────────────────────────────────
// getCurrencyInputStep
// Returns the appropriate step for <input type="number"> fields
// ─────────────────────────────────────────────

export function getCurrencyInputStep(currency: string): string {
  return fractionDigits(currency) === 0 ? "1" : "0.01";
}

/** Returns "0" for IDR, "0.00" for others */
export function getCurrencyPlaceholder(currency: string): string {
  return fractionDigits(currency) === 0 ? "0" : "0.00";
}

/**
 * Round an amount to the correct number of decimal places for the currency
 * and return it as a numeric string suitable for API/DB submission.
 * e.g. formatAmountForApi(50000.7, "IDR") → "50001"
 *      formatAmountForApi(50000.7, "BND") → "50000.70"
 */
export function formatAmountForApi(amount: number, currency: string): string {
  const d = fractionDigits(currency);
  if (d === 0) {
    return String(Math.round(amount));
  }
  const factor = Math.pow(10, d);
  return (Math.round(amount * factor) / factor).toFixed(d);
}
