import { useState } from "react";
import { Button } from "@/components/ui/button";
import { isEmail } from "@/lib/password";

// Google "G" mark — official multi-color SVG. Kept inline to avoid bundling
// an icon set just for one mark and to stay on Lucide-only elsewhere.
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

interface Props {
  // The current email from the parent form. Reused so users don't type their
  // address twice when requesting a magic link.
  email: string;
  // Called when the magic-link button is clicked with an empty/invalid email.
  // The parent should focus its email field and surface the validation error.
  onEmailRequired: () => void;
}

export function SocialAuth({ email, onEmailRequired }: Props) {
  const [magicPending, setMagicPending] = useState(false);
  const [magicError, setMagicError] = useState("");

  const requestMagicLink = async () => {
    const trimmed = email.trim();
    if (!trimmed || !isEmail(trimmed)) {
      onEmailRequired();
      return;
    }
    setMagicPending(true);
    setMagicError("");
    try {
      const res = await fetch("/api/auth/magic-link/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      window.location.href = `/magic-link-sent?email=${encodeURIComponent(trimmed)}`;
    } catch {
      setMagicError("We couldn't send the sign-in link. Please try again.");
      setMagicPending(false);
    }
  };

  return (
    <div>
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-muted-foreground uppercase tracking-wide">or</span>
        </div>
      </div>

      <div className="space-y-2">
        <Button asChild variant="outline" className="w-full h-11 gap-3 font-normal" type="button">
          <a href="/api/auth/google/start" data-testid="button-google-signin">
            <GoogleMark />
            <span>Continue with Google</span>
          </a>
        </Button>

        <Button
          onClick={requestMagicLink}
          disabled={magicPending}
          variant="outline"
          className="w-full h-11 gap-3 font-normal"
          type="button"
          data-testid="button-magic-link"
        >
          {magicPending ? "Sending link…" : "Email me a sign-in link"}
        </Button>

        {magicError && <p className="text-xs text-rose-600 pt-1">{magicError}</p>}
      </div>
    </div>
  );
}
