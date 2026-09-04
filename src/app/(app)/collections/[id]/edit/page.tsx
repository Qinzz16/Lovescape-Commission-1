import { notFound, redirect } from "next/navigation";
import { updateCollectionAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { monthFromMalaysiaDate } from "@/lib/business";
import {
  getCollectionForEdit,
  isMonthLocked,
  listOrders,
  listStaff,
} from "@/lib/queries";
import { EditableAllocations } from "@/components/editable-allocations";
import { Notice, PageHead, Status } from "@/components/ui";
export default async function EditCollection({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const [{ id }, q] = await Promise.all([params, searchParams]);
  const item = await getCollectionForEdit(id);
  if (!item) notFound();
  const [locked, orderList, people] = await Promise.all([
    isMonthLocked(monthFromMalaysiaDate(item.collection.collectionDate)),
    listOrders(),
    listStaff(false),
  ]);
  if (locked)
    redirect("/collections?error=Locked+month+collections+cannot+be+edited");
  return (
    <>
      <PageHead
        title="Edit Collection"
        description="Changing amount or allocation recalculates commission. A category change intentionally uses the current category rate."
        actions={<Status value="Unlocked" />}
      />
      <Notice error={q.error} />
      <form action={updateCollectionAction} className="card form-grid">
        <input type="hidden" name="id" value={id} />
        <label>
          Collection date
          <input
            type="date"
            name="collectionDate"
            defaultValue={item.collection.collectionDate}
            required
          />
        </label>
        <label>
          Order
          <select
            name="orderId"
            defaultValue={item.collection.orderId}
            required
          >
            {orderList.map((o) => (
              <option key={o.id} value={o.id}>
                {o.invoiceNumber} — {o.customerName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sales category
          <select name="category" defaultValue={item.collection.category}>
            <option value="PRE_WEDDING">Pre-wedding</option>
            <option value="RENTAL">Rental</option>
            <option value="MAKEUP">Makeup</option>
          </select>
        </label>
        <label>
          Collected amount (RM)
          <input
            name="collectedAmount"
            inputMode="decimal"
            defaultValue={(item.collection.collectedSen / 100).toFixed(2)}
            required
          />
        </label>
        <label>
          Source
          <select name="source" defaultValue={item.collection.source}>
            <option value="BOOKIT">Bookit</option>
            <option value="MANUAL_ADJUSTMENT">Manual Adjustment</option>
          </select>
        </label>
        <label>
          Notes
          <textarea name="notes" defaultValue={item.collection.notes || ""} />
        </label>
        <EditableAllocations people={people} initial={item.allocations} />
        <div className="actions full">
          <button className="button">Save changes</button>
          <a className="button secondary" href="/collections">
            Cancel
          </a>
        </div>
      </form>
    </>
  );
}
