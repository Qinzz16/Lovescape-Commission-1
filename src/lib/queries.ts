import "server-only";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { collectionAllocations, collections, commissionPayments, commissionSettings, monthlyLocks, staff } from "@/db/schema";
import { DEFAULT_SETTINGS, paymentStatus, rewardFor } from "@/lib/business";

function nextMonthStart(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) throw new Error(`Invalid month: ${month}`);
  return new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
}

export async function getSettings() {
  return (await getDb().select().from(commissionSettings).where(eq(commissionSettings.id, 1)).limit(1))[0] ?? { id: 1, ...DEFAULT_SETTINGS };
}
export async function isMonthLocked(month: string) {
  const [row] = await getDb().select().from(monthlyLocks).where(eq(monthlyLocks.month, month)).limit(1);
  return Boolean(row?.locked);
}
export async function listStaff(includeInactive = true) {
  const rows = await getDb().select().from(staff).orderBy(asc(staff.name));
  return includeInactive ? rows : rows.filter((item) => item.active);
}

export type CollectionFilters = { month?: string; staffId?: string; category?: string; source?: string; search?: string };
export async function listCollections(filters: CollectionFilters = {}, allowedStaffId?: string) {
  const conditions = [];
  if (filters.month) {
    conditions.push(gte(collections.collectionDate, `${filters.month}-01`));
    conditions.push(lt(collections.collectionDate, nextMonthStart(filters.month)));
  }
  const targetStaff = allowedStaffId ?? filters.staffId;
  if (targetStaff) conditions.push(eq(collectionAllocations.staffId, targetStaff));
  if (filters.category && ["PRE_WEDDING", "RENTAL", "MAKEUP"].includes(filters.category)) conditions.push(eq(collections.category, filters.category as "PRE_WEDDING" | "RENTAL" | "MAKEUP"));
  if (filters.source && ["BOOKIT", "MANUAL_ADJUSTMENT"].includes(filters.source)) conditions.push(eq(collections.source, filters.source as "BOOKIT" | "MANUAL_ADJUSTMENT"));
  return getDb().select({ collection: collections, staffId: staff.id, staffName: staff.name, staffActive: staff.active, allocationBps: collectionAllocations.allocationBps, allocatedCollectedSen: collectionAllocations.allocatedCollectedSen, commissionRateBps: collectionAllocations.commissionRateBps, commissionAmountSen: collectionAllocations.commissionAmountSen }).from(collections)
    .innerJoin(collectionAllocations, eq(collectionAllocations.collectionId, collections.id))
    .innerJoin(staff, eq(collectionAllocations.staffId, staff.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(collections.collectionDate), desc(collections.createdAt));
}

export async function monthlySummaries(month: string, allowedStaffId?: string) {
  const [settings, people, rows, payments] = await Promise.all([getSettings(), listStaff(true), listCollections({ month }, allowedStaffId), getDb().select().from(commissionPayments).where(eq(commissionPayments.commissionMonth, month))]);
  const selectedPeople = allowedStaffId ? people.filter((p) => p.id === allowedStaffId) : people;
  return selectedPeople.map((person) => {
    const mine = rows.filter((r) => r.staffId === person.id);
    const category = (name: "PRE_WEDDING" | "RENTAL" | "MAKEUP") => mine.filter((r) => r.collection.category === name).reduce((s, r) => s + r.allocatedCollectedSen, 0);
    const totalCollectedSen = mine.reduce((s, r) => s + r.allocatedCollectedSen, 0);
    const commissionSen = mine.reduce((s, r) => s + r.commissionAmountSen, 0);
    const rewardSen = rewardFor(totalCollectedSen, settings.monthlyTargetSen, settings.monthlyRewardSen);
    const totalPayableSen = commissionSen + rewardSen;
    const paidSen = payments.filter((p) => p.staffId === person.id).reduce((s, p) => s + p.paidSen, 0);
    return { staff: person, month, totalCollectedSen, preWeddingSen: category("PRE_WEDDING"), rentalSen: category("RENTAL"), makeupSen: category("MAKEUP"), commissionSen, rewardSen, totalPayableSen, paidSen, outstandingSen: Math.max(0, totalPayableSen - paidSen), status: paymentStatus(totalPayableSen, paidSen), targetSen: settings.monthlyTargetSen, remainingSen: Math.max(0, settings.monthlyTargetSen - totalCollectedSen), progress: settings.monthlyTargetSen ? Math.min(100, (totalCollectedSen / settings.monthlyTargetSen) * 100) : 100 };
  });
}

export async function getCollectionForEdit(id: string) {
  const rows = await listCollections({});
  const mine = rows.filter((row) => row.collection.id === id);
  if (!mine.length) return null;
  return { ...mine[0], allocations: mine.map((row) => ({ staffId: row.staffId, staffName: row.staffName, allocationBps: row.allocationBps, commissionRateBps: row.commissionRateBps })) };
}
export async function paymentHistory(staffId?: string, month?: string) {
  const conditions = [];
  if (staffId) conditions.push(eq(commissionPayments.staffId, staffId));
  if (month) conditions.push(eq(commissionPayments.commissionMonth, month));
  return getDb().select({ payment: commissionPayments, staffName: staff.name, createdByName: staff.name }).from(commissionPayments).innerJoin(staff, eq(commissionPayments.staffStaffId, staff.id)).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(commissionPayments.paymentDate));
}
