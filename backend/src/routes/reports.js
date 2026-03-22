import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

// GET /api/reports/hours — scheduled hours by employee for a date range
router.get("/hours", async (req, res, next) => {
    try {
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
        const byEmployee = {};
        for (const shift of shifts) {
            for (const assign of shift.assignments) {
                const { id, name, rank } = assign.employee;
                if (!byEmployee[id]) byEmployee[id] = { id, name, rank, regularHours: 0, overtimeHours: 0, nbotHours: 0 };
                byEmployee[id].regularHours += assign.regularHours || 0;
                byEmployee[id].overtimeHours += assign.overtimeHours || 0;
                byEmployee[id].nbotHours += assign.nbotHours || 0;
            }
        }
        res.json(Object.values(byEmployee).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) { next(err); }
});

// GET /api/reports/pto
router.get("/pto", async (req, res, next) => {
    try {
        const employees = await prisma.employee.findMany({
            where: { activeFlag: true },
            select: {
                id: true, name: true, rank: true, ptoBalance: true,
                ptoLedger: { orderBy: { createdAt: "desc" }, take: 5 },
            },
            orderBy: [{ seniorityKey: "asc" }, { name: "asc" }],
        });
        res.json(employees);
    } catch (err) { next(err); }
});

// GET /api/reports/sick
router.get("/sick", async (req, res, next) => {
    try {
        const employees = await prisma.employee.findMany({
            where: { activeFlag: true },
            select: {
                id: true, name: true, rank: true, sickBalance: true,
                sickLedger: { orderBy: { createdAt: "desc" }, take: 5 },
            },
            orderBy: [{ seniorityKey: "asc" }, { name: "asc" }],
        });
        res.json(employees);
    } catch (err) { next(err); }
});

// GET /api/reports/overtime
router.get("/overtime", async (req, res, next) => {
    try {
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
    } catch (err) { next(err); }
});

// GET /api/reports/nbot
router.get("/nbot", async (req, res, next) => {
    try {
        const { from, to } = req.query;
        const where = {};
        if (from) where.periodStart = { gte: new Date(from) };
        if (to) where.periodEnd = { lte: new Date(to) };
        const entries = await prisma.nbotEntry.findMany({
            where,
            include: { employee: { select: { id: true, name: true, rank: true } } },
            orderBy: { date: "desc" },
        });
        const totals = entries.reduce((acc, e) => {
            const key = e.employeeId;
            if (!acc[key]) acc[key] = { employee: e.employee, totalHours: 0 };
            acc[key].totalHours += e.hours;
            return acc;
        }, {});
        res.json({ entries, totals: Object.values(totals).sort((a, b) => b.totalHours - a.totalHours) });
    } catch (err) { next(err); }
});

// GET /api/reports/seniority — roster sorted by seniority (hire date asc)
router.get("/seniority", async (req, res, next) => {
    try {
        const employees = await prisma.employee.findMany({
            where: { activeFlag: true },
            select: {
                id: true, name: true, rank: true, hireDate: true,
                seniorityKey: true, seniorityRank: true,
                contractedWeeklyHours: true, shiftText: true, status: true,
            },
            orderBy: [{ seniorityKey: "asc" }, { name: "asc" }],
        });
        res.json(employees);
    } catch (err) { next(err); }
});

// GET /api/reports/credentials — employees with credentials expiring within N days
// NOTE: credential fields are stored directly on the Employee model
router.get("/credentials", async (req, res, next) => {
    try {
        const daysAhead = parseInt(req.query.daysAhead || "90", 10);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + daysAhead);

        // Return all employees that have any license expiry set
        const employees = await prisma.employee.findMany({
            where: {
                activeFlag: true,
                OR: [
                    { licenseExpiryPrimary: { not: null } },
                    { licenseExpirySecondary: { not: null } },
                ],
            },
            select: {
                id: true, name: true, rank: true,
                licenseGuardCardNumber: true,
                licenseExpiryPrimary: true,
                licenseExpirySecondary: true,
                farmCardNumber: true,
                firearmInfo: true,
                firearmSerialNumber: true,
            },
            orderBy: { licenseExpiryPrimary: "asc" },
        });
        res.json(employees);
    } catch (err) { next(err); }
});

export default router;
