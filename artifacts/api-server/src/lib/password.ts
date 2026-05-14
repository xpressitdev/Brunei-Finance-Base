// Shared password policy. Mirror the same rules in
// artifacts/duitplan/src/lib/password.ts so client-side feedback
// matches what the server enforces.
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

// Used at login time to flag legacy users whose stored password no longer
// meets the current policy. We can only assess this when we have the
// plaintext (i.e. on a successful login attempt).
export function isWeakPassword(pw: string): boolean {
  return !checkPasswordPolicy(pw).ok;
}
