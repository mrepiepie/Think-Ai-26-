/**
 * Reviewed list of real, dated law events. REAL DATA, not sample data.
 *
 * Rules (enforced by src/lib/law-alerts.test.ts):
 * - Every fact comes from the official law text (data/laws/*.txt) or
 *   docs/prd.txt section 3. If a fact has no source there, leave it out.
 * - `evidence` holds the exact words backing the event. The test checks them
 *   against that source with verifyQuote.
 * - Events never address the reader. "How this affects you" is computed from
 *   the match result in src/lib/law-alerts.ts.
 */

export type LawEventType =
  | "signed"
  | "effective"
  | "delayed"
  | "stayed"
  | "challenged"
  | "court-date"
  | "repealed-replaced"
  | "rulemaking"
  | "registration"
  | "enforcement";

export type LawEventSourceKind = "Official law text" | "PRD section 3";

export interface LawEvent {
  id: string;
  /** "YYYY-MM-DD", or "YYYY-MM" when the source only gives a month. */
  date: string;
  /** Shown instead of the date when the source is less exact, e.g. "Mid-2026". */
  dateLabel?: string;
  lawId: string;
  type: LawEventType;
  description: string;
  sourceUrl: string;
  sourceKind: LawEventSourceKind;
  /** Exact words from the source that back this event. */
  evidence: string;
}

const OFFICIAL = {
  nycLl144: "https://legistar.council.nyc.gov/View.ashx?M=F&ID=10369162&GUID=F25C6911-8267-48AF-9048-180D44091624",
  txTraiga: "https://capitol.texas.gov/tlodocs/89R/billtext/html/HB00149F.htm",
  coSb26189: "https://leg.colorado.gov/laws/session-laws/SB26-189/131/download",
  caSb243: "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260SB243",
  caAb2013: "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202320240AB2013",
  nyRaise: "https://nyassembly.gov/leg/?default_fld=&leg_video=&bn=S08828&term=2025&Summary=Y&Actions=Y&Text=Y",
};

/**
 * Citations given in PRD section 3. The PRD lists them per law, not per fact,
 * so each event points at the listed page that was read and states that fact.
 */
const PRD = {
  ilDuaneMorris:
    "https://www.duanemorris.com/alerts/illinois_enacts_artificial_intelligence_law_focused_employment_practices_0824.html",
  ilNatLawReview: "https://natlawreview.com/article/states-take-aim-ai-employment-decisions-illinoiss-disclosure-and-anti",
  caSb53: "https://www.vaquill.ai/blog/california-ai-laws-explained-sb-53-and-the-rest",
  caAb2013: "https://www.recordinglaw.com/us-laws/ai-laws/california-ai-laws/",
  caSb243: "https://calawyers.org/privacy-law/regulatory-focus-on-ai-companion-character-chatbots/",
  coSecurityBoulevard:
    "https://securityboulevard.com/2026/11/us-state-ai-laws-in-force-what-an-enterprise-deployer-actually-owes/",
  coStackCyber: "https://stackcyber.com/posts/ai-colorado-laws",
  coWardenAi: "https://www.warden-ai.com/resources/colorado-sb-26-189-enforcement-stay",
  nycDcwp: "https://www.nyc.gov/site/dca/about/automated-employment-decision-tools.page",
  nycDlaPiper:
    "https://www.dlapiper.com/en/insights/publications/2026/01/critical-audit-of-nyc-ai-hiring-law-signals-increased-risk-for-employers",
  nyRaise: "https://www.jdsupra.com/legalnews/new-york-finalizes-raise-act-for-8270433/",
  nyRaiseGuide: "https://secureprivacy.ai/blog/new-york-ai-law-2026-guide",
};

