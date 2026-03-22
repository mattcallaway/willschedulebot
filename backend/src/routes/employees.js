import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { logAudit } from "../services/auditService.js";

const router = Router();

const employeeSchema = z.object({
    name: z.string().min(1),
    nuid: z.string().optional().nullable(),
    rank: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    kpEmail: z.string().optional().nullable(),
    shift: z.string().optional().nullable(),
    status: z.string().optional().nullable(),
    hireDate: z.string().optional().nullable(),
    last4: z.string().optional().nullable(),
    bciNumber: z.string().optional().nullable(),
    badgeNumber: z.string().optional().nullable(),
    bwcIssued: z.boolean().optional(),
    cedIssued: z.boolean().optional(),
    notes: z.string().optional().nullable(),
    contractedWeeklyHours: z.number().optional(),
    employmentType: z.string().optional(),
    defaultShiftLength: z.number().optional(),
    ptoAccrualRate: z.number().optional(),
    sickAccrualRate: z.number().optional(),
    overtimeThreshold: z.number().optional(),
    nbotEligible: z.boolean().optional(),
    active: z.boolean().optional(),
});

// GET /api/employees
router.get("/", async (req, res) => {
    const { search, status, shift, active } = req.query;
    const where = {};
    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { nuid: { contains: search, mode: "insensitive" } },
            { rank: { contains: search, mode: "insensitive" } },
        ];
    }
    if (status) where.status = status;
    if (shift) where.shift = shift;
    if (active !== undefined) where.active = active === "true";

    const employees = await prisma.employee.findMany({
        where,
        include: { credentials: true },
        orderBy: [{ seniorityKey: "asc" }, { name: "asc" }],
    });
    res.json(employees);
});

// GET /api/employees/:id
router.get("/:id", async (req, res) => {
    const employee = await prisma.employee.findUniqueOrThrow({
        where: { id: req.params.id },
        include: {
            credentials: true,
            recurringTemplates: true,
            leaveRequests: { orderBy: { startDate: "desc" }, take: 10 },
            overtimeEntries: { orderBy: { periodStart: "desc" }, take: 5 },
        },
    });
    res.json(employee);
});

// POST /api/employees
router.post("/", async (req, res) => {
    const data = employeeSchema.parse(req.body);
    const hireDate = data.hireDate ? new Date(data.hireDate) : null;
    const employee = await prisma.employee.create({
        data: {
            ...data,
            hireDate,
            seniorityKey: hireDate,
            overtimeThreshold: data.overtimeThreshold ?? data.contractedWeeklyHours ?? 40,
        },
        include: { credentials: true },
    });
    await logAudit(req, "CREATE", "Employee", employee.id, null, employee);
    res.status(201).json(employee);
});

// PUT /api/employees/:id
router.put("/:id", async (req, res) => {
    const before = await prisma.employee.findUniqueOrThrow({ where: { id: req.params.id } });
    const data = employeeSchema.partial().parse(req.body);
    const hireDate = data.hireDate ? new Date(data.hireDate) : undefined;
    const employee = await prisma.employee.update({
        where: { id: req.params.id },
        data: {
            ...data,
            ...(hireDate ? { hireDate, seniorityKey: hireDate } : {}),
        },
        include: { credentials: true },
    });
    await logAudit(req, "UPDATE", "Employee", employee.id, before, employee);
    res.json(employee);
});

// DELETE /api/employees/:id (soft delete)
router.delete("/:id", async (req, res) => {
    const employee = await prisma.employee.update({
        where: { id: req.params.id },
        data: { active: false },
    });
    await logAudit(req, "DEACTIVATE", "Employee", employee.id, null, { active: false });
    res.json({ success: true });
});

// GET /api/employees/:id/credentials
router.get("/:id/credentials", async (req, res) => {
    const cred = await prisma.employeeCredential.findUnique({
        where: { employeeId: req.params.id },
    });
    res.json(cred || {});
});

// PUT /api/employees/:id/credentials
router.put("/:id/credentials", async (req, res) => {
    const schema = z.object({
        licenseNumber: z.string().optional().nullable(),
        licenseExpiry: z.string().optional().nullable(),
        guardCardNumber: z.string().optional().nullable(),
        farmCardNumber: z.string().optional().nullable(),
        firearmInfo: z.string().optional().nullable(),
        firearmSerial: z.string().optional().nullable(),
    });
    const data = schema.parse(req.body);
    const cred = await prisma.employeeCredential.upsert({
        where: { employeeId: req.params.id },
        create: {
            ...data,
            employeeId: req.params.id,
            licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry) : null,
        },
        update: {
            ...data,
            licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry) : null,
        },
    });
    await logAudit(req, "UPDATE_CREDENTIALS", "EmployeeCredential", cred.id, null, cred);
    res.json(cred);
});

export default router;
