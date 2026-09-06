"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { collectionAllocations, collections, commissionPayments, commissionSettings, monthlyLocks, staff } from "@/db/schema";
import { authenticate, requireAdmin, signOut } from "@/lib/auth";
import { calculateCommission, isSuspiciousDuplicate, moneyToSen, monthFromMalaysiaDate, rateForCategory, splitAmount, validateAllocations } from "@/lib/business";
import { getSettings, isMonthLocked, listCollections, monthlySummaries } from "@/lib/queries";

const s = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const go = (path: string, type: "success" | "error", message: string): never => redirect(`${path}?${type}=${encodeURIComponent(message)}`);

export async function loginAction(form: FormData) {
  const account = await authenticate(s(form, "email"), s(form, "password"));
  if (!account) {
    go("/login", "error", "Invalid email or password, or this account is inactive");
  }
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

function parseAllocations(form: FormData) { const staffIds=form.getAll("staffId").map(String), percentages=form.getAll("allocationPercent").map(String); return staffIds.map((staffId,index)=>({staffId,allocationBps:Math.round(Number(percentages[index])*100)})); }

export async function createCollectionAction(form: FormData) {
  const admin=await requireAdmin(); const collectionDate=s(form,"collectionDate"), month=monthFromMalaysiaDate(collectionDate); if(await isMonthLocked(month)) go("/collections","error",`${month} is locked`);
  const orderId=s(form,"orderId"), collectedSen=moneyToSen(s(form,"collectedAmount")); if(collectedSen<=0) go("/collections","error","Collected amount must be above RM0");
  const allocations=parseAllocations(form); if(!validateAllocations(allocations)) go("/collections","error","Staff allocations must be unique and total exactly 100%");
  const duplicates=await listCollections({}); if(form.get("duplicateConfirmed")!=="yes" && isSuspiciousDuplicate(duplicates.map(r=>({orderId:r.collection.orderId ?? "",collectionDate:r.collection.collectionDate,collectedSen:r.collection.collectedSen})),{orderId,collectionDate,collectedSen})) go("/collections","error","Possible duplicate: same date and amount already exists. Tick duplicate confirmation to save intentionally.");
  const category=s(form,"category") as "PRE_WEDDING"|"RENTAL"|"MAKEUP", rate=rateForCategory(category,await getSettings());
  const [created]=await getDb().insert(collections).values({orderId:orderId||null,collectionDate,category,collectedSen,source:s(form,"source")==="MANUAL_ADJUSTMENT"?"MANUAL_ADJUSTMENT":"BOOKIT",notes:s(form,"notes")||null,createdBy:admin.id}).returning();
  const splits=splitAmount(collectedSen,allocations); await getDb().insert(collectionAllocations).values(splits.map(a=>({collectionId:created.id,staffId:a.staffId,allocationBps:a.allocationBps,allocatedCollectedSen:a.amountSen,commissionRateBps:rate,commissionAmountSen:calculateCommission(a.amountSen,rate)})));
  revalidatePath("/"); go("/collections","success","Collection recorded with commission rate preserved");
}

export async function deleteCollectionAction(form: FormData) {
  await requireAdmin(); const id=s(form,"id"); const [item]=await getDb().select().from(collections).where(eq(collections.id,id)).limit(1); if(!item) go("/collections","error","Collection not found"); if(await isMonthLocked(monthFromMalaysiaDate(item.collectionDate))) go("/collections","error","Locked month collections cannot be deleted"); if(s(form,"confirm")!=="DELETE") go("/collections","error","Type DELETE to confirm"); await getDb().delete(collections).where(eq(collections.id,id)); revalidatePath("/"); go("/collections","success","Collection deleted");
}

export async function updateCollectionAction(form: FormData) {
  const id=s(form,"id"), collectionDate=s(form,"collectionDate"), month=monthFromMalaysiaDate(collectionDate); const [existing]=await getDb().select().from(collections).where(eq(collections.id,id)).limit(1); if(!existing) go("/collections","error","Collection not found");
  if((await isMonthLocked(monthFromMalaysiaDate(existing.collectionDate)))||(await isMonthLocked(month))) go("/collections","error","Locked-month collections cannot be edited or moved");
  const collectedSen=moneyToSen(s(form,"collectedAmount")); if(collectedSen<=0) go(`/collections/${id}/edit`,`error","Collected amount must be above RM0"); const allocations=parseAllocations(form); if(!validateAllocations(allocations)) go(`/collections/${id}/edit`,`error`,`Staff allocations must be unique and total exactly 100%`);
  const category=s(form,"category") as "PRE_WEDDING"|"RENTAL"|"MAKEUP"; const [oldAllocation]=await getDb().select().from(collectionAllocations).where(eq(collectionAllocations.collectionId,id)).limit(1); const rate=category===existing.category?(oldAllocation?.commissionRateBps??rateForCategory(category,await getSettings())):rateForCategory(category,await getSettings());
  await getDb().transaction(async tx=>{ await tx.update(collections).set({orderId:s(form,"orderId")||null,collectionDate,category,collectedSen,source:s(form,"source")==="MANUAL_ADJUSTMENT"?"MANUAL_ADJUSTMENT":"BOOKIT",notes:s(form,"notes")||null,updatedAt:new Date()}).where(eq(collections.id,id)); await tx.delete(collectionAllocations).where(eq(collectionAllocations.collectionId,id)); const splits=splitAmount(collectedSen,allocations); await tx.insert(collectionAllocations).values(splits.map(a=>({collectionId:id,staffId:a.staffId,allocationBps:a.allocationBps,allocatedCollectedSen:a.amountSen,commissionRateBps:rate,commissionAmountSen:calculateCommission(a.amountSen,rate)}))); });
  revalidatePath("/"); go("/collections","success","Collection updated and commission recalculated");
}

export async function createPaymentAction(form: FormData) {
  const admin=await requireAdmin(); const staffId=s(form,"staffId"), month=s(form,"commissionMonth"), paidSen=moneyToSen(s(form,"paidAmount")); if(paidSen<=0) go("/monthly-commission","error","Payment must be above RM0"); const [summary]=await monthlySummaries(month,staffId); if(!summary||paidSen>summary.outstandingSen) go("/monthly-commission","error","Payment cannot exceed the outstanding commission"); await getDb().insert(commissionPayments).values({staffId,commissionMonth:month,paidSen,paymentDate:s(form,"paymentDate"),notes:s(form,"notes")||null,createdBy:admin.id}); revalidatePath("/"); go("/monthly-commission","success","Commission payment recorded");
}
export async function toggleMonthLockAction(form: FormData) { const admin=await requireAdmin(); const month=s(form,"month"), locked=s(form,"locked")==="true"; await getDb().insert(monthlyLocks).values({month,locked,updatedBy:admin.id}).onConflictDoUpdate({target:monthlyLocks.month,set:{locked,updatedBy:admin.id,updatedAt:new Date()}}); revalidatePath("/"); go("/monthly-commission","success",`${month} ${locked?"locked":"unlocked"}`); }
export async function updateSettingsAction(form: FormData) { const admin=await requireAdmin(); const values={id:1,preWeddingBps:Math.round(Number(s(form,"preWeddingRate"))*100),rentalBps:Math.round(Number(s(form,"rentalRate"))*100),makeupBps:Math.round(Number(s(form,"makeupRate"))*100),monthlyTargetSen:moneyToSen(s(form,"monthlyTarget")),monthlyRewardSen:moneyToSen(s(form,"monthlyReward")),updatedBy:admin.id,updatedAt:new Date()}; if([values.preWeddingBps,values.rentalBps,values.makeupBps].some(n=>!Number.isInteger(n)||n<0||n>10000)) go("/settings","error","Rates must be between 0% and 100%"); await getDb().insert(commissionSettings).values(values).onConflictDoUpdate({target:commissionSettings.id,set:values}); revalidatePath("/"); go("/settings","success","Settings saved. Historical commission records were unchanged."); }
