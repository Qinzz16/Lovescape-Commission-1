import { createPaymentScheduleAction, deletePaymentScheduleAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { malaysiaMonthFromInstant } from "@/lib/business";
import { listPaymentSchedules, listStaff } from "@/lib/queries";
import { Money, Notice, PageHead } from "@/components/ui";

function monthEnd(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}

export default async function PaymentDuePage({ searchParams }: { searchParams: Promise<{ month?: string; success?: string; error?: string }> }) {
  await requireAdmin();
  const q = await searchParams;
  const month = q.month || malaysiaMonthFromInstant(new Date());
  const [people, rows] = await Promise.all([listStaff(false), listPaymentSchedules()]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
  const selectedMonthEnd = monthEnd(month);
  const outstanding = rows.filter((row) => row.outstandingSen > 0);
  const overdue = outstanding.filter((row) => row.schedule.dueDate < today);
  const dueInMonth = outstanding.filter((row) => row.schedule.dueDate >= today && row.schedule.dueDate >= `${month}-01` && row.schedule.dueDate <= selectedMonthEnd);
  const upcoming = outstanding.filter((row) => row.schedule.dueDate > selectedMonthEnd);

  const renderRows = (items: typeof outstanding) => items.length ? items.map((row) => (
    <tr key={row.schedule.id}>
      <td><strong>{row.schedule.customerName}</strong><div className="muted">Payment {row.schedule.paymentNumber}</div></td>
      <td>{row.schedule.dueDate}</td>
      <td><Money value={row.schedule.expectedSen} /></td>
      <td><Money value={row.outstandingSen} /></td>
      <td>{row.staff?.name || "—"}</td>
      <td><span className={row.schedule.dueDate < today ? "status danger" : "status"}>{row.schedule.dueDate < today ? "Overdue" : "Pending"}</span></td>
      <td><details><summary>Delete</summary><form action={deletePaymentScheduleAction} className="stack"><input type="hidden" name="id" value={row.schedule.id} /><p className="muted">Delete this payment schedule? Any payment matching attached to it will become available for the customer's other outstanding schedules.</p><button className="button danger">Delete</button></form></details></td>
    </tr>
  )) : <tr><td colSpan={7}>No outstanding payments in this section.</td></tr>;

  return <>
    <PageHead title="Payment Due" description="Plan future customer payments and automatically clear them when money is collected early." />
    <Notice success={q.success} error={q.error} />

    <details className="card" open>
      <summary>Add payment schedule</summary>
      <form action={createPaymentScheduleAction} className="form-grid">
        <label>Customer name<input name="customerName" placeholder="Customer name" required /></label>
        <label>Payment number<input name="paymentNumber" type="number" min="1" defaultValue="2" required /></label>
        <label>Due date<input name="dueDate" type="date" required /></label>
        <label>Expected amount (RM)<input name="expectedAmount" inputMode="decimal" required /></label>
        <label>Staff to follow up<select name="staffId"><option value="">Unassigned</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="full">Notes<textarea name="notes" placeholder="Optional payment terms or follow-up notes" /></label>
        <button className="button" type="submit">Add payment schedule</button>
      </form>
    </details>

    <section className="section">
      <form className="filters">
        <label>Payment month<input type="month" name="month" defaultValue={month} /></label>
        <button className="button">Apply</button>
      </form>

      <div className="grid-3">
        <div className="card"><div className="muted">Overdue</div><strong>{overdue.length}</strong></div>
        <div className="card"><div className="muted">Due in {month}</div><strong>{dueInMonth.length}</strong></div>
        <div className="card"><div className="muted">Upcoming</div><strong>{upcoming.length}</strong></div>
      </div>

      <div className="card section"><h2>🔴 Overdue</h2><div className="table-wrap"><table><thead><tr><th>Customer</th><th>Due date</th><th>Expected</th><th>Outstanding</th><th>Staff</th><th>Status</th><th>Action</th></tr></thead><tbody>{renderRows(overdue)}</tbody></table></div></div>
      <div className="card section"><h2>💰 Due in {month}</h2><p className="muted">If the customer pays before the due date, the outstanding amount automatically drops and the customer will no longer appear here once the payment is fully covered.</p><div className="table-wrap"><table><thead><tr><th>Customer</th><th>Due date</th><th>Expected</th><th>Outstanding</th><th>Staff</th><th>Status</th><th>Action</th></tr></thead><tbody>{renderRows(dueInMonth)}</tbody></table></div></div>
      <div className="card section"><h2>🟢 Upcoming</h2><div className="table-wrap"><table><thead><tr><th>Customer</th><th>Due date</th><th>Expected</th><th>Outstanding</th><th>Staff</th><th>Status</th><th>Action</th></tr></thead><tbody>{renderRows(upcoming)}</tbody></table></div></div>
    </section>
  </>;
}
