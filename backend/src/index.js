import "dotenv/config";
import "express-async-errors";
import express from "express";
import cors from "cors";
import morgan from "morgan";

import { errorHandler } from "./middleware/errorHandler.js";
import { authMiddleware } from "./middleware/auth.js";

import authRoutes from "./routes/auth.js";
import employeeRoutes from "./routes/employees.js";
import shiftRoutes from "./routes/shifts.js";
import scheduleRoutes from "./routes/schedules.js";
import leaveRoutes from "./routes/leave.js";
import ledgerRoutes from "./routes/ledger.js";
import overtimeRoutes from "./routes/overtime.js";
import nbotRoutes from "./routes/nbot.js";
import coverageRoutes from "./routes/coverage.js";
import reportsRoutes from "./routes/reports.js";
import settingsRoutes from "./routes/settings.js";
import auditRoutes from "./routes/audit.js";
import importRoutes from "./routes/import.js";
import recurringRoutes from "./routes/recurring.js";

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

// ─── Public Routes ──────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);

// ─── Protected Routes ───────────────────────────────────────────────────────
app.use("/api", authMiddleware);
app.use("/api/employees", employeeRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/overtime", overtimeRoutes);
app.use("/api/nbot", nbotRoutes);
app.use("/api/coverage", coverageRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/import", importRoutes);
app.use("/api/recurring", recurringRoutes);

// ─── Health Check ────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// ─── Error Handler ───────────────────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`✅  WillScheduleBot API running on http://localhost:${PORT}`);
});

export default app;
