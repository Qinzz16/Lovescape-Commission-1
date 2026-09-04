import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  calculateCommission,
  canMutateCollection,
  isSuspiciousDuplicate,
  malaysiaMonthFromInstant,
  moneyToSen,
  orderTotals,
  paymentStatus,
  rateForCategory,
  rewardFor,
  scopedStaffId,
  splitAmount,
  validateAllocations,
} from "./business";

describe("Lovescape commission rules", () => {
  it("uses 3% for pre-wedding", () =>
    expect(rateForCategory("PRE_WEDDING", DEFAULT_SETTINGS)).toBe(300));
  it("uses 6% for rental", () =>
    expect(rateForCategory("RENTAL", DEFAULT_SETTINGS)).toBe(600));
  it("uses 0% for makeup", () =>
    expect(rateForCategory("MAKEUP", DEFAULT_SETTINGS)).toBe(0));
  it("calculates partial collections independently", () => {
    expect(calculateCommission(300000, 300)).toBe(9000);
    expect(calculateCommission(300000, 300)).toBe(9000);
  });
  it("separates collection months", () => {
    expect(malaysiaMonthFromInstant(new Date("2026-09-30T16:01:00Z"))).toBe(
      "2026-10",
    );
    expect(malaysiaMonthFromInstant(new Date("2026-09-30T15:59:00Z"))).toBe(
      "2026-09",
    );
  });
  it("awards reward at RM30,000", () =>
    expect(rewardFor(3000000, 3000000, 30000)).toBe(30000));
  it("does not award at RM29,999.99", () =>
    expect(rewardFor(2999999, 3000000, 30000)).toBe(0));
  it("splits allocations without losing sen", () =>
    expect(
      splitAmount(400001, [
        { staffId: "a", allocationBps: 5000 },
        { staffId: "b", allocationBps: 5000 },
      ]).map((x) => x.amountSen),
    ).toEqual([200001, 200000]));
  it("requires allocations to total 100%", () =>
    expect(validateAllocations([{ staffId: "a", allocationBps: 9999 }])).toBe(
      false,
    ));
  it("rejects duplicate staff allocations", () =>
    expect(
      validateAllocations([
        { staffId: "a", allocationBps: 5000 },
        { staffId: "a", allocationBps: 5000 },
      ]),
    ).toBe(false));
  it("preserves saved historical rate when settings change", () => {
    const saved = calculateCommission(200000, 600);
    expect(calculateCommission(200000, 600)).toBe(saved);
    expect(calculateCommission(200000, 700)).not.toBe(saved);
  });
  it("order adjustments preserve collected values", () =>
    expect(
      orderTotals(
        300000,
        [
          { type: "ADDITION", amountSen: 50000 },
          { type: "DEDUCTION", amountSen: 30000 },
        ],
        200000,
      ),
    ).toMatchObject({ currentSen: 320000, collectedSen: 200000 }));
  it("locked months prevent edits", () =>
    expect(canMutateCollection(true)).toBe(false));
  it("locked months prevent deletion", () =>
    expect(canMutateCollection(true)).toBe(false));
  it("forces staff scope to session identity", () =>
    expect(scopedStaffId("STAFF", "staff-a", "staff-b")).toBe("staff-a"));
  it("allows admins to select staff", () =>
    expect(scopedStaffId("ADMIN", "admin", "staff-b")).toBe("staff-b"));
  it("marks partial payment", () =>
    expect(paymentStatus(10000, 5000)).toBe("Partially Paid"));
  it("marks full payment", () =>
    expect(paymentStatus(10000, 10000)).toBe("Paid"));
  it("marks no payment unpaid", () =>
    expect(paymentStatus(10000, 0)).toBe("Unpaid"));
  it("warns when total is below collected", () =>
    expect(
      orderTotals(10000, [{ type: "DEDUCTION", amountSen: 1000 }], 9500)
        .overCollected,
    ).toBe(true));
  it("keeps inactive staff in historical calculations", () =>
    expect({
      active: false,
      commissionSen: calculateCommission(100000, 300),
    }).toEqual({ active: false, commissionSen: 3000 }));
  it("handles MYR decimals exactly", () =>
    expect(moneyToSen("29,999.99")).toBe(2999999));
  it("detects suspicious duplicate entries", () =>
    expect(
      isSuspiciousDuplicate(
        [{ orderId: "o", collectionDate: "2026-09-01", collectedSen: 10000 }],
        { orderId: "o", collectionDate: "2026-09-01", collectedSen: 10000 },
      ),
    ).toBe(true));
});
