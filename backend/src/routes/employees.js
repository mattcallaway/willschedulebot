import { Router } from "express";
import prisma from "../lib/prisma.js";
import { auditLog } from "../services/auditService.js";

const router = Router();

// GET /employees — list with search/filter
router.get("/", async (req, res, next) => {
    try {
        const { search, status, shift, rank, active } = req.query;
        const employees = await prisma.employee.findMany({
            where: {
                ...(active !== undefined ? { activeFlag: active === "true" } : {}),
                ...(status ? { status } : {}),
                ...(rank ? { rank } : {}),
                ...(shift ? { shiftText: { contains: shift, mode: "insensitive" } } : {}),
                ...(search
                    ? {
                        OR: [
                            { name: { contains: search, mode: "insensitive" } },
                            { nuid: { contains: search, mode: "insensitive" } },
                            { rank: { contains: search, mode: "insensitive" } },
                            { email: { contains: search, mode: "insensitive" } },
                            { badgeNumber: { contains: search, mode: "insensitive" } },
                        ],
                    }
                    : {}),
            },
            orderBy: [
                { seniorityKey: "asc" },  // nulls go last in Postgres by default
                { name: "asc" },
            ],
        });
        res.json(employees);
    } catch (err) {
        next(err);
    }
});

// GET /employees/:id — single employee
router.get("/:id", async (req, res, next) => {
    try {
        const emp = await prisma.employee.findUniqueOrThrow({ where: { id: req.params.id } });
        res.json(emp);
    } catch (err) {
        next(err);
    }
});

// POST /employees — create new employee
router.post("/", async (req, res, next) => {
    try {
        const {
            name, nuid, rank, phone, email, kpEmail, shiftText, status,
            hireDate, last4, bciNumber, licenseGuardCardNumber, licenseExpiryPrimary,
            firearmInfo, firearmSerialNumber, farmCardNumber, licenseExpirySecondary,
            badgeNumber, bwcIssued, cedIssued, notes,
            // operational
            contractedWeeklyHours, ptoAccrualRate, ptoBalance, sickBalance,
            overtimeThreshold, outageStatus, activeFlag, overtimeRule, nbotRule,
            qualificationFlags, availabilityNotes, recurringScheduleTemplate, nbotEligible,
        } = req.body;

        if (!name) return res.status(400).json({ error: "name is required" });

        const emp = await prisma.employee.create({
            data: {
                name,
                nuid: nuid || null,
                rank, phone, email, kpEmail, shiftText, status,
                hireDate: hireDate ? new Date(hireDate) : null,
                seniorityKey: hireDate ? new Date(hireDate) : null,
                last4, bciNumber, licenseGuardCardNumber,
                licenseExpiryPrimary: licenseExpiryPrimary ? new Date(licenseExpiryPrimary) : null,
                firearmInfo, firearmSerialNumber, farmCardNumber,
                licenseExpirySecondary: licenseExpirySecondary ? new Date(licenseExpirySecondary) : null,
                badgeNumber, bwcIssued, cedIssued, notes,
                contractedWeeklyHours: contractedWeeklyHours ?? 40,
                overtimeThreshold: overtimeThreshold ?? contractedWeeklyHours ?? 40,
                ptoAccrualRate: ptoAccrualRate ?? 3.08,
                ptoBalance: ptoBalance ?? 0,
                sickBalance: sickBalance ?? 0,
                outageStatus: outageStatus || null,
                activeFlag: activeFlag ?? true,
                overtimeRule: overtimeRule || null,
                nbotRule: nbotRule || null,
                qualificationFlags: qualificationFlags || null,
                availabilityNotes: availabilityNotes || null,
                recurringScheduleTemplate: recurringScheduleTemplate || null,
                nbotEligible: nbotEligible ?? true,
            },
        });

        await auditLog({ userId: req.user?.id, action: "CREATE_EMPLOYEE", entityType: "Employee", entityId: emp.id, after: emp });
        res.status(201).json(emp);
    } catch (err) {
        next(err);
    }
});

