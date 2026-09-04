import { Money, Status } from "@/components/ui";

type Summary = {
  staff: { id: string; name: string; active: boolean };
  totalCollectedSen: number;
  preWeddingSen: number;
  rentalSen: number;
  makeupSen: number;
  commissionSen: number;
  rewardSen: number;
  totalPayableSen: number;
  paidSen: number;
  outstandingSen: number;
  status: string;
  targetSen: number;
  remainingSen: number;
  progress: number;
};

export function SummaryTable({
  rows,
  showCategories = true,
}: {
  rows: Summary[];
  showCategories?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Staff</th>
            <th>Collected</th>
            {showCategories ? (
              <>
                <th>Pre-wedding</th>
                <th>Rental</th>
                <th>Makeup</th>
              </>
            ) : null}
            <th>Commission</th>
            <th>Reward</th>
            <th>Payable</th>
            <th>Paid</th>
            <th>Outstanding</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.staff.id}>
              <td>
                <strong>{row.staff.name}</strong>
                {!row.staff.active ? (
                  <span className="warning">Inactive</span>
                ) : null}
              </td>
              <td>
                <Money value={row.totalCollectedSen} />
              </td>
              {showCategories ? (
                <>
                  <td>
                    <Money value={row.preWeddingSen} />
                  </td>
                  <td>
                    <Money value={row.rentalSen} />
                  </td>
                  <td>
                    <Money value={row.makeupSen} />
                  </td>
                </>
              ) : null}
              <td>
                <Money value={row.commissionSen} />
              </td>
              <td>
                <Money value={row.rewardSen} />
              </td>
              <td>
                <strong>
                  <Money value={row.totalPayableSen} />
                </strong>
              </td>
              <td>
                <Money value={row.paidSen} />
              </td>
              <td>
                <Money value={row.outstandingSen} />
              </td>
              <td>
                <Status value={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
