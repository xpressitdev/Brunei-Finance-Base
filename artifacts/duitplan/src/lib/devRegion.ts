import { createContext, useContext, useState, useEffect, type ReactNode, createElement } from "react";

export const DEV_REGION_KEY = "dev_region_override";
const VALID_REGIONS = new Set(["BN", "MY", "ID"]);

export function isDevEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.includes("replit.app") ||
    hostname.includes(".repl.co") ||
    import.meta.env.DEV === true
  );
}

export function getStoredDevRegion(): string | null {
  if (!isDevEnvironment()) return null;
  try {
    return sessionStorage.getItem(DEV_REGION_KEY);
  } catch {
    return null;
  }
}

interface DevRegionContextValue {
  devRegion: string | null;
  setDevRegion: (code: string | null) => void;
}

const DevRegionContext = createContext<DevRegionContextValue>({
  devRegion: null,
  setDevRegion: () => {},
});

export function useDevRegionContext(): DevRegionContextValue {
  return useContext(DevRegionContext);
}

export function DevRegionProvider({ children }: { children: ReactNode }) {
  const [devRegion, setDevRegionState] = useState<string | null>(() => getStoredDevRegion());

  const setDevRegion = (code: string | null) => {
    try {
      if (code) {
        sessionStorage.setItem(DEV_REGION_KEY, code);
      } else {
        sessionStorage.removeItem(DEV_REGION_KEY);
      }
    } catch {
    }
    setDevRegionState(code);
  };

  useEffect(() => {
    if (!isDevEnvironment()) return;

    const params = new URLSearchParams(window.location.search);
    const raw = params.get("region");

    if (raw === null) return;

    const code = raw.toUpperCase();
    if (raw === "" || !VALID_REGIONS.has(code)) {
      console.log("[DEV] Region override cleared");
      setDevRegion(null);
    } else {
      console.log(`[DEV] Region override active: ${code}`);
      setDevRegion(code);
    }
  }, []);

  return createElement(DevRegionContext.Provider, { value: { devRegion, setDevRegion } }, children);
}
