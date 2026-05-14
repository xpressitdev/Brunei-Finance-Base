// Mirror of artifacts/api-server/src/lib/password.ts so the form-level
// feedback we show users matches what the server enforces.
export const PASSWORD_MIN_LENGTH = 10;

export interface PasswordCheckResult {
  ok: boolean;
  reason?: string;
}

export function checkPasswordPolicy(pw: string): PasswordCheckResult {
  if (typeof pw !== "string") return { ok: false, reason: "Password is required." };
  if (pw.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, reason: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (!/\d/.test(pw)) {
    return { ok: false, reason: "Password must include at least one digit." };
  }
  return { ok: true };
}

export type PasswordStrength = "empty" | "weak" | "fair" | "good" | "strong";

// Cheap, dependency-free indicator. Not a security control — server-side
// `checkPasswordPolicy` is the source of truth for "valid"; this just
// gives the user feedback while typing.
export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: PasswordStrength } {
  if (!pw) return { score: 0, label: "empty" };
  let score = 0;
  if (pw.length >= 10) score += 1;
  if (pw.length >= 14) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  const clamped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  const label: PasswordStrength = clamped <= 1 ? "weak" : clamped === 2 ? "fair" : clamped === 3 ? "good" : "strong";
  return { score: clamped, label };
}

export function isEmail(value: string): boolean {
  // Simple, permissive — server-side zod is the strict authority.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
