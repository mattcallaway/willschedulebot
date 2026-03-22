import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { logAudit } from "../services/auditService.js";
import { adjustBalance } from "../services/leaveService.js";

const router = Router();
const adjSchema = z.object({
    employeeId: z.string(),
    leaveType: z.enum(["pto", "sick"]),
    hours: z.number(),
    reason: z.string().min(1),
});

// GET /api/ledger/pto/:employeeId
router.get("/pto/:employeeId", async (req, res) => {
    const entries = await prisma.ptoLedger.findMany({
        where: { employeeId: req.params.employeeId },
        orderBy: { createdAt: "desc" },
    });
    const employee = await prisma.employee.findUniqueOrThrow({
        where: { id: req.params.employeeId },
        select: { ptoBalance: true, name: true },
    });
    res.json({ balance: employee.ptoBalance, entries });
});

// GET /api/ledger/sick/:employeeId
router.get("/sick/:employeeId", async (req, res) => {
    const entries = await prisma.sickLedger.findMany({
        where: { employeeId: req.params.employeeId },
        orderBy: { createdAt: "desc" },
    });
    const employee = await prisma.employee.findUniqueOrThrow({
        where: { id: req.params.employeeId },
        select: { sickBalance: true, name: true },
    });
    res.json({ balance: employee.sickBalance, entries });
});

// POST /api/ledger/adjust
router.post("/adjust", async (req, res) => {
    const { employeeId, leaveType, hours, reason } = adjSchema.parse(req.body);
    const result = await adjustBalance(employeeId, leaveType, hours, reason, req.user?.id);
    await logAudit(req, "ADJUST_LEAVE_BALANCE", "Employee", employeeId, null, { leaveType, hours, reason }, reason);
    res.json(result);
});

// POST /api/ledger/accrue — trigger manual pay-period accrual
router.post("/accrue", async (req, res) => {
    const schema = z.object({
        employeeId: z.string(),
        hoursWorked: z.number().positive(),
        payPeriodEnd: z.string(),
    });
    const { employeeId, hoursWorked, payPeriodEnd } = schema.parse(req.body);
    const { accruePto, accrueSick } = await import("../services/leaveService.js");
    const ptoResult = await accruePto(employeeId, hoursWorked, new Date(payPeriodEnd), req.user?.id);
    const sickResult = await accrueSick(employeeId, hoursWorked, new Date(payPeriodEnd), req.user?.id);
    await logAudit(req, "MANUAL_ACCRUE", "Employee", employeeId, null, { hoursWorked, payPeriodEnd });
    res.json({ pto: ptoResult, sick: sickResult });
});

export default router;
