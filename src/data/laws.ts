import type { Law } from "./types";

/**
 * Law facts. SOURCE: docs/prd.txt section 3 (verified 7 Nov 2026).
 * Do not add laws, dates or penalties that are not in that section.
 * Penalties the PRD marks [UNCHECKED] are left out (penalty: null).
 *
 * Note: the "sources" are the citations given in the PRD. "Read the law"
 * links use the official text from data/laws/sources.json instead (see
 * law-library.ts), and verified rule cards from the law reader
 * (npm run extract-laws) override obligations, penalty and enforcer.
 */
export const LAWS: Law[] = [
  {
    id: "nyc-ll144",
    name: "NYC Local Law 144",
    jurisdiction: "New York City",
    state: "NY",
    tags: ["in-force"],
    effective: "Enforced since July 2023",
    effectiveDate: "2023-07-01",
    appliesTo: "Employers using AI hiring tools in New York City",
    summary:
      "AI hiring tools need an annual independent bias audit, a public audit summary, and notice to candidates.",
    obligations: [
      "Get an annual independent bias audit of the AI hiring tool",
      "Publish a summary of the audit",
      "Give candidates notice that the tool is used",
    ],
    penalty: "Up to $1,500 per violation per day",
    enforcement: {
      enforcer: "New York City (complaint-driven)",
      curePeriod: null,
      privateRightToSue: null,
    },
    notes: [
      "The employer is responsible even if it bought the tool from a vendor.",
      "A December 2025 New York State Comptroller audit found the city's complaint-driven enforcement was weak (only two AEDT complaints received in the audit period).",
    ],
    smallCompanyRelevance: "likely",
    sources: [
      {
        label: "NY State Comptroller audit (Dec 2025)",
        url: "https://www.osc.ny.gov/state-agencies/audits/2025/12/02/enforcement-local-law-144-automated-employment-decision-tools",
      },
      {
        label: "DLA Piper summary",
        url: "https://www.dlapiper.com/en/insights/publications/2026/01/critical-audit-of-nyc-ai-hiring-law-signals-increased-risk-for-employers",
      },
    ],
  },
  {
    id: "il-hb3773",
    name: "Illinois HB 3773",
    jurisdiction: "Illinois",
    state: "IL",
    tags: ["in-force"],
    effective: "In force Jan 1, 2026",
    effectiveDate: "2026-01-01",
    appliesTo:
      "Employers using AI in hiring, promotion, firing and other employment decisions",
    summary:
      "Bans AI with a discriminatory effect in employment decisions, and requires notice when AI is used.",
    obligations: [
      "Do not use AI that has a discriminatory effect in hiring, promotion, firing or other employment decisions",
      "Do not use ZIP codes as a proxy",
      "Notify workers and applicants when AI is used",
    ],
    penalty: null,
    enforcement: { enforcer: null, curePeriod: null, privateRightToSue: null },
    notes: ["The state's implementing rules were still delayed as of mid-2026."],
    smallCompanyRelevance: "likely",
    sources: [
      {
        label: "Duane Morris alert",
        url: "https://www.duanemorris.com/alerts/illinois_enacts_artificial_intelligence_law_focused_employment_practices_0824.html",
      },
      {
        label: "National Law Review",
        url: "https://natlawreview.com/article/states-take-aim-ai-employment-decisions-illinoiss-disclosure-and-anti",
      },
    ],
  },
  {
    id: "tx-traiga",
    name: "Texas TRAIGA (HB 149)",
    jurisdiction: "Texas",
    state: "TX",
    tags: ["in-force"],
    effective: "In force Jan 1, 2026",
    effectiveDate: "2026-01-01",
    appliesTo: "Developers and deployers of AI systems in Texas",
    summary: "Bans certain harmful AI uses and requires disclosures.",
    obligations: [
      "Do not use AI for the uses the law bans",
      "Make the required disclosures",
    ],
    penalty:
      "$10k–$200k per violation, plus daily amounts for continuing violations",
    enforcement: {
      enforcer: "Texas Attorney General (exclusive)",
      curePeriod: "60 days",
      privateRightToSue: "No",
    },
    notes: [
      "The AG had to launch a public online complaint portal by Sept 1, 2026.",
    ],
    smallCompanyRelevance: "likely",
    sources: [
      {
        label: "TRAIGA explained",
        url: "https://casrai.org/guides/texas-traiga-explained",
      },
    ],
  },
  {
    id: "co-sb26-189",
    name: "Colorado SB 26-189",
    jurisdiction: "Colorado",
    state: "CO",
    tags: ["coming-soon"],
    effective: "Takes effect Jan 1, 2027",
    effectiveDate: "2027-01-01",
    appliesTo:
      "Automated decisions in areas like jobs, loans, housing and insurance",
    summary:
      "A narrower disclosure law for automated decisions. Replaces the original Colorado AI Act (SB 24-205), which never took effect.",
    obligations: [
      "Make the required disclosures for automated decisions (jobs, loans, housing, insurance)",
    ],
    penalty: null,
    enforcement: {
      enforcer: "Colorado Attorney General only",
      curePeriod: "60 days",
      privateRightToSue: null,
    },
    notes: [
      "SB 24-205 was delayed, challenged by xAI (Apr 9, 2026), stayed (Apr 27), then repealed and replaced by SB 26-189, signed May 14, 2026.",
      "AG rulemaking hearing held Oct 26, 2026; final rules due by Jan 1, 2027.",
    ],
    smallCompanyRelevance: "likely",
    sources: [
      {
        label: "Security Boulevard (Nov 2026)",
        url: "https://securityboulevard.com/2026/11/us-state-ai-laws-in-force-what-an-enterprise-deployer-actually-owes/",
      },
      {
        label: "Stack Cyber",
        url: "https://stackcyber.com/posts/ai-colorado-laws",
      },
    ],
  },
  {
    id: "ca-sb243",
    name: "California SB 243",
    jurisdiction: "California",
    state: "CA",
    tags: ["in-force"],
    effective: "In force Jan 1, 2026",
    effectiveDate: "2026-01-01",
    appliesTo: "Companion chatbots",
    summary:
      "Companion chatbots must tell known minors they are talking to AI, remind them to take breaks, and follow crisis protocols.",
    obligations: [
      "Tell known minors they are talking to AI",
      "Remind minors to take a break at least every 3 hours",
      "Follow crisis protocols",
    ],
    penalty: null,
    enforcement: { enforcer: null, curePeriod: null, privateRightToSue: null },
    notes: [],
    smallCompanyRelevance: "depends",
    sources: [
      {
        label: "California Lawyers Association",
        url: "https://calawyers.org/privacy-law/regulatory-focus-on-ai-companion-character-chatbots/",
      },
    ],
  },
  {
    id: "ca-ab2013",
    name: "California AB 2013",
    jurisdiction: "California",
    state: "CA",
    tags: ["in-force", "challenged"],
    effective: "In force Jan 1, 2026",
    effectiveDate: "2026-01-01",
    appliesTo: "Generative AI developers",
    summary: "Generative AI developers must post a summary of their training data.",
    obligations: ["Post a summary of the training data"],
    penalty: null,
    enforcement: { enforcer: null, curePeriod: null, privateRightToSue: null },
    notes: [
      "Challenged in court: xAI sued; a federal judge refused to block the law (March 2026). Ninth Circuit argument is set for Nov 18, 2026.",
    ],
    smallCompanyRelevance: "depends",
    sources: [
      {
        label: "California AI laws overview",
        url: "https://www.recordinglaw.com/us-laws/ai-laws/california-ai-laws/",
      },
    ],
  },
  {
    id: "ca-sb53",
    name: "California SB 53",
    jurisdiction: "California",
    state: "CA",
    tags: ["in-force"],
    effective: "In force Jan 1, 2026",
    effectiveDate: "2026-01-01",
    appliesTo:
      "Frontier model developers (heaviest duties at $500M+ revenue)",
    summary:
      "Frontier model developers must publish safety frameworks and report serious safety incidents. Almost never applies to a small business.",
    obligations: [
      "Publish a safety framework",
      "Report serious safety incidents (within 15 days)",
    ],
    // PRD marks the penalty figure [UNCHECKED], so it is not shown.
    penalty: null,
    enforcement: { enforcer: null, curePeriod: null, privateRightToSue: null },
    notes: ["Does not apply to small companies in practice."],
    smallCompanyRelevance: "rarely",
    sources: [
      {
        label: "SB 53 explained",
        url: "https://www.vaquill.ai/blog/california-ai-laws-explained-sb-53-and-the-rest",
      },
    ],
  },
  {
    id: "ny-raise",
    name: "New York RAISE Act",
    jurisdiction: "New York",
    state: "NY",
    tags: ["coming-soon"],
    effective: "Takes effect Jan 1, 2027",
    effectiveDate: "2027-01-01",
    appliesTo: "Frontier developers only",
    summary:
      "Frontier developers must report safety incidents within 72 hours. Signed Dec 19, 2025; rewritten Mar 27, 2026.",
    obligations: [
      "Report safety incidents within 72 hours",
      "Register as a developer (registration begins Nov 2026)",
    ],
    penalty: null,
    enforcement: { enforcer: null, curePeriod: null, privateRightToSue: null },
    notes: ["Frontier developers only; does not reach small companies."],
    smallCompanyRelevance: "rarely",
    sources: [
      {
        label: "JD Supra",
        url: "https://www.jdsupra.com/legalnews/new-york-finalizes-raise-act-for-8270433/",
      },
      {
        label: "New York AI law guide",
        url: "https://secureprivacy.ai/blog/new-york-ai-law-2026-guide",
      },
    ],
  },
];

export const LAWS_BY_ID: Record<string, Law> = Object.fromEntries(
  LAWS.map((law) => [law.id, law]),
);

export function lawsForState(state: string): Law[] {
  return LAWS.filter((law) => law.state === state);
}
