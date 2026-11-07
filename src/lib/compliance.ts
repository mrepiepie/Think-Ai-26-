import { LAWS_BY_ID } from "@/data/laws";
import type {
  ComplianceStatus,
  Law,
  LawAssessment,
  LawStatusTag,
} from "@/data/types";

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

const SEVERITY: Record<ComplianceStatus, number> = {
  "non-compliant": 3,
  "action-soon": 2,
  compliant: 1,
  "not-applicable": 0,
};

export function lawPassesFilters(law: Law, filters: LawFilters): boolean {
  return law.tags.some((tag) => filters[tag]);
}

export interface StateRollup {
  status: ComplianceStatus;
  /** Assessments for this state that pass the filters. */
  items: { law: Law; assessment: LawAssessment }[];
}

/**
 * Roll per-law assessments up to one status per state (worst wins).
 * States with no tracked law passing the filters are omitted.
 */
export function rollupByState(
  assessments: LawAssessment[],
  filters: LawFilters,
): Record<string, StateRollup> {
  const out: Record<string, StateRollup> = {};
  for (const assessment of assessments) {
    const law = LAWS_BY_ID[assessment.lawId];
    if (!law || !lawPassesFilters(law, filters)) continue;
    const entry = (out[law.state] ??= { status: "not-applicable", items: [] });
    entry.items.push({ law, assessment });
    if (SEVERITY[assessment.status] > SEVERITY[entry.status]) {
      entry.status = assessment.status;
    }
  }
  return out;
}
