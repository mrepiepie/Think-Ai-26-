import type { CompanyProfile, LawAssessment } from "./types";

/**
 * SAMPLE DATA. A fictional startup used for the demo (PRD section 7).
 * The company, its product and its compliance progress are invented;
 * the laws and their obligations come from laws.ts.
 */
export const SAMPLE_COMPANY: CompanyProfile = {
  name: "Parrotfish Hiring Co.",
  tagline: "Fictional startup · sample profile",
  productName: "ShortlistBot",
  productDescription:
    "AI resume screener that ranks job applicants for small employers. The scoring model is licensed from a third-party vendor.",
  employees: 14,
  features: [
    { label: "Ranks resumes", classification: "Resume screening" },
    { label: "Auto-rejects low scores", classification: "Automated employment decision" },
    { label: "Uses applicant location", classification: "Possible ZIP-code proxy" },
  ],
  markets: [
    { label: "New York City", state: "NY" },
    { label: "Illinois", state: "IL" },
    { label: "Colorado", state: "CO" },
    { label: "Texas", state: "TX" },
  ],
  cityPins: [{ label: "NYC", lon: -74.006, lat: 40.7128 }],
};

/**
 * SAMPLE DATA. Per-law compliance status for the fictional company.
 * Deadlines only use dates from laws.ts; "Now" means the law is in force.
 */
export const SAMPLE_ASSESSMENTS: LawAssessment[] = [
  {
    lawId: "nyc-ll144",
    status: "non-compliant",
    reason: "No independent bias audit on file for ShortlistBot.",
    checklist: [
      { task: "Annual independent bias audit", done: false, deadline: "Now (enforced since July 2023)" },
      { task: "Publish audit summary", done: false, deadline: "Now" },
      { task: "Candidate notice on job pages", done: true, deadline: "Now" },
      { task: "Confirm vendor model is covered (you are responsible, not the vendor)", done: false, deadline: "Now" },
    ],
  },
  {
    lawId: "ny-raise",
    status: "not-applicable",
    reason: "Covers frontier developers only.",
    checklist: [],
  },
  {
    lawId: "il-hb3773",
    status: "action-soon",
    reason: "Notice is live; the location feature needs a ZIP-code proxy review.",
    checklist: [
      { task: "Notify applicants that AI is used", done: true, deadline: "Now (in force Jan 1, 2026)" },
      { task: "Review location feature for ZIP-code proxy use", done: false, deadline: "Now" },
      { task: "Check results for discriminatory effect", done: false, deadline: "Now" },
      { task: "Watch for delayed state implementing rules", done: false, deadline: "Pending" },
    ],
  },
  {
    lawId: "tx-traiga",
    status: "compliant",
    reason: "Disclosures in place; no banned uses identified.",
    checklist: [
      { task: "Confirm no banned AI uses", done: true, deadline: "Now (in force Jan 1, 2026)" },
      { task: "Required disclosures published", done: true, deadline: "Now" },
    ],
  },
  {
    lawId: "co-sb26-189",
    status: "action-soon",
    reason: "Automated hiring decisions need disclosures before Jan 1, 2027.",
    checklist: [
      { task: "Draft disclosure for automated hiring decisions", done: true, deadline: "Jan 1, 2027" },
      { task: "Publish disclosure to Colorado applicants", done: false, deadline: "Jan 1, 2027" },
      { task: "Check AG final rules (due by Jan 1, 2027)", done: false, deadline: "Jan 1, 2027" },
    ],
  },
  {
    lawId: "ca-sb243",
    status: "not-applicable",
    reason: "ShortlistBot is not a companion chatbot.",
    checklist: [],
  },
  {
    lawId: "ca-ab2013",
    status: "not-applicable",
    reason: "ShortlistBot is not a generative AI system.",
    checklist: [],
  },
  {
    lawId: "ca-sb53",
    status: "not-applicable",
    reason: "Frontier model developers only; almost never a small business.",
    checklist: [],
  },
];
