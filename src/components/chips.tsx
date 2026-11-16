import type { IssueStatus } from "@/lib/issues/domain";

/** Status, severity and area each have their own light colour family, so a row reads at a glance. */
export function StatusChip({ status, label }: Readonly<{ status: IssueStatus; label: string }>) {
  return <span className={`chip chip-status st-${status}`}>{label}</span>;
}

export function SeverityChip({ severity, label }: Readonly<{ severity: string; label: string }>) {
  return <span className={`chip chip-sev sev-${severity}`}>{label}</span>;
}

export function AreaChip({ side, label }: Readonly<{ side: string; label: string }>) {
  return <span className={`chip chip-area area-${side}`}>{label}</span>;
}
