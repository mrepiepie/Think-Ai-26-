/**
 * Shared types for all dashboard data.
 *
 * Everything under src/data/ is static sample data today. Swap these files
 * (or replace them with fetchers returning the same shapes) to plug in real
 * data without touching the components.
 */

export type Persona = "company" | "citizen" | "investigator";

/** Two-letter USPS code, e.g. "TX". */
export type StateCode = string;

/* ------------------------------------------------------------------ */
/* Laws (facts from docs/prd.txt section 3 only)                       */
/* ------------------------------------------------------------------ */

/** A law can carry more than one tag, e.g. in force AND challenged. */
export type LawStatusTag = "in-force" | "coming-soon" | "challenged";

export interface LawSource {
  label: string;
  url: string;
}

export interface Law {
  id: string;
  name: string;
  /** e.g. "New York City", "Texas". */
  jurisdiction: string;
  state: StateCode;
  tags: LawStatusTag[];
  /** Human-readable effective-date line, e.g. "In force Jan 1, 2026". */
  effective: string;
  /** ISO date when the law takes or took effect, if the PRD gives a day. */
  effectiveDate?: string;
  /** Who the law covers, in plain words. */
  appliesTo: string;
  summary: string;
  obligations: string[];
  /** null when the PRD gives no verified penalty (or marks it [UNCHECKED]). */
  penalty: string | null;
  enforcement: {
    enforcer: string | null;
    curePeriod: string | null;
    privateRightToSue: string | null;
  };
  /** Extra verified context (court status, rulemaking, audits). */
  notes: string[];
  /** Does this law usually reach a small company? */
  smallCompanyRelevance: "likely" | "depends" | "rarely";
  sources: LawSource[];
}

/* ------------------------------------------------------------------ */
/* Small company persona                                               */
/* ------------------------------------------------------------------ */

export type ComplianceStatus =
  | "compliant"
  | "action-soon"
  | "non-compliant"
  | "not-applicable";

/** Display info for the fictional sample company ("Load example"). */
export interface CompanyProfile {
  name: string;
  tagline: string;
  productName: string;
  productDescription: string;
  employees: number;
}

export interface LawChangeAlert {
  id: string;
  /** Display date as precise as the PRD gives it. */
  dateLabel: string;
  /** Sort key (ISO, approximate when the PRD only gives a month). */
  sortDate: string;
  state: StateCode;
  lawId: string | null;
  kind: "signed" | "replaced" | "challenged" | "rulemaking" | "enforcement" | "delayed";
  headline: string;
  /** How this affects the sample company's product. */
  impact: string;
  affectsYou: boolean;
}

export interface Deadline {
  id: string;
  /** ISO date used for the countdown. */
  date: string;
  /** Display label when the PRD is less precise than a day. */
  dateLabel?: string;
  /** True when the source only gives a month: no day countdown is shown. */
  approximate?: boolean;
  title: string;
  lawId: string | null;
  affectsYou: boolean;
  /** True for invented company-internal tasks (not a law fact). */
  sample: boolean;
}

/* ------------------------------------------------------------------ */
/* Citizen persona                                                     */
/* ------------------------------------------------------------------ */

export type DataCenterStatus = "existing" | "proposed";

export interface DataCenter {
  id: string;
  name: string;
  operator: string;
  status: DataCenterStatus;
  lon: number;
  lat: number;
  state: StateCode;
  capacityMW: number;
  waterMgd: number;
  billImpactPerMonth: [number, number];
  hearingDate: string | null;
}

export interface Headline {
  id: string;
  text: string;
  source: string;
}

export interface OfficialStatement {
  id: string;
  role: string;
  stance: "supports" | "opposes" | "mixed";
  statement: string;
}

export interface GridFact {
  text: string;
  source: LawSource;
}

/* ------------------------------------------------------------------ */
/* Investigator persona                                                */
/* ------------------------------------------------------------------ */

export type ComplaintCategory =
  | "Undisclosed AI use"
  | "Possible discriminatory screening"
  | "Data shared without notice"
  | "Chatbot and minors"
  | "No training-data summary";

export interface Complaint {
  id: string;
  receivedAt: string;
  state: StateCode;
  channel: "Online portal" | "Email" | "Phone" | "Referral";
  companyId: string;
  category: ComplaintCategory;
  summary: string;
}

export interface InvestigatedCompany {
  id: string;
  name: string;
  tool: string;
  /** Total complaints on file per state (sample). */
  complaintsByState: Record<StateCode, number>;
  /** Possibly relevant law per state (law ids from laws.ts). */
  lawByState: Record<StateCode, string | null>;
  trend: "rising" | "steady";
  /** Placeholder data-flow observations (F9). */
  dataFlowNotes: string[];
}
