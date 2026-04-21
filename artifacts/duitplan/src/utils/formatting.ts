import { formatDistanceToNow } from 'date-fns';

const PLACEHOLDER = '—';

/**
 * ISO 4217 currencies that have 0 minor units (no decimal places).
 * Used to correct the fraction digits passed to Intl.NumberFormat, since
 * some Node/ICU versions do not apply this rule automatically for all currencies.
 */
const ZERO_DECIMAL_CURRENCIES = new Set(['IDR', 'JPY', 'KRW', 'VND', 'BIF', 'GNF', 'MGA', 'PYG', 'RWF', 'UGX', 'XAF', 'XOF', 'XPF']);

/**
 * Formats a monetary amount using Intl.NumberFormat.
 * Decimal rules are determined by the currency: IDR (and other zero-decimal
 * currencies) show 0 decimal places; BND, MYR, USD etc. show 2.
 * Returns "—" for NaN or non-finite values.
 */
export function formatCurrency(amount: number, currency: string, locale?: string): string {
  if (!isFinite(amount) || isNaN(amount)) return PLACEHOLDER;
  const fractionDigits = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2;
  return new Intl.NumberFormat(locale ?? 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

/**
 * Formats a plain number using Intl.NumberFormat.
 * Returns "—" for NaN or non-finite values.
 */
export function formatNumber(value: number, locale?: string): string {
  if (!isFinite(value) || isNaN(value)) return PLACEHOLDER;
  return new Intl.NumberFormat(locale ?? 'en-US').format(value);
}

/**
 * Formats a date as DD/MM/YYYY using Intl.DateTimeFormat.
 */
export function formatDate(date: Date | string | number, locale?: string): string {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(locale ?? 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/**
 * Formats a date as a full date-time string using Intl.DateTimeFormat.
 */
export function formatDateTime(date: Date | string | number, locale?: string): string {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(locale ?? 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Formats a date as a relative time string, e.g. "2 hours ago", "3 days ago".
 * Uses date-fns formatDistanceToNow for natural language output.
 */
export function formatRelativeTime(date: Date | string | number, _locale?: string): string {
  const d = date instanceof Date ? date : new Date(date);
  return formatDistanceToNow(d, { addSuffix: true });
}
