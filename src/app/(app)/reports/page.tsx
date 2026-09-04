import { requireAdmin } from "@/lib/auth";
import { malaysiaMonthFromInstant } from "@/lib/business";
import { monthlySummaries } from "@/lib/queries";
import { PageHead } from "@/components/ui";
import { SummaryTable } from "@/components/summary-table";
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireAdmin();
  const q = await searchParams;
  const month = q.month || malaysiaMonthFromInstant(new Date());
  const rows = await monthlySummaries(month);
  return (
    <>
      <PageHead
        title="Reports"
        description="Exported files use the exact same monthly summary calculation as this table."
        actions={
          <>
            <a
              className="button secondary"
              href={`/api/reports?month=${month}&format=csv`}
            >
              Export CSV
            </a>
            <a
              className="button"
          href={`/api/reports?month=${month}&format=xls`}
            >
              Export Excel
            </a>
          </>
        }
      />
      <form className="inline-form">
        <label>
          Month
          <input type="month" name="month" defaultValue={month} />
        </label>
        <button className="button">View report</button>
      </form>
      <section className="section">
        <SummaryTable rows={rows} />
      </section>
    </>
  );
}
