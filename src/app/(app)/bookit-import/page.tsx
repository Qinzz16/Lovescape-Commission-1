import { requireAdmin } from "@/lib/auth";
import { listStaff } from "@/lib/queries";
import { Notice, PageHead } from "@/components/ui";
import { BookitImportForm } from "@/components/bookit-import";

export default async function BookitImportPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireAdmin();
  const [people, q] = await Promise.all([listStaff(true), searchParams]);
  return (
    <>
      <PageHead
        title="Bookit Import"
        description="Import Bookit Commission Report by Payment into Lovescape. Payment ID prevents duplicate imports."
      />
      <Notice success={q.success} error={q.error} />
      <div className="card notice">
        <strong>Before importing</strong>
        <p>Use Bookit&apos;s <strong>Commission Report by Payment</strong> export. Full payments and multiple payments under the same Booking ID are supported.</p>
        <p>Booking date is initially set to the payment date. Wedding / Pickup Date can be entered later on the collection record; this controls the second commission portion.</p>
      </div>
      <BookitImportForm people={people.map((p) => ({ id: p.id, name: p.name }))} />
    </>
  );
}
