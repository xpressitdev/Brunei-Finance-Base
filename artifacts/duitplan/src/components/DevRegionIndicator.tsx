import { useDevRegionContext, isDevEnvironment } from "@/lib/devRegion";
import { getRegionByCode } from "@/config/regions";
import { useGetProfile } from "@workspace/api-client-react";

export function DevRegionIndicator() {
  if (!isDevEnvironment()) return null;

  return <DevRegionIndicatorInner />;
}

function DevRegionIndicatorInner() {
  const { devRegion } = useDevRegionContext();
  const { data: profile } = useGetProfile();

  const activeRegionCode = devRegion ?? (profile?.region as string) ?? "BN";
  const region = getRegionByCode(activeRegionCode);
  const isOverride = !!devRegion;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "12px",
        right: "12px",
        zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        color: "rgba(255,255,255,0.75)",
        fontFamily: "monospace",
        fontSize: "11px",
        lineHeight: "1.4",
        padding: "5px 9px",
        borderRadius: "6px",
        pointerEvents: "none",
        userSelect: "none",
        backdropFilter: "blur(2px)",
        border: isOverride ? "1px solid rgba(251,191,36,0.4)" : "1px solid rgba(255,255,255,0.1)",
      }}
    >
      DEV: region={region.code} | currency={region.currency} | locale={region.locale}
      {isOverride && <span style={{ color: "rgba(251,191,36,0.9)", marginLeft: "4px" }}>↑override</span>}
    </div>
  );
}
