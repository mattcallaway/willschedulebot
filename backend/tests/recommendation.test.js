import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Prisma ─────────────────────────────────────────────────────────────
vi.mock("../src/lib/prisma.js", () => ({
    default: {
        employee: {
            findMany: vi.fn(),
            findUniqueOrThrow: vi.fn(),
        },
    },
}));

import prisma from "../src/lib/prisma.js";
import { recommendCoverage } from "../src/services/recommendationEngine.js";

// Helper: create a mock employee
function makeEmployee(overrides = {}) {
    const hireDate = new Date(overrides.hireDate || "2020-01-01");
    return {
        id: overrides.id || "emp-1",
        name: overrides.name || "Test Employee",
        rank: overrides.rank || "Officer",
        active: true,
        contractedWeeklyHours: overrides.contractedWeeklyHours ?? 40,
        overtimeThreshold: overrides.overtimeThreshold ?? (overrides.contractedWeeklyHours ?? 40),
        hireDate,
        seniorityKey: hireDate,
        leaveRequests: overrides.leaveRequests || [],
        blackoutDates: overrides.blackoutDates || [],
        shiftAssignments: overrides.shiftAssignments || [],
        ...overrides,
    };
}

describe("Recommendation Engine", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns only eligible employees", async () => {
        const emp1 = makeEmployee({ id: "e1", name: "On Leave" });
        emp1.leaveRequests = [{ id: "l1", type: "pto", status: "approved", startDate: new Date("2099-01-01"), endDate: new Date("2099-12-31") }];

        const emp2 = makeEmployee({ id: "e2", name: "Available" });

        prisma.employee.findMany.mockResolvedValue([emp1, emp2]);

        const result = await recommendCoverage({
            date: new Date("2099-06-15"),
            durationHrs: 8,
        });

        const eligibleIds = result.eligible.map((r) => r.employee.id);
        expect(eligibleIds).not.toContain("e1");
        expect(eligibleIds).toContain("e2");
        expect(result.ineligible.some((r) => r.employee.id === "e1")).toBe(true);
    });

    it("prefers 32hr employees over 40hr employees", async () => {
        const emp32 = makeEmployee({
            id: "e32",
            name: "Thirty-Two",
            contractedWeeklyHours: 32,
            overtimeThreshold: 32,
            hireDate: "2020-01-01",
        });
        const emp40 = makeEmployee({
            id: "e40",
            name: "Forty",
            contractedWeeklyHours: 40,
            overtimeThreshold: 40,
            hireDate: "2015-01-01", // More senior but 40hr
        });

        prisma.employee.findMany.mockResolvedValue([emp40, emp32]);

        const result = await recommendCoverage({
            date: new Date("2099-06-15"),
            durationHrs: 8,
        });

        const eligibleIds = result.eligible.map((r) => r.employee.id);
        expect(eligibleIds[0]).toBe("e32");
        expect(eligibleIds[1]).toBe("e40");
    });

    it("within same contracted-hours tier, sorts by seniority (earlier hire first)", async () => {
        const senior = makeEmployee({ id: "senior", name: "Senior", contractedWeeklyHours: 40, hireDate: "2010-01-01" });
        const junior = makeEmployee({ id: "junior", name: "Junior", contractedWeeklyHours: 40, hireDate: "2022-01-01" });

        prisma.employee.findMany.mockResolvedValue([junior, senior]);

        const result = await recommendCoverage({ date: new Date("2099-06-15"), durationHrs: 8 });
        const ids = result.eligible.map((r) => r.employee.id);
        expect(ids[0]).toBe("senior");
        expect(ids[1]).toBe("junior");
    });

    it("flags overtime risk when projected hours exceed threshold", async () => {
        const emp = makeEmployee({
            id: "ot-risk",
            contractedWeeklyHours: 40,
            overtimeThreshold: 40,
            shiftAssignments: [
                { shiftId: "s1", shift: { durationHrs: 36, date: new Date("2099-06-10"), startTime: "07:00", endTime: "15:00" } },
            ],
        });

        prisma.employee.findMany.mockResolvedValue([emp]);

        const result = await recommendCoverage({
            date: new Date("2099-06-15"),
            durationHrs: 8,
        });

        const candidate = result.eligible.find((r) => r.employee.id === "ot-risk");
        expect(candidate).toBeDefined();
        expect(candidate.willCreateOvertime).toBe(true);
        expect(candidate.score).toBeLessThan(100);
    });

    it("excludes employee already on blackout dates", async () => {
        const emp = makeEmployee({
            id: "blackout",
            blackoutDates: [{ startDate: new Date("2099-01-01"), endDate: new Date("2099-12-31") }],
        });

        prisma.employee.findMany.mockResolvedValue([emp]);

        const result = await recommendCoverage({ date: new Date("2099-06-15"), durationHrs: 8 });
        expect(result.eligible).toHaveLength(0);
        expect(result.ineligible[0].reasons).toContain("Date is a blackout/unavailable day");
    });

    it("returns empty eligible list when no employees exist", async () => {
        prisma.employee.findMany.mockResolvedValue([]);
        const result = await recommendCoverage({ date: new Date("2099-06-15"), durationHrs: 8 });
        expect(result.eligible).toHaveLength(0);
        expect(result.ineligible).toHaveLength(0);
    });
});
