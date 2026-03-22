/**
 * seed.js — Populates the database with:
 *   1. An admin user account
 *   2. The REAL employee roster (18 employees from the official spreadsheet)
 *   3. Default app settings (OT thresholds, accrual rates, NBOT rules)
 *   4. Sample shift data for the current week
 *
 * Run: npm run seed   (from the backend/ directory)
 *
 * WHERE THE SEED DATA LIVES
 * The employee records below come directly from the official roster
 * spreadsheet. To edit or replace them, update the EMPLOYEES array.
 * After changing it, re-run `npm run seed` (idempotent via upsert).
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, format, startOfWeek } from "date-fns";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Helper: parse a date string and return a Date or null
// ─────────────────────────────────────────────────────────────────────────────
function d(str) {
    if (!str) return null;
    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? null : parsed;
}

// "N/A" firearm_serial_number values from the spreadsheet should be null
function nullIfNA(val) {
    if (!val) return null;
    if (typeof val === "string" && val.trim().toUpperCase() === "N/A") return null;
    return val;
}

// ─────────────────────────────────────────────────────────────────────────────
// OFFICIAL EMPLOYEE ROSTER
// Source: Uploaded spreadsheet (imported verbatim — edit here to update)
// APO employees: contracted 40hr, firearm qualified
// HPO employees: contracted 40hr by default (adjust per individual if needed)
// ─────────────────────────────────────────────────────────────────────────────
const EMPLOYEES = [
    {
        name: "Alvarez, Andres (APO)",
        nuid: "E417129",
        rank: "APO",
        phone: "510-253-9474",
        email: "andresalvarez1455@gmail.com",
        kpEmail: "Andres Alvarez <Andres.X.Alvarez@kp.org>",
        shiftText: "2230-0630 THUR/FRI & 2200-0600 SAT/SUN",
        status: "Active",
        hireDate: d("2025-02-11"),
        bciNumber: "56557",
        licenseGuardCardNumber: "G6519858",
        licenseExpiryPrimary: d("2026-10-31"),
        firearmInfo: "Glock 19 9mm/Glock22 .40",
        firearmSerialNumber: "CDHC663/BWBN285",
        farmCardNumber: "FQ2686175",
        licenseExpirySecondary: d("2026-10-31"),
        badgeNumber: "3954",
        bwcIssued: "X60C02428",
        cedIssued: "X4001MK7M",
        notes: null,
        contractedWeeklyHours: 40,
        qualificationFlags: JSON.stringify(["firearm", "apo"]),
    },
    {
        name: "Banks, Kofi",
        nuid: "K569127",
        rank: "HPO",
        phone: "415-685-7007",
        email: "realkofibanks@icloud.com",
        kpEmail: "Kofi Banks <Kofi.X.Banks@kp.org>",
        shiftText: "0600-1600 SUN-WED",
        status: "Active",
        hireDate: d("2024-07-05"),
        bciNumber: "52955",
        licenseGuardCardNumber: null,
        licenseExpiryPrimary: null,
        firearmInfo: null,
        firearmSerialNumber: null,
        farmCardNumber: null,
        licenseExpirySecondary: null,
        badgeNumber: "3656",
        bwcIssued: "X60C06938",
        cedIssued: "X4001P4TX",
        notes: null,
        contractedWeeklyHours: 40,
        qualificationFlags: JSON.stringify(["hpo"]),
    },
    {
        name: "Blackwood, Semaj (APO LEAD)",
        nuid: "L510331",
        rank: "APO",
        phone: "510-593-4937",
        email: "semajkb@yahoo.com",
        kpEmail: "Semaj Blackwood <Semaj.X.Blackwood@kp.org>",
        shiftText: "1400-2200 TUE-SAT",
        status: "Active",
        hireDate: d("2024-04-16"),
        bciNumber: "52728",
        licenseGuardCardNumber: "G182516",
        licenseExpiryPrimary: d("2027-11-30"),
        firearmInfo: "Glock 19 9mm",
        firearmSerialNumber: "CDHC054",
        farmCardNumber: "FQ369994",
        licenseExpirySecondary: d("2027-11-30"),
        badgeNumber: "4031",
        bwcIssued: "X60C02123A",
        cedIssued: "X4001MK5T",
        notes: null,
        contractedWeeklyHours: 40,
        qualificationFlags: JSON.stringify(["firearm", "apo", "lead"]),
    },
    {
        name: "Seutter, Jonathan (APO)",
        nuid: null, // No NUID in spreadsheet — stable internal ID will be generated
        rank: "APO",
        phone: null,
        email: null,
        kpEmail: null,
        shiftText: "1430-2230 FRI/SAT &1400 SUN/MON",
        status: "Active",
        hireDate: null,
        bciNumber: null,
        licenseGuardCardNumber: null,
        licenseExpiryPrimary: null,
        firearmInfo: null,
        firearmSerialNumber: null,
        farmCardNumber: null,
        licenseExpirySecondary: null,
        badgeNumber: null,
        bwcIssued: null,
        cedIssued: null,
        notes: null,
        contractedWeeklyHours: 40,
        qualificationFlags: JSON.stringify(["apo"]),
    },
    {
        name: "Cabrera, Francisco",
        nuid: "K208419",
        rank: "HPO",
        phone: "415-412-8679",
        email: "pancho_415@yahoo.com",
        kpEmail: "Francisco Cabrera <Francisco.F.Cabrera@kp.org>",
        shiftText: "0600-1400 SUN-WED",
        status: "Active",
        hireDate: d("2024-07-15"),
        bciNumber: "52953",
        licenseGuardCardNumber: null,
        licenseExpiryPrimary: null,
        firearmInfo: null,
        firearmSerialNumber: null,
        farmCardNumber: null,
        licenseExpirySecondary: null,
        badgeNumber: "3663",
        bwcIssued: "X60C06939",
        cedIssued: "X4001P4TV",
        notes: null,
        contractedWeeklyHours: 40,
        qualificationFlags: JSON.stringify(["hpo"]),
    },
    {
        name: "Cutler, William",
        nuid: "L557704",
        rank: "HPO",
        phone: "510-545-5716",
        email: "billcutler589@gmail.com",
        kpEmail: "William Cutler <William.X.Cutler@kp.org>",
        shiftText: "2200-0630 SUN-WED",
        status: "Active",
        hireDate: d("2024-07-10"),
        bciNumber: "52961",
        licenseGuardCardNumber: null,
        licenseExpiryPrimary: null,
        firearmInfo: null,
        firearmSerialNumber: null,
        farmCardNumber: null,
        licenseExpirySecondary: null,
        badgeNumber: "3660",
        bwcIssued: "X60C06937",
        cedIssued: "X4001P4TT",
        notes: null,
        contractedWeeklyHours: 40,
        qualificationFlags: JSON.stringify(["hpo"]),
    },
    {
        name: "Deleon, Rafael",
        nuid: "K504867",
        rank: "HPO",
        phone: "510-417-0136",
        email: "rdeleon1986@yahoo.com",
        kpEmail: "Rafael Deleon <Rafael.X.Deleon@kp.org>",
        shiftText: "1400-2200 SUN-WED",
        status: "Active",
        hireDate: d("2024-07-15"),
        bciNumber: "52963",
        licenseGuardCardNumber: null,
        licenseExpiryPrimary: null,
        firearmInfo: null,
        firearmSerialNumber: null,
        farmCardNumber: null,
        licenseExpirySecondary: null,
        badgeNumber: "3662",
        bwcIssued: "X60C06940",
        cedIssued: "X4001P4TW",
        notes: null,
        contractedWeeklyHours: 40,
        qualificationFlags: JSON.stringify(["hpo"]),
    },
    {
        name: "Elivar, Darius",
        nuid: "L339591",
        rank: "HPO",
        phone: "707-548-5100",
        email: "dariuselivar@gmail.com",
        kpEmail: "Darius Elivar <Darius.X.Elivar@kp.org>",
        shiftText: "1400-2200 WED-SAT",
        status: "Active",
        hireDate: d("2024-07-12"),
        bciNumber: "52952",
        licenseGuardCardNumber: null,
        licenseExpiryPrimary: null,
        firearmInfo: null,
        firearmSerialNumber: null,
        farmCardNumber: null,
        licenseExpirySecondary: null,
        badgeNumber: "3659",
        bwcIssued: "X60C06942",
        cedIssued: "X4001P4TR",
        notes: null,
        contractedWeeklyHours: 40,
        qualificationFlags: JSON.stringify(["hpo"]),
    },
    {
        name: "Garcia, Alejandro",
        nuid: "K130104",
        rank: "HPO",
        phone: "510-387-5716",
        email: "alejandrogarcia422@gmail.com",
        kpEmail: "Alejandro Garcia <Alejandro.Garcia2@kp.org>",
        shiftText: "2200-0600 WED-SAT",
        status: "Active",
        hireDate: d("2024-07-11"),
        bciNumber: "52958",
        licenseGuardCardNumber: null,
        licenseExpiryPrimary: null,
        firearmInfo: null,
        firearmSerialNumber: null,
        farmCardNumber: null,
        licenseExpirySecondary: null,
        badgeNumber: "3658",
        bwcIssued: "X60C06941",
        cedIssued: "X4001P4TQ",
        notes: null,
        contractedWeeklyHours: 40,
        qualificationFlags: JSON.stringify(["hpo"]),
    },
    {
        name: "Grayson, Jackson",
        nuid: "K547620",
        rank: "APO",
        phone: "707-477-2237",
        email: "jgrayson12@yahoo.com",
        kpEmail: "Jackson Grayson <Jackson.X.Grayson@kp.org>",
        shiftText: "2200-0600 TUE-SAT",
        status: "Active",
        hireDate: d("2024-04-16"),
        bciNumber: "52749",
        licenseGuardCardNumber: "G4950782",
        licenseExpiryPrimary: d("2027-11-30"),
        firearmInfo: "Glock 22 .40/Glock 17 9mm",
        firearmSerialNumber: "BWBN370/BSCW856",
        farmCardNumber: "FQ241245",
        licenseExpirySecondary: d("2027-11-30"),
        badgeNumber: "4029",
        bwcIssued: "X60C02131A",
        cedIssued: "X4001MK5W",
        notes: null,
        contractedWeeklyHours: 40,
        qualificationFlags: JSON.stringify(["firearm", "apo"]),
    },
    {
        name: "Hicks, Travis (APO LEAD)",
        nuid: "L599385",
        rank: "APO",
        phone: "925-336-4516",
        email: "travishicks925@gmail.com",
        kpEmail: "Travis Hicks <Travis.X.Hicks@kp.org>",
        shiftText: "0600-1400 TUE-SAT",
        status: "Active",
        hireDate: d("2024-04-23"),
        bciNumber: "52755",
        licenseGuardCardNumber: "G1262626",
        licenseExpiryPrimary: d("2027-11-30"),
        firearmInfo: "Glock 22 .40/Glock 17 9mm",
        firearmSerialNumber: "BWBN359/BSCW881",
        farmCardNumber: "FQ099531",
        licenseExpirySecondary: d("2027-11-30"),
        badgeNumber: "4030",
        bwcIssued: "X60C02127A",
        cedIssued: "X4001MK5X",
        notes: null,
        contractedWeeklyHours: 40,
        qualificationFlags: JSON.stringify(["firearm", "apo", "lead"]),
    },
    {
        name: "Hooks, Aaron",
        nuid: "L552496",
        rank: "HPO",
        phone: "510-381-7728",
        email: "ahooks_1985@yahoo.com",
        kpEmail: "Aaron Hooks <Aaron.X.Hooks@kp.org>",
        shiftText: "0600-1600 WED-SAT",
        status: "Active",
        hireDate: d("2024-07-12"),
        bciNumber: "52954",
        licenseGuardCardNumber: null,
        licenseExpiryPrimary: null,
        firearmInfo: null,
        firearmSerialNumber: null,
        farmCardNumber: null,
        licenseExpirySecondary: null,
        badgeNumber: "3657",
        bwcIssued: "X60C06943",
        cedIssued: "X4001P4TS",
        notes: null,
        contractedWeeklyHours: 40,
        qualificationFlags: JSON.stringify(["hpo"]),
    },
    {
        name: "Lewis, Jack",
        nuid: "K482053",
        rank: "HPO",
        phone: "707-318-1925",
        email: "jackvlewis@gmail.com",
        kpEmail: "Jack Lewis <Jack.X.Lewis@kp.org>",
        shiftText: "1400-2200 THURS-SUN",
        status: "Active",
        hireDate: d("2024-07-12"),
        bciNumber: "52959",
        licenseGuardCardNumber: null,
        licenseExpiryPrimary: null,
        firearmInfo: null,
        firearmSerialNumber: null,
        farmCardNumber: null,
        licenseExpirySecondary: null,
        badgeNumber: "3661",
        bwcIssued: "X60C06944",
        cedIssued: "X4001P4TU",
        notes: null,
        contractedWeeklyHours: 40,
        qualificationFlags: JSON.stringify(["hpo"]),
    },
    {
        name: "Mclaren, Erick",
        nuid: "L550365",
        rank: "HPO",
        phone: "707-291-9059",
        email: "mclaren.erick@yahoo.com",
        kpEmail: "Erick Mclaren <Erick.X.Mclaren@kp.org>",
        shiftText: "2200-0600 THURS-SUN",
        status: "Active",
        hireDate: d("2024-07-12"),
        bciNumber: "52960",
        licenseGuardCardNumber: null,
        licenseExpiryPrimary: null,
        firearmInfo: null,
        firearmSerialNumber: null,
        farmCardNumber: null,
        licenseExpirySecondary: null,
        badgeNumber: "3664",
        bwcIssued: "X60C06945",
        cedIssued: "X4001P4TV",
        notes: null,
        contractedWeeklyHours: 40,
        qualificationFlags: JSON.stringify(["hpo"]),
    },
    {
        name: "Miller, Antonio",
        nuid: "K512746",
        rank: "HPO",
        phone: "707-775-6992",
        email: "tonio1341@gmail.com",
        kpEmail: "Antonio Miller <Antonio.X.Miller@kp.org>",
        shiftText: "2200-0600 SUN-WED",
        status: "Active",
        hireDate: d("2024-07-11"),
        bciNumber: "52956",
        licenseGuardCardNumber: null,
        licenseExpiryPrimary: null,
        firearmInfo: null,
        firearmSerialNumber: null,
        farmCardNumber: null,
        licenseExpirySecondary: null,
        badgeNumber: "3655",
        bwcIssued: "X60C06946",
        cedIssued: "X4001P4TX",
        notes: null,
        contractedWeeklyHours: 40,
        qualificationFlags: JSON.stringify(["hpo"]),
    },
    {
        name: "Osorio, Jimmy",
        nuid: "K571136",
        rank: "APO",
        phone: "707-291-9059",
        email: "jimmyeosorio@yahoo.com",
        kpEmail: "Jimmy Osorio <Jimmy.X.Osorio@kp.org>",
        shiftText: "1400-2200 SUN-THURS",
        status: "Active",
        hireDate: d("2024-04-24"),
        bciNumber: "52766",
        licenseGuardCardNumber: "G6460546",
        licenseExpiryPrimary: d("2027-11-30"),
        firearmInfo: "Glock 22 .40/Glock 17 9mm",
        firearmSerialNumber: "BWBN462/BSCW480",
        farmCardNumber: "FQ296466",
        licenseExpirySecondary: d("2027-11-30"),
        badgeNumber: "4032",
        bwcIssued: "X60C02126A",
        cedIssued: "X4001MK5V",
        notes: null,
        contractedWeeklyHours: 40,
        qualificationFlags: JSON.stringify(["firearm", "apo"]),
    },
    {
        name: "Phipps, Reed (APO)",
        nuid: "K287329",
        rank: "APO",
        phone: "707-799-9159",
        email: "reed_phipps@yahoo.com",
        kpEmail: "Reed Phipps <Reed.X.Phipps@kp.org>",
        shiftText: "0600-1400 SUN-THURS",
        status: "Active",
        hireDate: d("2024-04-17"),
        bciNumber: "52731",
        licenseGuardCardNumber: "G2051326",
        licenseExpiryPrimary: d("2027-11-30"),
        firearmInfo: "Glock 22 .40/Glock 17 9mm",
        firearmSerialNumber: "BWBN240/BSCW296",
        farmCardNumber: "FQ205319",
        licenseExpirySecondary: d("2027-11-30"),
        badgeNumber: "4028",
        bwcIssued: "X60C02128A",
        cedIssued: "X4001MK5Y",
        notes: null,
        contractedWeeklyHours: 40,
        qualificationFlags: JSON.stringify(["firearm", "apo"]),
    },
    {
        name: "Rivera, Natanel",
        nuid: "K581133",
        rank: "APO",
        phone: "707-477-2237",
        email: "jackvlewis@gmail.com", // as-is from spreadsheet
        kpEmail: "Natanel Rivera <Natanel.X.Rivera@kp.org>",
        shiftText: "1400-2200 THURS-SUN",
        status: "Active",
        hireDate: d("2024-04-16"),
        bciNumber: "52719",
        licenseGuardCardNumber: "G6021238",
        licenseExpiryPrimary: d("2027-11-30"),
        firearmInfo: "Glock 22 .40/Glock 17 9mm",
        firearmSerialNumber: "BWBN572/BSCW643",
        farmCardNumber: "FQ483127",
        licenseExpirySecondary: d("2027-11-30"),
        badgeNumber: "4027",
        bwcIssued: "X60C02130A",
        cedIssued: "X4001MK5Z",
        notes: null,
        contractedWeeklyHours: 40,
        qualificationFlags: JSON.stringify(["firearm", "apo"]),
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT APP SETTINGS
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = [
    // Overtime
    { key: "ot_threshold_40hr", value: "40", label: "Weekly OT threshold — 40hr employees", group: "overtime" },
    { key: "ot_threshold_32hr", value: "32", label: "Weekly OT threshold — 32hr employees", group: "overtime" },
    { key: "ot_warning_enabled", value: "true", label: "Warn when reassignment creates OT", group: "overtime" },
    // Accrual
    { key: "pto_accrual_rate", value: "3.08", label: "PTO accrual rate (hrs per 80 hrs worked)", group: "accrual" },
    { key: "sick_accrual_rate", value: "1.54", label: "Sick accrual rate (hrs per 80 hrs worked)", group: "accrual" },
    // NBOT
    { key: "nbot_pay_period_days", value: "14", label: "Pay period length for NBOT accumulation (days)", group: "nbot" },
    { key: "nbot_max_per_period", value: "16", label: "Max NBOT hours allowed per pay period", group: "nbot" },
    // General
    { key: "org_name", value: "Kaiser Permanente – Security Operations", label: "Organization name", group: "general" },
    { key: "schedule_week_start", value: "0", label: "Week starts on (0=Sun, 1=Mon)", group: "general" },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPUTE SENIORITY RANKS
// Lower rank number = more seniority (earlier hire date)
// Employees with no hire date get the lowest priority (highest number)
// ─────────────────────────────────────────────────────────────────────────────
function computeSeniorityRanks(employees) {
    const sorted = [...employees].sort((a, b) => {
        if (!a.hireDate && !b.hireDate) return 0;
        if (!a.hireDate) return 1;
        if (!b.hireDate) return -1;
        return a.hireDate - b.hireDate;
    });
    return sorted.map((emp, i) => ({ nuid: emp.nuid, name: emp.name, seniorityRank: i + 1 }));
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SEED FUNCTION
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
    console.log("🌱  Starting database seed…");

    // 1. Admin user
    const adminEmail = "admin@willschedulebot.local";
    const adminPassword = "Admin1234!";
    const hashedPw = await bcrypt.hash(adminPassword, 12);
    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {},
        create: { email: adminEmail, name: "Admin", password: hashedPw, role: "admin" },
    });
    console.log(`✅  Admin user: ${adminEmail}`);

    // 2. App settings
    for (const setting of DEFAULT_SETTINGS) {
        await prisma.appSetting.upsert({
            where: { key: setting.key },
            update: {},
            create: { key: setting.key, value: setting.value, label: setting.label, group: setting.group },
        });
    }
    console.log(`✅  App settings seeded (${DEFAULT_SETTINGS.length})`);

    // 3. Seniority ranks
    const seniorityMap = computeSeniorityRanks(EMPLOYEES);
    const seniorityByNuid = Object.fromEntries(seniorityMap.map((s) => [s.nuid ?? s.name, s.seniorityRank]));

    // 4. Employees — upsert by NUID when present, else by name
    let created = 0;
    let updated = 0;
    const seededEmployees = [];

    for (const emp of EMPLOYEES) {
        const seniorityRank = seniorityByNuid[emp.nuid ?? emp.name] ?? null;
        const overtimeThreshold = emp.contractedWeeklyHours; // mirrors contracted hours

        const data = {
            ...emp,
            seniorityRank,
            seniorityKey: emp.hireDate,         // keep in sync for ORDER BY
            overtimeThreshold,
            activeFlag: true,
            ptoBalance: 0,
            sickBalance: 0,
            ptoAccrualRate: 3.08,
            nbotEligible: true,
        };

        let record;

        if (emp.nuid) {
            // Prefer NUID as unique key
            const existing = await prisma.employee.findUnique({ where: { nuid: emp.nuid } });
            if (existing) {
                record = await prisma.employee.update({ where: { nuid: emp.nuid }, data });
                updated++;
            } else {
                record = await prisma.employee.create({ data });
                created++;
            }
        } else {
            // No NUID — fall back to name-based upsert
            const existing = await prisma.employee.findFirst({ where: { name: emp.name } });
            if (existing) {
                record = await prisma.employee.update({ where: { id: existing.id }, data });
                updated++;
            } else {
                record = await prisma.employee.create({ data });
                created++;
            }
        }

        seededEmployees.push(record);
    }

    console.log(`✅  Employees seeded: ${created} created, ${updated} updated`);
    console.log(`    Roster: ${seededEmployees.map((e) => e.name).join(", ")}`);

    // 5. Demo shifts for the current week (Sun–Sat)
    const today = new Date();
    const sun = startOfWeek(today, { weekStartsOn: 0 });

    // Create common shifts for this week — one day, one swing, one night
    const SHIFTS = [
        { label: "Day Shift", startTime: "0600", endTime: "1400", durationHrs: 8 },
        { label: "Swing Shift", startTime: "1400", endTime: "2200", durationHrs: 8 },
        { label: "Night Shift", startTime: "2200", endTime: "0600", durationHrs: 8 },
    ];

    let shiftsCreated = 0;
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const shiftDate = addDays(sun, dayOffset);
        // Only create shifts if they don't already exist for this date
        for (const shift of SHIFTS) {
            const existing = await prisma.shift.findFirst({
                where: {
                    date: shiftDate,
                    startTime: shift.startTime,
                    label: shift.label,
                },
            });
            if (!existing) {
                await prisma.shift.create({
                    data: {
                        date: shiftDate,
                        startTime: shift.startTime,
                        endTime: shift.endTime,
                        durationHrs: shift.durationHrs,
                        label: shift.label,
                        isOpen: true,
                    },
                });
                shiftsCreated++;
            }
        }
    }
    console.log(`✅  Shifts for current week: ${shiftsCreated} created`);

    console.log("\n🎉  Seed complete!");
    console.log(`    Admin login: ${adminEmail} / ${adminPassword}`);
    console.log(`    ${seededEmployees.length} real employees ready in the directory`);
}

main()
    .catch((e) => {
        console.error("❌  Seed failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
