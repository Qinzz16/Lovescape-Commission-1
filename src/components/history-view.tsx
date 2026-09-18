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
            <tr key={`${r.collection.id}-${r.staffId ?? "unassigned"}-${index}`}>
              <td>{r.collection.collectionDate}</td>
              <td>{r.collection.category.replace("_", " ")}</td>
              <td>
                {r.staffName ?? <span className="muted">Unassigned</span>}
                {r.staffId && !r.staffActive ? (
                  <>
                    <br />
                    <Status value="Inactive" />
                  </>
                ) : null}
              </td>
              <td>{r.allocatedCollectedSen == null ? "—" : <Money value={r.allocatedCollectedSen} />}</td>
              <td>{r.commissionRateBps == null ? "—" : `${(r.commissionRateBps / 100).toFixed(2)}%`}</td>
              <td>{r.commissionAmountSen == null ? "—" : <Money value={r.commissionAmountSen} />}</td>
              <td>{r.collection.source.replace("_", " ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
