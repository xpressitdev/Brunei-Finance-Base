import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, formatRelativeTime } from './formatting';

describe('formatCurrency', () => {
  it('formats BND with currency symbol and 2 decimal places', () => {
    const result = formatCurrency(5769.36, 'BND', 'en-BN', 2);
    expect(result).toMatch(/BND/);
    expect(result).toMatch(/5[,.]?769/);
    expect(result).toMatch(/\.36$/);
  });

  it('formats MYR with RM symbol and 2 decimal places', () => {
    const result = formatCurrency(7500, 'MYR', 'ms-MY', 2);
    expect(result).toMatch(/RM/);
    expect(result).toMatch(/7[,.]?500/);
    expect(result).toMatch(/\.00$/);
  });

  it('formats IDR with Rp symbol and 0 decimal places — no trailing ,00', () => {
    const result = formatCurrency(75000000, 'IDR', 'id-ID', 0);
    expect(result).toMatch(/Rp/);
    expect(result).toMatch(/75/);
    expect(result).not.toMatch(/,00$/);
    expect(result).not.toMatch(/\.00$/);
  });

  it('formats IDR 12,000,000 with correct thousand separators and no decimals', () => {
    const result = formatCurrency(12000000, 'IDR', 'id-ID', 0);
    expect(result).toMatch(/Rp/);
    expect(result).toMatch(/12[.,]000[.,]000/);
    expect(result).not.toMatch(/,00$/);
    expect(result).not.toMatch(/\.00$/);
  });

  it('regression: MYR preserves 2 decimal places', () => {
    const result = formatCurrency(5769.36, 'MYR', 'ms-MY', 2);
    expect(result).toMatch(/RM/);
    expect(result).toMatch(/5[,.]?769/);
    expect(result).toMatch(/36/);
  });

  it('regression: BND preserves 2 decimal places ending in .36', () => {
    const result = formatCurrency(5769.36, 'BND', 'en-BN', 2);
    expect(result).toMatch(/BND/);
    expect(result).toMatch(/\.36$/);
  });

  it('formats zero BND cleanly without NaN or empty string', () => {
    const result = formatCurrency(0, 'BND', 'en-BN', 2);
    expect(result).toMatch(/BND/);
    expect(result).toMatch(/0/);
    expect(result).not.toBe('');
    expect(result).not.toMatch(/NaN/);
  });

  it('returns placeholder "—" for NaN', () => {
    expect(formatCurrency(NaN, 'BND', 'en-BN')).toBe('—');
  });

  it('returns placeholder "—" for Infinity', () => {
    expect(formatCurrency(Infinity, 'BND', 'en-BN')).toBe('—');
  });

  it('formats 1,000,000 IDR with thousand separator', () => {
    const result = formatCurrency(1000000, 'IDR', 'id-ID', 0);
    expect(result).toMatch(/Rp/);
    expect(result).toMatch(/1[.,]000[.,]000/);
    expect(result).not.toMatch(/,00$/);
  });
});

describe('formatDate', () => {
  const testDate = new Date('2026-04-21T12:00:00Z');

  it('formats with correct year, month, and day components for en-BN', () => {
    const result = formatDate(testDate, 'en-BN');
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/04/);
    expect(result).toMatch(/21/);
  });

  it('formats as DD/MM/YYYY for ms-MY', () => {
    const result = formatDate(testDate, 'ms-MY');
    expect(result).toMatch(/21[\/\-]04[\/\-]2026/);
  });

  it('formats as DD/MM/YYYY for id-ID', () => {
    const result = formatDate(testDate, 'id-ID');
    expect(result).toMatch(/21[\/\-]04[\/\-]2026/);
  });
});

describe('formatRelativeTime', () => {
  it('formats a past date with "ago" or similar suffix', () => {
    const oneHourAgo = new Date(Date.now() - 3600 * 1000);
    const result = formatRelativeTime(oneHourAgo, 'en-US');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toMatch(/ago|hour|minute/i);
  });

  it('returns a string for a future date', () => {
    const inTwoDays = new Date(Date.now() + 2 * 86400 * 1000);
    const result = formatRelativeTime(inTwoDays, 'en-US');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
