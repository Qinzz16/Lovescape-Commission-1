import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions";
import { currentAccount } from "@/lib/auth";
import { Notice } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await currentAccount()) redirect("/dashboard");
  const query = await searchParams;
  return (
    <main className="login">
      <section className="login-card">
        <h1 className="serif">Lovescape</h1>
        <p>Private commission management for the Lovescape team.</p>
        <Notice error={query.error} />
        <form action={loginAction}>
          <label>
            Email
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button className="button" type="submit">
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
