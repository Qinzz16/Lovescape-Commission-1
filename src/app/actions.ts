"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { collectionAllocations, collections, commissionPayments, commissionPortions, commissionSettings, monthlyLocks, paymentScheduleAllocations, paymentSchedules, staff } from "@/db/schema";
import { authenticate, requireAdmin, signOut } from "@/lib/auth";
import { calculateCommission, isSuspiciousDuplicate, moneyToSen, monthFromMalaysiaDate, rateForCategory, splitAmount, validateAllocations } from "@/lib/business";
import { getSettings, isMonthLocked, listCollections, monthlySummaries } from "@/lib/queries";

const s = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const go = (path: string, type: "success" | "error", message: string): never => redirect(`${path}?${type}=${encodeURIComponent(message)}`);

export async function loginAction(form: FormData) {
  const account = await authenticate(s(form, "email"), s(form, "password"));
  if (!account) return go("/login", "error", "Invalid email or password, or this account is inactive");
  if (account.role === "ADMIN") redirect("/collections");
  redirect("/my-commission");
}
export async function logoutAction() { await signOut(); redirect("/login"); }

export async function createStaffAction(form: FormData) {
  await requireAdmin(); const name=s(form,"name"), email=s(form,"email").toLowerCase(), password=s(form,"password");
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length<8) go("/staff","error","Name, valid email and password of at least 8 characters are required");
  await getDb().insert(staff).values({name,email,passwordHash:await hash(password,12),role:s(form,"role")==="ADMIN"?"ADMIN":"STAFF"}); revalidatePath("/staff"); go("/staff","success","Staff account created");
}
export async function updateStaffAction(form: FormData) {
  await requireAdmin(); const id=s(form,"id"), password=s(form,"password"); const values: Partial<typeof staff.$inferInsert>={name:s(form,"name"),email:s(form,"email").toLowerCase(),role:s(form,"role")==="ADMIN"?"ADMIN":"STAFF",active:form.get("active")==="on",loginEnabled:form.get("loginEnabled")==="on",updatedAt:new Date()};
  if(password){if(password.length<8) go("/staff","error","New password must be at least 8 characters"); values.passwordHash=await hash(password,12);} await getDb().update(staff).set(values).where(eq(staff.id,id)); revalidatePath("/staff"); go("/staff","success","Staff updated");
}
export async function deleteStaffAction(form: FormData) {
  const admin = await requireAdmin();
  const id = s(form, "id");
  if (s(form, "confirm") !== "DELETE") go("/staff", "error", "Type DELETE to confirm permanent staff removal");
  if (id === admin.id) go("/staff", "error", "You cannot remove your own admin account");
  const [person] = await getDb().select().from(staff).where(eq(staff.id, id)).limit(1);
  if (!person) go("/staff", "error", "Staff account not found");
  if (person.active) go("/staff", "error", "Only inactive staff can be removed permanently");
  try {
    await getDb().delete(staff).where(eq(staff.id, id));
  } catch {
    go("/staff", "error", "This staff cannot be removed because historical commission, collection, payment, or audit records are linked to the account. Keep the staff inactive instead.");
  }
  revalidatePath("/staff");
  go("/staff", "success", "Inactive staff removed permanently");
}

function parseAllocations(form: FormData) { const staffIds=form.getAll("staffId").map(String), percentages=form.getAll("allocationPercent").map(String); return staffIds.map((staffId,index)=>({staffId,allocationBps:Math.round(Number(percentages[index])*100)})); }

function createCommissionPortionRows(
  collectionId: string,
  allocations: Array<{ staffId: string; commissionAmountSen: number }>,
  bookingDate: string | null | undefined,
  collectionDate: string,
  weddingPickupDate: string | null | undefined,
  settings: { bookingPortionBps: number; weddingPortionBps: number },
) {
  const bookingMonth = monthFromMalaysiaDate(bookingDate || collectionDate);
  const weddingMonth = monthFromMalaysiaDate(weddingPickupDate || collectionDate);
  return allocations.flatMap((allocation) => {
    const bookingAmount = Math.round((allocation.commissionAmountSen * settings.bookingPortionBps) / 10_000);
    const weddingAmount = allocation.commissionAmountSen - bookingAmount;
    return [
      { collectionId, staffId: allocation.staffId, portion: 1, releaseMonth: bookingMonth, amountSen: bookingAmount },
      { collectionId, staffId: allocation.staffId, portion: 2, releaseMonth: weddingMonth, amountSen: weddingAmount },
    ];
  });
}

