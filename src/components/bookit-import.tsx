"use client";

import { useMemo, useState } from "react";
import { importBookitPaymentsAction } from "@/app/actions";

type Person = { id: string; name: string };

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); if (row.some((x) => x.trim() !== "")) rows.push(row); }
  if (rows.length < 2) return [];
  const headers = rows[0].map((x) => x.trim());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? "").trim()])));
}

function splitNames(value: string) {
  return value.split(/[,;\n]+/).map((x) => x.trim()).filter((x) => x && x !== "-");
}

export function BookitImportForm({ people }: { people: Person[] }) {
  type RawRow = Record<string, string>;
type NormalizedRow = { paymentId: string; paymentDate: string; customerName: string; collectionAmount: string; items: string; catalogueType: string; bookingId: string; teamMembers: string[]; commissionByStaff: { name: string; amount: string }[] };
const [rows, setRows] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  const names = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      for (const name of splitNames(String(row["Team members"] ?? ""))) set.add(name);
      for (const key of Object.keys(row)) {
        if (key.endsWith(" Commissions (RM)")) {
          const name = key.replace(/ Commissions \(RM\)$/, "").trim();
          if (name && row[key] && row[key] !== "-" && Number(String(row[key]).replace(/,/g, "")) > 0) set.add(name);
        }
      }
    }
    return [...set].sort();
  }, [rows]);

  const normalizedRows = useMemo<NormalizedRow[]>(() => rows.map((row) => ({
    paymentId: row["Payment ID"],
    paymentDate: row["Payment date"],
    customerName: row["Customer"],
    collectionAmount: row["Total collection"],
    items: row["Items"],
    catalogueType: row["Catalogue type"],
    bookingId: row["Booking ID"],
    teamMembers: splitNames(String(row["Team members"] ?? "")),
    commissionByStaff: Object.keys(row)
      .filter((key) => key.endsWith(" Commissions (RM)"))
      .map((key) => ({ name: key.replace(/ Commissions \(RM\)$/, "").trim(), amount: row[key] }))
      .filter((x) => x.name && x.amount && x.amount !== "-" && Number(String(x.amount).replace(/,/g, "")) > 0),
  })), [rows]);

  async function onFile(file?: File) {
    setError("");
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("CSV is larger than 5 MB."); return; }
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (!parsed.length || !("Payment ID" in parsed[0]) || !("Payment date" in parsed[0]) || !("Total collection" in parsed[0])) {
        setError("This does not look like the Bookit Commission Report by Payment export.");
        setRows([]);
        return;
      }
      setFileName(file.name);
      setRows(parsed);
      const defaults: Record<string, string> = {};
      const lowerPeople = people.map((p) => ({ ...p, key: p.name.toLowerCase().replace(/\s+/g, " ").trim() }));
      const discovered = new Set<string>();
      for (const row of parsed) {
        for (const name of splitNames(String(row["Team members"] ?? ""))) discovered.add(name);
        for (const key of Object.keys(row)) if (key.endsWith(" Commissions (RM)")) discovered.add(key.replace(/ Commissions \(RM\)$/, "").trim());
      }
      for (const name of discovered) {
        const match = lowerPeople.find((p) => p.key === name.toLowerCase().replace(/\s+/g, " ").trim());
        defaults[name] = match?.id ?? "__IGNORE__";
      }
      setMapping(defaults);
    } catch {
      setError("Unable to read this CSV file.");
    }
  }

  const mappingComplete = names.every((name) => mapping[name] && mapping[name] !== "");
  const missingCommission = normalizedRows.some((row) => row.commissionByStaff.some((x) => !mapping[x.name] || mapping[x.name] === "__IGNORE__"));

  return (
    <div className="stack">
      <div className="card">
        <label>Bookit Commission Report by Payment (CSV)
          <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {fileName ? <p className="muted">{fileName} · {rows.length} payment rows detected.</p> : null}
        {error ? <div className="notice error">{error}</div> : null}
      </div>

      {rows.length ? <>
        <div className="card">
          <h3>Bookit staff mapping</h3>
          <p className="muted">Match each Bookit staff name to a Lovescape account. Use Ignore for names such as “Cashier” if they are not a commission staff account.</p>
          <div className="form-grid">
            {names.map((name) => (
              <label key={name}>{name}
                <select value={mapping[name] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [name]: e.target.value }))}>
                  <option value="">Select staff</option>
                  <option value="__IGNORE__">Ignore</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>Import preview</h3>
          <p className="muted">Payment ID is the duplicate-protection key. Each Bookit payment becomes one Lovescape collection, so one Booking ID can safely have multiple payments.</p>
          <div className="table-wrap"><table><thead><tr><th>Payment ID</th><th>Date</th><th>Customer</th><th>Collected</th><th>Bookit commission</th><th>Booking ID</th></tr></thead>
          <tbody>{normalizedRows.slice(0, 10).map((row) => <tr key={row.paymentId}><td>{row.paymentId}</td><td>{row.paymentDate}</td><td>{row.customerName || "—"}</td><td>RM {row.collectionAmount || "0"}</td><td>{row.commissionByStaff.map((x) => x.name + ": RM " + x.amount).join(", ") || "—"}</td><td>{row.bookingId || "—"}</td></tr>)}</tbody></table></div>
          {rows.length > 10 ? <p className="muted">Showing first 10 rows only.</p> : null}
        </div>

        <form action={importBookitPaymentsAction} className="card">
          <input type="hidden" name="rowsJson" value={JSON.stringify(normalizedRows)} />
          <input type="hidden" name="staffMapping" value={JSON.stringify(mapping)} />\n          <label>Fallback staff for zero-commission rows without a usable Bookit staff name<select name="fallbackStaffId" defaultValue=""><option value="">Do not assign automatically</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>\n          <p className="muted">This is only used for rows with zero Bookit commission and no mapped Team Members, such as system cashier or “-” rows.</p>
          {(!mappingComplete || missingCommission) ? <div className="notice error">Please map every detected Bookit staff name before importing. Commission staff cannot be ignored.</div> : null}
          <button className="button" type="submit" disabled={!mappingComplete || missingCommission}>Import {rows.length} payments</button>
        </form>
      </> : null}
    </div>
  );
}
