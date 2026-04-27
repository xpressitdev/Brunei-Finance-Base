import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  hero?: boolean;
  delta?: string;
  deltaLabel?: string;
  deltaTone?: "up" | "down" | "neutral";
  footer?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "primary" | "rose" | "emerald" | "amber";
  className?: string;
};

export function KpiCard({
  label,
  value,
  hero,
  delta,
  deltaLabel,
  deltaTone = "up",
  footer,
  icon,
  tone = "default",
  className,
}: Props) {
  const baseTone =
    tone === "primary"
      ? "bg-primary/5 border-primary/30"
      : tone === "rose"
      ? "bg-rose-50 border-rose-200"
      : tone === "emerald"
      ? "bg-emerald-50 border-emerald-200"
      : tone === "amber"
      ? "bg-amber-50 border-amber-200"
      : "bg-card border-border";

  const valueTone =
    tone === "rose" ? "text-rose-700"
      : tone === "emerald" ? "text-emerald-700"
      : tone === "amber" ? "text-amber-800"
      : tone === "primary" ? "text-primary"
      : "text-foreground";

  const deltaColor =
    deltaTone === "up" ? "text-emerald-700"
      : deltaTone === "down" ? "text-rose-600"
      : "text-muted-foreground";

  return (
    <div
      className={cn(
        "rounded-xl border p-3 sm:p-4 shadow-sm relative overflow-hidden min-w-0",
        baseTone,
        hero && "ring-1 ring-primary/40",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground truncate min-w-0">
          {label}
        </span>
        {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
      </div>
      <div
        className={cn(
          "font-bold tabular-nums leading-tight mt-1 break-words",
          hero ? "text-2xl sm:text-3xl" : "text-lg sm:text-2xl",
          valueTone
        )}
      >
        {value}
      </div>
      {delta && (
        <div className={cn("text-[11px] font-semibold tabular-nums mt-1", deltaColor)}>
          {delta} {deltaLabel && <span className="text-muted-foreground font-normal">{deltaLabel}</span>}
        </div>
      )}
      {footer && <div className="mt-1">{footer}</div>}
    </div>
  );
}
