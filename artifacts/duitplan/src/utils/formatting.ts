import { formatDistanceToNow } from 'date-fns';

const PLACEHOLDER = '—';

function isValidDate(d: Date): boolean {
  return !isNaN(d.getTime());
}

/**
 * Formats a monetary amount using Intl.NumberFormat with style: 'currency'.
 *
 * By default, decimal places are derived from the Intl API for the given
 * currency and locale. Pass `fractionDigits` to override — for example when
 * the REGIONS config specifies a different canonical decimal count (e.g. IDR = 0).
 * There is no currency-specific logic inside this function.
 *
 * Returns "—" for NaN, non-finite, or invalid values.
 */
export function formatCurrency(
  amount: number,
  currency: string,
  locale?: string,
  fractionDigits?: number,
): string {
  if (!isFinite(amount) || isNaN(amount)) return PLACEHOLDER;
  const opts: Intl.NumberFormatOptions = { style: 'currency', currency };
  if (fractionDigits !== undefined) {
    opts.minimumFractionDigits = fractionDigits;
    opts.maximumFractionDigits = fractionDigits;
  }
  return new Intl.NumberFormat(locale ?? 'en-US', opts).format(amount);
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
 * Returns "—" for invalid dates.
 */
export function formatDate(date: Date | string | number, locale?: string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (!isValidDate(d)) return PLACEHOLDER;
  return new Intl.DateTimeFormat(locale ?? 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/**
 * Formats a date as a full date-time string using Intl.DateTimeFormat.
 * Returns "—" for invalid dates.
 */
export function formatDateTime(date: Date | string | number, locale?: string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (!isValidDate(d)) return PLACEHOLDER;
  return new Intl.DateTimeFormat(locale ?? 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Formats a date as a locale-aware "Month Year" string (e.g. "April 2026").
 * Returns "—" for invalid dates.
 */
export function formatMonthYear(date: Date | string | number, locale?: string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (!isValidDate(d)) return PLACEHOLDER;
  return new Intl.DateTimeFormat(locale ?? 'en-US', {
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/**
 * Formats a date as a locale-aware short month name (e.g. "Apr").
 * Returns "—" for invalid dates.
 */
export function formatMonthShort(date: Date | string | number, locale?: string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (!isValidDate(d)) return PLACEHOLDER;
  return new Intl.DateTimeFormat(locale ?? 'en-US', {
    month: 'short',
  }).format(d);
}

/**
 * Formats a date as a locale-aware relative time string using Intl.RelativeTimeFormat,
 * e.g. "2 hours ago", "3 days ago". Falls back to date-fns for English when the
 * Intl API is unavailable. Returns "—" for invalid dates.
 */
export function formatRelativeTime(date: Date | string | number, locale?: string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (!isValidDate(d)) return PLACEHOLDER;

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
