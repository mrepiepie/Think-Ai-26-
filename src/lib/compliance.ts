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

export const STATUS_LABEL: Record<ComplianceStatus, string> = {
  compliant: "Compliant",
  "action-soon": "Action needed soon",
  "non-compliant": "Non-compliant",
  "not-applicable": "Not applicable",
};

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
