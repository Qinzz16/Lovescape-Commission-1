import { format } from "date-fns";
import { requireAccount } from "@/lib/auth";
import { formatMoney, malaysiaMonthFromInstant } from "@/lib/business";
import { monthlySummaries } from "@/lib/queries";
import { Metric, Money, PageHead, Status } from "@/components/ui";
import { SummaryTable } from "@/components/summary-table";
export default async function Dashboard() {
  const account = await requireAccount();
  const month = malaysiaMonthFromInstant(new Date());
  const rows = await monthlySummaries(
    month,
    account.role === "STAFF" ? account.id : undefined,
  );
  const total = (key: keyof (typeof rows)[number]) =>
    rows.reduce(
      (s, r) => s + (typeof r[key] === "number" ? (r[key] as number) : 0),
      0,
    );
  const current = rows[0];
  if (account.role === "STAFF" && current)
    return (
      <>
        <PageHead
          title={`Welcome, ${account.name}`}
          description={`${format(new Date(`${month}-01T00:00:00+08:00`), "MMMM yyyy")} commission at a glance.`}
        />
        <div className="cards">
          <Metric
            label="Collected sales"
            value={formatMoney(current.totalCollectedSen)}
          />
          <Metric
            label="Commission"
            value={formatMoney(current.commissionSen)}
          />
          <Metric
            label="Reward"
            value={formatMoney(current.rewardSen)}
            hint={current.rewardSen ? "Target reached" : "Not reached yet"}
          />
          <Metric
            label="Total payable"
            value={formatMoney(current.totalPayableSen)}
          />
          <Metric label="Paid" value={formatMoney(current.paidSen)} />
          <Metric
            label="Outstanding"
            value={formatMoney(current.outstandingSen)}
          />
        </div>
        <div className="two-col">
          <section className="card">
            <div className="section-title">
              <h3>RM30K reward progress</h3>
              <Status value={current.rewardSen ? "Reached" : "Not reached"} />
            </div>
            <strong>
              <Money value={current.totalCollectedSen} />
            </strong>{" "}
            of <Money value={current.targetSen} />
            <div className="progress">
              <span style={{ width: `${current.progress}%` }} />
            </div>
            <span className="caption">
              <Money value={current.remainingSen} /> remaining
            </span>
          </section>
          <section className="card">
            <div className="section-title">
              <h3>Collection mix</h3>
              <Status value={current.status} />
            </div>
            <p>
              Pre-wedding: <Money value={current.preWeddingSen} />
            </p>
            <p>
              Rental: <Money value={current.rentalSen} />
            </p>
            <p>
              Makeup: <Money value={current.makeupSen} />
            </p>
          </section>
        </div>
      </>
    );
  return (
    <>
      <PageHead
        title="Dashboard"
        description={`${format(new Date(`${month}-01T00:00:00+08:00`), "MMMM yyyy")} overview based on actual collections.`}
      />
      <div className="cards">
        <Metric
          label="Collected sales"
          value={formatMoney(total("totalCollectedSen"))}
        />
        <Metric
          label="Commission"
          value={formatMoney(total("commissionSen"))}
        />
        <Metric label="RM30K rewards" value={formatMoney(total("rewardSen"))} />
        <Metric
          label="Total payable"
          value={formatMoney(total("totalPayableSen"))}
        />
        <Metric label="Paid" value={formatMoney(total("paidSen"))} />
        <Metric
          label="Outstanding"
          value={formatMoney(total("outstandingSen"))}
          hint={`${rows.filter((r) => r.rewardSen > 0).length} staff reached target · ${rows.filter((r) => r.staff.active).length} active staff`}
        />
      </div>
      <section className="section">
        <div className="section-title">
          <h3>Staff summary</h3>
        </div>
        <SummaryTable rows={rows} />
      </section>
    </>
  );
}
