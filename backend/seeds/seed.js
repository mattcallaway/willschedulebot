/**
 * seed.js — WillScheduleBot initial seed
 *
 * What this does:
 *  1. Creates admin user
 *  2. Creates all 17 roster employees (upsert by NUID)
 *  3. Parses each employee's shiftText and creates real Shift records +
 *     ShiftAssignment records for the CURRENT WEEK automatically
 *  4. Seeds default app settings
 *
 * WHERE THE SEED DATA LIVES
 * Edit the EMPLOYEES array below to update the roster.
 * Re-run `npm run seed` to apply changes (safe to re-run — uses upserts).
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { startOfWeek, addDays, format, differenceInMinutes } from "date-fns";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function d(str) {
    if (!str) return null;
    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? null : parsed;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIFT TEXT PARSER
//
// Parses free-text shift descriptions like:
//   "0600-1400 TUE-SAT"
//   "2200-0600 MON-FRI"
//   "2230-0630 THUR/FRI & 2200-0600 SAT/SUN"
//   "0800-1600 M-F"
//   "1000-2000 WED-SAT (ACT 1600-0200 WED-SAT)"
//   "1430-2230 FRI/SAT &1400 SUN/MON"
//   "0630-1430 FRI/SAT &0600-1400 SUN/MON"
//
// Returns: [{ dayOfWeek: 0-6, startTime: "HH:MM", endTime: "HH:MM", durationHrs }]
//   dayOfWeek: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MAP = {
    sun: 0, sunday: 0,
    mon: 1, monday: 1, m: 1,
    tue: 2, tues: 2, tuesday: 2, tu: 2,
    wed: 3, wednesday: 3, w: 3,
    thu: 4, thur: 4, thurs: 4, thursday: 4, th: 4,
    fri: 5, friday: 5, f: 5,
    sat: 6, saturday: 6, s: 6,
};

/** Convert "HHMM" or "HH:MM" → "HH:MM" */
function normalizeTime(t) {
    const s = t.replace(":", "").padStart(4, "0");
    return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
}

/** "HH:MM" → decimal hours */
function timeToHrs(t) {
    const [h, m] = t.split(":").map(Number);
    return h + m / 60;
}

/** Duration of a shift crossing midnight correctly */
function shiftDuration(start, end) {
    const s = timeToHrs(start);
    let e = timeToHrs(end);
    if (e <= s) e += 24; // overnight
    return Math.round((e - s) * 10) / 10;
}

/** Parse a single day name or abbreviation → dayOfWeek number */
function parseDay(token) {
    const key = token.toLowerCase().replace(/[^a-z]/g, "");
    return DAY_MAP[key] ?? null;
}

/**
 * Parse a day expression into an array of dayOfWeek numbers.
 * Handles:
 *   "SUN-WED"   → [0,1,2,3]
 *   "THUR/FRI"  → [4,5]
 *   "M-F"       → [1,2,3,4,5]
 *   "SUN/MON"   → [0,1]
 *   "TUE-SAT"   → [2,3,4,5,6]
 *   "SAT-WED"   → [6,0,1,2,3]  (wraps around)
 */
function parseDayRange(expr) {
    expr = expr.trim();
    const days = [];

    if (expr.includes("-")) {
        const [startStr, endStr] = expr.split("-");
        const start = parseDay(startStr.trim());
        const end = parseDay(endStr.trim());
        if (start === null || end === null) return days;

        if (end >= start) {
            for (let i = start; i <= end; i++) days.push(i);
        } else {
            // wraps: e.g. SAT(6)-WED(3) → 6,0,1,2,3
            for (let i = start; i <= 6; i++) days.push(i);
            for (let i = 0; i <= end; i++) days.push(i);
        }
    } else if (expr.includes("/")) {
        expr.split("/").forEach((p) => {
            const d = parseDay(p.trim());
            if (d !== null) days.push(d);
        });
    } else {
        const d = parseDay(expr);
        if (d !== null) days.push(d);
    }

    return [...new Set(days)];
}

/**
 * Parse a "TIME-TIME DAYEXPR" block like "0600-1400 TUE-SAT"
 * Returns array of shift blocks.
 */
