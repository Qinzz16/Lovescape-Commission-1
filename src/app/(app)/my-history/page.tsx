import { requireAccount } from "@/lib/auth";
import { malaysiaMonthFromInstant } from "@/lib/business";
import { listCollections } from "@/lib/queries";
import { HistoryView } from "@/components/history-view";
import { PageHead } from "@/components/ui";
export default async function MyHistory({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; category?: string; search?: string }>;
}) {
  const me = await requireAccount();
  const q = await searchParams;
  const month = q.month || malaysiaMonthFromInstant(new Date());
  const rows = await listCollections(
    { month, category: q.category, search: q.search },
    me.id,
  );
  return (
    <>
      <PageHead
        title="My History"
        description="Only collections allocated to your account are shown."
      />
      <form className="filters">
        <label>
          Month
          <input type="month" name="month" defaultValue={month} />
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