export const LAW_EVENTS: LawEvent[] = [
  {
    id: "ca-sb243-reporting",
    date: "2027-07-01",
    lawId: "ca-sb243",
    type: "effective",
    description: "California SB 243: annual operator reporting to the state begins.",
    sourceUrl: OFFICIAL.caSb243,
    sourceKind: "Official law text",
    evidence: "Beginning July 1, 2027, an operator shall annually report to the office all of the following",
  },
  {
    id: "co-final-rules-due",
    date: "2027-01-01",
    dateLabel: "By Jan 1, 2027",
    lawId: "co-sb26-189",
    type: "rulemaking",
    description: "Colorado Attorney General must adopt rules under SB 26-189 by this date.",
    sourceUrl: OFFICIAL.coSb26189,
    sourceKind: "Official law text",
    evidence: "ON OR BEFORE JANUARY 1, 2027, THE ATTORNEY GENERAL SHALL ADOPT RULES TO CLARIFY AND IMPLEMENT",
  },
  {
    id: "co-effective",
    date: "2027-01-01",
    lawId: "co-sb26-189",
    type: "effective",
    description: "Colorado SB 26-189 takes effect.",
    sourceUrl: OFFICIAL.coSb26189,
    sourceKind: "Official law text",
    evidence: "this act takes effect January 1, 2027",
  },
  {
    id: "ny-raise-effective",
    date: "2027-01-01",
    lawId: "ny-raise",
    type: "effective",
    description: "New York RAISE Act takes effect.",
    sourceUrl: OFFICIAL.nyRaise,
    sourceKind: "Official law text",
    evidence: "This act shall take effect [on the ninetieth day after it shall have become a law] January 1, 2027",
  },
  {
    id: "ca-ab2013-argument",
    date: "2026-11-18",
    lawId: "ca-ab2013",
    type: "court-date",
    description: "Ninth Circuit argument in xAI's challenge to California AB 2013.",
    sourceUrl: PRD.caAb2013,
    sourceKind: "PRD section 3",
    evidence: "Ninth Circuit argument is set for Nov 18, 2026",
  },
  {
    id: "ny-raise-registration",
    date: "2026-11",
    lawId: "ny-raise",
    type: "registration",
    description: "New York RAISE Act developer registration begins, per a PRD source. This date is not in the official text.",
    sourceUrl: PRD.nyRaiseGuide,
    sourceKind: "PRD section 3",
    evidence: "Developer registration begins Nov 2026",
  },
  {
    id: "co-rulemaking-hearing",
    date: "2026-10-26",
    lawId: "co-sb26-189",
    type: "rulemaking",
    description: "Colorado Attorney General held the SB 26-189 rulemaking hearing.",
    sourceUrl: PRD.coSecurityBoulevard,
    sourceKind: "PRD section 3",
    evidence: "AG rulemaking hearing held Oct 26, 2026",
  },
  {
    id: "tx-complaint-portal",
    date: "2026-09-01",
    lawId: "tx-traiga",
    type: "enforcement",
    description: "Deadline for the Texas Attorney General to post TRAIGA's online complaint mechanism.",
    sourceUrl: OFFICIAL.txTraiga,
    sourceKind: "Official law text",
    evidence:
      "Not later than September 1, 2026, the attorney general shall post on the attorney general's Internet website the information and online mechanism",
  },
  {
    id: "il-rules-delayed",
    // Sort position only: the PRD says "mid-2026" and names no month.
    date: "2026-06",
    dateLabel: "Mid-2026",
    lawId: "il-hb3773",
    type: "delayed",
    description: "Illinois implementing rules for HB 3773 were still delayed.",
    sourceUrl: PRD.ilNatLawReview,
    sourceKind: "PRD section 3",
    evidence: "implementing rules were still delayed as of mid-2026",
  },
  {
    id: "co-sb26-189-approved",
    date: "2026-05-14",
    lawId: "co-sb26-189",
    type: "signed",
    description: "Colorado SB 26-189 approved.",
    sourceUrl: OFFICIAL.coSb26189,
    sourceKind: "Official law text",
    evidence: "support and maintenance of the departments of the state and state institutions. Approved: May 14, 2026",
  },
  {
    id: "co-sb24-205-replaced",
    date: "2026-05-14",
    lawId: "co-sb26-189",
    type: "repealed-replaced",
    description: "Colorado SB 24-205 repealed and replaced by SB 26-189.",
    sourceUrl: PRD.coStackCyber,
    sourceKind: "PRD section 3",
    evidence: "repealed and replaced by SB 26-189, signed May 14, 2026",
  },
  {
    id: "co-sb26-189-stay-covers",
    date: "2026-04-27",
    lawId: "co-sb26-189",
    type: "stayed",
    description:
      "Enforcement of Colorado SB 26-189 is also paused: the Apr 27, 2026 stay's terms cover legislation replacing SB 24-205. The Jan 1, 2027 effective date is unchanged.",
    sourceUrl: PRD.coWardenAi,
    sourceKind: "PRD section 3",
    evidence:
      "Enforcement of SB 26-189 is also paused: the Apr 27, 2026 stay's terms cover legislation replacing SB 24-205.",
  },
  {
    id: "co-sb24-205-stayed",
    date: "2026-04-27",
    lawId: "co-sb26-189",
    type: "stayed",
    description: "Federal magistrate stayed enforcement of Colorado SB 24-205, the law SB 26-189 later replaced.",
    sourceUrl: PRD.coStackCyber,
    sourceKind: "PRD section 3",
    evidence: "federal magistrate stayed enforcement (Apr 27)",
  },
  {
    id: "co-sb24-205-challenged",
    date: "2026-04-09",
    lawId: "co-sb26-189",
    type: "challenged",
    description: "xAI sued over Colorado SB 24-205, the law SB 26-189 later replaced.",
    sourceUrl: PRD.coStackCyber,
    sourceKind: "PRD section 3",
    evidence: "delayed from Feb 1 to June 30, 2026 -> xAI sued (Apr 9, 2026)",
  },
  {
    id: "ny-raise-rewritten",
    date: "2026-03-27",
    lawId: "ny-raise",
    type: "signed",
    description: "New York RAISE Act rewritten.",
    sourceUrl: PRD.nyRaise,
    sourceKind: "PRD section 3",
    evidence: "signed Dec 19, 2025, rewritten Mar 27, 2026",
  },
  {
    id: "ca-ab2013-not-blocked",
    date: "2026-03",
    lawId: "ca-ab2013",
    type: "challenged",
    description: "Federal judge refused to block California AB 2013 in xAI's lawsuit.",
    sourceUrl: PRD.caAb2013,
    sourceKind: "PRD section 3",
    evidence: "a federal judge refused to block the law (March 2026)",
  },
  {
    id: "il-effective",
    date: "2026-01-01",
    lawId: "il-hb3773",
    type: "effective",
    description: "Illinois HB 3773 in effect.",
    sourceUrl: PRD.ilDuaneMorris,
    sourceKind: "PRD section 3",
    evidence: "Illinois HB 3773 (in effect Jan 1, 2026)",
  },
  {
    id: "tx-effective",
    date: "2026-01-01",
    lawId: "tx-traiga",
    type: "effective",
    description: "Texas TRAIGA (HB 149) takes effect.",
    sourceUrl: OFFICIAL.txTraiga,
    sourceKind: "Official law text",
    evidence: "SECTION 10. This Act takes effect January 1, 2026",
  },
  {
    id: "ca-sb243-effective",
    date: "2026-01-01",
    lawId: "ca-sb243",
    type: "effective",
    description: "California SB 243 in force.",
    sourceUrl: PRD.caSb243,
    sourceKind: "PRD section 3",
    evidence: "California SB 243 (in force Jan 1, 2026)",
  },
  {
    id: "ca-ab2013-effective",
    date: "2026-01-01",
    lawId: "ca-ab2013",
    type: "effective",
    description: "California AB 2013: first deadline for developers to post training-data documentation.",
    sourceUrl: OFFICIAL.caAb2013,
    sourceKind: "Official law text",
    evidence: "On or before January 1, 2026, and before each time thereafter that a generative artificial intelligence system",
  },
  {
    id: "ca-sb53-effective",
    date: "2026-01-01",
    lawId: "ca-sb53",
    type: "effective",
    description: "California SB 53 in force.",
    sourceUrl: PRD.caSb53,
    sourceKind: "PRD section 3",
    evidence: "California SB 53 (in force Jan 1, 2026)",
  },
  {
    id: "nyc-comptroller-audit",
    date: "2025-12",
    lawId: "nyc-ll144",
    type: "enforcement",
    description: "New York State Comptroller audit found New York City's complaint-driven LL144 enforcement was weak.",
    sourceUrl: PRD.nycDlaPiper,
    sourceKind: "PRD section 3",
    evidence: "A December 2025 New York State Comptroller audit found the city's complaint-driven enforcement was weak",
  },
  {
    id: "ny-raise-signed",
    date: "2025-12-19",
    lawId: "ny-raise",
    type: "signed",
    description: "New York RAISE Act signed.",
    sourceUrl: PRD.nyRaise,
    sourceKind: "PRD section 3",
    evidence: "signed Dec 19, 2025, rewritten Mar 27, 2026",
  },
  {
    id: "nyc-enforced",
    date: "2023-07-05",
    lawId: "nyc-ll144",
    type: "enforcement",
    description: "New York City's DCWP begins enforcing Local Law 144.",
    sourceUrl: PRD.nycDcwp,
    sourceKind: "PRD section 3",
    evidence: "DCWP will begin enforcement of this law and rule on July 5, 2023",
  },
  {
    id: "nyc-effective",
    date: "2023-01-01",
    lawId: "nyc-ll144",
    type: "effective",
    description: "New York City Local Law 144 takes effect.",
    sourceUrl: OFFICIAL.nycLl144,
    sourceKind: "Official law text",
    evidence: "This local law takes effect on January 1, 2023",
  },
];
