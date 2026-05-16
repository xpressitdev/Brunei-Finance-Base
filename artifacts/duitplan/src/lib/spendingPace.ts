export type PaceLabel =
  | "Over budget"
  | "Ahead of pace"
  | "On track"
  | "Slightly ahead"
  | "Burning fast"
  | "";

export type SpendingPace = {
  daysInMonth: number;
  dayOfMonth: number;
  monthProgressPct: number;
  spentPctRaw: number;
  spentPct: number;
  overBudget: boolean;
  paceLabel: PaceLabel;
  paceTone: string;
  barColor: string;
};

export function computeSpendingPace(
  spent: number,
  monthlyIncome: number,
  now: Date = new Date(),
): SpendingPace {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const monthProgressPct = (dayOfMonth / daysInMonth) * 100;
  const spentPctRaw = monthlyIncome > 0 ? (spent / monthlyIncome) * 100 : 0;
  const spentPct = Math.min(spentPctRaw, 100);
  const overBudget = spentPctRaw > 100;
  const paceDelta = spentPctRaw - monthProgressPct;

  let paceLabel: PaceLabel = "";
  let paceTone = "";
  if (monthlyIncome > 0) {
    if (overBudget) {
      paceLabel = "Over budget";
      paceTone = "text-rose-600";
    } else if (paceDelta <= -10) {
      paceLabel = "Ahead of pace";
      paceTone = "text-emerald-700";
    } else if (paceDelta <= 5) {
      paceLabel = "On track";
      paceTone = "text-emerald-700";
    } else if (paceDelta <= 15) {
      paceLabel = "Slightly ahead";
      paceTone = "text-amber-600";
    } else {
      paceLabel = "Burning fast";
      paceTone = "text-rose-600";
    }
  }

  const barColor = overBudget
    ? "bg-rose-500"
    : spentPctRaw > 80
      ? "bg-amber-500"
      : "bg-primary";

  return {
    daysInMonth,
    dayOfMonth,
    monthProgressPct,
    spentPctRaw,
    spentPct,
    overBudget,
    paceLabel,
    paceTone,
    barColor,
  };
}

export function formatPaceTooltip(pace: SpendingPace): string {
  if (!pace.paceLabel) return "";
  return `Used ${Math.round(pace.spentPctRaw)}% of expected income · day ${pace.dayOfMonth} of ${pace.daysInMonth} (${Math.round(pace.monthProgressPct)}% through the month)`;
}
