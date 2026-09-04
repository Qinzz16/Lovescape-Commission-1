import { requireAccount } from "@/lib/auth";
import { malaysiaMonthFromInstant } from "@/lib/business";
import { monthlySummaries } from "@/lib/queries";
import { PageHead } from "@/components/ui";
import { SummaryTable } from "@/components/summary-table";
export default async function MyCommission({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const me = await requireAccount();
  const q = await searchParams;
  const month = q.month || malaysiaMonthFromInstant(new Date());
  const rows = await monthlySummaries(month, me.id);
  return (
    <>
      <PageHead
        title="My Commission"
        description="Your allocated collected sales, commission reward and payment status."
      />
      <form className="inline-form">
        <label>
          Month
          <input type="month" name="month" defaultValue={month} />
        </label>
        <button className="button">View</button>
      </form>
      <section className="section">
        <SummaryTable rows={rows} />
      </section>
    </>
  );
}
