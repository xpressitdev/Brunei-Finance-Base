import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquarePlus, Star, X, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const CATEGORIES = ["bug", "feature", "general", "praise"] as const;
type Category = typeof CATEGORIES[number];

export function FeedbackWidget() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("general");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [includeAccount, setIncludeAccount] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    setCategory("general");
    setMessage("");
    setRating(null);
    setHoverRating(null);
    setEmail("");
    setIncludeAccount(false);
    setDone(false);
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(reset, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || message.trim().length < 5) return;
    setSubmitting(true);
    try {
      const page = window.location.pathname;
      await customFetch("/api/feedback", {
        method: "POST",
        body: JSON.stringify({
          category,
          message: message.trim(),
          rating: rating ?? undefined,
          page,
          email: email.trim() || undefined,
          includeAccount: user ? includeAccount : false,
        }),
      });
      setDone(true);
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-primary text-primary-foreground",
          "rounded-full shadow-lg px-4 py-2.5 text-sm font-medium",
          "hover:bg-primary/90 transition-all duration-200",
          "hover:shadow-xl active:scale-95",
          open && "opacity-0 pointer-events-none"
        )}
        aria-label={t("feedback.button")}
      >
        <MessageSquarePlus className="w-4 h-4" />
        <span>{t("feedback.button")}</span>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]"
          onClick={handleClose}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 w-[340px] bg-white rounded-2xl shadow-2xl border",
          "transition-all duration-200 origin-bottom-right",
          open
            ? "scale-100 opacity-100 pointer-events-auto"
            : "scale-90 opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">{t("feedback.title")}</span>
          </div>
          <button
            onClick={handleClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {done ? (
            /* Success state */
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <p className="font-semibold text-sm">{t("feedback.success.title")}</p>
              <p className="text-xs text-muted-foreground">{t("feedback.success.subtitle")}</p>
              <Button size="sm" variant="outline" onClick={handleClose} className="mt-2">
                {t("feedback.success.close")}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Category pills */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t("feedback.categoryLabel")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                        category === cat
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-border hover:border-primary/50"
                      )}
                    >
                      {t(`feedback.categories.${cat}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Star rating */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t("feedback.ratingLabel")}</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      onClick={() => setRating(rating === star ? null : star)}
                      className="p-0.5 transition-transform hover:scale-110"
                      aria-label={`${star} star`}
                    >
                      <Star
                        className={cn(
                          "w-5 h-5 transition-colors",
                          (hoverRating ?? rating ?? 0) >= star
                            ? "fill-amber-400 text-amber-400"
                            : "fill-muted text-muted-foreground/30"
                        )}
                      />
                    </button>
                  ))}
                  {rating && (
                    <span className="text-xs text-muted-foreground self-center ml-1">
                      {rating}/5
                    </span>
                  )}
                </div>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="feedback-message">
                  {t("feedback.messageLabel")}
                  <span className="text-destructive ml-0.5">*</span>
                </Label>
                <Textarea
                  id="feedback-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("feedback.messagePlaceholder")}
                  rows={3}
                  className="text-sm resize-none"
                  required
                  minLength={5}
                />
              </div>

              {/* Email (only when not logged in or when anonymous) */}
              {(!user || !includeAccount) && (
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="feedback-email">
                    {t("feedback.emailLabel")}
                  </Label>
                  <Input
                    id="feedback-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("feedback.emailPlaceholder")}
                    className="text-sm h-8"
                  />
                </div>
              )}

              {/* Include account info toggle (for logged-in users) */}
              {user && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeAccount}
                    onChange={(e) => setIncludeAccount(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-xs text-muted-foreground">
                    {t("feedback.includeAccount")}
                  </span>
                </label>
              )}

              {/* Anonymous note */}
              {!includeAccount && (
                <p className="text-[11px] text-muted-foreground">
                  {t("feedback.anonymousNote")}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                size="sm"
                disabled={submitting || message.trim().length < 5}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    {t("feedback.submitting")}
                  </>
                ) : (
                  t("feedback.submit")
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
