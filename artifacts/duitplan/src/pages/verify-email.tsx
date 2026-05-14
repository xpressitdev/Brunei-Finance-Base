import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useVerifyEmail } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";

export default function VerifyEmail() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token") ?? "";
  const mutation = useVerifyEmail();
  const [status, setStatus] = useState<"pending" | "ok" | "error">("pending");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("This link is missing its verification token.");
      return;
    }
    let cancelled = false;
    mutation
      .mutateAsync({ data: { token } })
      .then(() => { if (!cancelled) setStatus("ok"); })
      .catch((err: any) => {
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(err?.error || "Verification failed. The link may have expired.");
      });
    return () => { cancelled = true; };
    // Run once on mount; mutation identity is stable per render but we don't want to refire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <img src="/logo-mark.png" alt="" className="h-9 w-9 object-contain" />
        <span className="font-bold text-xl tracking-tight">DuitPlan</span>
      </Link>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8 space-y-4 text-center">
        {status === "pending" && (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Verifying your email…</p>
          </>
        )}
        {status === "ok" && (
          <>
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h1 className="text-xl font-semibold">Email verified</h1>
            <p className="text-sm text-muted-foreground">
              Thanks — you can now reset your password if you ever need to.
            </p>
            <Button asChild className="w-full">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </>
        )}
        {status === "error" && (
          <>
            <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto" />
            <h1 className="text-xl font-semibold">Verification failed</h1>
            <Alert variant="destructive"><AlertDescription>{errorMsg}</AlertDescription></Alert>
            <p className="text-sm text-muted-foreground">
              Sign in and request a new verification email from the banner at the top of the app.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
