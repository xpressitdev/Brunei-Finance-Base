import { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const userId = req.session?.userId as string | undefined;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;
  next();
}

declare module "express-session" {
  interface SessionData {
    userId: string;
    // CSRF state for the Google OAuth round-trip. Set on /auth/google/start,
    // verified and cleared on /auth/google/callback.
    oauthState?: string;
  }
}
