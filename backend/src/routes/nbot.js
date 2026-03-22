import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { logAudit } from "../services/auditService.js";

const router = Router();

// GET /api/nbot?from=YYYY-MM-DD&to=YYYY-MM-DD&employeeId=...
router.get("/", async (req, res) => {
    const { from, to, employeeId } = req.query;
    const where = {};
    if (employeeId) where.employeeId = employeeId;
    if (from) where.periodStart = { gte: new Date(from) };
    if (to) where.periodEnd = { lte: new Date(to) };
    const entries = await prisma.nbotEntry.findMany({
        where,
        include: { employee: { select: { id: true, name: true, rank: true } } },
        orderBy: { date: "desc" },
    });
    // Aggregate totals by employee
    const totals = entries.reduce((acc, e) => {
        if (!acc[e.employeeId]) acc[e.employeeId] = { employee: e.employee, totalHours: 0 };
        acc[e.employeeId].totalHours += e.hours;
        return acc;
    }, {});
    res.json({ entries, totals: Object.values(totals) });
});

// POST /api/nbot
router.post("/", async (req, res) => {
    const schema = z.object({
        employeeId: z.string(),
        shiftAssignmentId: z.string().optional().nullable(),
        date: z.string(),
        hours: z.number().positive(),
        periodStart: z.string(),
        periodEnd: z.string(),
        notes: z.string().optional().nullable(),
    });
    const data = schema.parse(req.body);
    const entry = await prisma.nbotEntry.create({
        data: {
            ...data,
            date: new Date(data.date),
            periodStart: new Date(data.periodStart),
            periodEnd: new Date(data.periodEnd),
        },
        include: { employee: { select: { id: true, name: true } } },
    });
    await logAudit(req, "CREATE_NBOT_ENTRY", "NbotEntry", entry.id, null, entry);
    res.status(201).json(entry);
});

// DELETE /api/nbot/:id
router.delete("/:id", async (req, res) => {
    const entry = await prisma.nbotEntry.delete({ where: { id: req.params.id } });
    await logAudit(req, "DELETE_NBOT_ENTRY", "NbotEntry", req.params.id, entry, null);
    res.json({ success: true });
});

export default router;
