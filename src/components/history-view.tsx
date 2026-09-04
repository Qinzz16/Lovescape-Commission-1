import { Money, Status } from "@/components/ui";
export function HistoryView({
  rows,
}: {
  rows: Awaited<ReturnType<typeof import("@/lib/queries").listCollections>>;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Customer / Invoice</th>
            <th>Category</th>
            <th>Staff</th>
            <th>Allocated sales</th>
            <th>Rate used</th>
            <th>Commission</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, index) => (
            <tr key={`${r.collection.id}-${r.staffId}-${index}`}>
              <td>{r.collection.collectionDate}</td>
              <td>
                <strong>{r.customerName}</strong>
                <br />
                <span className="muted">{r.invoiceNumber}</span>
              </td>
              <td>{r.collection.category.replace("_", " ")}</td>
              <td>
                {r.staffName}
                {!r.staffActive ? (
                  <>
                    <br />
                    <Status value="Inactive" />
                  </>
                ) : null}
              </td>
              <td>
                <Money value={r.allocatedCollectedSen} />
              </td>
              <td>{(r.commissionRateBps / 100).toFixed(2)}%</td>
              <td>
                <Money value={r.commissionAmountSen} />
              </td>
              <td>{r.collection.source.replace("_", " ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
