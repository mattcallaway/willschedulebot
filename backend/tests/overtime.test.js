import { describe, it, expect } from "vitest";

// Pure overtime calculation helpers (no DB dependency)
function calculateOvertimeHours(totalHours, threshold) {
    if (totalHours <= threshold) return 0;
    return totalHours - threshold;
}

function wouldCreateOvertime(currentHours, additionalHours, threshold) {
    return currentHours + additionalHours > threshold;
}

function overtimeSummary(entries) {
    return entries.reduce(
        (acc, e) => {
            acc.regular += e.regularHours;
            acc.overtime += e.overtimeHours;
            return acc;
        },
        { regular: 0, overtime: 0 }
    );
}

describe("Overtime Logic", () => {
    it("calculates zero overtime when hours are at or below threshold", () => {
        expect(calculateOvertimeHours(40, 40)).toBe(0);
        expect(calculateOvertimeHours(32, 32)).toBe(0);
        expect(calculateOvertimeHours(30, 40)).toBe(0);
    });

    it("calculates correct overtime hours when above threshold", () => {
        expect(calculateOvertimeHours(46, 40)).toBe(6);
        expect(calculateOvertimeHours(35, 32)).toBe(3);
        expect(calculateOvertimeHours(41, 40)).toBeCloseTo(1);
    });

    it("detects when adding a shift would create overtime", () => {
        expect(wouldCreateOvertime(36, 8, 40)).toBe(true);   // 44 > 40
        expect(wouldCreateOvertime(32, 8, 40)).toBe(false);  // 40 = 40
        expect(wouldCreateOvertime(28, 4, 32)).toBe(false);  // 32 = 32
        expect(wouldCreateOvertime(28, 5, 32)).toBe(true);   // 33 > 32
    });

    it("aggregates overtime from multiple entries correctly", () => {
        const entries = [
            { regularHours: 40, overtimeHours: 0 },
            { regularHours: 40, overtimeHours: 4 },
            { regularHours: 40, overtimeHours: 8 },
        ];
        const summary = overtimeSummary(entries);
        expect(summary.regular).toBe(120);
        expect(summary.overtime).toBe(12);
    });

    it("handles empty entries", () => {
        const summary = overtimeSummary([]);
        expect(summary.regular).toBe(0);
        expect(summary.overtime).toBe(0);
    });

    it("32hr threshold is more restrictive than 40hr threshold", () => {
        const hours = 33;
        expect(calculateOvertimeHours(hours, 32)).toBe(1);
        expect(calculateOvertimeHours(hours, 40)).toBe(0);
    });
});
