import { cn } from "@/lib/utils";

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("text-[11px] uppercase tracking-wider font-semibold text-muted-foreground", className)}>
      {children}
    </span>
  );
}
