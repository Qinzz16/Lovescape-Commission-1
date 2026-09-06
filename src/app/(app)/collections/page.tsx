import { createCollectionAction, deleteCollectionAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { malaysiaMonthFromInstant } from "@/lib/business";
import { listCollections, listStaff } from "@/lib/queries";
import { AllocationFields } from "@/components/allocation-fields";
import { Money, Notice, PageHead } from "@/components/ui";
import Link from "next/link";

export default async function CollectionsPage({ searchParams }: { searchParams: Promise<{ month?: string; staffId?: string; category?: string; source?: string; success?: string; error?: string }> }) {
  await requireAdmin();
  const q = await searchParams;
  const month = q.month || malaysiaMonthFromInstant(new Date());
  const [people, rows] = await Promise.all([
    listStaff(false),
    listCollections({ month, staffId: q.staffId, category: q.category, source: q.source }),
  ]);
  const grouped = Object.values(rows.reduce<Record<string, { base: (typeof rows)[number]; allocations: typeof rows }>((map, row) => {
    (map[row.collection.id] ??= { base: row, allocations: [] }).allocations.push(row);
    return map;
  }, {}));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
  return <>
    <PageHead title="Collections" description="Record money actually received. Commission is calculated from the collected amount and staff allocation." />
    <Notice success={q.success} error={q.error} />
    <details className="card">
      <summary>Add collection</summary>
      <form action={createCollectionAction} className="form-grid">
        <label>Collection date<input type="date" name="collectionDate" defaultValue={today} required /></label>
        <label>Collection category<select name="category"><option value="PRE_WEDDING">Pre-wedding</option><option value="RENTAL">Rental</option><option value="MAKEUP">Makeup</option></select></label>
        <label>Collected amount (RM)<input name="collectedAmount" inputMode="decimal" required /></label>
        <label>Source<select name="source"><option value="BOOKIT">Bookit</option><option value="MANUAL_ADJUSTMENT">Manual Adjustment</option></select></label>
        <label className="full">Notes<textarea name="notes" /></label>
        <AllocationFields people={people} />
        <label className="full check"><input type="checkbox" name="duplicateConfirmed" value="yes" /> I confirm this is intentional if a duplicate warning appears.</label>
        <button className="button" type="submit">Record collection</button>
      </form>
    </details>
    <section className="section">
      <form className="filters">
        <label>Month<input type="month" name="month" defaultValue={month} /></label>
        <label>Staff<select name="staffId" defaultValue={q.staffId}><option value="">All staff</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Category<select name="category" defaultValue={q.category}><option value="">All categories</option><option value="PRE_WEDDING">Pre-wedding</option><option value="RENTAL">Rental</option><option value="MAKEUP">Makeup</option></select></label>
        <label>Source<select name="source" defaultValue={q.source}><option value="">All sources</option><option value="BOOKIT">Bookit</option><option value="MANUAL_ADJUSTMENT">Manual Adjustment</option></select></label>
        <button className="button">Apply filters</button>
      </form>
      <div className="table-wrap"><table><thead><tr><th>Date</th><th>Category</th><th>Collected</th><th>Allocation & commission</th><th>Source</th><th>Action</th></tr></thead>
      <tbody>{grouped.map(({ base, allocations }) => <tr key={base.collection.id}>
        <td>{base.collection.collectionDate}</td><td>{base.collection.category.replace("_", " ")}</td><td><Money value={base.collection.collectedSen} /></td>
        <td>{allocations.map((a) => <div key={a.staffId}>{a.staffName}: <Money value={a.allocatedCollectedSen} /> × {(a.commissionRateBps / 100).toFixed(2)}% = <strong><Money value={a.commissionAmountSen} /></strong></div>)}</td>
        <td>{base.collection.source.replace("_", " ")}</td>
        <td><Link className="button secondary" href={`/collections/${base.collection.id}/edit`}>Edit</Link><details><summary>Delete</summary><form action={deleteCollectionAction} className="stack"><input type="hidden" name="id" value={base.collection.id} /><label>Type DELETE<input name="confirm" /></label><button className="button danger">Delete</button></form></details></td>
      </tr>)}</tbody></table></div>
    </section>
  </>;
}
