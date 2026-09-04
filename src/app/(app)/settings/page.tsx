import { updateSettingsAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/queries";
import { Notice, PageHead } from "@/components/ui";
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireAdmin();
  const [settings, q] = await Promise.all([getSettings(), searchParams]);
  return (
    <>
      <PageHead
        title="Settings"
        description="New and intentionally edited collections use these rates. Saved historical records never change."
      />
      <Notice success={q.success} error={q.error} />
      <form action={updateSettingsAction} className="card form-grid">
        <label>
          Pre-wedding commission rate (%)
          <input
            name="preWeddingRate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={settings.preWeddingBps / 100}
            required
          />
        </label>
        <label>
          Rental commission rate (%)
          <input
            name="rentalRate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={settings.rentalBps / 100}
            required
          />
        </label>
        <label>
          Makeup commission rate (%)
          <input
            name="makeupRate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={settings.makeupBps / 100}
            required
          />
        </label>
        <label>
          Monthly sales target (RM)
          <input
            name="monthlyTarget"
            inputMode="decimal"
            defaultValue={(settings.monthlyTargetSen / 100).toFixed(2)}
            required
          />
        </label>
        <label>
          Monthly reward (RM)
          <input
            name="monthlyReward"
            inputMode="decimal"
            defaultValue={(settings.monthlyRewardSen / 100).toFixed(2)}
            required
          />
        </label>
        <div className="full notice">
          Saving settings affects future collections only. Existing allocation
          rates and commission amounts remain preserved.
        </div>
        <button className="button">Save settings</button>
      </form>
    </>
  );
}
