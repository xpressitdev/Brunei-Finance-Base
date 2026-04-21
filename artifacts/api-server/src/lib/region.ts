import { type Request, type Response, type NextFunction } from "express";

export type RegionCode = "BN" | "MY" | "ID";

export const DEFAULT_REGION: RegionCode = "BN";

const SUBDOMAIN_TO_REGION: Record<string, RegionCode> = {
  my: "MY",
  id: "ID",
};

/**
 * Resolves a hostname to a RegionCode.
 *
 * Rules:
 *   my.duitplan.com  → MY
 *   id.duitplan.com  → ID
 *   duitplan.com     → BN (default)
 *   localhost / any  → BN (default)
 */
export function resolveRegionFromHost(host: string): RegionCode {
  const hostname = host.split(":")[0].toLowerCase();
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    const subdomain = parts[0];
    if (subdomain && SUBDOMAIN_TO_REGION[subdomain]) {
      return SUBDOMAIN_TO_REGION[subdomain];
    }
  }
  return DEFAULT_REGION;
}

declare global {
  namespace Express {
    interface Request {
      region?: RegionCode;
    }
  }
}

/**
 * Express middleware that reads the Host header, resolves the region,
 * and attaches it to req.region for downstream handlers.
 */
function normalizeHeader(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.split(",")[0]?.trim() ?? "";
  return value?.split(",")[0]?.trim() ?? "";
}

export function regionMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const host =
    normalizeHeader(req.headers["x-forwarded-host"]) ||
    normalizeHeader(req.headers["host"]);
  req.region = resolveRegionFromHost(host);
  next();
}
