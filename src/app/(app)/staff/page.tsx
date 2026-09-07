import { createStaffAction, deleteStaffAction, updateStaffAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { listStaff } from "@/lib/queries";
import { Notice, PageHead, Status } from "@/components/ui";
export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireAdmin();
  const [people, q] = await Promise.all([listStaff(true), searchParams]);
  return (
    <>
      <PageHead
        title="Staff"
        description="Manage staff access. Inactive staff without linked historical records can be removed permanently."
      />
      <Notice success={q.success} error={q.error} />
      <details className="card">
        <summary>Add staff account</summary>
        <form action={createStaffAction} className="form-grid">
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Role
            <select name="role">
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin / Manager</option>
            </select>
          </label>
          <label>
            Initial password
            <input name="password" type="password" minLength={8} required />
          </label>
          <button className="button">Create staff</button>
        </form>
      </details>
      <section className="section stack">
        {people.map((person) => (
          <details className="card" key={person.id}>
            <summary>
              {person.name} · {person.role} ·{" "}
              <Status value={person.active ? "Active" : "Inactive"} />
            </summary>
            <form action={updateStaffAction} className="form-grid">
              <input type="hidden" name="id" value={person.id} />
              <label>
                Name
                <input name="name" defaultValue={person.name} required />
              </label>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  defaultValue={person.email}
                  required
                />
              </label>
              <label>
                Role
                <select name="role" defaultValue={person.role}>
                  <option value="STAFF">Staff</option>
                  <option value="ADMIN">Admin / Manager</option>
                </select>
              </label>
              <label>
                New password (optional)
                <input name="password" type="password" minLength={8} />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={person.active}
                />{" "}
                Active staff
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  name="loginEnabled"
                  defaultChecked={person.loginEnabled}
                />{" "}
                Login access
              </label>
              <button className="button">Save changes</button>
            </form>
            {!person.active && (
              <details className="section">
                <summary>Remove staff permanently</summary>
                <form action={deleteStaffAction} className="stack">
                  <input type="hidden" name="id" value={person.id} />
                  <p className="muted">
                    This permanently removes the staff account. If historical commission,
                    collection, payment, or audit records are linked to this person, removal
                    will be blocked and the account should remain inactive instead.
                  </p>
                  <label>
                    Type DELETE to confirm
                    <input name="confirm" autoComplete="off" />
                  </label>
                  <button className="button danger" type="submit">
                    Remove staff permanently
                  </button>
                </form>
              </details>
            )}
          </details>
        ))}
      </section>
    </>
  );
}
