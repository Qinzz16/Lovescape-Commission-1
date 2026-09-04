import { createStaffAction, updateStaffAction } from "@/app/actions";
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
        description="Manage internal access without deleting historical commission records."
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
          </details>
        ))}
      </section>
    </>
  );
}