function parseBlock(block) {
    block = block.trim();

    // Strip parenthetical notes like "(ACT 1600-0200 WED-SAT)"
    block = block.replace(/\(.*?\)/g, "").trim();

    // Match pattern: 4-digit range, optional colon, then day expression
    // e.g. "0600-1400 TUE-SAT" or "2230-0630 THUR/FRI"
    const m = block.match(/^(\d{3,4})-(\d{3,4})\s+(.+)$/);
    if (!m) return [];

    const startTime = normalizeTime(m[1]);
    const endTime = normalizeTime(m[2]);
    const dayExpr = m[3].trim();

    // Also handle trailing time without days on the second half (rare edge: "1400 SUN/MON")
    // Check if dayExpr looks like just a time
    if (/^\d{3,4}$/.test(dayExpr)) return []; // skip time-only remnants

    const days = parseDayRange(dayExpr);
    const dur = shiftDuration(startTime, endTime);

    return days.map((dayOfWeek) => ({ dayOfWeek, startTime, endTime, durationHrs: dur }));
}

/**
 * Top-level shift text parser.
 * Handles compound patterns separated by " & " or just "&".
 */
function parseShiftText(shiftText) {
    if (!shiftText) return [];

    const results = [];

    // Split on " & " or "&" (normalize spacing first)
    const chunks = shiftText.replace(/\s*&\s*/g, " & ").split(" & ");

    for (const chunk of chunks) {
        const trimmed = chunk.trim();
        if (!trimmed) continue;

        // Handle "TIME DAYEXPR" where DAYEXPR may embed another time implicitly
        // e.g. "1430-2230 FRI/SAT" — standard block
        // e.g. "1400 SUN/MON" — time-only with day list (means start=previous end, or treat as same time)
        // We skip pure time-only fragments
        const m = trimmed.match(/^(\d{3,4})-(\d{3,4})\s+(.+)$/);
        if (m) {
            results.push(...parseBlock(trimmed));
        } else {
            // Edge case: "1400 SUN/MON" with no end time — skip or try to figure out
            // Just skip since we can't determine end time
            console.warn(`  ⚠ Cannot parse shift chunk: "${trimmed}" — skipping`);
        }
    }

    return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE ROSTER (from official spreadsheet, 2nd version)
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
        badgeNumber: "3656",
        bwcIssued: "X60C06938",
        cedIssued: "X4001P4TX",
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
        qualificationFlags: JSON.stringify(["firearm", "apo", "lead"]),
    },
    {
        name: "Seutter, Jonathan (APO)",
        nuid: null,
        rank: "APO",
        shiftText: "1430-2230 FRI/SAT",
        status: "Active",
        qualificationFlags: JSON.stringify(["apo"]),
    },
    {
        name: "Douangnouanexay, Johnny (HPO)",
        nuid: "T338546",
        rank: "HPO",
        phone: "559-601-9980",
        email: "johnnydouang85@gmail.com",
        kpEmail: "JOHNNY X DOUANGNOUANEXAY <JOHNNY.X.DOUANGNOUANEXAY@kp.org>",
        shiftText: "2000-0600 SUN-WED",
        status: "Active",
        hireDate: d("2024-05-19"),
        bciNumber: "57238",
        badgeNumber: "5981",
        bwcIssued: "X60C06229",
        cedIssued: "X4001P509",
        qualificationFlags: JSON.stringify(["hpo"]),
    },
    {
        name: "Escobar, Eber (HPO)",
        nuid: "O412900",
        rank: "HPO",
        phone: "415-583-1470",
        email: "eberescobar38@gmail.com",
        kpEmail: "EBER ESCOBAR <EBER.X.ESCOBAR@kp.org>",
        shiftText: "1000-2000 SUN-WED",
        status: "Active",
        hireDate: d("2024-05-19"),
        bciNumber: "57321",
        licenseGuardCardNumber: "G6591197",
        licenseExpiryPrimary: d("2025-12-31"),
        firearmInfo: "45/40/9mm",
        farmCardNumber: "FQ2684952",
        licenseExpirySecondary: d("2026-09-30"),
        badgeNumber: "6458",
        bwcIssued: "X60C08558",
        cedIssued: "X4001P4X9",
        qualificationFlags: JSON.stringify(["hpo", "firearm"]),
    },
    {
        name: "Ferreira, Nicholas (HPO)",
        nuid: "P126089",
        rank: "HPO",
        phone: "707-389-1414",
        email: "nicholascortez27@gmail.com",
        kpEmail: "NICHOLAS CORTEZ <NICHOLAS.X.CORTEZ@kp.org>",
        shiftText: "1000-2000 WED-SAT",
        status: "Active",
        hireDate: d("2024-05-19"),
        bciNumber: "57320",
        badgeNumber: "3655",
        bwcIssued: "X60C0037A",
        cedIssued: "X4001P4Y3",
        qualificationFlags: JSON.stringify(["hpo"]),
    },
    {
        name: "Harper, Khalid (APO)",
        nuid: "G936793",
        rank: "APO",
        phone: "510-228-5413",
        email: "Khalidharper@gmail.com",
        kpEmail: "Khalid Harper <Khalid.X.Harper@kp.org>",
        shiftText: "2230-0630 SAT-WED",
        status: "Active",
        hireDate: d("2024-11-01"),
        bciNumber: "55345",
        licenseGuardCardNumber: "G6524887",
        licenseExpiryPrimary: d("2026-11-30"),
        firearmInfo: "Glock 22 .40",
        firearmSerialNumber: "BNGC328",
        farmCardNumber: "FQ2659244",
        licenseExpirySecondary: d("2027-06-30"),
        badgeNumber: "1344",
        bwcIssued: "X60C04137",
        cedIssued: "X4001MK75",
        qualificationFlags: JSON.stringify(["firearm", "apo"]),
    },
    {
        name: "Harris, William (PSS)",
        nuid: "G612587",
        rank: "PSS",
        phone: "707-531-9593",
        email: "william.r.harris@kp.org",
        kpEmail: "William.R.Harris@kp.org",
        shiftText: "0800-1600 M-F",
        status: "Active",
        hireDate: d("2019-04-12"),
        bciNumber: "48346",
        badgeNumber: "1666",
        bwcIssued: "X60C06359",
        cedIssued: "X4001P4TA",
        qualificationFlags: JSON.stringify(["pss"]),
    },
    {
        name: "Konz, Peter (APO)",
        nuid: "Y060069",
        rank: "APO",
        phone: "510-410-5767",
        email: "pjkonz@gmail.com",
        kpEmail: "Peter Konz <Peter.X.Konz@kp.org>",
        shiftText: "0600-1400 TUE-SAT",
        status: "Active",
        hireDate: d("2024-08-02"),
        bciNumber: "53978",
        licenseGuardCardNumber: "G1672194",
        licenseExpiryPrimary: d("2027-08-31"),
        firearmInfo: "H&K USP .40",
        firearmSerialNumber: "22-115094",
        farmCardNumber: "FQ2683127",
        licenseExpirySecondary: d("2026-06-30"),
        badgeNumber: "1854",
        bwcIssued: "X60C02868",
        cedIssued: "X4001MK77",
        qualificationFlags: JSON.stringify(["firearm", "apo"]),
    },
    {
        name: "Marler, Cody (HPO)",
        nuid: "K336579",
        rank: "HPO",
        phone: "760-453-9513",
        email: "lmx1000@yahoo.com",
        kpEmail: "CODY MARLER <CODY.X.MARLER@kp.org>",
        shiftText: "1600-0200 SUN-WED",
        status: "Active",
        hireDate: d("2024-05-19"),
        bciNumber: "57319",
        licenseGuardCardNumber: "G6703787",
        licenseExpiryPrimary: d("2026-07-31"),
        firearmInfo: "40/9mm",
        farmCardNumber: "FQ2687036",
        licenseExpirySecondary: d("2026-12-31"),
        badgeNumber: "6098",
        bwcIssued: "X60C0066A",
        cedIssued: "X4001P4XR",
        qualificationFlags: JSON.stringify(["hpo", "firearm"]),
    },
    {
        name: "Pulido, Jose (HPO)",
        nuid: "S976494",
        rank: "HPO",
        phone: "415-936-9183",
        email: "jose.medina25@gmail.com",
        kpEmail: "Jose Medina Pulido <Jose.X.MedinaPulido@kp.org>",
        shiftText: "0600-1600 WED-SAT",
        status: "Active",
        hireDate: d("2024-05-19"),
        bciNumber: "57322",
        badgeNumber: "6464",
        bwcIssued: "X60C06669",
        cedIssued: "X4001P4VY",
        qualificationFlags: JSON.stringify(["hpo"]),
    },
    {
        name: "Simpson, Andrew (APO)",
        nuid: "P844019",
        rank: "APO",
        phone: "516-606-9221",
        email: "andrew.d.simpson.7@gmail.com",
        kpEmail: "Andrew Simpson <Andrew.X.Simpson@kp.org>",
        shiftText: "1430-2230 SUN-THUR",
        status: "Active",
        hireDate: d("2024-04-18"),
        bciNumber: "52753",
        licenseGuardCardNumber: "G6415430",
        licenseExpiryPrimary: d("2027-01-31"),
        firearmInfo: "Glock 23 .40",
        firearmSerialNumber: "BFWX141",
        farmCardNumber: "FQ2645058",
        licenseExpirySecondary: d("2027-03-31"),
        badgeNumber: "1861",
        bwcIssued: "X60C02468",
        cedIssued: "X4001MK1K",
        qualificationFlags: JSON.stringify(["firearm", "apo"]),
    },
    {
        name: "Siverand, David (APO)",
        nuid: "L226104",
        rank: "APO",
        phone: "510-541-0373",
        email: "david_siverand@yahoo.com",
        kpEmail: "David Siverand <David.X.Siverand@kp.org>",
        shiftText: "2200-0600 MON-FRI",
        status: "Active",
        hireDate: d("2024-04-17"),
        bciNumber: "52755",
        licenseGuardCardNumber: "G1204731",
        licenseExpiryPrimary: d("2027-08-31"),
        firearmInfo: "Glock 22 .40",
        firearmSerialNumber: "BBR313US",
        farmCardNumber: "FQ2680324",
        licenseExpirySecondary: d("2026-02-28"),
        bwcIssued: "X60C00578",
        cedIssued: "X4001MK5X",
        qualificationFlags: JSON.stringify(["firearm", "apo"]),
    },
    {
        name: "Vazquez, Ruben (APO)",
        nuid: "Y957131",
        rank: "APO",
        phone: "925-550-0012",
        email: "rubenp26@att.net",
        kpEmail: "Reben Vasquez Jr. <Reben.X.VasquezJr@kp.org>",
        shiftText: "0630-1430 FRI/SAT & 0600-1400 SUN/MON",
        status: "Active",
        hireDate: d("2025-07-23"),
        bciNumber: "60220",
        licenseGuardCardNumber: "G6659180",
        licenseExpiryPrimary: d("2026-12-31"),
        firearmInfo: "H&K P2000 9mm",
        firearmSerialNumber: "116-059573",
        farmCardNumber: "FQ2687536",
        licenseExpirySecondary: d("2027-01-31"),
        badgeNumber: "6117",
        qualificationFlags: JSON.stringify(["firearm", "apo"]),
    },
    {
        name: "Vinson, Ronald (APO)",
        nuid: "G281512",
        rank: "APO",
        phone: "510-365-5864",
        email: "ronaldvinson510@gmail.com",
        kpEmail: "Ronald L Vinson <Ronald.L.Vinson@kp.org>",
        shiftText: "0630-1430 SUN-THU",
        status: "Active",
        hireDate: d("2024-11-01"),
        bciNumber: "55105",
        licenseGuardCardNumber: "G6644884",
        licenseExpiryPrimary: d("2026-09-30"),
        firearmInfo: "Vanta 9 9mm",
        firearmSerialNumber: "V9-0349",
        farmCardNumber: "FQ2670963",
        licenseExpirySecondary: d("2026-12-31"),
        badgeNumber: "339",
        bwcIssued: "X60C00438",
        cedIssued: "X4001MK73",
        qualificationFlags: JSON.stringify(["firearm", "apo"]),
    },
    {
        name: "Whaley, Corey (HPO)",
        nuid: "G099014",
        rank: "HPO",
        phone: "510-570-6848",
        email: "coreywhaley4579@gmail.com",
        kpEmail: "COREY WHALEY <COREY.X.WHALEY@kp.org>",
        shiftText: "2000-0600 WED-SAT",
        status: "Active",
        hireDate: d("2024-05-19"),
        bciNumber: "57541",
        badgeNumber: "1268",
        bwcIssued: "X60C04907",
        cedIssued: "X400194T8",
        qualificationFlags: JSON.stringify(["hpo"]),
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT APP SETTINGS
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = [
    { key: "ot_threshold_40hr", value: "40", label: "Weekly OT threshold — 40hr employees", group: "overtime" },
    { key: "ot_threshold_32hr", value: "32", label: "Weekly OT threshold — 32hr employees", group: "overtime" },
    { key: "ot_warning_enabled", value: "true", label: "Warn when reassignment creates OT", group: "overtime" },
    { key: "pto_accrual_rate", value: "3.08", label: "PTO accrual rate (hrs per 80 hrs worked)", group: "accrual" },
    { key: "sick_accrual_rate", value: "1.54", label: "Sick accrual rate (hrs per 80 hrs worked)", group: "accrual" },
    { key: "nbot_pay_period_days", value: "14", label: "Pay period length for NBOT (days)", group: "nbot" },
    { key: "nbot_max_per_period", value: "16", label: "Max NBOT hours allowed per pay period", group: "nbot" },
    { key: "org_name", value: "Kaiser Permanente – Security Operations", label: "Organization name", group: "general" },
    { key: "schedule_week_start", value: "0", label: "Week starts on (0=Sun, 1=Mon)", group: "general" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Compute seniority ranks (earlier hire date = more senior = lower number)
// ─────────────────────────────────────────────────────────────────────────────
function computeSeniorityRanks(employees) {
    return [...employees]
        .sort((a, b) => {
            if (!a.hireDate && !b.hireDate) return 0;
            if (!a.hireDate) return 1;
            if (!b.hireDate) return -1;
            return a.hireDate - b.hireDate;
        })
        .map((emp, i) => ({ key: emp.nuid ?? emp.name, rank: i + 1 }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Build shift records for the current week from parsed shiftText
// ─────────────────────────────────────────────────────────────────────────────
function buildWeeklyShifts(shiftText, weekSundayDate) {
    const blocks = parseShiftText(shiftText);
    const result = [];

    for (const block of blocks) {
        // dayOfWeek 0=Sun → add that many days to the Sunday anchor
        const shiftDate = addDays(weekSundayDate, block.dayOfWeek);
        result.push({
            date: shiftDate,
            startTime: block.startTime,
            endTime: block.endTime,
            durationHrs: block.durationHrs,
            label: `${block.startTime}–${block.endTime}`,
        });
    }

    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SEED
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
    console.log("🌱  Starting database seed…\n");

    const weekSunday = startOfWeek(new Date(), { weekStartsOn: 0 });
    console.log(`📅  Seeding shifts for week of ${format(weekSunday, "yyyy-MM-dd")} (Sun)\n`);

    // ── 1. Admin user ──────────────────────────────────────────────────────────
    const adminEmail = "admin@willschedulebot.local";
    const hashedPw = await bcrypt.hash("Admin1234!", 12);
    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {},
        create: { email: adminEmail, name: "Admin", password: hashedPw, role: "admin" },
    });
    console.log(`✅  Admin: ${adminEmail}`);

    // ── 2. App settings ────────────────────────────────────────────────────────
    for (const s of DEFAULT_SETTINGS) {
        await prisma.appSetting.upsert({
            where: { key: s.key },
            update: {},
            create: s,
        });
    }
    console.log(`✅  Settings seeded (${DEFAULT_SETTINGS.length})`);

    // ── 3. Seniority ranks ─────────────────────────────────────────────────────
    const ranks = computeSeniorityRanks(EMPLOYEES);
    const rankMap = Object.fromEntries(ranks.map((r) => [r.key, r.rank]));

    // ── 4. Upsert employees + auto-create shifts ───────────────────────────────
    let empCreated = 0, empUpdated = 0;
    let shiftCreated = 0, assignCreated = 0;

    for (const emp of EMPLOYEES) {
        const seniorityRank = rankMap[emp.nuid ?? emp.name] ?? null;
        const data = {
            ...emp,
            hireDate: emp.hireDate ?? null,
            seniorityKey: emp.hireDate ?? null,
            seniorityRank,
            overtimeThreshold: emp.contractedWeeklyHours ?? 40,
            contractedWeeklyHours: emp.contractedWeeklyHours ?? 40,
            ptoAccrualRate: 3.08,
            ptoBalance: 0,
            sickBalance: 0,
            activeFlag: true,
            nbotEligible: true,
        };

        let empRecord;
        if (emp.nuid) {
            const existing = await prisma.employee.findUnique({ where: { nuid: emp.nuid } });
            if (existing) {
                empRecord = await prisma.employee.update({ where: { nuid: emp.nuid }, data });
                empUpdated++;
            } else {
                empRecord = await prisma.employee.create({ data });
                empCreated++;
            }
        } else {
            const existing = await prisma.employee.findFirst({ where: { name: emp.name } });
            if (existing) {
                empRecord = await prisma.employee.update({ where: { id: existing.id }, data });
                empUpdated++;
            } else {
                empRecord = await prisma.employee.create({ data });
                empCreated++;
            }
        }

        // ── Auto-create shifts for this week based on shiftText ─────────────────
        if (emp.shiftText) {
            const weekShifts = buildWeeklyShifts(emp.shiftText, weekSunday);

            if (weekShifts.length === 0) {
                console.warn(`  ⚠ ${emp.name}: could not parse shift "${emp.shiftText}"`);
            }

            for (const s of weekShifts) {
                // Find-or-create the Shift record (keyed by date + startTime + endTime)
                let shift = await prisma.shift.findFirst({
                    where: { date: s.date, startTime: s.startTime, endTime: s.endTime },
                });

                if (!shift) {
                    shift = await prisma.shift.create({
                        data: {
                            date: s.date,
                            startTime: s.startTime,
                            endTime: s.endTime,
                            durationHrs: s.durationHrs,
                            label: s.label,
                            isOpen: false, // assigned immediately below
                        },
                    });
                    shiftCreated++;
                }

                // Create assignment (skip if already assigned this person to this shift)
                const existing = await prisma.shiftAssignment.findFirst({
                    where: { shiftId: shift.id, employeeId: empRecord.id },
                });

                if (!existing) {
                    await prisma.shiftAssignment.create({
                        data: {
                            shiftId: shift.id,
                            employeeId: empRecord.id,
                            type: "regular",
                            regularHours: s.durationHrs,
                            isNbot: false,
                        },
                    });
                    assignCreated++;
                }
            }
        }
    }

    console.log(`\n✅  Employees: ${empCreated} created, ${empUpdated} updated`);
    console.log(`✅  Shifts created this week: ${shiftCreated}`);
    console.log(`✅  Shift assignments created: ${assignCreated}`);
    console.log(`\n📋  Roster:`);
    EMPLOYEES.forEach((e, i) => {
        const blocks = parseShiftText(e.shiftText || "");
        const dayNums = [...new Set(blocks.map((b) => b.dayOfWeek))];
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const days = dayNums.map((d) => dayNames[d]).join(", ");
        console.log(`    ${String(i + 1).padStart(2)}. ${e.name.padEnd(35)} ${(e.shiftText || "(no shift)").padEnd(42)} → ${days || "⚠ unparsed"}`);
    });

    console.log(`\n🎉  Seed complete!`);
    console.log(`    Login: admin@willschedulebot.local / Admin1234!`);
    console.log(`    ${EMPLOYEES.length} employees, ${shiftCreated} shifts, ${assignCreated} assignments`);
}

main()
    .catch((e) => { console.error("❌  Seed failed:", e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
