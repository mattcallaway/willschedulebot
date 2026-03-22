import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { logAudit } from "../services/auditService.js";

const router = Router();

const leaveSchema = z.object({
    employeeId: z.string(),
    type: z.enum(["pto", "sick", "outage", "unpaid", "fmla", "other"]),
    startDate: z.string(),
    endDate: z.string(),
    hours: z.number().nonnegative(),
    reason: z.string().optional().nullable(),
    adminNotes: z.string().optional().nullable(),
    status: z.enum(["pending", "approved", "denied"]).optional(),
});

// GET /api/leave
router.get("/", async (req, res) => {
    const { employeeId, type, status, from, to } = req.query;
    const where = {};
    if (employeeId) where.employeeId = employeeId;
    if (type) where.type = type;
    if (status) where.status = status;
    if (from || to) {
        where.startDate = {};
        if (from) where.startDate.gte = new Date(from);
        if (to) where.endDate = { lte: new Date(to) };
    }
    const requests = await prisma.leaveRequest.findMany({
        where,
        include: { employee: { select: { id: true, name: true, rank: true } } },
        orderBy: { startDate: "desc" },
    });
    res.json(requests);
});

// GET /api/leave/:id
router.get("/:id", async (req, res) => {
    const leave = await prisma.leaveRequest.findUniqueOrThrow({
        where: { id: req.params.id },
        include: { employee: true },
    });
    res.json(leave);
});

// POST /api/leave
router.post("/", async (req, res) => {
    const data = leaveSchema.parse(req.body);
    const leave = await prisma.leaveRequest.create({
        data: {
            ...data,
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
        },
        include: { employee: true },
    });
    // Auto-charge leave balance
    if (leave.status === "approved" && leave.hours > 0) {
        const { chargeLeave } = await import("../services/leaveService.js");
        await chargeLeave(leave, req);
    }
    await logAudit(req, "CREATE_LEAVE_REQUEST", "LeaveRequest", leave.id, null, leave);
    res.status(201).json(leave);
});

// PUT /api/leave/:id
router.put("/:id", async (req, res) => {
    const before = await prisma.leaveRequest.findUniqueOrThrow({ where: { id: req.params.id } });
    const data = leaveSchema.partial().parse(req.body);
    const leave = await prisma.leaveRequest.update({
        where: { id: req.params.id },
        data: {
            ...data,
            ...(data.startDate ? { startDate: new Date(data.startDate) } : {}),
            ...(data.endDate ? { endDate: new Date(data.endDate) } : {}),
        },
        include: { employee: true },
    });
    // If status changed to approved and wasn't before, charge leave
    if (data.status === "approved" && before.status !== "approved" && leave.hours > 0) {
        const { chargeLeave } = await import("../services/leaveService.js");
        await chargeLeave(leave, req);
    }
    await logAudit(req, "UPDATE_LEAVE_REQUEST", "LeaveRequest", leave.id, before, leave);
    res.json(leave);
});

// DELETE /api/leave/:id
router.delete("/:id", async (req, res) => {
    const leave = await prisma.leaveRequest.delete({ where: { id: req.params.id } });
    await logAudit(req, "DELETE_LEAVE_REQUEST", "LeaveRequest", req.params.id, leave, null);
    res.json({ success: true });
});

export default router;
