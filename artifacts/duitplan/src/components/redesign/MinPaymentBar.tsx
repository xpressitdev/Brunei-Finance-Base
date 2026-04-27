import { cn } from "@/lib/utils";

type Props = {
  paid: number;
  minimum: number;
  className?: string;
};

/**
 * Two-zone progress bar for loan repayment in a given month.
 * Rose left segment fills 0-50% of the bar (paid as fraction of minimum due).
 * Emerald right segment beyond the centre tick = extra contributions above minimum.
 * Centre tick marks "minimum payment met".
 */
export function MinPaymentBar({ paid, minimum, className }: Props) {
  const min = Math.max(0, minimum);
  const p = Math.max(0, paid);
  const minRatio = min > 0 ? Math.min(1, p / min) : p > 0 ? 1 : 0;
  const minHalf = minRatio * 50;

  const extra = Math.max(0, p - min);
  const overRatio = min > 0 ? extra / min : 0;
  const overHalf = Math.min(50, overRatio * 50);

  return (
    <div className={cn("relative h-2 rounded-full overflow-hidden bg-muted", className)}>
      {/* Rose: paid up to minimum (left half) */}
      <div
        className="absolute inset-y-0 left-0 bg-rose-400 rounded-l-full transition-all"
        style={{ width: `${minHalf}%` }}
      />
      {/* Emerald: extra contribution (right half) */}
      {overHalf > 0 && (
        <div
          className="absolute inset-y-0 bg-emerald-500 transition-all"
          style={{ left: "50%", width: `${overHalf}%` }}
        />
      )}
      {/* Minimum tick */}
      <div
        className="absolute -inset-y-0.5 w-[2px] bg-foreground"
        style={{ left: "calc(50% - 1px)" }}
        title="Minimum payment"
      />
    </div>
  );
}