async function applyCollectionToSchedules(collectionId: string, customerName: string | null, amountSen: number) {
  if (!customerName || amountSen <= 0) return;
  const db = getDb();
  const schedules = await db.select().from(paymentSchedules).where(eq(paymentSchedules.customerName, customerName)).orderBy(asc(paymentSchedules.dueDate), asc(paymentSchedules.paymentNumber));
  let remaining = amountSen;
  for (const schedule of schedules) {
    if (remaining <= 0) break;
    const existing = await db.select().from(paymentScheduleAllocations).where(eq(paymentScheduleAllocations.scheduleId, schedule.id));
    const paidSen = existing.reduce((sum, row) => sum + row.allocatedSen, 0);
    const availableSen = Math.max(0, schedule.expectedSen - paidSen);
    const appliedSen = Math.min(remaining, availableSen);
    if (appliedSen > 0) {
      await db.insert(paymentScheduleAllocations).values({ scheduleId: schedule.id, collectionId, allocatedSen: appliedSen });
      remaining -= appliedSen;
    }
  }
}

function parseImportedMoney(value: unknown) {
  const raw = String(value ?? "").trim().replace(/,/g, "").replace(/^RM\s*/i, "");
  if (!raw || raw === "-") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function normalizeImportedDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
  return "";
}

function importedCategory(items: string, catalogueType: string): "PRE_WEDDING" | "RENTAL" | "MAKEUP" {
  const text = (items + " " + catalogueType).toLowerCase();
  if (/makeup|mua|hair/.test(text)) return "MAKEUP";
  if (/pre[- ]?wedding|rom|pre wedding/.test(text)) return "PRE_WEDDING";
  return "RENTAL";
}

