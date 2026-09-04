import { requireAccount } from "@/lib/auth";
import { Nav } from "@/components/nav";
export const dynamic = "force-dynamic";
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = await requireAccount();
  return (
    <div className="shell">
      <Nav account={account} />
      <main className="content">{children}</main>
    </div>
  );
}
