import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePaydayPrompt } from "@/hooks/usePaydayPrompt";
import { PaydayReviewModal } from "./PaydayReviewModal";
import { useToast } from "@/hooks/use-toast";
import { useGetProfile } from "@workspace/api-client-react";

export function PaydayBanner() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { prompt, isLoading, skip, remindTomorrow } = usePaydayPrompt();
  const { data: profile } = useGetProfile();
  const [modalOpen, setModalOpen] = useState(false);
  const [acting, setActing] = useState(false);

  // Variable-income users don't get a fixed monthly payday — they log income ad-hoc.
  if (profile?.incomeType === "variable") return null;
  if (isLoading || !prompt) return null;

  const handleNotYet = async () => {
    setActing(true);
    try {
      await remindTomorrow(prompt.id);
      toast({ title: t("paydayPrompt.toast.remindTomorrow") });
    } finally {
      setActing(false);
    }
  };

  const handleSkip = async () => {
    setActing(true);
    try {
      await skip(prompt.id);
      toast({ title: t("paydayPrompt.toast.skipped") });
    } finally {
      setActing(false);
    }
  };

  return (
    <>
      <div className="bg-emerald-700 text-white w-full px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <CalendarCheck className="w-5 h-5 flex-shrink-0 text-emerald-200" />
          <p className="text-sm font-medium">{t("paydayPrompt.banner.title")}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <Button
            size="sm"
            className="bg-white text-emerald-800 hover:bg-emerald-50 font-semibold h-8 px-3 text-xs"
            disabled={acting}
            onClick={() => setModalOpen(true)}
          >
            {t("paydayPrompt.banner.yesPaid")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-emerald-100 hover:text-white hover:bg-emerald-800 h-8 px-3 text-xs"
            disabled={acting}
            onClick={handleNotYet}
          >
            {t("paydayPrompt.banner.notYet")}
          </Button>
          <button
            className="text-emerald-300 hover:text-white text-xs underline underline-offset-2 transition-colors disabled:opacity-50"
            disabled={acting}
            onClick={handleSkip}
          >
            {t("paydayPrompt.banner.skipMonth")}
          </button>
        </div>
      </div>

      <PaydayReviewModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        prompt={prompt}
      />
    </>
  );
}
