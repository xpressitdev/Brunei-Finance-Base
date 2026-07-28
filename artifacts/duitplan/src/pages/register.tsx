import { useRef, useState } from "react";
import { Link } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { SocialAuth } from "@/components/SocialAuth";
import { checkPasswordPolicy, isEmail, PASSWORD_MIN_LENGTH } from "@/lib/password";

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
}

export default function Register() {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<Record<keyof FieldErrors, boolean>>({ fullName: false, email: false, password: false });
  const [serverError, setServerError] = useState("");
  const registerMutation = useRegister();
  const emailRef = useRef<HTMLInputElement>(null);

  const focusEmail = () => {
    setTouched((s) => ({ ...s, email: true }));
    emailRef.current?.focus();
  };

  const errors: FieldErrors = {};
  if (!fullName.trim()) errors.fullName = "Please enter your name.";
  if (!email) errors.email = "Please enter your email.";
  else if (!isEmail(email)) errors.email = "Enter a valid email like name@example.com.";
  const policy = checkPasswordPolicy(password);
  if (!policy.ok) errors.password = policy.reason;

  const showError = (field: keyof FieldErrors) => touched[field] && errors[field];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ fullName: true, email: true, password: true });
    setServerError("");
    if (errors.fullName || errors.email || errors.password) return;
    try {
      await registerMutation.mutateAsync({ data: { fullName: fullName.trim(), email: email.trim(), password } });
      window.location.href = "/onboarding";
    } catch (err: any) {
      setServerError(err?.error || t("auth.errors.registrationFailed"));
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <img src="/logo-mark.png" alt="" className="h-9 w-9 object-contain" />
        <span className="font-bold text-xl tracking-tight">DuitPlan</span>
      </Link>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8">
        <h1 className="text-2xl font-semibold mb-2 text-center">{t("auth.register.title")}</h1>
        <p className="text-muted-foreground mb-8 text-center">{t("auth.register.subtitle")}</p>

        {serverError && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="fullName">{t("auth.register.fullNameLabel")}</Label>
            <Input
              id="fullName"
              type="text"
              placeholder={t("auth.register.fullNamePlaceholder")}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={() => setTouched((s) => ({ ...s, fullName: true }))}
              aria-invalid={showError("fullName") ? true : undefined}
              aria-describedby={showError("fullName") ? "fullName-error" : undefined}
              className={showError("fullName") ? "border-rose-400 focus-visible:ring-rose-300" : undefined}
            />
            {showError("fullName") && (
              <p id="fullName-error" className="text-xs text-rose-600" data-testid="error-fullName">{errors.fullName}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("auth.register.emailLabel")}</Label>
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
            />
            {showError("email") && (
              <p id="email-error" className="text-xs text-rose-600" data-testid="error-email">{errors.email}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t("auth.register.passwordLabel")}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((s) => ({ ...s, password: true }))}
              aria-invalid={showError("password") ? true : undefined}
              aria-describedby={showError("password") ? "password-error" : "password-strength"}
              className={showError("password") ? "border-rose-400 focus-visible:ring-rose-300" : undefined}
              minLength={PASSWORD_MIN_LENGTH}
              autoComplete="new-password"
            />
            <PasswordStrengthMeter password={password} />
            {showError("password") && (
              <p id="password-error" className="text-xs text-rose-600" data-testid="error-password">{errors.password}</p>
            )}
          </div>
          <Button
            type="submit"
            className="w-full h-11 text-base mt-2"
            disabled={registerMutation.isPending}
          >
            {registerMutation.isPending ? t("auth.register.creating") : t("auth.register.submit")}
          </Button>
        </form>

        <SocialAuth email={email} onEmailRequired={focusEmail} />

        <div className="mt-8 text-center text-sm text-muted-foreground">
          {t("auth.register.hasAccount")}{" "}
          <Link href="/login">
            <span className="text-primary font-medium hover:underline cursor-pointer">{t("auth.register.signIn")}</span>
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {t("auth.register.govDisclaimer", "DuitPlan is free to use. By creating an account, you acknowledge that anonymised data may be shared with and used by the Government of Brunei Darussalam.")}
        </p>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          {t("auth.register.privacyNote", "Your data is encrypted and never sold.")}{" "}
          <Link href="/privacy">
            <span className="text-emerald-700 font-medium hover:underline cursor-pointer">
              {t("auth.register.privacyLink", "Privacy & Trust")}
            </span>
          </Link>
        </p>
      </div>
    </div>
  );
}
