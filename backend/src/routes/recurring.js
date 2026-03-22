import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { logAudit } from "../services/auditService.js";

const router = Router();

const templateSchema = z.object({
    employeeId: z.string(),
    name: z.string().optional(),
    pattern: z.array(z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: z.string(),
        endTime: z.string(),
        isNbot: z.boolean().optional(),
    })),
    effectiveFrom: z.string().optional(),
    effectiveTo: z.string().optional().nullable(),
    active: z.boolean().optional(),
});

// GET /api/recurring?employeeId=...
router.get("/", async (req, res) => {
    const where = {};
    if (req.query.employeeId) where.employeeId = req.query.employeeId;
    const templates = await prisma.recurringScheduleTemplate.findMany({
        where,
        include: { employee: { select: { id: true, name: true, rank: true } } },
        orderBy: { createdAt: "desc" },
    });
    res.json(templates);
});

// GET /api/recurring/:id
router.get("/:id", async (req, res) => {
    const tpl = await prisma.recurringScheduleTemplate.findUniqueOrThrow({
        where: { id: req.params.id },
        include: { employee: true },
    });
    res.json(tpl);
});

// POST /api/recurring
router.post("/", async (req, res) => {
    const data = templateSchema.parse(req.body);
    const tpl = await prisma.recurringScheduleTemplate.create({
        data: {
            ...data,
            effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
            effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
        },
        include: { employee: { select: { id: true, name: true } } },
    });
    await logAudit(req, "CREATE_RECURRING_TEMPLATE", "RecurringScheduleTemplate", tpl.id, null, tpl);
    res.status(201).json(tpl);
});

// PUT /api/recurring/:id
router.put("/:id", async (req, res) => {
    const before = await prisma.recurringScheduleTemplate.findUniqueOrThrow({ where: { id: req.params.id } });
    const data = templateSchema.partial().parse(req.body);
    const tpl = await prisma.recurringScheduleTemplate.update({
        where: { id: req.params.id },
        data: {
            ...data,
            ...(data.effectiveFrom ? { effectiveFrom: new Date(data.effectiveFrom) } : {}),
            ...(data.effectiveTo !== undefined ? { effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null } : {}),
        },
        include: { employee: { select: { id: true, name: true } } },
    });
    await logAudit(req, "UPDATE_RECURRING_TEMPLATE", "RecurringScheduleTemplate", tpl.id, before, tpl);
    res.json(tpl);
});

// DELETE /api/recurring/:id
router.delete("/:id", async (req, res) => {
    await prisma.recurringScheduleTemplate.delete({ where: { id: req.params.id } });
    await logAudit(req, "DELETE_RECURRING_TEMPLATE", "RecurringScheduleTemplate", req.params.id, null, null);
    res.json({ success: true });
});

// POST /api/recurring/:id/generate — expand recurring template into actual shifts for a week
router.post("/:id/generate", async (req, res) => {
    const { weekStart } = z.object({ weekStart: z.string() }).parse(req.body);
    const tpl = await prisma.recurringScheduleTemplate.findUniqueOrThrow({ where: { id: req.params.id } });
    const start = new Date(weekStart);

    const created = [];
    for (const block of tpl.pattern) {
        const shiftDate = new Date(start);
        shiftDate.setDate(start.getDate() + block.dayOfWeek);

        const [sh, sm] = block.startTime.split(":").map(Number);
        const [eh, em] = block.endTime.split(":").map(Number);
        const durationHrs = ((eh * 60 + em) - (sh * 60 + sm)) / 60;

        const shift = await prisma.shift.create({
            data: {
                date: shiftDate,
                startTime: block.startTime,
                endTime: block.endTime,
                durationHrs,
                label: `${tpl.name || "Recurring"} — Day ${block.dayOfWeek}`,
                isOpen: false,
                assignments: {
                    create: {
                        employeeId: tpl.employeeId,
                        type: "regular",
                        isNbot: block.isNbot || false,
                        regularHours: durationHrs,
                    },
                },
            },
            include: { assignments: true },
        });
        created.push(shift);
    }
    await logAudit(req, "GENERATE_RECURRING", "RecurringScheduleTemplate", tpl.id, null, { weekStart, shiftCount: created.length });
    res.status(201).json(created);
});

export default router;
