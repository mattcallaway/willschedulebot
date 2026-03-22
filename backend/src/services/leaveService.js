import prisma from "../lib/prisma.js";
import { logAudit } from "./auditService.js";

/**
 * Charge leave (PTO or sick) when a leave request is approved.
 * @param {object} leave - LeaveRequest record
 * @param {import("express").Request} req
 */
export async function chargeLeave(leave, req) {
    const employee = await prisma.employee.findUniqueOrThrow({ where: { id: leave.employeeId } });

    if (leave.type === "pto") {
        const newBalance = employee.ptoBalance - leave.hours;
        if (newBalance < 0) {
            throw Object.assign(new Error("Insufficient PTO balance"), { statusCode: 422 });
        }
        await prisma.employee.update({ where: { id: leave.employeeId }, data: { ptoBalance: newBalance } });
        await prisma.ptoLedger.create({
            data: {
                employeeId: leave.employeeId,
                type: "usage",
                hours: -leave.hours,
                balance: newBalance,
                reason: leave.reason || "PTO leave",
                referenceId: leave.id,
                recordedBy: req.user?.id,
            },
        });
    }

    if (leave.type === "sick") {
        const newBalance = employee.sickBalance - leave.hours;
        if (newBalance < 0) {
            throw Object.assign(new Error("Insufficient sick time balance"), { statusCode: 422 });
        }
        await prisma.employee.update({ where: { id: leave.employeeId }, data: { sickBalance: newBalance } });
        await prisma.sickLedger.create({
            data: {
                employeeId: leave.employeeId,
                type: "usage",
                hours: -leave.hours,
                balance: newBalance,
                reason: leave.reason || "Sick leave",
                referenceId: leave.id,
                recordedBy: req.user?.id,
            },
        });
    }
}

/**
 * Accrue PTO for an employee based on hours worked.
 * @param {string} employeeId
 * @param {number} hoursWorked
 * @param {Date} payPeriodEnd
 * @param {string} [recordedBy]
 */
export async function accruePto(employeeId, hoursWorked, payPeriodEnd, recordedBy) {
    const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
    const accrued = (hoursWorked / 80) * employee.ptoAccrualRate;
    const newBalance = employee.ptoBalance + accrued;
    await prisma.employee.update({ where: { id: employeeId }, data: { ptoBalance: newBalance } });
    await prisma.ptoLedger.create({
        data: {
            employeeId,
            type: "accrual",
            hours: accrued,
            balance: newBalance,
            reason: `Auto-accrual for ${hoursWorked.toFixed(2)} hrs worked`,
            payPeriodEnd,
            recordedBy,
        },
    });
    return { accrued, newBalance };
}

/**
 * Accrue sick time for an employee based on hours worked.
 */
export async function accrueSick(employeeId, hoursWorked, payPeriodEnd, recordedBy) {
    const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
    const accrued = (hoursWorked / 80) * employee.sickAccrualRate;
    const newBalance = employee.sickBalance + accrued;
    await prisma.employee.update({ where: { id: employeeId }, data: { sickBalance: newBalance } });
    await prisma.sickLedger.create({
        data: {
            employeeId,
            type: "accrual",
            hours: accrued,
            balance: newBalance,
            reason: `Auto-accrual for ${hoursWorked.toFixed(2)} hrs worked`,
            payPeriodEnd,
            recordedBy,
        },
    });
    return { accrued, newBalance };
}

/**
 * Manual balance adjustment with reason logging.
 */
export async function adjustBalance(employeeId, leaveType, hours, reason, recordedBy) {
    const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });

    if (leaveType === "pto") {
        const newBalance = employee.ptoBalance + hours;
        if (newBalance < 0) throw Object.assign(new Error("Adjustment would result in negative PTO balance"), { statusCode: 422 });
        await prisma.employee.update({ where: { id: employeeId }, data: { ptoBalance: newBalance } });
        await prisma.ptoLedger.create({
            data: { employeeId, type: "adjustment", hours, balance: newBalance, reason, recordedBy },
        });
        return { newBalance };
    }

    if (leaveType === "sick") {
        const newBalance = employee.sickBalance + hours;
        if (newBalance < 0) throw Object.assign(new Error("Adjustment would result in negative sick balance"), { statusCode: 422 });
        await prisma.employee.update({ where: { id: employeeId }, data: { sickBalance: newBalance } });
        await prisma.sickLedger.create({
            data: { employeeId, type: "adjustment", hours, balance: newBalance, reason, recordedBy },
        });
        return { newBalance };
    }

    throw new Error(`Unknown leave type: ${leaveType}`);
}
