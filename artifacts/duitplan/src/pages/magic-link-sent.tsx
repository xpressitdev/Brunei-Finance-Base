import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

// Confirmation screen after the user requests a magic link. We don't reveal
// whether the email exists in our system — every request lands here.
export default function MagicLinkSent() {
  const [location] = useLocation();
  const [email, setEmail] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get("email") ?? "");
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <img src="/logo-mark.png" alt="" className="h-9 w-9 object-contain" />
        <span className="font-bold text-xl tracking-tight">DuitPlan</span>
      </Link>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8 text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-6 w-6 text-primary" strokeWidth={1.75} />
        </div>
        <h1 className="text-2xl font-semibold mb-2">Check your inbox</h1>
        <p className="text-muted-foreground mb-1">
          We sent a sign-in link to
        </p>
        {email && (
          <p className="font-medium mb-6 break-all" data-testid="text-magic-link-email">{email}</p>
        )}
        <p className="text-sm text-muted-foreground mb-8">
          Tap the link in the email to sign in. It expires in 15 minutes and can only be used once.
          You can close this tab — the link opens in any browser.
        </p>

        <Button asChild variant="outline" className="w-full h-11">
          <Link href="/login">Back to sign in</Link>
        </Button>

        <p className="mt-6 text-xs text-muted-foreground">
          Didn't get it? Check your spam folder, or try again from the sign-in page.
        </p>
      </div>
    </div>
  );
}
