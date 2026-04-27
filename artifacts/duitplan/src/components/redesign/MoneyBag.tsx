import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtBND } from "@/lib/format";

type Props = {
  available: number;
  total: number;
  isOver?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  className?: string;
};

export function MoneyBag({ available, total, isOver, onDragOver, onDragLeave, onDrop, className }: Props) {
  const pct = Math.max(0, Math.min(1, total > 0 ? available / total : 0));
  const empty = available <= 0;
  const fillY = 100 - pct * 78;

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      title="Drag chips back here to deallocate"
      className={cn(
        "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors px-4 py-3 w-44 select-none",
        isOver
          ? "border-primary bg-primary/5"
          : empty
          ? "border-rose-200 bg-rose-50/40"
          : "border-border bg-accent/40",
        className
      )}
    >
      <svg viewBox="0 0 100 110" className="w-24 h-28" aria-hidden>
        <defs>
          <clipPath id="dp-bagClip">
            <path d="M30 22 L70 22 L88 50 C92 78 78 100 50 100 C22 100 8 78 12 50 Z" />
          </clipPath>
          <linearGradient id="dp-coinGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFD668" />
            <stop offset="100%" stopColor="#E5A23B" />
          </linearGradient>
        </defs>
        <path d="M28 22 Q50 6 72 22" stroke="#9A6B3F" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="50" cy="14" r="2.5" fill="#9A6B3F" />
        <path
          d="M30 22 L70 22 L88 50 C92 78 78 100 50 100 C22 100 8 78 12 50 Z"
          fill={empty ? "#F5E1CC" : "#E8C9A2"}
          stroke="#9A6B3F"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <g clipPath="url(#dp-bagClip)">
          <rect
            x="0"
            y={fillY}
            width="100"
            height="120"
            fill="url(#dp-coinGrad)"
            style={{ transition: "y 350ms cubic-bezier(.2,.8,.2,1)" }}
          />
          {!empty && (
            <path
              className="dp-coin-wave"
              d={`M-5 ${fillY + 3} Q 25 ${fillY - 1} 50 ${fillY + 3} T 105 ${fillY + 3} L 105 110 L -5 110 Z`}
              fill="#FFD668"
              opacity="0.7"
            />
          )}
          {!empty && pct > 0.15 && (
            <>
              <circle cx="38" cy={fillY + 14} r="2.5" fill="#FFF2C2" opacity="0.7" />
              <circle cx="58" cy={fillY + 22} r="2" fill="#FFF2C2" opacity="0.6" />
              <circle cx="48" cy={fillY + 34} r="2.5" fill="#FFF2C2" opacity="0.5" />
            </>
          )}
        </g>
        <text
          x="50"
          y="62"
          textAnchor="middle"
          fontSize="22"
          fontWeight="800"
          fill={empty ? "#B97947" : "#9A6B3F"}
          fontFamily="Inter, sans-serif"
          opacity={empty ? 0.7 : 0.35}
        >
          $
        </text>
      </svg>
      <div className="text-center mt-1">
        <div
          className={cn(
            "text-[10px] uppercase tracking-wider font-semibold",
            empty ? "text-rose-600" : "text-muted-foreground"
          )}
        >
          {empty ? "Bag is empty" : "In the bag"}
        </div>
        <div className={cn("text-base font-bold tabular-nums", empty ? "text-rose-600" : "text-foreground")}>
          {fmtBND(Math.max(0, available))}
        </div>
      </div>
      {isOver && (
        <div className="absolute inset-0 rounded-2xl bg-primary/5 flex items-center justify-center pointer-events-none">
          <div className="bg-white px-2 py-1 rounded-md border border-primary text-[11px] font-semibold text-primary inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> drop to deallocate
          </div>
        </div>
      )}
      <style>{`
        @keyframes dpCoinWave { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-4px); } }
        .dp-coin-wave { animation: dpCoinWave 3.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
