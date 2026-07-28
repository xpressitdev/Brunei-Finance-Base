import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth";

// Free app: only authentication is required, no subscription check.
export async function requireAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
