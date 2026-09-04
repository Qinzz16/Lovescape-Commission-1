"use client";
import { useState } from "react";
export function EditableAllocations({
  people,
  initial,
}: {
  people: Array<{ id: string; name: string }>;
  initial: Array<{ staffId: string; allocationBps: number }>;
}) {
  const [rows, setRows] = useState(initial);
  return (
    <div className="full stack">
      <strong>Staff allocation</strong>
      {rows.map((row, index) => (
        <div className="split-row" key={index}>
          <label>
            Staff
            <select name="staffId" required defaultValue={row.staffId}>
              <option value="">Select staff</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Percent
            <input
              name="allocationPercent"
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              defaultValue={row.allocationBps / 100}
              required
            />
          </label>
          <button
            className="button danger"
            type="button"
            disabled={rows.length === 1}
            onClick={() =>
              setRows((current) => current.filter((_, i) => i !== index))
            }
          >
            −
          </button>
        </div>
      ))}
      <div>
        <button
          className="button secondary"
          type="button"
          onClick={() =>
            setRows((current) => [
              ...current,
              { staffId: "", allocationBps: 0 },
            ])
          }
        >
          Add staff split
        </button>
      </div>
    </div>
  );
}
