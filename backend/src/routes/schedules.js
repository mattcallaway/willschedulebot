import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { logAudit } from "../services/auditService.js";

const router = Router();

// GET /api/schedules?week=YYYY-MM-DD — full week schedule grouped by date
router.get("/", async (req, res, next) => {
    try {
        const { week } = req.query;
        const start = week ? new Date(week) : startOfCurrentWeek();
        const end = new Date(start.getTime() + 7 * 86400000);

        const shifts = await prisma.shift.findMany({
            where: { date: { gte: start, lt: end } },
            include: {
                assignments: {
                    include: {
                        employee: {
                            select: {
                                id: true,
                                name: true,
                                rank: true,
                                contractedWeeklyHours: true,
                                shiftText: true,  // ← was `shift` before schema rename
                                status: true,
                                seniorityRank: true,
                            },
                        },
                    },
                },
            },
            orderBy: [{ date: "asc" }, { startTime: "asc" }],
        });

        // Group by ISO date string (YYYY-MM-DD)
        const byDate = {};
        for (const shift of shifts) {
            const key = shift.date.toISOString().slice(0, 10);
            if (!byDate[key]) byDate[key] = [];
            byDate[key].push(shift);
        }

        res.json({
            weekStart: start.toISOString().slice(0, 10),
            weekEnd: end.toISOString().slice(0, 10),
            schedule: byDate,
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/schedules/snapshot — save a named schedule version
router.post("/snapshot", async (req, res, next) => {
    try {
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
                weekStart,
                snapshot: JSON.stringify(shifts),  // store as JSON string for SQLite
                createdBy: req.user?.id,
                changeNote: changeNote ?? null,
            },
        });

        await logAudit(req, "SNAPSHOT_SCHEDULE", "ScheduleVersion", version.id, null, { weekStart, changeNote });
        res.status(201).json(version);
    } catch (err) {
        next(err);
    }
});

// GET /api/schedules/versions?weekStart=YYYY-MM-DD
router.get("/versions", async (req, res, next) => {
    try {
        const where = {};
        if (req.query.weekStart) where.weekStart = new Date(req.query.weekStart);
        const versions = await prisma.scheduleVersion.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: 20,
        });
        res.json(versions);
    } catch (err) {
        next(err);
    }
});

function startOfCurrentWeek() {
    const now = new Date();
    const diff = now.getDate() - now.getDay();
    return new Date(new Date(now).setDate(diff));
}

export default router;
