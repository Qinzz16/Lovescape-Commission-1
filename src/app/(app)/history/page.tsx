import { requireAdmin } from "@/lib/auth";
import { malaysiaMonthFromInstant } from "@/lib/business";
import { listCollections, listStaff } from "@/lib/queries";
import { HistoryView } from "@/components/history-view";
import { PageHead } from "@/components/ui";
export default async function History({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    staffId?: string;
    category?: string;
    search?: string;
  }>;
}) {
  await requireAdmin();
  const q = await searchParams;
  const month = q.month || malaysiaMonthFromInstant(new Date());
  const [people, rows] = await Promise.all([
    listStaff(true),
    listCollections({
      month,
      staffId: q.staffId,
      category: q.category,
      search: q.search,
    }),
  ]);
  return (
    <>
      <PageHead
        title="Commission History"
        description="Historical commission rates and amounts are read from their saved snapshots."
      />
      <form className="filters">
        <label>
          Month
          <input type="month" name="month" defaultValue={month} />
        </label>
        <label>
          Staff
          <select name="staffId" defaultValue={q.staffId}>
            <option value="">All staff</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select name="category" defaultValue={q.category}>
            <option value="">All categories</option>
            <option value="PRE_WEDDING">Pre-wedding</option>
            <option value="RENTAL">Rental</option>
            <option value="MAKEUP">Makeup</option>
          </select>
        </label>
        <label>
          Customer or invoice
          <input name="search" defaultValue={q.search} />
        </label>
        <button className="button">Apply</button>
      </form>
      <HistoryView rows={rows} />
    </>
  );
}
