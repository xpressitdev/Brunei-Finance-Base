import { formatDistanceToNow } from 'date-fns';

const PLACEHOLDER = '—';

/**
 * Formats a monetary amount using Intl.NumberFormat with style: 'currency'.
 * Decimal places are determined by the currency's CLDR data (2 for BND/MYR, 0 for IDR, etc.).
 * Returns "—" for NaN or non-finite values.
 */
export function formatCurrency(amount: number, currency: string, locale?: string): string {
  if (!isFinite(amount) || isNaN(amount)) return PLACEHOLDER;
  return new Intl.NumberFormat(locale ?? 'en-US', {
    style: 'currency',
    currency,
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
 * Formats a date as a locale-aware relative time string using Intl.RelativeTimeFormat,
 * e.g. "2 hours ago", "3 days ago". Falls back to date-fns for English when the
 * Intl API is unavailable.
 */
export function formatRelativeTime(date: Date | string | number, locale?: string): string {
  const d = date instanceof Date ? date : new Date(date);
  const nowMs = Date.now();
  const diffMs = d.getTime() - nowMs;
  const diffSec = Math.round(diffMs / 1000);
  const absSec = Math.abs(diffSec);

  let value: number;
  let unit: Intl.RelativeTimeFormatUnit;

  if (absSec < 60) {
    value = diffSec;
    unit = 'second';
  } else if (absSec < 3600) {
    value = Math.round(diffSec / 60);
    unit = 'minute';
  } else if (absSec < 86400) {
    value = Math.round(diffSec / 3600);
    unit = 'hour';
  } else if (absSec < 86400 * 30) {
    value = Math.round(diffSec / 86400);
    unit = 'day';
  } else if (absSec < 86400 * 365) {
    value = Math.round(diffSec / (86400 * 30));
    unit = 'month';
  } else {
    value = Math.round(diffSec / (86400 * 365));
    unit = 'year';
  }

  try {
    return new Intl.RelativeTimeFormat(locale ?? 'en-US', { numeric: 'auto' }).format(value, unit);
  } catch {
    return formatDistanceToNow(d, { addSuffix: true });
  }
}
