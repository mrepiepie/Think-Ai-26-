import type { Complaint, InvestigatedCompany } from "./types";

/**
 * SAMPLE DATA. Every company here is FICTIONAL. Complaints are
 * unverified allegations invented for the demo; a complaint is not a
 * finding of a violation.
 */
export const INVESTIGATED_COMPANIES: InvestigatedCompany[] = [
  {
    id: "brindlewick",
    name: "Brindlewick Staffing AI",
    tool: "Resume screener",
    complaintsByState: { TX: 14, IL: 6, CO: 3, NY: 2 },
    lawByState: { TX: "tx-traiga", IL: "il-hb3773", CO: "co-sb26-189", NY: "nyc-ll144" },
    trend: "rising",
    dataFlowNotes: [
      "Placeholder trace: applicant PDFs sent to an unlisted third-party parser",
      "Placeholder trace: privacy policy names one processor; two observed",
    ],
  },
  {
    id: "morrowgate",
    name: "Morrowgate Lending",
    tool: "Automated loan decisions",
    complaintsByState: { CO: 9, TX: 4 },
    lawByState: { CO: "co-sb26-189", TX: "tx-traiga" },
    trend: "rising",
    dataFlowNotes: ["Placeholder trace: no traces captured yet"],
  },
  {
    id: "pixelmoth",
    name: "Pixelmoth Companions",
    tool: "Companion chatbot",
    complaintsByState: { CA: 8, TX: 2 },
    lawByState: { CA: "ca-sb243", TX: "tx-traiga" },
    trend: "steady",
    dataFlowNotes: ["Placeholder trace: chat logs synced to analytics vendor"],
  },
  {
    id: "quillsby",
    name: "Quillsby Data Co.",
    tool: "Generative text model",
    complaintsByState: { CA: 5 },
    lawByState: { CA: "ca-ab2013" },
    trend: "steady",
    dataFlowNotes: ["Placeholder trace: no traces captured yet"],
  },
  {
    id: "tarnhollow",
    name: "Tarnhollow Insure Tech",
    tool: "Insurance risk scoring",
    complaintsByState: { CO: 2, IL: 1 },
    lawByState: { CO: "co-sb26-189", IL: null },
    trend: "steady",
    dataFlowNotes: ["Placeholder trace: no traces captured yet"],
  },
];

export const SAMPLE_COMPLAINTS: Complaint[] = [
  { id: "C-1043", receivedAt: "2026-11-07T09:12:00Z", state: "TX", channel: "Online portal", companyId: "brindlewick", category: "Undisclosed AI use", summary: "Rejected within minutes of applying; no notice that software screened the application." },
  { id: "C-1042", receivedAt: "2026-11-07T07:48:00Z", state: "CO", channel: "Email", companyId: "morrowgate", category: "Undisclosed AI use", summary: "Loan denied by an automated system; applicant was not told how the decision was made." },
  { id: "C-1041", receivedAt: "2026-11-06T22:05:00Z", state: "CA", channel: "Online portal", companyId: "pixelmoth", category: "Chatbot and minors", summary: "Parent reports a 14-year-old was never told the companion app was AI." },
  { id: "C-1040", receivedAt: "2026-11-06T18:30:00Z", state: "TX", channel: "Online portal", companyId: "brindlewick", category: "Possible discriminatory screening", summary: "Applicants from one area code all rejected for the same role." },
  { id: "C-1039", receivedAt: "2026-11-06T15:11:00Z", state: "IL", channel: "Referral", companyId: "brindlewick", category: "Possible discriminatory screening", summary: "Advocacy group says ZIP code appears to drive screening scores." },
  { id: "C-1038", receivedAt: "2026-11-06T11:42:00Z", state: "TX", channel: "Phone", companyId: "brindlewick", category: "Data shared without notice", summary: "Resume content appeared in a third-party recruiter database." },
  { id: "C-1037", receivedAt: "2026-11-05T20:17:00Z", state: "CA", channel: "Email", companyId: "quillsby", category: "No training-data summary", summary: "No training-data summary found on the developer's website." },
  { id: "C-1036", receivedAt: "2026-11-05T13:03:00Z", state: "CO", channel: "Online portal", companyId: "morrowgate", category: "Possible discriminatory screening", summary: "Similar applicants received different automated outcomes." },
  { id: "C-1035", receivedAt: "2026-11-05T09:55:00Z", state: "NY", channel: "Email", companyId: "brindlewick", category: "Undisclosed AI use", summary: "No bias audit summary published for the screening tool." },
  { id: "C-1034", receivedAt: "2026-11-04T16:21:00Z", state: "CO", channel: "Email", companyId: "tarnhollow", category: "Undisclosed AI use", summary: "Premium quote changed after an automated review with no explanation." },
  { id: "C-1033", receivedAt: "2026-11-04T10:08:00Z", state: "CA", channel: "Online portal", companyId: "pixelmoth", category: "Chatbot and minors", summary: "No break reminder during a multi-hour session by a minor." },
  { id: "C-1032", receivedAt: "2026-11-03T14:40:00Z", state: "TX", channel: "Online portal", companyId: "morrowgate", category: "Data shared without notice", summary: "Applicant data appears to have been shared with a marketing partner." },
];

/** Companies with at least this many complaints are flagged (F19). */
export const FLAG_THRESHOLD = 8;
