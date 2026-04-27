export function fmtBND(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return "BND " + v.toLocaleString("en-BN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtBNDShort(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("en-BN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function safeNum(x: unknown): number {
  const n = typeof x === "number" ? x : parseFloat(String(x ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

export function fmtMonths(m: number): string {
  if (!Number.isFinite(m)) return "—";
  const yrs = Math.floor(m / 12);
  const mo = m % 12;
  if (yrs === 0) return `${mo} mo`;
  if (mo === 0) return `${yrs} yr`;
  return `${yrs} yr ${mo} mo`;
}