export async function importBookitPaymentsAction(form: FormData) {
  const admin = await requireAdmin();
  let rows: Array<any> = [];

  try {
    rows = JSON.parse(s(form, "rowsJson"));
  } catch {
    go("/bookit-import", "error", "The uploaded Bookit file could not be read.");
  }
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 5000) go("/bookit-import", "error", "Please upload a valid Bookit CSV with between 1 and 5,000 payment rows.");
  const people = await getDb().select().from(staff);
  const peopleById = new Map(people.map((p) => [p.id, p]));
  const settings = await getSettings();
  const normalizeStaffName = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
  const staffByName = new Map(people.map((person) => [normalizeStaffName(person.name), person.id]));
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? {};
    const paymentId = String(row.paymentId ?? "").trim();
    const collectionDate = normalizeImportedDate(row.paymentDate);
    const amountSen = parseImportedMoney(row.collectionAmount);
    if (!paymentId || !collectionDate || amountSen <= 0) {
      errors.push("Row " + (i + 2) + ": missing Payment ID, valid Payment date, or positive Total collection.");
      continue;
    }
    const [existing] = await getDb().select({ id: collections.id }).from(collections).where(eq(collections.bookitPaymentId, paymentId)).limit(1);
    if (existing) { skipped++; continue; }

    const commissionEntries = Array.isArray(row.commissionByStaff) ? row.commissionByStaff : [];
    const resolvedCommission = commissionEntries
      .map((entry: any) => ({ name: String(entry.name ?? "").trim(), amountSen: parseImportedMoney(entry.amount) }))
      .filter((entry: any) => entry.name && entry.amountSen > 0)
      .map((entry: any) => ({ ...entry, staffId: staffByName.get(normalizeStaffName(entry.name)) }));
    const unmappedCommission = resolvedCommission.filter((entry: any) => !entry.staffId);
    if (unmappedCommission.length) {
      errors.push("Row " + (i + 2) + " (" + paymentId + "): commission staff not mapped: " + unmappedCommission.map((x: any) => x.name).join(", "));
      continue;
    }

    const teamNames = Array.isArray(row.teamMembers) ? row.teamMembers : [];
    const resolvedTeam = teamNames.map((name: unknown) => ({ name: String(name).trim(), staffId: staffByName.get(normalizeStaffName(String(name))) })).filter((x: any) => x.staffId);
    const staffCommissionSen = resolvedCommission.reduce((sum: number, x: any) => sum + x.amountSen, 0);
    const reportedCommissionSen = parseImportedMoney(row.totalCommission);
    if (reportedCommissionSen > 0 && staffCommissionSen === 0) {
      errors.push("Row " + (i + 2) + " (" + paymentId + "): Bookit shows commission but no staff commission was found.");
      continue;
    }
    if (reportedCommissionSen > 0 && Math.abs(reportedCommissionSen - staffCommissionSen) > 1) {
      errors.push("Row " + (i + 2) + " (" + paymentId + "): Bookit total commission does not match its staff commission columns.");
      continue;
    }
    const totalCommissionSen = staffCommissionSen;
    const sourceAllocations = totalCommissionSen > 0
      ? resolvedCommission.map((x: any) => ({ staffId: x.staffId as string, commissionAmountSen: x.amountSen }))
      : resolvedTeam.length
        ? resolvedTeam.map((x: any) => ({ staffId: x.staffId as string, commissionAmountSen: 0 }))
        : [];

    const uniqueAllocations = Array.from(new Map(sourceAllocations.map((x: any) => [x.staffId, x])).values());
    const allocationRows = uniqueAllocations.length
      ? (() => {
          const totalWeight = uniqueAllocations.reduce((sum: number, x: any) => sum + (totalCommissionSen > 0 ? x.commissionAmountSen : 1), 0);
          let assigned = 0;
          let assignedAmount = 0;
          return uniqueAllocations.map((x: any, index: number) => {
            const weight = totalCommissionSen > 0 ? x.commissionAmountSen : 1;
            const allocationBps = index === uniqueAllocations.length - 1 ? 10000 - assigned : Math.round(weight * 10000 / totalWeight);
            const allocatedCollectedSen = index === uniqueAllocations.length - 1 ? amountSen - assignedAmount : Math.round(amountSen * weight / totalWeight);
            assigned += allocationBps;
            assignedAmount += allocatedCollectedSen;
            return { staffId: x.staffId as string, allocationBps, allocatedCollectedSen, commissionRateBps: 0, commissionAmountSen: x.commissionAmountSen };
          });
        })()
      : [];
    if (allocationRows.some((x: any) => !peopleById.has(x.staffId))) {
      errors.push("Row " + (i + 2) + " (" + paymentId + "): mapped staff account no longer exists.");
      continue;
    }

    const customerName = String(row.customerName ?? "").trim();
    const bookingId = String(row.bookingId ?? "").trim();
    const notes = ["Bookit Payment ID: " + paymentId, bookingId ? "Bookit Booking ID: " + bookingId : "", String(row.items ?? "").trim()].filter(Boolean).join(" | ");
    const bookingDate = collectionDate;
    const [created] = await getDb().insert(collections).values({
      bookitPaymentId: paymentId,
      bookitBookingId: bookingId || null,
      customerName: customerName === "-" ? null : customerName || null,
      bookingDate,
      weddingPickupDate: null,
      collectionDate,
      category: importedCategory(String(row.items ?? ""), String(row.catalogueType ?? "")),
      collectedSen: amountSen,
      source: "BOOKIT",
      notes,
      createdBy: admin.id,
    }).returning();
    if (allocationRows.length) {
      await getDb().insert(collectionAllocations).values(allocationRows.map((x: any) => ({ ...x, collectionId: created.id })));
      await getDb().insert(commissionPortions).values(createCommissionPortionRows(created.id, allocationRows, bookingDate, collectionDate, null, settings));
    }
    await applyCollectionToSchedules(created.id, customerName || null, amountSen);
    imported++;
  }
  revalidatePath("/");
  if (errors.length) go("/bookit-import", "error", "Imported " + imported + ", skipped " + skipped + ". First issues: " + errors.slice(0, 4).join(" | "));
  go("/bookit-import", "success", "Bookit import complete: " + imported + " new payments imported, " + skipped + " duplicates skipped.");
}

