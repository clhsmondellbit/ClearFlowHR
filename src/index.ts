/**
 * @file index.ts
 * @description AER Express application entry point.
 *
 * Mounts all API routes under /api/v1 and starts the HTTP server.
 */

import express, { type Express } from "express";
import { evaluateRouter } from "./api/routes/evaluate.js";
import { overrideRouter } from "./api/routes/override.js";

const app: Express = express();
const PORT = process.env["PORT"] ?? 3000;

app.use(express.json());

// Mount API routes
app.use("/api/v1", evaluateRouter);
app.use("/api/v1", overrideRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "AER — Autonomous HR Escalation Referee" });
});

app.listen(PORT, () => {
  console.log(`[AER] Server running on port ${PORT}`);
});

export default app;
