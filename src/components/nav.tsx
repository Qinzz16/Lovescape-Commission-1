import Link from "next/link";
import { logoutAction } from "@/app/actions";

const adminLinks = [
  ["/collections", "Collections"],
  ["/monthly-commission", "Monthly Commissions"],
  ["/history", "Commission History"],
  ["/reports", "Export Data"],
];

const staffLinks = [
  ["/my-commission", "My Commission"],
  ["/my-history", "My History"],
];

export function Nav({
  account,
}: {
  account: { name: string; email: string; role: "ADMIN" | "STAFF" };
}) {
  const links = account.role === "ADMIN" ? adminLinks : staffLinks;
  return (
    <aside className="sidebar">
      <div className="brand">
        <h1 className="serif">Lovescape</h1>
        <p>Commission</p>
      </div>
      <nav className="nav" aria-label="Main navigation">
        {links.map(([href, label]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="account">
        <strong>{account.name}</strong>
        <span>{account.role === "ADMIN" ? "Admin / Manager" : "Staff"}</span>
        <form action={logoutAction}>
          <button className="link-button">Sign out</button>
        </form>
      </div>
    </aside>
  );
}
