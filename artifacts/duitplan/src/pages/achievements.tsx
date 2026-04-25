import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Flame, Trophy } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";

type GamificationSummary = {
  streak: { current: number; longest: number };
  achievements: {
    key: string; name: string; description: string; icon: string;
    category: string; unlocked: boolean; unlockedAt: string | null;
  }[];
  monthlyChallenge: {
    title: string; description: string; progress: number; target: number; unit: string;
  };
  totalUnlocked: number;
  totalAvailable: number;
};

function useGamification() {
  return useQuery<GamificationSummary>({
    queryKey: ["gamification-summary"],
    queryFn: async () => {
      const res = await fetch(`/api/gamification/summary`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
}

function useCheckAchievements() {
  return useMutation({
    mutationFn: async () => {
      await fetch(`/api/gamification/achievements/check`, {
        method: "POST",
        credentials: "include",
      });
    },
  });
}

export default function Achievements() {
  const { t } = useTranslation();
  const { data, isLoading, refetch } = useGamification();
  const checkMutation = useCheckAchievements();

  useEffect(() => {
    checkMutation.mutateAsync().then(() => refetch());
  }, []);

  if (isLoading || !data) {
    return (
      <div className="space-y-6 animate-pulse max-w-4xl mx-auto">
        <div className="h-10 w-48 bg-muted rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const { streak, achievements, monthlyChallenge, totalUnlocked, totalAvailable } = data;
  const challengePct = Math.min(100, (monthlyChallenge.progress / monthlyChallenge.target) * 100);
  const challengeDone = monthlyChallenge.progress >= monthlyChallenge.target;

  const milestones = achievements.filter(a => a.category === "milestone");
  const habits = achievements.filter(a => a.category === "habit");

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("achievements.title")}</h1>
        <p className="text-muted-foreground">
          {t("achievements.subtitle", { earned: totalUnlocked, total: totalAvailable })}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
              <Flame className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">{streak.current}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">{t("achievements.streak.label")}</div>
              {streak.longest > 0 && (
                <div className="text-xs text-muted-foreground">{t("achievements.streak.best", { count: streak.longest })}</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-2xl">
              🏅
            </div>
            <div>
              <div className="text-3xl font-bold">{totalUnlocked}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">{t("achievements.badges.label")}</div>
              <div className="text-xs text-muted-foreground">{t("achievements.badges.remaining", { count: totalAvailable - totalUnlocked })}</div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(challengeDone ? "border-primary/30 bg-primary/5" : "")}>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t("achievements.challenge.label")}</div>
                <div className="font-semibold text-sm leading-tight">{monthlyChallenge.title}</div>
              </div>
              {challengeDone && <span className="text-xl">✅</span>}
            </div>
            <Progress value={challengePct} className="h-2" />
            <div className="text-xs text-muted-foreground">
              {monthlyChallenge.progress} / {monthlyChallenge.target} {monthlyChallenge.unit}
              {challengeDone && t("achievements.challenge.completed")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Milestones */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" /> {t("achievements.milestones")}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {milestones.map(a => (
            <div
              key={a.key}
              className={cn(
                "rounded-xl border p-4 flex flex-col items-start gap-2 transition-all",
                a.unlocked
                  ? "bg-white border-primary/20 shadow-sm"
                  : "bg-muted/30 border-border opacity-60 grayscale"
              )}
            >
              <span className={cn("text-3xl", !a.unlocked && "opacity-40")}>{a.icon}</span>
              <div>
                <div className={cn("font-semibold text-sm", a.unlocked ? "text-foreground" : "text-muted-foreground")}>
                  {a.name}
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed mt-0.5">{a.description}</div>
              </div>
              {a.unlocked && a.unlockedAt && (
                <div className="text-xs text-primary font-medium mt-auto">
                  {t("achievements.earned", { date: new Date(a.unlockedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) })}
                </div>
              )}
              {!a.unlocked && (
                <div className="text-xs text-muted-foreground mt-auto">{t("achievements.locked")}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Habits */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-xl">🌱</span> {t("achievements.habitBadges")}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {habits.map(a => (
            <div
              key={a.key}
              className={cn(
                "rounded-xl border p-4 flex flex-col items-start gap-2 transition-all",
                a.unlocked
                  ? "bg-white border-primary/20 shadow-sm"
                  : "bg-muted/30 border-border opacity-60 grayscale"
              )}
            >
              <span className={cn("text-3xl", !a.unlocked && "opacity-40")}>{a.icon}</span>
              <div>
                <div className={cn("font-semibold text-sm", a.unlocked ? "text-foreground" : "text-muted-foreground")}>
                  {a.name}
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed mt-0.5">{a.description}</div>
              </div>
              {a.unlocked && a.unlockedAt && (
                <div className="text-xs text-primary font-medium mt-auto">
                  {t("achievements.earned", { date: new Date(a.unlockedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) })}
                </div>
              )}
              {!a.unlocked && (
                <div className="text-xs text-muted-foreground mt-auto">{t("achievements.locked")}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Positive reinforcement */}
      <div className="rounded-xl bg-primary/5 border border-primary/20 p-5">
        <p className="text-sm font-medium text-primary mb-1">
          {streak.current > 0
            ? t("achievements.reinforcement.streakActive", { count: streak.current })
            : t("achievements.reinforcement.noStreak")}
        </p>
        <p className="text-xs text-muted-foreground">
          {totalUnlocked === 0
            ? t("achievements.reinforcement.zeroBadges")
            : totalUnlocked < 5
            ? t("achievements.reinforcement.fewBadges")
            : t("achievements.reinforcement.manyBadges")}
        </p>
      </div>
    </div>
  );
}
