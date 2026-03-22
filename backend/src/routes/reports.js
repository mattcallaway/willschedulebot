import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

// GET /api/reports/hours — scheduled hours by employee for a date range
router.get("/hours", async (req, res) => {
    const { from, to } = req.query;
    const where = {};
    if (from || to) {
        where.date = {};
        if (from) where.date.gte = new Date(from);
        if (to) where.date.lte = new Date(to);
    }
    const shifts = await prisma.shift.findMany({
        where,
        include: {
            assignments: {
                include: { employee: { select: { id: true, name: true, rank: true } } },
            },
        },
    });
    // Aggregate by employee
    const byEmployee = {};
    for (const shift of shifts) {
        for (const assign of shift.assignments) {
            const { id, name, rank } = assign.employee;
            if (!byEmployee[id]) byEmployee[id] = { id, name, rank, regularHours: 0, overtimeHours: 0, nbotHours: 0 };
            byEmployee[id].regularHours += assign.regularHours;
            byEmployee[id].overtimeHours += assign.overtimeHours;
            byEmployee[id].nbotHours += assign.nbotHours;
        }
    }
    res.json(Object.values(byEmployee).sort((a, b) => a.name.localeCompare(b.name)));
});

// GET /api/reports/pto
router.get("/pto", async (req, res) => {
    const employees = await prisma.employee.findMany({
        where: { active: true },
        select: {
            id: true, name: true, rank: true, ptoBalance: true,
            ptoLedger: { orderBy: { createdAt: "desc" }, take: 5 },
        },
        orderBy: { name: "asc" },
    });
    res.json(employees);
});

// GET /api/reports/sick
router.get("/sick", async (req, res) => {
    const employees = await prisma.employee.findMany({
        where: { active: true },
        select: {
            id: true, name: true, rank: true, sickBalance: true,
            sickLedger: { orderBy: { createdAt: "desc" }, take: 5 },
        },
        orderBy: { name: "asc" },
    });
    res.json(employees);
});

// GET /api/reports/overtime
router.get("/overtime", async (req, res) => {
    const { from, to } = req.query;
    const where = {};
    if (from) where.periodStart = { gte: new Date(from) };
    if (to) where.periodEnd = { lte: new Date(to) };
    const entries = await prisma.overtimeEntry.findMany({
        where,
        include: { employee: { select: { id: true, name: true, rank: true } } },
        orderBy: { periodStart: "desc" },
    });
    res.json(entries);
});

// GET /api/reports/nbot
router.get("/nbot", async (req, res) => {
    const { from, to } = req.query;
    const where = {};
    if (from) where.periodStart = { gte: new Date(from) };
    if (to) where.periodEnd = { lte: new Date(to) };
    const entries = await prisma.nbotEntry.findMany({
        where,
        include: { employee: { select: { id: true, name: true, rank: true } } },
        orderBy: { date: "desc" },
    });
    // Aggregate totals by employee
    const totals = entries.reduce((acc, e) => {
        const key = e.employeeId;
        if (!acc[key]) acc[key] = { employee: e.employee, totalHours: 0 };
        acc[key].totalHours += e.hours;
        return acc;
    }, {});
    res.json({ entries, totals: Object.values(totals).sort((a, b) => b.totalHours - a.totalHours) });
});

// GET /api/reports/seniority — roster sorted by seniority
router.get("/seniority", async (req, res) => {
    const employees = await prisma.employee.findMany({
        where: { active: true },
        select: { id: true, name: true, rank: true, hireDate: true, seniorityKey: true, contractedWeeklyHours: true, shift: true },
        orderBy: [{ seniorityKey: "asc" }, { name: "asc" }],
    });
    res.json(employees);
});

// GET /api/reports/credentials — employees with credentials expiring within N days
router.get("/credentials", async (req, res) => {
    const daysAhead = parseInt(req.query.daysAhead || "90", 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);

    const creds = await prisma.employeeCredential.findMany({
        where: {
            licenseExpiry: { lte: cutoff },
        },
        include: {
            employee: { select: { id: true, name: true, rank: true, active: true } },
        },
        orderBy: { licenseExpiry: "asc" },
    });
    res.json(creds);
});

export default router;
