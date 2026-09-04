"use client";
import { useState } from "react";
export function AllocationFields({
  people,
}: {
  people: Array<{ id: string; name: string }>;
}) {
  const [count, setCount] = useState(1);
  return (
    <div className="full stack">
      <strong>Staff allocation</strong>
      {Array.from({ length: count }, (_, index) => (
        <div className="split-row" key={index}>
          <label>
            Staff
            <select name="staffId" required defaultValue="">
              <option value="" disabled>
                Select staff
              </option>
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
              defaultValue={count === 1 ? "100" : ""}
              required
            />
          </label>
          <button
            className="button danger"
            type="button"
            aria-label="Remove allocation"
            disabled={count === 1}
            onClick={() => setCount((c) => Math.max(1, c - 1))}
          >
            −
          </button>
        </div>
      ))}
      <div>
        <button
          className="button secondary"
          type="button"
          onClick={() => setCount((c) => Math.min(10, c + 1))}
        >
          Add staff split
        </button>
      </div>
      <p className="caption">
        All percentages must total exactly 100%. Sen rounding is assigned
        deterministically to the final allocation.
      </p>
    </div>
  );
}
