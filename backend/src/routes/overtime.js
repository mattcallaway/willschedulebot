import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { logAudit } from "../services/auditService.js";

const router = Router();

// GET /api/overtime?from=YYYY-MM-DD&to=YYYY-MM-DD&employeeId=...
router.get("/", async (req, res) => {
    const { from, to, employeeId } = req.query;
    const where = {};
    if (employeeId) where.employeeId = employeeId;
    if (from) where.periodStart = { gte: new Date(from) };
    if (to) where.periodEnd = { lte: new Date(to) };
    const entries = await prisma.overtimeEntry.findMany({
        where,
        include: { employee: { select: { id: true, name: true, rank: true } } },
        orderBy: [{ periodStart: "desc" }],
    });
    res.json(entries);
});

// POST /api/overtime — manual entry
router.post("/", async (req, res) => {
    const schema = z.object({
        employeeId: z.string(),
        periodStart: z.string(),
        periodEnd: z.string(),
        regularHours: z.number().nonnegative(),
        overtimeHours: z.number().nonnegative(),
        approvedBy: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
    });
    const data = schema.parse(req.body);
    const entry = await prisma.overtimeEntry.create({
        data: { ...data, periodStart: new Date(data.periodStart), periodEnd: new Date(data.periodEnd) },
        include: { employee: { select: { id: true, name: true } } },
    });
    await logAudit(req, "CREATE_OVERTIME_ENTRY", "OvertimeEntry", entry.id, null, entry, data.notes);
    res.status(201).json(entry);
});

// DELETE /api/overtime/:id
router.delete("/:id", async (req, res) => {
    const entry = await prisma.overtimeEntry.delete({ where: { id: req.params.id } });
    await logAudit(req, "DELETE_OVERTIME_ENTRY", "OvertimeEntry", req.params.id, entry, null);
    res.json({ success: true });
});

export default router;
