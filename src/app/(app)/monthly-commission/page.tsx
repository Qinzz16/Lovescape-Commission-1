import { createPaymentAction, toggleMonthLockAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { malaysiaMonthFromInstant } from "@/lib/business";
import {
  isMonthLocked,
  listStaff,
  monthlySummaries,
  paymentHistory,
} from "@/lib/queries";
import { Notice, PageHead, Status, Money } from "@/components/ui";
import { SummaryTable } from "@/components/summary-table";
export default async function MonthlyPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    staffId?: string;
    success?: string;
    error?: string;
  }>;
}) {
  await requireAdmin();
  const q = await searchParams;
  const month = q.month || malaysiaMonthFromInstant(new Date());
  const [people, rows, locked, payments] = await Promise.all([
    listStaff(true),
    monthlySummaries(month, q.staffId),
    isMonthLocked(month),
    paymentHistory(q.staffId, month),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
  return (
    <>
      <PageHead
        title="Monthly Commission"
        description="Actual allocated collections, preserved commissions, monthly reward and payment status."
        actions={
          <>
            <Status value={locked ? "Locked" : "Unlocked"} />
            <form action={toggleMonthLockAction}>
              <input type="hidden" name="month" value={month} />
              <input type="hidden" name="locked" value={String(!locked)} />
              <button className={`button ${locked ? "secondary" : "danger"}`}>
                {locked ? "Unlock month" : "Lock month"}
              </button>
            </form>
          </>
        }
      />
      <Notice success={q.success} error={q.error} />
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
                {p.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </label>
        <button className="button">Apply</button>
      </form>
      <SummaryTable rows={rows} />
      <section className="section two-col">
        <details className="card">
          <summary>Record commission payment</summary>
          <form action={createPaymentAction} className="form-grid">
            <label>
              Staff
              <select name="staffId" required>
                <option value="">Select staff</option>
                {rows
                  .filter((r) => r.outstandingSen > 0)
                  .map((r) => (
                    <option key={r.staff.id} value={r.staff.id}>
                      {r.staff.name} — {r.outstandingSen / 100} outstanding
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Commission month
              <input
                type="month"
                name="commissionMonth"
                defaultValue={month}
                required
              />
            </label>
            <label>
              Paid amount (RM)
              <input name="paidAmount" inputMode="decimal" required />
            </label>
            <label>
              Payment date
              <input
                type="date"
                name="paymentDate"
                defaultValue={today}
                required
              />
            </label>
            <label className="full">
              Notes
              <textarea name="notes" />
            </label>
            <button className="button">Record payment</button>
          </form>
        </details>
        <section className="card">
          <div className="section-title">
            <h3>Payment history</h3>
          </div>
          <div className="stack">
            {payments.length ? (
              payments.map(({ payment: p, staffName }) => (
                <div key={p.id}>
                  <strong>{staffName}</strong> · <Money value={p.paidSen} />
                  <br />
                  <span className="caption">
                    {p.paymentDate} · {p.notes || "No notes"}
                  </span>
                </div>
              ))
            ) : (
              <p className="muted">No payments recorded for this selection.</p>
            )}
          </div>
        </section>
      </section>
    </>
  );
}
