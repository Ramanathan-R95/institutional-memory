import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { supabase } from "./lib/supabase.js";
import { requireAuth } from "./middleware/auth.js";
import assetsRouter from "./routes/assets.js";
import transfersRouter from "./routes/transfers.js";
import documentsRouter from "./routes/documents.js";
import aiRouter from "./routes/ai.js";
import knowledgeRouter from "./routes/knowledge.js";
import alertsRouter from "./routes/alerts.js";
import graphRouter from "./routes/graph.js";
import "express-async-errors";
const app = express();
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const origins = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));
app.use(express.json({ limit: "1mb" }));

// Compact request log (skips the uptime pings)
app.use((req, res, next) => {
  const t = Date.now();
  res.on("finish", () => {
    if (req.path !== "/api/health") console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - t}ms`);
  });
  next();
});

app.use("/api", rateLimit({ windowMs: 60_000, limit: 300, validate: false,
  message: { error: "Too many requests. Slow down a little." } }));

const api = express.Router();
api.get("/health", async (_req, res) => {
  const { error } = await supabase.from("departments").select("id").limit(1);
  res.status(error ? 503 : 200).json({ ok: !error });
});
api.get("/me", requireAuth, (req, res) => res.json(req.user));
api.get("/departments", requireAuth, async (_req, res) => {
  const { data, error } = await supabase.from("departments").select("*").order("id");
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});
api.use("/assets", assetsRouter);
api.use("/transfers", transfersRouter);
api.use("/documents", documentsRouter);
api.use("/ai", aiRouter);
api.use("/knowledge", knowledgeRouter);
api.use("/alerts", alertsRouter);
api.use("/graph", graphRouter);
app.use("/api", api);

app.get("/", (_req, res) => res.send("Institutional Memory API"));
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

// Last line of defence: never leak stack traces, never crash
app.use((err, _req, res, _next) => {
  console.error("Unhandled:", err);
  if (res.headersSent) return;
  if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "File too large (max 10 MB)." });
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: status === 413 ? "Request too large." : "Something went wrong on the server." });
});
process.on("unhandledRejection", (e) => console.error("Unhandled rejection:", e));
process.on("uncaughtException", (e) => console.error("Uncaught exception:", e));

const port = process.env.PORT || 4000;
app.listen(port, "0.0.0.0", () => console.log(`API running on port ${port}`));