export async function createCollectionAction(form: FormData) {
  const admin=await requireAdmin(); const collectionDate=s(form,"collectionDate"), month=monthFromMalaysiaDate(collectionDate); if(await isMonthLocked(month)) go("/collections","error",`${month} is locked`);
  const orderId=s(form,"orderId"), customerName=s(form,"customerName"), collectedSen=moneyToSen(s(form,"collectedAmount")); if(collectedSen<=0) go("/collections","error","Collected amount must be above RM0");
  const allocations=parseAllocations(form); if(!validateAllocations(allocations)) go("/collections","error","Staff allocations must be unique and total exactly 100%");
  const duplicates=await listCollections({}); if(form.get("duplicateConfirmed")!=="yes" && isSuspiciousDuplicate(duplicates.map(r=>({orderId:r.collection.orderId ?? "",collectionDate:r.collection.collectionDate,collectedSen:r.collection.collectedSen})),{orderId,collectionDate,collectedSen})) go("/collections","error","Possible duplicate: same date and amount already exists. Tick duplicate confirmation to save intentionally.");
  const bookingDate=s(form,"bookingDate") || null; const weddingPickupDate=s(form,"weddingPickupDate") || null;
  const settings=await getSettings(); const category=s(form,"category") as "PRE_WEDDING"|"RENTAL"|"MAKEUP", rate=rateForCategory(category,settings);
  const [created]=await getDb().insert(collections).values({orderId:orderId||null,customerName:customerName||null,bookingDate,weddingPickupDate,collectionDate,category,collectedSen,source:s(form,"source")==="MANUAL_ADJUSTMENT"?"MANUAL_ADJUSTMENT":"BOOKIT",notes:s(form,"notes")||null,createdBy:admin.id}).returning();
  const splits=splitAmount(collectedSen,allocations); const allocationRows=splits.map(x=>({...x,collectionId:created.id,allocatedCollectedSen:x.amountSen,commissionRateBps:rate,commissionAmountSen:calculateCommission(x.amountSen,rate)})); await getDb().insert(collectionAllocations).values(allocationRows); await getDb().insert(commissionPortions).values(createCommissionPortionRows(created.id, allocationRows, bookingDate, collectionDate, weddingPickupDate, settings)); await applyCollectionToSchedules(created.id,customerName||null,collectedSen); revalidatePath("/"); go("/collections","success","Collection recorded");
}

