import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { USER_ACCOUNTS } from "../../auth/accounts.js";
import {
  createSession,
  destroySession,
  publicSession,
  resolveSession,
  verifyPassword,
} from "../../auth/session.js";

export const authRouter: IRouter = Router();

const LoginRequestSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(256),
}).strict();

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const DUMMY_SALT = "a6b5c4d3e2f10987654321abcdefabcd";
const DUMMY_HASH = "0".repeat(128);

function loginRateLimitKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

authRouter.post("/login", async (req: Request, res: Response): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = LoginRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_FAILED", details: parsed.error.flatten() });
    return;
  }

  const now = Date.now();
  const rateKey = loginRateLimitKey(req);
  const attempts = loginAttempts.get(rateKey);
  if (attempts && attempts.resetAt > now && attempts.count >= MAX_ATTEMPTS) {
    res.status(429).json({ error: "LOGIN_RATE_LIMITED" });
    return;
  }

  const account = USER_ACCOUNTS.find((candidate) => candidate.username === parsed.data.username);
  const validPassword = await verifyPassword(
    parsed.data.password,
    account?.salt ?? DUMMY_SALT,
    account?.passwordHash ?? DUMMY_HASH,
  );

  if (!account || !validPassword) {
    const state = attempts && attempts.resetAt > now
      ? attempts
      : { count: 0, resetAt: now + WINDOW_MS };
    state.count += 1;
    loginAttempts.set(rateKey, state);
    res.status(401).json({ error: "INVALID_CREDENTIALS" });
    return;
  }

  loginAttempts.delete(rateKey);
  createSession(account, res);
  res.status(200).json(publicSession(account));
});

authRouter.get("/me", (req: Request, res: Response): void => {
  res.setHeader("Cache-Control", "no-store");
  const account = resolveSession(req);
  if (!account) {
    res.status(401).json({ error: "AUTHENTICATION_REQUIRED" });
    return;
  }
  res.status(200).json(publicSession(account));
});

authRouter.post("/logout", (req: Request, res: Response): void => {
  destroySession(req, res);
  res.status(200).json({ status: "signed_out" });
});
