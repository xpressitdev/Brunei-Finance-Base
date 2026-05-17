import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SocialAuth } from "@/components/SocialAuth";
import { isEmail } from "@/lib/password";

// Friendly messages for errors surfaced via ?error=... after a redirect
// from the Google/magic-link backend routes. Keep generic — never reveal
// whether the email exists in our system.
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_state: "That sign-in attempt expired. Please try again.",
  oauth_failed: "We couldn't complete Google sign-in. Please try again.",
  google_unavailable: "Google sign-in is not available right now. Please use your email and password.",
  google_unverified: "Your Google account email isn't verified. Verify it with Google, then try again.",
  magic_link_invalid: "That sign-in link is invalid or has expired. Please request a new one.",
  magic_link_failed: "We couldn't sign you in with that link. Please try again.",
};

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<Record<keyof FieldErrors, boolean>>({ email: false, password: false });
  const [serverError, setServerError] = useState("");
  const loginMutation = useLogin();
  const emailRef = useRef<HTMLInputElement>(null);

  // Surface server-side redirect errors from /api/auth/google/* and
  // /api/auth/magic-link/* once on mount. Strip the query string so the
  // banner doesn't reappear on refresh.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("error");
    if (code && OAUTH_ERROR_MESSAGES[code]) {
      setServerError(OAUTH_ERROR_MESSAGES[code]);
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const focusEmail = () => {
    setTouched((s) => ({ ...s, email: true }));
    emailRef.current?.focus();
  };

  const errors: FieldErrors = {};
  if (!email) errors.email = "Please enter your email.";
  else if (!isEmail(email)) errors.email = "Enter a valid email like name@example.com.";
  if (!password) errors.password = "Please enter your password.";

  const showError = (field: keyof FieldErrors) => touched[field] && errors[field];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setServerError("");
    if (errors.email || errors.password) return;
    try {
      await loginMutation.mutateAsync({ data: { email: email.trim(), password } });
      window.location.href = "/dashboard";
    } catch (err: any) {
      setServerError(err?.error || t("auth.errors.invalidCredentials"));
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <img src="/logo-mark.png" alt="" className="h-9 w-9 object-contain" />
        <span className="font-bold text-xl tracking-tight">DuitPlan</span>
      </Link>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8">
        <h1 className="text-2xl font-semibold mb-2 text-center">{t("auth.login.title")}</h1>
        <p className="text-muted-foreground mb-8 text-center">{t("auth.login.subtitle")}</p>

        {serverError && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("auth.login.emailLabel")}</Label>
            <Input
              id="email"
              ref={emailRef}
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((s) => ({ ...s, email: true }))}
              aria-invalid={showError("email") ? true : undefined}
              aria-describedby={showError("email") ? "email-error" : undefined}
              className={showError("email") ? "border-rose-400 focus-visible:ring-rose-300" : undefined}
              autoComplete="email"
            />
            {showError("email") && (
              <p id="email-error" className="text-xs text-rose-600" data-testid="error-email">{errors.email}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t("auth.login.passwordLabel")}</Label>
              <Link href="/forgot-password">
                <span className="text-xs text-primary hover:underline cursor-pointer" data-testid="link-forgot-password">
                  {t("auth.login.forgotPassword", "Forgot password?")}
                </span>
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((s) => ({ ...s, password: true }))}
              aria-invalid={showError("password") ? true : undefined}
              aria-describedby={showError("password") ? "password-error" : undefined}
              className={showError("password") ? "border-rose-400 focus-visible:ring-rose-300" : undefined}
              autoComplete="current-password"
            />
            {showError("password") && (
              <p id="password-error" className="text-xs text-rose-600" data-testid="error-password">{errors.password}</p>
            )}
          </div>
          <Button
            type="submit"
            className="w-full h-11 text-base mt-2"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? t("auth.login.signingIn") : t("auth.login.submit")}
          </Button>
        </form>

        <SocialAuth email={email} onEmailRequired={focusEmail} />

        <div className="mt-8 text-center text-sm text-muted-foreground">
          {t("auth.login.noAccount")}{" "}
          <Link href="/register">
            <span className="text-primary font-medium hover:underline cursor-pointer">{t("auth.login.signUp")}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
