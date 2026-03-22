/**
 * WillScheduleBot Seed Script
 * Run: node seeds/seed.js
 *
 * Creates:
 *  - 1 admin user
 *  - 12 demo employees (mix of 32hr and 40hr, various ranks)
 *  - Credentials for credentialed employees
 *  - App settings (OT thresholds, accrual rates)
 *  - Demo recurring schedule templates
 *  - Demo shifts for current week
 *  - Demo leave requests + ledger entries
 *  - Demo NBOT and overtime entries
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, startOfWeek, format } from "date-fns";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Seeding WillScheduleBot...");

    // ── Admin User ──────────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash("Admin1234!", 12);
    const admin = await prisma.user.upsert({
        where: { email: "admin@willschedulebot.local" },
        update: {},
        create: {
            email: "admin@willschedulebot.local",
            name: "System Admin",
            password: passwordHash,
            role: "admin",
        },
    });
    console.log("  ✓ Admin user created:", admin.email);

    // ── App Settings ────────────────────────────────────────────────────────
    const settings = [
        { key: "ot_threshold_40hr", value: "40", label: "OT threshold for 40-hr employees (hrs/week)", group: "overtime" },
        { key: "ot_threshold_32hr", value: "32", label: "OT threshold for 32-hr employees (hrs/week)", group: "overtime" },
        { key: "pto_accrual_rate", value: "3.08", label: "PTO accrual rate (hrs per 80 hrs worked)", group: "accrual" },
        { key: "sick_accrual_rate", value: "1.54", label: "Sick accrual rate (hrs per 80 hrs worked)", group: "accrual" },
        { key: "pay_period_days", value: "14", label: "Pay period length (days)", group: "general" },
        { key: "nbot_requires_approval", value: "true", label: "NBOT requires admin approval", group: "nbot" },
    ];
    for (const s of settings) {
        await prisma.appSetting.upsert({ where: { key: s.key }, create: s, update: s });
    }
    console.log("  ✓ App settings seeded");

    // ── Employees ───────────────────────────────────────────────────────────
    const employeeDefs = [
        { name: "Alice Johnson", rank: "Sergeant", contractedWeeklyHours: 40, hireDate: "2012-03-15", shift: "Day", status: "Active", nuid: "E001" },
        { name: "Bob Martinez", rank: "Officer", contractedWeeklyHours: 40, hireDate: "2015-07-22", shift: "Night", status: "Active", nuid: "E002" },
        { name: "Carol Williams", rank: "Officer", contractedWeeklyHours: 32, hireDate: "2018-01-10", shift: "Day", status: "Active", nuid: "E003" },
        { name: "David Chen", rank: "Officer", contractedWeeklyHours: 32, hireDate: "2019-05-30", shift: "Swing", status: "Active", nuid: "E004" },
        { name: "Emma Davis", rank: "Corporal", contractedWeeklyHours: 40, hireDate: "2010-11-01", shift: "Day", status: "Active", nuid: "E005" },
        { name: "Frank Wilson", rank: "Officer", contractedWeeklyHours: 40, hireDate: "2020-08-15", shift: "Night", status: "Active", nuid: "E006" },
        { name: "Grace Thompson", rank: "Lieutenant", contractedWeeklyHours: 40, hireDate: "2008-04-12", shift: "Day", status: "Active", nuid: "E007" },
        { name: "Henry Garcia", rank: "Officer", contractedWeeklyHours: 32, hireDate: "2021-02-28", shift: "Day", status: "Active", nuid: "E008" },
        { name: "Iris Adams", rank: "Officer", contractedWeeklyHours: 32, hireDate: "2022-06-01", shift: "Night", status: "Active", nuid: "E009" },
        { name: "James Robinson", rank: "Officer", contractedWeeklyHours: 40, hireDate: "2017-09-19", shift: "Swing", status: "Active", nuid: "E010" },
        { name: "Karen White", rank: "Sergeant", contractedWeeklyHours: 40, hireDate: "2013-12-05", shift: "Night", status: "Active", nuid: "E011" },
        { name: "Leo Harris", rank: "Officer", contractedWeeklyHours: 32, hireDate: "2023-03-14", shift: "Day", status: "Active", nuid: "E012" },
    ];

    const createdEmployees = [];
    for (const def of employeeDefs) {
        const hireDate = new Date(def.hireDate);
        const emp = await prisma.employee.upsert({
            where: { nuid: def.nuid },
            create: {
                ...def,
                hireDate,
                seniorityKey: hireDate,
                overtimeThreshold: def.contractedWeeklyHours,
                ptoBalance: 40 + Math.random() * 40,
                sickBalance: 20 + Math.random() * 20,
                ptoAccrualRate: 3.08,
                sickAccrualRate: 1.54,
                nbotEligible: true,
                bwcIssued: Math.random() > 0.3,
                cedIssued: Math.random() > 0.5,
                badgeNumber: `B${1000 + createdEmployees.length}`,
            },
            update: { name: def.name },
        });
        createdEmployees.push(emp);
    }
    console.log(`  ✓ ${createdEmployees.length} employees seeded`);

    // ── Credentials ─────────────────────────────────────────────────────────
    const expiryDates = [
        new Date("2024-11-30"), // expired
        new Date("2026-06-30"),
        new Date("2026-12-31"),
        new Date("2027-03-15"),
        new Date("2025-04-01"), // expires soon
    ];
    for (let i = 0; i < Math.min(createdEmployees.length, expiryDates.length); i++) {
        await prisma.employeeCredential.upsert({
            where: { employeeId: createdEmployees[i].id },
            create: {
                employeeId: createdEmployees[i].id,
                licenseNumber: `LIC-${10000 + i}`,
                licenseExpiry: expiryDates[i],
                guardCardNumber: `GC-${5000 + i}`,
                farmCardNumber: `FC-${2000 + i}`,
                firearmInfo: i % 3 === 0 ? "Glock 17, 9mm" : null,
                firearmSerial: i % 3 === 0 ? `GK${100000 + i}` : null,
            },
            update: {},
        });
    }
    console.log("  ✓ Credentials seeded");

    // ── Demo Shifts — current week ───────────────────────────────────────────
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 }); // Sunday
    const shiftDefs = [
        { dow: 0, start: "07:00", end: "15:00", label: "Day Shift A" },
        { dow: 0, start: "15:00", end: "23:00", label: "Swing Shift A" },
        { dow: 0, start: "23:00", end: "07:00", label: "Night Shift A" },
        { dow: 1, start: "07:00", end: "15:00", label: "Day Shift B" },
        { dow: 1, start: "15:00", end: "23:00", label: "Swing Shift B" },
        { dow: 2, start: "07:00", end: "15:00", label: "Day Shift C" },
        { dow: 2, start: "15:00", end: "23:00", label: "Swing Shift C" },
        { dow: 3, start: "07:00", end: "15:00", label: "Day Shift D" },
        { dow: 4, start: "07:00", end: "15:00", label: "Day Shift E" },
        { dow: 5, start: "07:00", end: "15:00", label: "Day Shift F" },
        { dow: 6, start: "07:00", end: "15:00", label: "Weekend Day Shift" },
    ];

    let assignIdx = 0;
    for (const def of shiftDefs) {
        const date = addDays(weekStart, def.dow);
        const [sh, sm] = def.start.split(":").map(Number);
        const [eh, em] = def.end.split(":").map(Number);
        let dur = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
        if (dur <= 0) dur += 24; // overnight

        const shift = await prisma.shift.create({
            data: {
                date,
                startTime: def.start,
                endTime: def.end,
                durationHrs: dur,
                label: def.label,
                isOpen: false,
            },
        });

        const emp = createdEmployees[assignIdx % createdEmployees.length];
        await prisma.shiftAssignment.create({
            data: {
                shiftId: shift.id,
                employeeId: emp.id,
                type: "regular",
                regularHours: dur,
                isNbot: false,
            },
        });
        assignIdx++;
    }
    console.log(`  ✓ ${shiftDefs.length} demo shifts created for current week`);

    // ── Demo Leave Requests ─────────────────────────────────────────────────
    const today = new Date();
    const emp0 = createdEmployees[0];
    const emp1 = createdEmployees[1];

    await prisma.leaveRequest.createMany({
        data: [
            {
                employeeId: emp0.id,
                type: "pto",
                status: "approved",
                startDate: addDays(today, 3),
                endDate: addDays(today, 5),
                hours: 24,
                reason: "Family vacation",
            },
            {
                employeeId: emp1.id,
                type: "sick",
                status: "approved",
                startDate: addDays(today, -1),
                endDate: addDays(today, -1),
                hours: 8,
                reason: "Ill",
            },
        ],
    });
    console.log("  ✓ Demo leave requests seeded");

    // ── Demo PTO Ledger ─────────────────────────────────────────────────────
    await prisma.ptoLedger.createMany({
        data: [
            { employeeId: emp0.id, type: "accrual", hours: 3.08, balance: 43.08, reason: "Pay period accrual", payPeriodEnd: addDays(today, -14) },
            { employeeId: emp0.id, type: "usage", hours: -24, balance: 19.08, reason: "PTO leave", payPeriodEnd: null },
            { employeeId: emp1.id, type: "accrual", hours: 3.08, balance: 28.08, reason: "Pay period accrual", payPeriodEnd: addDays(today, -14) },
        ],
    });

    // ── Demo NBOT Entries ───────────────────────────────────────────────────
    await prisma.nbotEntry.createMany({
        data: createdEmployees.slice(0, 4).map((emp, i) => ({
            employeeId: emp.id,
            date: addDays(today, -i * 3),
            hours: 2 + i,
            periodStart: addDays(today, -14),
            periodEnd: today,
            notes: `Non-benefit overtime block week ${i + 1}`,
        })),
    });

    // ── Demo Overtime Entries ───────────────────────────────────────────────
    await prisma.overtimeEntry.create({
        data: {
            employeeId: createdEmployees[4].id,
            periodStart: addDays(today, -14),
            periodEnd: addDays(today, -1),
            regularHours: 40,
            overtimeHours: 6,
            notes: "Covered two sick calls",
        },
    });

    console.log("  ✓ Demo ledger, NBOT, and overtime entries seeded");
    console.log("\n✅ Seed complete!");
    console.log("   Admin login: admin@willschedulebot.local / Admin1234!");
}

main()
    .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
