import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useResetPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { checkPasswordPolicy, PASSWORD_MIN_LENGTH } from "@/lib/password";

export default function ResetPassword() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const tokenFromUrl = params.get("token") ?? "";
  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState({ password: false, confirm: false });
  const [serverError, setServerError] = useState("");
  const [done, setDone] = useState(false);
  const mutation = useResetPassword();

  useEffect(() => { setToken(tokenFromUrl); }, [tokenFromUrl]);

  const policy = checkPasswordPolicy(password);
  const passwordError = !policy.ok ? policy.reason : undefined;
  const confirmError = confirm && confirm !== password ? "Passwords don't match." : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ password: true, confirm: true });
    setServerError("");
    if (passwordError || confirmError || !token) return;
    try {
      await mutation.mutateAsync({ data: { token, password } });
      setDone(true);
    } catch (err: any) {
      setServerError(err?.error || "Couldn't reset your password. The link may have expired.");
    }
  };

  if (!tokenFromUrl) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8 text-center space-y-4">
          <h1 className="text-xl font-semibold">Reset link missing</h1>
          <p className="text-sm text-muted-foreground">
            Open the most recent reset email and tap the link there. If it doesn't work, request a new one.
          </p>
          <Button asChild className="w-full">
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <img src="/logo-mark.png" alt="" className="h-9 w-9 object-contain" />
        <span className="font-bold text-xl tracking-tight">DuitPlan</span>
      </Link>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8">
        <h1 className="text-2xl font-semibold mb-2 text-center">Set a new password</h1>

        {done ? (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>Your password has been updated. You can now sign in.</AlertDescription>
            </Alert>
            <Button asChild className="w-full">
              <Link href="/login">Go to sign in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((s) => ({ ...s, password: true }))}
                aria-invalid={touched.password && passwordError ? true : undefined}
                className={touched.password && passwordError ? "border-rose-400 focus-visible:ring-rose-300" : undefined}
                minLength={PASSWORD_MIN_LENGTH}
                autoComplete="new-password"
              />
              <PasswordStrengthMeter password={password} />
              {touched.password && passwordError && <p className="text-xs text-rose-600">{passwordError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onBlur={() => setTouched((s) => ({ ...s, confirm: true }))}
                aria-invalid={touched.confirm && confirmError ? true : undefined}
                className={touched.confirm && confirmError ? "border-rose-400 focus-visible:ring-rose-300" : undefined}
                autoComplete="new-password"
              />
              {touched.confirm && confirmError && <p className="text-xs text-rose-600">{confirmError}</p>}
            </div>
            <Button type="submit" className="w-full h-11" disabled={mutation.isPending}>
              {mutation.isPending ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
