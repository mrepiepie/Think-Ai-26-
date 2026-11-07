import type { ComplianceStatus, Law, LawStatusTag } from "@/data/types";

export type LawFilters = Record<LawStatusTag, boolean>;

export const DEFAULT_FILTERS: LawFilters = {
  "in-force": true,
  "coming-soon": true,
  challenged: true,
};

export const TAG_LABEL: Record<LawStatusTag, string> = {
  "in-force": "In force",
  "coming-soon": "Coming soon",
  challenged: "Challenged in court",
};

/**
 * Generic status labels (legend, counts). We never say "compliant" or
 * "non-compliant": the app only knows which duties the user has ticked.
 * Use statusText() when a specific amber date is known.
 */
export const STATUS_LABEL: Record<ComplianceStatus, string> = {
  compliant: "All confirmed",
  "action-soon": "Action needed by a later date",
  "non-compliant": "Action needed now",
  "not-applicable": "Not applicable",
};

const DAY_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "2027-01-01" -> "Jan 1, 2027". */
export function formatDay(iso: string): string {
  return DAY_FMT.format(new Date(iso + "T00:00:00Z"));
}

/**
 * Label for a status. Amber shows the earliest effective date among the
 * unchecked future duties ("Action needed by Jan 1, 2027"); amber with no
 * open duty (only items needing review) shows "Review needed".
 */
export function statusText(status: ComplianceStatus, dueBy: string | null): string {
  if (status === "action-soon") return dueBy ? `Action needed by ${formatDay(dueBy)}` : "Review needed";
  return STATUS_LABEL[status];
}

/** CSS color token for each compliance status (see globals.css). */
export const STATUS_COLOR: Record<ComplianceStatus, string> = {
  compliant: "var(--status-compliant)",
  "action-soon": "var(--status-soon)",
  "non-compliant": "var(--status-noncompliant)",
  "not-applicable": "var(--status-na)",
};

export function lawPassesFilters(law: Law, filters: LawFilters): boolean {
  return law.tags.some((tag) => filters[tag]);
}
