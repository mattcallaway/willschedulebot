import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { logAudit } from "../services/auditService.js";

const router = Router();

// GET /api/schedules?week=YYYY-MM-DD — week schedule with full shift+assignment data
router.get("/", async (req, res) => {
    const { week } = req.query;
    const start = week ? new Date(week) : startOfCurrentWeek();
    const end = new Date(start.getTime() + 7 * 86400000);
    const shifts = await prisma.shift.findMany({
        where: { date: { gte: start, lt: end } },
        include: {
            assignments: {
                include: {
                    employee: {
                        select: { id: true, name: true, rank: true, contractedWeeklyHours: true, shift: true, status: true },
                    },
                },
            },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
    // Group by date
    const byDate = {};
    for (const shift of shifts) {
        const key = shift.date.toISOString().slice(0, 10);
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(shift);
    }
    res.json({ weekStart: start.toISOString().slice(0, 10), weekEnd: end.toISOString().slice(0, 10), schedule: byDate });
});

// POST /api/schedules/snapshot — save a schedule version
router.post("/snapshot", async (req, res) => {
    const { weekStart, changeNote } = z.object({
        weekStart: z.string(),
        changeNote: z.string().optional(),
    }).parse(req.body);

    const start = new Date(weekStart);
    const end = new Date(start.getTime() + 7 * 86400000);
    const shifts = await prisma.shift.findMany({
        where: { date: { gte: start, lt: end } },
        include: { assignments: { include: { employee: true } } },
    });
    const version = await prisma.scheduleVersion.create({
        data: {
            weekStart: start,
            snapshot: shifts,
            createdBy: req.user?.id,
            changeNote,
        },
    });
    await logAudit(req, "SNAPSHOT_SCHEDULE", "ScheduleVersion", version.id, null, { weekStart, changeNote });
    res.status(201).json(version);
});

// GET /api/schedules/versions?weekStart=YYYY-MM-DD
router.get("/versions", async (req, res) => {
    const where = {};
    if (req.query.weekStart) where.weekStart = new Date(req.query.weekStart);
    const versions = await prisma.scheduleVersion.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 20,
    });
    res.json(versions);
});

function startOfCurrentWeek() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day;
    return new Date(now.setDate(diff));
}

export default router;
