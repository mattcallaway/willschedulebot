import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/prisma.js", () => ({
    default: {
        employee: {
            findUniqueOrThrow: vi.fn(),
            update: vi.fn(),
        },
        ptoLedger: { create: vi.fn() },
        sickLedger: { create: vi.fn() },
    },
}));

import prisma from "../src/lib/prisma.js";
import { accruePto, accrueSick, adjustBalance } from "../src/services/leaveService.js";

function mockEmployee(overrides = {}) {
    return {
        id: "emp-1",
        ptoBalance: 40,
        sickBalance: 20,
        ptoAccrualRate: 3.08,
        sickAccrualRate: 1.54,
        ...overrides,
    };
}

describe("Accrual Logic", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prisma.employee.update.mockResolvedValue({});
        prisma.ptoLedger.create.mockResolvedValue({});
        prisma.sickLedger.create.mockResolvedValue({});
    });

    it("accrues correct PTO amount based on hours worked", async () => {
        prisma.employee.findUniqueOrThrow.mockResolvedValue(mockEmployee({ ptoBalance: 40 }));
        const result = await accruePto("emp-1", 80, new Date(), "test");
        // 80 hrs worked / 80 * 3.08 = 3.08 hrs accrued
        expect(result.accrued).toBeCloseTo(3.08, 5);
        expect(result.newBalance).toBeCloseTo(43.08, 5);
    });

    it("accrues proportional PTO for partial period", async () => {
        prisma.employee.findUniqueOrThrow.mockResolvedValue(mockEmployee({ ptoBalance: 0 }));
        const result = await accruePto("emp-1", 40, new Date(), "test");
        // 40/80 * 3.08 = 1.54
        expect(result.accrued).toBeCloseTo(1.54, 5);
    });

    it("accrues correct sick time", async () => {
        prisma.employee.findUniqueOrThrow.mockResolvedValue(mockEmployee({ sickBalance: 20 }));
        const result = await accrueSick("emp-1", 80, new Date(), "test");
        expect(result.accrued).toBeCloseTo(1.54, 5);
        expect(result.newBalance).toBeCloseTo(21.54, 5);
    });

    it("prevents negative PTO balance on adjustment", async () => {
        prisma.employee.findUniqueOrThrow.mockResolvedValue(mockEmployee({ ptoBalance: 5 }));
        await expect(adjustBalance("emp-1", "pto", -10, "test deduction", "admin")).rejects.toThrow(
            "negative PTO balance"
        );
    });

    it("prevents negative sick balance on adjustment", async () => {
        prisma.employee.findUniqueOrThrow.mockResolvedValue(mockEmployee({ sickBalance: 3 }));
        await expect(adjustBalance("emp-1", "sick", -5, "too much", "admin")).rejects.toThrow(
            "negative sick balance"
        );
    });

    it("allows positive adjustment (adding hours)", async () => {
        prisma.employee.findUniqueOrThrow.mockResolvedValue(mockEmployee({ ptoBalance: 10 }));
        const result = await adjustBalance("emp-1", "pto", 8, "manual credit", "admin");
        expect(result.newBalance).toBeCloseTo(18, 5);
        expect(prisma.ptoLedger.create).toHaveBeenCalled();
    });

    it("throws on unknown leave type", async () => {
        prisma.employee.findUniqueOrThrow.mockResolvedValue(mockEmployee());
        await expect(adjustBalance("emp-1", "vacation", 8, "reason", "admin")).rejects.toThrow(
            "Unknown leave type"
        );
    });
});
