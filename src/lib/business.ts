export type Category = "PRE_WEDDING" | "RENTAL" | "MAKEUP";
export type PaymentStatus = "Unpaid" | "Partially Paid" | "Paid";

export const DEFAULT_SETTINGS = {
  preWeddingBps: 300,
  rentalBps: 600,
  makeupBps: 0,
  monthlyTargetSen: 3_000_000,
  monthlyRewardSen: 30_000,
} as const;

export function moneyToSen(value: string | number): number {
  const normalized =
    typeof value === "number"
      ? value.toString()
      : value.replace(/[RM,\s]/gi, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized))
    throw new Error("Enter a valid amount with up to 2 decimal places");
  const [ringgit, fraction = ""] = normalized.split(".");
  const sen = Number(ringgit) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(sen)) throw new Error("Amount is too large");
  return sen;
}

export function formatMoney(sen: number): string {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    currencyDisplay: "narrowSymbol",
  })
    .format(sen / 100)
    .replace("RM", "RM ");
}

export function rateForCategory(
  category: Category,
  settings: { preWeddingBps: number; rentalBps: number; makeupBps: number },
) {
  return category === "PRE_WEDDING"
    ? settings.preWeddingBps
    : category === "RENTAL"
      ? settings.rentalBps
      : settings.makeupBps;
}

export function calculateCommission(baseSen: number, rateBps: number): number {
  return Math.round((baseSen * rateBps) / 10_000);
}

export function validateAllocations(
  allocations: Array<{ staffId: string; allocationBps: number }>,
) {
  if (
    !allocations.length ||
    allocations.some(
      (a) =>
        !a.staffId ||
        !Number.isInteger(a.allocationBps) ||
        a.allocationBps <= 0,
    )
  )
    return false;
  return (
    new Set(allocations.map((a) => a.staffId)).size === allocations.length &&
    allocations.reduce((sum, a) => sum + a.allocationBps, 0) === 10_000
  );
}

export function splitAmount(
  totalSen: number,
  allocations: Array<{ staffId: string; allocationBps: number }>,
) {
  if (!validateAllocations(allocations))
    throw new Error("Staff allocations must total exactly 100%");
  let assigned = 0;
  return allocations.map((allocation, index) => {
    const amount =
      index === allocations.length - 1
        ? totalSen - assigned
        : Math.round((totalSen * allocation.allocationBps) / 10_000);
    assigned += amount;
    return { ...allocation, amountSen: amount };
  });
}

export function rewardFor(
  totalSen: number,
  targetSen: number,
  rewardSen: number,
) {
  return totalSen >= targetSen ? rewardSen : 0;
}

export function paymentStatus(
  totalPayableSen: number,
  paidSen: number,
): PaymentStatus {
  if (paidSen <= 0) return "Unpaid";
  if (paidSen < totalPayableSen) return "Partially Paid";
  return "Paid";
}

export function orderTotals(
  originalSen: number,
  adjustments: Array<{ type: "ADDITION" | "DEDUCTION"; amountSen: number }>,
  collectedSen: number,
) {
  const currentSen = adjustments.reduce(
    (total, item) =>
      total + (item.type === "ADDITION" ? item.amountSen : -item.amountSen),
    originalSen,
  );
  return {
    currentSen,
    collectedSen,
    outstandingSen: currentSen - collectedSen,
    overCollected: collectedSen > currentSen,
  };
}

export function monthFromMalaysiaDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Invalid business date");
  return date.slice(0, 7);
}

export function malaysiaMonthFromInstant(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(instant);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${year}-${month}`;
}

export function isSuspiciousDuplicate(
  existing: Array<{
    orderId: string;
    collectionDate: string;
    collectedSen: number;
  }>,
  candidate: { orderId: string; collectionDate: string; collectedSen: number },
) {
  return existing.some(
    (item) =>
      item.orderId === candidate.orderId &&
      item.collectionDate === candidate.collectionDate &&
      item.collectedSen === candidate.collectedSen,
  );
}

export function scopedStaffId(
  role: "ADMIN" | "STAFF",
  currentStaffId: string,
  requestedStaffId?: string,
) {
  return role === "STAFF" ? currentStaffId : requestedStaffId;
}

export function canMutateCollection(monthLocked: boolean) {
  return !monthLocked;
}
