import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { USER_ACCOUNTS, toPublicAccount, type UserAccount } from "./accounts.js";

const SESSION_COOKIE = "clearflow_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

interface SessionRecord {
  username: string;
  expiresAt: number;
}

export interface AuthenticatedRequest extends Request {
  account?: UserAccount;
}

const sessions = new Map<string, SessionRecord>();

function readSessionToken(req: Request): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;

  const cookie = cookieHeader.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return cookie?.slice(SESSION_COOKIE.length + 1);
}

export function resolveSession(req: Request): UserAccount | undefined {
  const token = readSessionToken(req);
  if (!token) return undefined;

  const session = sessions.get(token);
  if (!session) return undefined;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return undefined;
  }

  return USER_ACCOUNTS.find((account) => account.username === session.username);
}

export function requireAuthentication(req: Request, res: Response, next: NextFunction): void {
  const account = resolveSession(req);
  if (!account) {
    res.status(401).json({ error: "AUTHENTICATION_REQUIRED" });
    return;
  }
  (req as AuthenticatedRequest).account = account;
  next();
}

export function requireManager(req: Request, res: Response, next: NextFunction): void {
  const account = (req as AuthenticatedRequest).account;
  if (!account || account.role === "EMPLOYEE") {
    res.status(403).json({ error: "MANAGER_ROLE_REQUIRED" });
    return;
  }
  next();
}

export function createSession(account: UserAccount, res: Response): void {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }

  const token = randomBytes(32).toString("base64url");
  sessions.set(token, { username: account.username, expiresAt: now + SESSION_TTL_MS });

  const secure = process.env["NODE_ENV"] === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure}`,
  );
}

export function destroySession(req: Request, res: Response): void {
  const token = readSessionToken(req);
  if (token) sessions.delete(token);
  const secure = process.env["NODE_ENV"] === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
}

export function publicSession(account: UserAccount) {
  return {
    user: toPublicAccount(account),
    directory: USER_ACCOUNTS.map(({ username, employeeId, name, role, roleTitle, department }) => ({
      username, employeeId, name, role, roleTitle, department,
    })),
  };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      const expected = Buffer.from(expectedHash, "hex");
      resolve(expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey));
    });
  });
}
