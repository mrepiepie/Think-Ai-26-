import type { Deadline, LawChangeAlert } from "./types";

/**
 * Law change alerts (F5). Events and dates come from docs/prd.txt
 * section 3. The "impact" lines describe the fictional sample company,
 * so this feed is SAMPLE DATA.
 */
export const LAW_CHANGE_ALERTS: LawChangeAlert[] = [
  {
    id: "a-co-rulemaking",
    dateLabel: "Oct 26, 2026",
    sortDate: "2026-10-26",
    state: "CO",
    lawId: "co-sb26-189",
    kind: "rulemaking",
    headline: "Colorado AG held the SB 26-189 rulemaking hearing. Final rules due by Jan 1, 2027.",
    impact: "Your Colorado disclosure may need edits once final rules land.",
    affectsYou: true,
  },
  {
    id: "a-tx-portal",
    dateLabel: "Sept 1, 2026",
    sortDate: "2026-09-01",
    state: "TX",
    lawId: "tx-traiga",
    kind: "enforcement",
    headline: "TRAIGA deadline for the Texas AG's public online complaint portal.",
    impact: "Applicant complaints about ShortlistBot can be routed to the Texas AG.",
    affectsYou: true,
  },
  {
    id: "a-il-rules",
    dateLabel: "Mid-2026",
    sortDate: "2026-07-01",
    state: "IL",
    lawId: "il-hb3773",
    kind: "delayed",
    headline: "Illinois implementing rules for HB 3773 still delayed.",
    impact: "The law is in force anyway. Keep the applicant notice live.",
    affectsYou: true,
  },
  {
    id: "a-co-replaced",
    dateLabel: "May 14, 2026",
    sortDate: "2026-05-14",
    state: "CO",
    lawId: "co-sb26-189",
    kind: "replaced",
    headline: "Colorado SB 24-205 repealed and replaced by SB 26-189 (signed). Effective Jan 1, 2027.",
    impact: "Your Colorado checklist switched to SB 26-189 disclosure duties.",
    affectsYou: true,
  },
  {
    id: "a-ny-raise",
    dateLabel: "Mar 27, 2026",
    sortDate: "2026-03-27",
    state: "NY",
    lawId: "ny-raise",
    kind: "signed",
    headline: "New York RAISE Act rewritten. Effective Jan 1, 2027, frontier developers only.",
    impact: "No action: ShortlistBot is not a frontier model.",
    affectsYou: false,
  },
  {
    id: "a-ca-ab2013",
    dateLabel: "March 2026",
    sortDate: "2026-03-15",
    state: "CA",
    lawId: "ca-ab2013",
    kind: "challenged",
    headline: "Federal judge refused to block California AB 2013. Ninth Circuit argument set for Nov 18, 2026.",
    impact: "No action: applies to generative AI developers.",
    affectsYou: false,
  },
  {
    id: "a-nyc-audit",
    dateLabel: "Dec 2025",
    sortDate: "2025-12-02",
    state: "NY",
    lawId: "nyc-ll144",
    kind: "enforcement",
    headline: "NY State Comptroller audit found NYC's complaint-driven LL144 enforcement was weak.",
    impact: "Increased scrutiny is likely. Your bias audit is still missing.",
    affectsYou: true,
  },
];

/**
 * Upcoming deadlines (F14). Law dates come from the PRD; entries with
 * sample: true are invented internal tasks for the fictional company.
 */
export const UPCOMING_DEADLINES: Deadline[] = [
  {
    id: "d-raise-reg",
    date: "2026-11-01",
    dateLabel: "Nov 2026",
    approximate: true,
    title: "NY RAISE Act developer registration begins",
    lawId: "ny-raise",
    affectsYou: false,
    sample: false,
  },
  {
    id: "d-ab2013-arg",
    date: "2026-11-18",
    title: "Ninth Circuit argument on California AB 2013",
    lawId: "ca-ab2013",
    affectsYou: false,
    sample: false,
  },
  {
    id: "d-task-audit",
    date: "2026-12-01",
    title: "Internal target: book NYC LL144 bias auditor",
    lawId: "nyc-ll144",
    affectsYou: true,
    sample: true,
  },
  {
    id: "d-co-effective",
    date: "2027-01-01",
    title: "Colorado SB 26-189 takes effect",
    lawId: "co-sb26-189",
    affectsYou: true,
    sample: false,
  },
  {
    id: "d-co-rules",
    date: "2027-01-01",
    dateLabel: "By Jan 1, 2027",
    title: "Colorado AG final rules due",
    lawId: "co-sb26-189",
    affectsYou: true,
    sample: false,
  },
  {
    id: "d-raise-effective",
    date: "2027-01-01",
    title: "New York RAISE Act takes effect",
    lawId: "ny-raise",
    affectsYou: false,
    sample: false,
  },
];
