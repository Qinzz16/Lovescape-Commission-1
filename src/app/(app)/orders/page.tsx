import { createAdjustmentAction, createOrderAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { listAdjustments, listOrders } from "@/lib/queries";
import { Money, Notice, PageHead } from "@/components/ui";
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; success?: string; error?: string }>;
}) {
  await requireAdmin();
  const q = await searchParams;
  const [items, adjustments] = await Promise.all([
    listOrders(q.search),
    listAdjustments(),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date());
  return (
    <>
      <PageHead
        title="Orders"
        description="Reference Bookit orders, totals and adjustment history. Collections stay separate."
      />
      <Notice success={q.success} error={q.error} />
      <div className="two-col">
        <details className="card">
          <summary>Create order</summary>
          <form action={createOrderAction} className="form-grid">
            <label>
              Bookit invoice / order number
              <input name="invoiceNumber" required />
            </label>
            <label>
              Customer name
              <input name="customerName" required />
            </label>
            <label>
              Original order total (RM)
              <input name="originalTotal" inputMode="decimal" required />
            </label>
            <label>
              Created date
              <input
                name="createdDate"
                type="date"
                defaultValue={today}
                required
              />
            </label>
            <label className="full">
              Notes
              <textarea name="notes" />
            </label>
            <button className="button" type="submit">
              Create order
            </button>
          </form>
        </details>
        <details className="card">
          <summary>Record order adjustment</summary>
          <form action={createAdjustmentAction} className="form-grid">
            <label className="full">
              Order
              <select name="orderId" required>
                <option value="">Select order</option>
                {items.map((o) => (
                  <option value={o.id} key={o.id}>
                    {o.invoiceNumber} — {o.customerName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Type
              <select name="type">
                <option value="ADDITION">Addition</option>
                <option value="DEDUCTION">Deduction</option>
              </select>
            </label>
            <label>
              Amount (RM)
              <input name="amount" inputMode="decimal" required />
            </label>
            <label>
              Date
              <input
                type="date"
                name="adjustmentDate"
                defaultValue={today}
                required
              />
            </label>
            <label>
              Reason
              <input
                name="reason"
                placeholder="Upgrade, cancellation…"
                required
              />
            </label>
            <label className="full">
              Notes
              <textarea name="notes" />
            </label>
            <button className="button" type="submit">
              Record adjustment
            </button>
          </form>
        </details>
      </div>
      <section className="section">
        <form className="inline-form">
          <label>
            Search
            <input
              name="search"
              defaultValue={q.search}
              placeholder="Customer or invoice"
            />
          </label>
          <button className="button secondary">Search</button>
        </form>
      </section>
      <section className="section">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Original</th>
                <th>Current</th>
                <th>Collected</th>
                <th>Outstanding</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.invoiceNumber}</strong>
                  </td>
                  <td>{o.customerName}</td>
                  <td>
                    <Money value={o.originalTotalSen} />
                  </td>
                  <td>
                    <Money value={o.currentTotalSen} />
                  </td>
                  <td>
                    <Money value={o.collectedSen} />
                  </td>
                  <td>
                    <Money value={o.outstandingSen} />
                    {o.overCollected ? (
                      <span className="warning">
                        Collected exceeds current total
                      </span>
                    ) : null}
                  </td>
                  <td>{o.createdDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="section">
        <div className="section-title">
          <h3>Adjustment history</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Order</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Reason</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map(
                ({ adjustment: a, invoiceNumber, customerName }) => (
                  <tr key={a.id}>
                    <td>{a.adjustmentDate}</td>
                    <td>
                      {invoiceNumber}
                      <br />
                      <span className="muted">{customerName}</span>
                    </td>
                    <td>{a.type}</td>
                    <td>
                      <Money value={a.amountSen} />
                    </td>
                    <td>{a.reason}</td>
                    <td>{a.notes || "—"}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
