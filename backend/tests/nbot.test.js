import { describe, it, expect } from "vitest";

// Pure NBOT calculation helpers (no DB dependency)
function sumNbotHours(entries, employeeId) {
    return entries
        .filter((e) => e.employeeId === employeeId)
        .reduce((sum, e) => sum + e.hours, 0);
}

function groupNbotByEmployee(entries) {
    const groups = {};
    for (const entry of entries) {
        if (!groups[entry.employeeId]) {
            groups[entry.employeeId] = { employeeId: entry.employeeId, totalHours: 0, entries: [] };
        }
        groups[entry.employeeId].totalHours += entry.hours;
        groups[entry.employeeId].entries.push(entry);
    }
    return Object.values(groups);
}

function filterNbotByPeriod(entries, periodStart, periodEnd) {
    return entries.filter(
        (e) => new Date(e.date) >= periodStart && new Date(e.date) <= periodEnd
    );
}

function validateNbotEntry(hours, shiftDurationHrs) {
    if (hours <= 0) return { valid: false, error: "NBOT hours must be positive" };
    if (hours > shiftDurationHrs) return { valid: false, error: "NBOT hours cannot exceed shift duration" };
    return { valid: true };
}

describe("NBOT Logic", () => {
    const entries = [
        { id: "n1", employeeId: "e1", date: "2026-01-05", hours: 2, periodStart: "2026-01-01", periodEnd: "2026-01-15" },
        { id: "n2", employeeId: "e1", date: "2026-01-10", hours: 3, periodStart: "2026-01-01", periodEnd: "2026-01-15" },
        { id: "n3", employeeId: "e2", date: "2026-01-06", hours: 4, periodStart: "2026-01-01", periodEnd: "2026-01-15" },
        { id: "n4", employeeId: "e1", date: "2026-01-20", hours: 1, periodStart: "2026-01-16", periodEnd: "2026-01-31" },
    ];

    it("sums NBOT hours correctly per employee", () => {
        expect(sumNbotHours(entries, "e1")).toBe(6); // 2 + 3 + 1
        expect(sumNbotHours(entries, "e2")).toBe(4);
        expect(sumNbotHours(entries, "e3")).toBe(0);
    });

    it("groups NBOT entries by employee", () => {
        const groups = groupNbotByEmployee(entries);
        expect(groups).toHaveLength(2);
        const e1group = groups.find((g) => g.employeeId === "e1");
        expect(e1group.totalHours).toBe(6);
        expect(e1group.entries).toHaveLength(3);
    });

    it("filters NBOT entries within a pay period", () => {
        const periodStart = new Date("2026-01-01");
        const periodEnd = new Date("2026-01-15");
        const filtered = filterNbotByPeriod(entries, periodStart, periodEnd);
        expect(filtered).toHaveLength(3);
        expect(filtered.every((e) => e.id !== "n4")).toBe(true);
    });

    it("validates partial-shift NBOT hours", () => {
        expect(validateNbotEntry(2, 8)).toEqual({ valid: true });
        expect(validateNbotEntry(8, 8)).toEqual({ valid: true });
        expect(validateNbotEntry(0, 8)).toEqual({ valid: false, error: "NBOT hours must be positive" });
        expect(validateNbotEntry(-1, 8)).toEqual({ valid: false, error: "NBOT hours must be positive" });
        expect(validateNbotEntry(9, 8)).toEqual({ valid: false, error: "NBOT hours cannot exceed shift duration" });
    });

    it("accumulates NBOT across multiple pay periods", () => {
        const period1 = filterNbotByPeriod(entries, new Date("2026-01-01"), new Date("2026-01-15"));
        const period2 = filterNbotByPeriod(entries, new Date("2026-01-16"), new Date("2026-01-31"));
        const e1Period1 = sumNbotHours(period1, "e1");
        const e1Period2 = sumNbotHours(period2, "e1");
        expect(e1Period1).toBe(5); // n1 + n2
        expect(e1Period2).toBe(1); // n4
        expect(e1Period1 + e1Period2).toBe(6); // total
    });
});
