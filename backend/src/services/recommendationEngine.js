import prisma from "../lib/prisma.js";
import { startOfWeek, endOfWeek, eachDayOfInterval, format } from "date-fns";

/**
 * Coverage Recommendation Engine
 *
 * Business rules (in priority order):
 * 1. Must be active and not on leave/outage/blackout on the given date
 * 2. Prefer 32-hour contracted employees over 40-hour contracted employees
 * 3. Within same contracted-hours tier: sort by seniority (hire date, earliest = most senior)
 * 4. Employee must be qualified (active)
 * 5. Avoid creating overtime unless explicitly flagged
 *
 * Returns ranked array of candidates with explanation strings.
 */
export async function recommendCoverage({ date, shiftId, startTime, endTime, durationHrs }) {
    const weekStart = startOfWeek(date, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 0 });

    // ── Step 1: Get all active employees ─────────────────────────────────────
    const allEmployees = await prisma.employee.findMany({
        where: { activeFlag: true },
        include: {
            leaveRequests: {
                where: {
                    status: "approved",
                    startDate: { lte: date },
                    endDate: { gte: date },
                },
            },
            blackoutDates: {
                where: {
                    startDate: { lte: date },
                    endDate: { gte: date },
                },
            },
            shiftAssignments: {
                where: {
                    shift: {
                        date: { gte: weekStart, lte: weekEnd },
                    },
                },
                include: { shift: true },
            },
        },
    });

    const results = [];

    for (const emp of allEmployees) {
        const reasons = [];
        const disqualifiers = [];

        // ── Eligibility checks ────────────────────────────────────────────────
        const onLeave = emp.leaveRequests.length > 0;
        const onBlackout = emp.blackoutDates.length > 0;

        if (onLeave) disqualifiers.push(`On approved leave (${emp.leaveRequests[0].type})`);
        if (onBlackout) disqualifiers.push("Date is a blackout/unavailable day");

        // Already assigned to another shift that overlaps?
        const hasConflict = emp.shiftAssignments.some((sa) => {
            if (format(sa.shift.date, "yyyy-MM-dd") !== format(date, "yyyy-MM-dd")) return false;
            if (!startTime || !endTime) return false;
            // Simple overlap: new shift [s,e) overlaps existing [sa.shift.startTime, sa.shift.endTime)
            return timeOverlap(startTime, endTime, sa.shift.startTime, sa.shift.endTime);
        });
        if (hasConflict) disqualifiers.push("Already assigned to another shift on this date");

        // Skip same shiftId if already assigned
        if (shiftId && emp.shiftAssignments.some((sa) => sa.shiftId === shiftId)) {
            disqualifiers.push("Already assigned to this shift");
        }

        if (disqualifiers.length > 0) {
            results.push({ employee: emp, eligible: false, score: -1, reasons: disqualifiers });
            continue;
        }

        // ── Scoring ───────────────────────────────────────────────────────────
        let score = 100;

        // Rule 1: 32hr employees preferred over 40hr
        if (emp.contractedWeeklyHours <= 32) {
            score += 20;
            reasons.push("32-hr contracted — highest priority for coverage");
        } else {
            reasons.push("40-hr contracted");
        }

        // Rule 2: Seniority (earlier hire = more senior = higher score)
        if (emp.seniorityKey) {
            const seniorityBoost = Math.max(0, 20 - Math.floor((new Date() - emp.seniorityKey) / (365.25 * 86400000)));
            // Actually invert: more senior = higher score
            const yearsService = (new Date() - emp.seniorityKey) / (365.25 * 86400000);
            const seniorScore = Math.min(15, yearsService); // up to 15 pts for 15+ years
            score += seniorScore;
            reasons.push(`Seniority: ${yearsService.toFixed(1)} yrs (hire date ${format(emp.seniorityKey, "yyyy-MM-dd")})`);
        }

        // Rule 3: Overtime risk
        const weeklyHours = emp.shiftAssignments.reduce((sum, sa) => sum + sa.shift.durationHrs, 0);
        const projectedHours = weeklyHours + (durationHrs || 8);
        if (projectedHours > emp.overtimeThreshold) {
            score -= 15;
            reasons.push(`⚠️ Will create overtime: ${projectedHours.toFixed(1)} hrs (threshold ${emp.overtimeThreshold})`);
        } else {
            reasons.push(`Hours ok: ${weeklyHours.toFixed(1)} + ${durationHrs || 8} = ${projectedHours.toFixed(1)} (threshold ${emp.overtimeThreshold})`);
        }

        results.push({
            employee: {
                id: emp.id,
                name: emp.name,
                rank: emp.rank,
                contractedWeeklyHours: emp.contractedWeeklyHours,
                hireDate: emp.hireDate,
                seniorityKey: emp.seniorityKey,
                weeklyScheduledHours: weeklyHours,
            },
            eligible: true,
            score,
            willCreateOvertime: projectedHours > emp.overtimeThreshold,
            projectedWeeklyHours: projectedHours,
            reasons,
        });
    }

    // Sort eligible candidates by score DESC, then by contracted hours ASC (32 before 40), then seniority
    const eligible = results
        .filter((r) => r.eligible)
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.employee.contractedWeeklyHours !== b.employee.contractedWeeklyHours)
                return a.employee.contractedWeeklyHours - b.employee.contractedWeeklyHours;
            // Earlier hire = more senior = preferred
            const ad = a.employee.seniorityKey ? new Date(a.employee.seniorityKey) : new Date();
            const bd = b.employee.seniorityKey ? new Date(b.employee.seniorityKey) : new Date();
            return ad - bd;
        });

    const ineligible = results.filter((r) => !r.eligible);

    return { eligible, ineligible };
}

function timeOverlap(s1, e1, s2, e2) {
    const toMins = (t) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
    };
    const [s1m, e1m, s2m, e2m] = [toMins(s1), toMins(e1), toMins(s2), toMins(e2)];
    return s1m < e2m && e1m > s2m;
}
