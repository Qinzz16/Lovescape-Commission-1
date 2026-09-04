import { NextRequest } from "next/server";
import { currentAccount } from "@/lib/auth";
import { malaysiaMonthFromInstant } from "@/lib/business";
import { monthlySummaries } from "@/lib/queries";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const account = await currentAccount();
  if (!account)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (account.role !== "ADMIN")
    return Response.json({ error: "Forbidden" }, { status: 403 });
  const month =
    request.nextUrl.searchParams.get("month") ||
    malaysiaMonthFromInstant(new Date());
  if (!/^\d{4}-\d{2}$/.test(month))
    return Response.json({ error: "Invalid month" }, { status: 400 });
  const rows = (await monthlySummaries(month)).map((r) => ({
    "Staff Name": r.staff.name,
    Month: month,
    "Total Collected Sales": r.totalCollectedSen / 100,
    "Pre-wedding Collected": r.preWeddingSen / 100,
    "Rental Collected": r.rentalSen / 100,
    "Makeup Collected": r.makeupSen / 100,
    Commission: r.commissionSen / 100,
    "RM30K Reward": r.rewardSen / 100,
    "Total Payable": r.totalPayableSen / 100,
    "Paid Amount": r.paidSen / 100,
    "Outstanding Amount": r.outstandingSen / 100,
    "Payment Status": r.status,
  }));
  const format = request.nextUrl.searchParams.get("format");
  if (format === "xls") {
    const headers = Object.keys(rows[0] ?? { "Staff Name": "", Month: "" });
    const htmlEscape = (value: unknown) =>
      String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    const workbook = `<!doctype html><html><head><meta charset="utf-8"></head><body><table><thead><tr>${headers.map((header) => `<th>${htmlEscape(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((key) => `<td>${htmlEscape(row[key as keyof typeof row])}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
    return new Response(workbook, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="lovescape-commission-${month}.xls"`,
      },
    });
  }
  const headers = Object.keys(rows[0] ?? { "Staff Name": "", Month: "" });
  const escape = (value: unknown) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [
    headers.map(escape).join(","),
    ...rows.map((row) =>
      headers.map((key) => escape(row[key as keyof typeof row])).join(","),
    ),
  ].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lovescape-commission-${month}.csv"`,
    },
  });
}
