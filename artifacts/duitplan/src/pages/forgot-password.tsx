import { useState } from "react";
import { Link } from "wouter";
import { useForgotPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isEmail } from "@/lib/password";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const mutation = useForgotPassword();

  const error = !email
    ? "Please enter your email."
    : !isEmail(email)
      ? "Enter a valid email like name@example.com."
      : null;
  const showError = touched && error;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (error) return;
    try {
      const res = await mutation.mutateAsync({ data: { email: email.trim() } });
      setSubmitted(true);
      setDevUrl(res?.devResetUrl ?? null);
    } catch {
      // The endpoint always returns 200; only network failures land here.
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <img src="/logo-mark.png" alt="" className="h-9 w-9 object-contain" />
        <span className="font-bold text-xl tracking-tight">DuitPlan</span>
      </Link>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8">
        <h1 className="text-2xl font-semibold mb-2 text-center">Forgot password?</h1>
        <p className="text-muted-foreground mb-6 text-center">
          Enter the email you signed up with. We'll send you a link to set a new password.
        </p>

        {submitted ? (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                If <strong>{email}</strong> is registered and verified, a reset link is on its way. The link expires in 60 minutes.
              </AlertDescription>
            </Alert>
            {devUrl && (
              <Alert>
                <AlertDescription>
                  <span className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">Dev mode</span>
                  <a href={devUrl} className="text-primary underline break-all" data-testid="link-dev-reset-url">{devUrl}</a>
                </AlertDescription>
              </Alert>
            )}
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={showError ? true : undefined}
                className={showError ? "border-rose-400 focus-visible:ring-rose-300" : undefined}
                autoComplete="email"
              />
              {showError && <p className="text-xs text-rose-600">{error}</p>}
            </div>
            <Button type="submit" className="w-full h-11" disabled={mutation.isPending}>
              {mutation.isPending ? "Sending…" : "Send reset link"}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              <Link href="/login">
                <span className="text-primary hover:underline cursor-pointer">Back to sign in</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
