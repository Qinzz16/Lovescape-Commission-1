"use client";

import { useMemo, useState } from "react";
import { importBookitPaymentsAction } from "@/app/actions";

type Person = { id: string; name: string };
type RawRow = Record<string, string>;
type NormalizedRow = {
  paymentId: string; paymentDate: string; customerName: string; collectionAmount: string; totalCommission: string;
  items: string; catalogueType: string; bookingId: string; teamMembers: string[];
  commissionByStaff: { name: string; amount: string }[];
};
function parseCsv(text: string): RawRow[] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (ch === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); if (row.some((x) => x.trim() !== "")) rows.push(row); }
  if (rows.length < 2) return [];
  const headers = rows[0].map((x) => x.trim());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? "").trim()])));
}
function norm(value: string) { return value.toLowerCase().replace(/\s+/g, " ").trim(); }
function splitNames(value: string) { return value.split(/[,;\n]+/).map((x) => x.trim()).filter((x) => x && x !== "-"); }

export function BookitImportForm({ people }: { people: Person[] }) {
  const [rows, setRows] = useState<RawRow[]>([]); const [fileName, setFileName] = useState(""); const [error, setError] = useState("");
  const normalizedRows = useMemo<NormalizedRow[]>(() => rows.map((row) => ({
    paymentId: row["Payment ID"] ?? "", paymentDate: row["Payment date"] ?? "", customerName: row["Customer"] ?? "",
    collectionAmount: row["Total collection"] ?? "", totalCommission: row["Total commission (RM)"] ?? row["Total commission"] ?? "0",
    items: row["Items"] ?? "", catalogueType: row["Catalogue type"] ?? "", bookingId: row["Booking ID"] ?? "",
    teamMembers: splitNames(row["Team members"] ?? ""),
    commissionByStaff: Object.keys(row).filter((key) => key.endsWith(" Commissions (RM)"))
      .map((key) => ({ name: key.replace(/ Commissions \(RM\)$/, "").trim(), amount: row[key] }))
      .filter((x) => x.name && x.amount && x.amount !== "-" && Number(x.amount.replace(/,/g, "")) > 0),
  })), [rows]));
  const unknownCommissionStaff = useMemo(() => {
    const known = new Set(people.map((p) => norm(p.name)));
    return [...new Set(normalizedRows.flatMap((r) => r.commissionByStaff.map((x) => x.name)).filter((name) => !known.has(norm(name))))].sort();
  }, [normalizedRows, people]);

  async function onFile(file?: File) {
    setError(""); if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("CSV is larger than 5 MB."); return; }
    try {
      const parsed = parseCsv(await file.text());
      if (!parsed.length || !("Payment ID" in parsed[0]) || !("Payment date" in parsed[0]) || !("Total collection" in parsed[0])) {
        setError("Please upload Bookit's Commission Report by Payment export."); setRows([]); return;
      }
      setFileName(file.name); setRows(parsed);
    } catch { setError("Unable to read this CSV file."); }
  }

  return <div className="stack">
    <div className="card">
      <label>Bookit Commission Report by Payment (CSV)
        <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {fileName ? <p className="muted">{fileName} · {rows.length} payments</p> : null}
      {error ? <div className="notice error">{error}</div> : null}
    </div>
    {rows.length ? <>
      <div className="card">
        <h3>Ready to import</h3>
        <p className="muted">Bookit supplies the amount, staff split and commission. Lovescape does not recalculate the 3% / 6% commission.</p>
        {unknownCommissionStaff.length ? <div className="notice error">Commission staff not found in Lovescape Staff: {unknownCommissionStaff.join(", ")}. Add the matching staff account first.</div>
          : <div className="notice success">✓ Commission staff matched automatically.</div>}
        <div className="table-wrap"><table><thead><tr><th>Payment</th><th>Date</th><th>Customer</th><th>Collected</th><th>Bookit commission</th><th>Booking ID</th></tr></thead>
          <tbody>{normalizedRows.slice(0, 10).map((row) => <tr key={row.paymentId}><td>{row.paymentId}</td><td>{row.paymentDate}</td><td>{row.customerName || "—"}</td><td>RM {row.collectionAmount || "0"}</td><td>{row.commissionByStaff.map((x) => x.name + ": RM " + x.amount).join(", ") || "—"}</td><td>{row.bookingId || "—"}</td></tr>)}</tbody>
        </table></div>
        {rows.length > 10 ? <p className="muted">Showing first 10 rows only.</p> : null}
      </div>
      <form action={importBookitPaymentsAction} className="card">
        <input type="hidden" name="rowsJson" value={JSON.stringify(normalizedRows)} />
        <p><strong>Nothing to key in for commission.</strong> Amount, staff commission and Booking ID come from Bookit.</p>
        <p className="muted">After import, edit only the Booking Date and Wedding / Pickup Date where needed. Wedding / Pickup Date controls the second commission portion.</p>
        <button className="button" type="submit" disabled={unknownCommissionStaff.length > 0}>Import {rows.length} payments</button>
      </form>
    </> : null}
  </div>;
}
