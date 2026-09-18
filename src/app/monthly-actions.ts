"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { commissionPayments, monthlyLocks } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { moneyToSen } from "@/lib/business";
import { monthlySummaries } from "@/lib/queries";

const s = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

const go = (
  path: string,
  type: "success" | "error",
  message: string,
): never => redirect(`${path}?${type}=${encodeURIComponent(message)}`);

export async function createPaymentAction(form: FormData) {
  const admin = await requireAdmin();
  const staffId = s(form, "staffId");
  const month = s(form, "commissionMonth");
  const paidSen = moneyToSen(s(form, "paidAmount"));

  if (paidSen <= 0) {
    go("/monthly-commission", "error", "Payment must be above RM0");
  }

  const [summary] = await monthlySummaries(month, staffId);
  if (!summary || paidSen > summary.outstandingSen) {
    go(
      "/monthly-commission",
      "error",
      "Payment cannot exceed the outstanding commission",
    );
  }

  await getDb().insert(commissionPayments).values({
    staffId,
    commissionMonth: month,
    paidSen,
    paymentDate: s(form, "paymentDate"),
    notes: s(form, "notes") || null,
    createdBy: admin.id,
  });

  revalidatePath("/");
  go("/monthly-commission", "success", "Commission payment recorded");
}

export async function toggleMonthLockAction(form: FormData) {
  const admin = await requireAdmin();
  const month = s(form, "month");
  const locked = s(form, "locked") === "true";

  await getDb()
    .insert(monthlyLocks)
    .values({
      month,
      locked,
      updatedBy: admin.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: monthlyLocks.month,
      set: {
        locked,
        updatedBy: admin.id,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/");
  go(
    "/monthly-commission",
    "success",
    `${month} ${locked ? "locked" : "unlocked"}`,
  );
}
