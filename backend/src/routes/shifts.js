import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { logAudit } from "../services/auditService.js";

const router = Router();

const shiftSchema = z.object({
    date: z.string(),
    startTime: z.string(), // "HH:MM"
    endTime: z.string(),
    durationHrs: z.number().positive(),
    label: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    isOpen: z.boolean().optional(),
});

// GET /api/shifts?date=YYYY-MM-DD&week=YYYY-MM-DD
router.get("/", async (req, res) => {
    const { date, week } = req.query;
    const where = {};
    if (date) {
        const d = new Date(date);
        where.date = { gte: d, lt: new Date(d.getTime() + 86400000) };
    } else if (week) {
        const start = new Date(week);
        const end = new Date(start.getTime() + 7 * 86400000);
        where.date = { gte: start, lt: end };
    }
    const shifts = await prisma.shift.findMany({
        where,
        include: {
            assignments: {
                include: {
                    employee: {
                        select: { id: true, name: true, rank: true, contractedWeeklyHours: true, seniorityKey: true },
                    },
                },
            },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
    res.json(shifts);
});

// GET /api/shifts/:id
router.get("/:id", async (req, res) => {
    const shift = await prisma.shift.findUniqueOrThrow({
        where: { id: req.params.id },
        include: {
            assignments: { include: { employee: true } },
        },
    });
    res.json(shift);
});

// POST /api/shifts
router.post("/", async (req, res) => {
    const data = shiftSchema.parse(req.body);
    const shift = await prisma.shift.create({
        data: { ...data, date: new Date(data.date) },
    });
    await logAudit(req, "CREATE_SHIFT", "Shift", shift.id, null, shift);
    res.status(201).json(shift);
});

// PUT /api/shifts/:id
router.put("/:id", async (req, res) => {
    const before = await prisma.shift.findUniqueOrThrow({ where: { id: req.params.id } });
    const data = shiftSchema.partial().parse(req.body);
    const shift = await prisma.shift.update({
        where: { id: req.params.id },
        data: { ...data, ...(data.date ? { date: new Date(data.date) } : {}) },
        include: { assignments: { include: { employee: true } } },
    });
    await logAudit(req, "UPDATE_SHIFT", "Shift", shift.id, before, shift);
    res.json(shift);
});

// DELETE /api/shifts/:id
router.delete("/:id", async (req, res) => {
    await prisma.shift.delete({ where: { id: req.params.id } });
    await logAudit(req, "DELETE_SHIFT", "Shift", req.params.id, null, null);
    res.json({ success: true });
});

// POST /api/shifts/:id/assign
router.post("/:id/assign", async (req, res) => {
    const schema = z.object({
        employeeId: z.string(),
        type: z.enum(["regular", "cover", "split", "override"]).optional(),
        isNbot: z.boolean().optional(),
        nbotHours: z.number().optional(),
        regularHours: z.number().optional(),
        overtimeHours: z.number().optional(),
        coveredForEmployeeId: z.string().optional().nullable(),
        overrideReason: z.string().optional().nullable(),
        recommendedReason: z.string().optional().nullable(),
    });
    const data = schema.parse(req.body);
    const assignment = await prisma.shiftAssignment.create({
        data: { shiftId: req.params.id, ...data },
        include: { employee: true, shift: true },
    });
    // Mark shift as no longer open if filled
    await prisma.shift.update({ where: { id: req.params.id }, data: { isOpen: false } });
    await logAudit(req, "ASSIGN_SHIFT", "ShiftAssignment", assignment.id, null, assignment, data.overrideReason);
    res.status(201).json(assignment);
});

// PUT /api/shifts/:id/assignments/:assignmentId — reassign / edit
router.put("/:id/assignments/:assignmentId", async (req, res) => {
    const schema = z.object({
        employeeId: z.string().optional(),
        type: z.string().optional(),
        isNbot: z.boolean().optional(),
        nbotHours: z.number().optional(),
        regularHours: z.number().optional(),
        overtimeHours: z.number().optional(),
        overrideReason: z.string().optional().nullable(),
        approvedBy: z.string().optional().nullable(),
        recommendedReason: z.string().optional().nullable(),
    });
    const before = await prisma.shiftAssignment.findUniqueOrThrow({ where: { id: req.params.assignmentId } });
    const data = schema.parse(req.body);
    const assignment = await prisma.shiftAssignment.update({
        where: { id: req.params.assignmentId },
        data,
        include: { employee: true },
    });
    await logAudit(req, "REASSIGN_SHIFT", "ShiftAssignment", assignment.id, before, assignment, data.overrideReason);
    res.json(assignment);
});

export default router;
