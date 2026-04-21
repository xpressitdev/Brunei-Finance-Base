import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, formatRelativeTime } from './formatting';

describe('formatCurrency', () => {
  it('formats BND with currency symbol and numeric value', () => {
    const result = formatCurrency(5769.36, 'BND', 'en-BN');
    expect(result).toMatch(/BND/);
    expect(result).toMatch(/5[,.]?769/);
  });

  it('formats MYR with RM symbol and numeric value', () => {
    const result = formatCurrency(5769.36, 'MYR', 'ms-MY');
    expect(result).toMatch(/RM/);
    expect(result).toMatch(/5[,.]?769/);
  });

  it('formats IDR with Rp symbol and numeric value', () => {
    const result = formatCurrency(5769.36, 'IDR', 'id-ID');
    expect(result).toMatch(/Rp/);
    expect(result).toMatch(/5[,.]?769/);
  });

  it('formats zero BND cleanly without NaN or empty string', () => {
    const result = formatCurrency(0, 'BND', 'en-BN');
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
    const result = formatCurrency(1000000, 'IDR', 'id-ID');
    expect(result).toMatch(/Rp/);
    expect(result).toMatch(/1[.,]000[.,]000/);
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
