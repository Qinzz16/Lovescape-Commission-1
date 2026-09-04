import type { ReactNode } from "react";
import { formatMoney } from "@/lib/business";
export function Notice({
  success,
  error,
}: {
  success?: string;
  error?: string;
}) {
  if (!success && !error) return null;
  return (
    <div className={`notice ${error ? "error" : "success"}`} role="status">
      {error ?? success}
    </div>
  );
}
export function PageHead({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h2 className="serif">{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </div>
  );
}
export function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="card metric">
      <small>{label}</small>
      <strong>{value}</strong>
      {hint ? <span>{hint}</span> : null}
    </div>
  );
}
export function Money({ value }: { value: number }) {
  return <span className="number">{formatMoney(value)}</span>;
}
export function Status({ value }: { value: string }) {
  const tone =
    value === "Paid" || value === "Reached" || value === "Active"
      ? "green"
      : value === "Partially Paid" || value === "Unlocked"
        ? "yellow"
        : value === "Unpaid" || value === "Locked" || value === "Inactive"
          ? "red"
          : "";
  return <span className={`badge ${tone}`}>{value}</span>;
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