export async function updateCollectionAction(form: FormData) {
  const admin=await requireAdmin(); const id=s(form,"id"); const [current]=await getDb().select().from(collections).where(eq(collections.id,id)).limit(1); if(!current) go("/collections","error","Collection not found"); const currentMonth=monthFromMalaysiaDate(current.collectionDate); if(await isMonthLocked(currentMonth)) go("/collections","error",`${currentMonth} is locked`);
  const bookingDate=s(form,"bookingDate") || current.bookingDate || current.collectionDate; const weddingPickupDate=s(form,"weddingPickupDate") || null;
  if (current.bookitPaymentId) {
    await getDb().update(collections).set({ bookingDate, weddingPickupDate, updatedAt:new Date() }).where(eq(collections.id,id));
    await getDb().delete(commissionPortions).where(eq(commissionPortions.collectionId,id));
    const existingAllocations=await getDb().select().from(collectionAllocations).where(eq(collectionAllocations.collectionId,id));
    if(existingAllocations.length) await getDb().insert(commissionPortions).values(createCommissionPortionRows(id,existingAllocations,bookingDate,current.collectionDate,weddingPickupDate,await getSettings()));
    revalidatePath("/"); go(`/collections/${id}/edit`,`success","Bookit dates updated");
  }
  const collectionDate=s(form,"collectionDate"), newMonth=monthFromMalaysiaDate(collectionDate); if(newMonth!==currentMonth && await isMonthLocked(newMonth)) go("/collections","error",`${newMonth} is locked`); const collectedSen=moneyToSen(s(form,"collectedAmount")), allocations=parseAllocations(form); if(!validateAllocations(allocations)) go(`/collections/${id}/edit`,`error","Allocations must total exactly 100%"); const settings=await getSettings(); const category=s(form,"category") as "PRE_WEDDING"|"RENTAL"|"MAKEUP",rate=rateForCategory(category,settings); await getDb().update(collections).set({customerName:s(form,"customerName")||null,bookingDate,weddingPickupDate,collectionDate,category,collectedSen,source:s(form,"source")==="MANUAL_ADJUSTMENT"?"MANUAL_ADJUSTMENT":"BOOKIT",notes:s(form,"notes")||null,updatedAt:new Date()}).where(eq(collections.id,id)); await getDb().delete(collectionAllocations).where(eq(collectionAllocations.collectionId,id)); await getDb().delete(commissionPortions).where(eq(commissionPortions.collectionId,id)); const splits=splitAmount(collectedSen,allocations); const allocationRows=splits.map(x=>({...x,collectionId:id,allocatedCollectedSen:x.amountSen,commissionRateBps:rate,commissionAmountSen:calculateCommission(x.amountSen,rate)})); await getDb().insert(collectionAllocations).values(allocationRows); await getDb().insert(commissionPortions).values(createCommissionPortionRows(id, allocationRows, bookingDate, collectionDate, weddingPickupDate, settings)); revalidatePath("/"); go(`/collections/${id}/edit`,`success","Collection updated");
}

export async function deleteCollectionAction(form: FormData) { const admin=await requireAdmin(); const id=s(form,"id"); if(s(form,"confirm")!=="DELETE") go("/collections","error","Type DELETE to confirm"); const [row]=await getDb().select().from(collections).where(eq(collections.id,id)).limit(1); if(!row) go("/collections","error","Collection not found"); if(await isMonthLocked(monthFromMalaysiaDate(row.collectionDate))) go("/collections","error","Locked month collections cannot be deleted"); await getDb().delete(collections).where(eq(collections.id,id)); revalidatePath("/"); go("/collections","success","Collection deleted"); }

export async function addPaymentAction(form: FormData) { const admin=await requireAdmin(); const staffId=s(form,"staffId"),month=s(form,"month"),paidSen=moneyToSen(s(form,"amount")); if(paidSen<=0) go("/payments","error","Payment must be above RM0"); await getDb().insert(commissionPayments).values({staffId,commissionMonth:month,paidSen,paymentDate:s(form,"paymentDate"),notes:s(form,"notes")||null,createdBy:admin.id}); revalidatePath("/"); go("/payments","success","Commission payment recorded"); }
export async function lockMonthAction(form: FormData) { const admin=await requireAdmin(); const month=s(form,"month"); await getDb().insert(monthlyLocks).values({month,locked:true,updatedBy:admin.id}).onConflictDoUpdate({target:monthlyLocks.month,set:{locked:true,updatedBy:admin.id,updatedAt:new Date()}}); revalidatePath("/"); go("/settings","success",`${month} locked`); }
export async function unlockMonthAction(form: FormData) { const admin=await requireAdmin(); const month=s(form,"month"); await getDb().insert(monthlyLocks).values({month,locked:false,updatedBy:admin.id}).onConflictDoUpdate({target:monthlyLocks.month,set:{locked:false,updatedBy:admin.id,updatedAt:new Date()}}); revalidatePath("/"); go("/settings","success",`${month} unlocked`); }

export async function updateSettingsAction(form: FormData) { const admin=await requireAdmin(); const bookingPortionBps=Math.round(Number(s(form,"bookingPortionPercent"))*100),weddingPortionBps=Math.round(Number(s(form,"weddingPortionPercent"))*100),preWeddingBps=Math.round(Number(s(form,"preWeddingRate"))*100),rentalBps=Math.round(Number(s(form,"rentalRate"))*100),makeupBps=Math.round(Number(s(form,"makeupRate"))*100),monthlyTargetSen=moneyToSen(s(form,"monthlyTarget")),monthlyRewardSen=moneyToSen(s(form,"monthlyReward")); if(bookingPortionBps<0||weddingPortionBps<0||bookingPortionBps+weddingPortionBps!==10000) go("/settings","error","Booking and wedding portions must total exactly 100%"); if([preWeddingBps,rentalBps,makeupBps].some(v=>v<0||v>10000)) go("/settings","error","Commission rates must be between 0% and 100%"); await getDb().update(commissionSettings).set({bookingPortionBps,weddingPortionBps,preWeddingBps,rentalBps,makeupBps,monthlyTargetSen,monthlyRewardSen,updatedBy:admin.id,updatedAt:new Date()}).where(eq(commissionSettings.id,1)); revalidatePath("/"); go("/settings","success","Settings updated. Historical collection commission rates remain unchanged."); }

export async function createPaymentScheduleAction(form: FormData) { const admin=await requireAdmin(); const customerName=s(form,"customerName"), paymentNumber=Number(s(form,"paymentNumber")), expectedSen=moneyToSen(s(form,"expectedAmount")); if(!customerName||!Number.isInteger(paymentNumber)||paymentNumber<=0||expectedSen<=0) go("/payment-schedule","error","Customer, payment number and positive expected amount are required"); await getDb().insert(paymentSchedules).values({customerName,paymentNumber,dueDate:s(form,"dueDate"),expectedSen,staffId:s(form,"staffId")||null,notes:s(form,"notes")||null,createdBy:admin.id}); revalidatePath("/payment-schedule"); go("/payment-schedule","success","Payment schedule added"); }
export async function deletePaymentScheduleAction(form: FormData) { await requireAdmin(); const id=s(form,"id"); await getDb().delete(paymentSchedules).where(eq(paymentSchedules.id,id)); revalidatePath("/payment-schedule"); go("/payment-schedule","success","Payment schedule removed"); }