// PUT /employees/:id — update employee
router.put("/:id", async (req, res, next) => {
    try {
        const prev = await prisma.employee.findUniqueOrThrow({ where: { id: req.params.id } });

        const {
            name, nuid, rank, phone, email, kpEmail, shiftText, status,
            hireDate, last4, bciNumber, licenseGuardCardNumber, licenseExpiryPrimary,
            firearmInfo, firearmSerialNumber, farmCardNumber, licenseExpirySecondary,
            badgeNumber, bwcIssued, cedIssued, notes,
            contractedWeeklyHours, ptoAccrualRate, ptoBalance, sickBalance,
            overtimeThreshold, outageStatus, activeFlag, overtimeRule, nbotRule,
            qualificationFlags, availabilityNotes, recurringScheduleTemplate, nbotEligible,
        } = req.body;

        const updated = await prisma.employee.update({
            where: { id: req.params.id },
            data: {
                ...(name !== undefined ? { name } : {}),
                ...(nuid !== undefined ? { nuid: nuid || null } : {}),
                ...(rank !== undefined ? { rank } : {}),
                ...(phone !== undefined ? { phone } : {}),
                ...(email !== undefined ? { email } : {}),
                ...(kpEmail !== undefined ? { kpEmail } : {}),
                ...(shiftText !== undefined ? { shiftText } : {}),
                ...(status !== undefined ? { status } : {}),
                ...(hireDate !== undefined ? { hireDate: hireDate ? new Date(hireDate) : null, seniorityKey: hireDate ? new Date(hireDate) : null } : {}),
                ...(last4 !== undefined ? { last4 } : {}),
                ...(bciNumber !== undefined ? { bciNumber } : {}),
                ...(licenseGuardCardNumber !== undefined ? { licenseGuardCardNumber } : {}),
                ...(licenseExpiryPrimary !== undefined ? { licenseExpiryPrimary: licenseExpiryPrimary ? new Date(licenseExpiryPrimary) : null } : {}),
                ...(firearmInfo !== undefined ? { firearmInfo } : {}),
                ...(firearmSerialNumber !== undefined ? { firearmSerialNumber } : {}),
                ...(farmCardNumber !== undefined ? { farmCardNumber } : {}),
                ...(licenseExpirySecondary !== undefined ? { licenseExpirySecondary: licenseExpirySecondary ? new Date(licenseExpirySecondary) : null } : {}),
                ...(badgeNumber !== undefined ? { badgeNumber } : {}),
                ...(bwcIssued !== undefined ? { bwcIssued } : {}),
                ...(cedIssued !== undefined ? { cedIssued } : {}),
                ...(notes !== undefined ? { notes } : {}),
                ...(contractedWeeklyHours !== undefined ? { contractedWeeklyHours: Number(contractedWeeklyHours) } : {}),
                ...(ptoAccrualRate !== undefined ? { ptoAccrualRate: Number(ptoAccrualRate) } : {}),
                ...(ptoBalance !== undefined ? { ptoBalance: Number(ptoBalance) } : {}),
                ...(sickBalance !== undefined ? { sickBalance: Number(sickBalance) } : {}),
                ...(overtimeThreshold !== undefined ? { overtimeThreshold: Number(overtimeThreshold) } : {}),
                ...(outageStatus !== undefined ? { outageStatus } : {}),
                ...(activeFlag !== undefined ? { activeFlag: Boolean(activeFlag) } : {}),
                ...(overtimeRule !== undefined ? { overtimeRule } : {}),
                ...(nbotRule !== undefined ? { nbotRule } : {}),
                ...(qualificationFlags !== undefined ? { qualificationFlags } : {}),
                ...(availabilityNotes !== undefined ? { availabilityNotes } : {}),
                ...(recurringScheduleTemplate !== undefined ? { recurringScheduleTemplate } : {}),
                ...(nbotEligible !== undefined ? { nbotEligible: Boolean(nbotEligible) } : {}),
                updatedAt: new Date(),
            },
        });

        await auditLog({ userId: req.user?.id, action: "UPDATE_EMPLOYEE", entityType: "Employee", entityId: updated.id, before: prev, after: updated });
        res.json(updated);
    } catch (err) {
        next(err);
    }
});

// DELETE /employees/:id — soft delete (sets activeFlag = false)
router.delete("/:id", async (req, res, next) => {
    try {
        const prev = await prisma.employee.findUniqueOrThrow({ where: { id: req.params.id } });
        const updated = await prisma.employee.update({
            where: { id: req.params.id },
            data: { activeFlag: false, status: "Inactive" },
        });
        await auditLog({ userId: req.user?.id, action: "DEACTIVATE_EMPLOYEE", entityType: "Employee", entityId: updated.id, before: prev, after: updated });
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

export default router;
