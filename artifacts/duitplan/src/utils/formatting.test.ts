import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate } from './formatting';

describe('formatCurrency', () => {
  it('formats BND with 2 decimal places', () => {
    const result = formatCurrency(5769.36, 'BND', 'en-BN');
    expect(result).toMatch(/5[,.]?769[.,]36/);
    expect(result).toMatch(/BND/);
  });

  it('formats MYR with 2 decimal places', () => {
    const result = formatCurrency(5769.36, 'MYR', 'ms-MY');
    expect(result).toMatch(/5[,.]?769[.,]36/);
    expect(result).toMatch(/RM/);
  });

  it('formats IDR with 0 decimal places', () => {
    const result = formatCurrency(5769.36, 'IDR', 'id-ID');
    expect(result).toMatch(/Rp/);
    expect(result).toMatch(/5[,.]?769/);
    expect(result).not.toMatch(/[.,]\d{2}$/);
  });

  it('formats zero BND cleanly', () => {
    const result = formatCurrency(0, 'BND', 'en-BN');
    expect(result).toMatch(/0[.,]00/);
    expect(result).toMatch(/BND/);
  });

  it('returns placeholder for NaN', () => {
    expect(formatCurrency(NaN, 'BND', 'en-BN')).toBe('—');
  });

  it('returns placeholder for Infinity', () => {
    expect(formatCurrency(Infinity, 'BND', 'en-BN')).toBe('—');
  });

  it('formats 1,000,000 IDR without decimals', () => {
    const result = formatCurrency(1000000, 'IDR', 'id-ID');
    expect(result).toMatch(/Rp/);
    expect(result).toMatch(/1[.,]000[.,]000/);
    expect(result).not.toMatch(/[.,]\d{2}$/);
  });
});

describe('formatDate', () => {
  const testDate = new Date('2026-04-21T12:00:00Z');

  it('formats with year 2026, month 04, day 21 for en-BN', () => {
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
