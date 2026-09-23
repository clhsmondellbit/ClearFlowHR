/**
 * @file index.ts
 * @description AER Express application entry point.
 *
 * Mounts all API routes under /api/v1, serves the static frontend dashboard
 * from the public/ directory, and starts the HTTP server.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { evaluateRouter } from "./api/routes/evaluate.js";
import { overrideRouter } from "./api/routes/override.js";

try {
  process.loadEnvFile();
} catch {
  // .env file is optional in production/containerized environments
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app: Express = express();
const PORT = process.env["PORT"] ?? 4647;

// ── CORS (permissive for local dev) ──────────────────────────────────────────
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // Handle preflight here to avoid app.options("*") which breaks path-to-regexp v8
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json({ limit: "25mb" }));

// ── Static frontend (public/) ─────────────────────────────────────────────────
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api/v1", evaluateRouter);
app.use("/api/v1", overrideRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "AER — Autonomous HR Escalation Referee" });
});

// ── SPA fallback: serve index.html for any unknown GET route ──────────────────
// Express 5 + path-to-regexp v8: use named wildcard {*path} instead of (.*)
app.get("/{*path}", (_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`[AER] Server running on http://localhost:${PORT}`);
  console.log(`[AER] Frontend dashboard → http://localhost:${PORT}/`);
});

export default app;
