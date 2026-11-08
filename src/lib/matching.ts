import { ruleCard } from "@/data/law-library";
import { LAWS_BY_ID } from "@/data/laws";
import type { ComplianceStatus, Law } from "@/data/types";
import { statusText } from "./compliance";
import type { ConfirmedProfile, FeatureId } from "./product-profile";
import type { RuleField, RuleItem, RuleObligation } from "./rule-card";

/**
 * MATCHING ENGINE: ordinary code, no AI.
 *
 * 1. Law level: a small hand-reviewed table (LAW_RULES) says, per law, which
 *    jurisdiction it belongs to, which product features trigger it, which
 *    roles it covers and when it takes effect. Each entry cites the verified
 *    rule-card items it relies on ("lawId/field/index"). Laws with no
 *    extracted rule card use only PRD facts and are marked not extracted.
 *    A date with no verified quote behind it is flagged effectiveDateFromPrd.
 * 2. Duty level: every verified rule-card obligation is classified by its
 *    addressee ("who") with keyword rules, then sorted into: applies to
 *    you / needs review / doesn't apply (with the reason).
 * 3. Status: computed from which applicable duties the user has checked.
 */

/* ------------------------------------------------------------------ */
/* Addressee classification                                            */
/* ------------------------------------------------------------------ */

export type Addressee =
  | "developer"
  | "deployer"
  | "employer"
  | "operator"
  | "processor"
  | "controller"
  | "government"
  | "any_person"
  | "unknown";

export interface AddresseeClass {
  addressees: Addressee[];
  /** Set when every addressee is a specific named state body (e.g. "the council"). */
  namedBody: string | null;
  /** Set when the duty is limited to a sector the profile can't tell us about. */
  sector: string | null;
}

const NAMED_BODY = /\b(attorney general|department|council|governor|legislature|speaker|office)\b/;
const GOVERNMENT = /\b(government(al)?\s+(agency|agencies|entity|entities)|state agenc(y|ies)|government)\b/;
const SECTORS: [RegExp, string][] = [
  [/\bferpa\b/, "Education records (FERPA-covered deployers)"],
  [/health|covered entity|patient/, "Health-care providers / covered health entities"],
  [/\bcreditor/, "Creditors (lending)"],
  [/\binsurer/, "Insurers"],
  [/program participant/, "Texas AI sandbox participants"],
];

function classifyPart(part: string): { addressee: Addressee; named?: boolean; sector?: string } {
  if (NAMED_BODY.test(part)) return { addressee: "government", named: true };
  if (GOVERNMENT.test(part)) return { addressee: "government" };
  for (const [re, label] of SECTORS) if (re.test(part)) return { addressee: "unknown", sector: label };
  if (/\bemploy(er|ers|ment agenc(y|ies))\b/.test(part)) return { addressee: "employer" };
  if (/\bdevelopers?\b/.test(part)) return { addressee: "developer" };
  if (/\bdeployers?\b/.test(part)) return { addressee: "deployer" };
  if (/\boperators?\b/.test(part)) return { addressee: "operator" };
  if (/\bprocessors?\b/.test(part)) return { addressee: "processor" };
  if (/\bcontrollers?\b/.test(part)) return { addressee: "controller" };
  if (/\bpersons?\b|contracting part/.test(part)) return { addressee: "any_person" };
  return { addressee: "unknown" };
}

/** Deterministic keyword rules over the rule card's "who" text. */
export function classifyAddressee(who: string): AddresseeClass {
  const parts = who
    .toLowerCase()
    .split(/\s+(?:or|and)\s+|,\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { addressees: ["unknown"], namedBody: null, sector: null };
  const results = parts.map(classifyPart);
  const addressees = [...new Set(results.map((r) => r.addressee))];
  const allNamed = results.every((r) => r.named);
  const sector = results.find((r) => r.sector)?.sector ?? null;
  return { addressees, namedBody: allNamed ? who : null, sector };
}

/** Addressees whose duties land on a company with this profile. */
export function addresseesFor(profile: ConfirmedProfile): Set<Addressee> {
  const out = new Set<Addressee>(["any_person"]);
  if (profile.role === "developer" || profile.role === "both") out.add("developer");
  if (profile.role === "deployer" || profile.role === "both") {
    out.add("deployer");
    out.add("operator");
    out.add("employer");
  }
  if (profile.isGovernment) out.add("government");
  return out;
}

const NOT_APPLICABLE_REASON: Partial<Record<Addressee, string>> = {
  government: "Applies to government agencies",
  employer: "Applies to employers using the tool (your customers), not to a company that only builds it",
  developer: "Applies to developers (companies that build or sell the AI)",
  deployer: "Applies to deployers (companies that use the AI themselves)",
  operator: "Applies to operators who make the chatbot available to users",
};

/* ------------------------------------------------------------------ */
/* The reviewed law table                                              */
/* ------------------------------------------------------------------ */

type CoveredRole = "developer" | "deployer";

interface DutyOverride {
  /** Replace the keyword classification (reason required). */
  addressees?: Addressee[];
  /** A specific state body the keyword rules miss. Never lands on a company, even a government one. */
  namedBody?: string;
  /** Not an action item (exemption, duplicate, rule about contracts...). */
  notADuty?: string;
  /** Only applies in a situation the profile doesn't describe. */
  onlyIf?: string;
  /** May apply, but the profile can't tell: goes to Needs review with this reason. */
  needsReview?: string;
  /** Corrects the keyword notice check (e.g. a ban that merely mentions "disclosure"). */
  notice?: boolean;
  /** Duty only applies when the profile has this feature. */
  requiresFeature?: { feature: FeatureId; reason: string };
  /** Duty-specific start date (ISO), with the rule-card item it comes from. */
  effectiveDate?: string;
  /** Why this override exists (reviewed by hand). */
  note: string;
}

/**
 * A hand-reviewed fact. A test checks its quote against the law text. A null
 * quote means the law text states nothing on this; a test checks that too.
 */
interface ReviewedFact {
  text: string;
  quote: string | null;
}

export const NO_ENFORCER = "No enforcer named in the law text";
export const NO_PENALTY = "No penalty stated in the law text";
export const NO_CURE_PERIOD = "No cure period stated in the law text";
/** Shown once per law with any "not stated" line, so silence doesn't read as "no risk". */
export const OTHER_LAWS_NOTE = "Other laws may still apply";

export const isNotStated = (item: { text: string }) =>
  item.text === NO_ENFORCER || item.text === NO_PENALTY || item.text === NO_CURE_PERIOD;

const notStated = (text: string): ReviewedFact[] => [{ text, quote: null }];

interface PrdDuty {
  /** Index into laws.ts obligations (PRD facts). */
  index: number;
  addressees: Addressee[];
  requiresFeature?: { feature: FeatureId; reason: string };
  effectiveDate?: string;
}

export interface LawRule {
  lawId: string;
  /** Map key: USPS state code, or "NYC" for New York City. */
  jurisdictionKey: string;
  /** Any of these features triggers the law; "any" = any AI product. */
  triggerFeatures: FeatureId[] | "any";
  coveredRoles: CoveredRole[];
  /** Who is covered, in plain words (shown when a law doesn't apply). */
  covers: string;
  effectiveDate: string;
  /** The date comes from the PRD: no verified rule-card item states it. */
  effectiveDateFromPrd?: true;
  /** Rule-card item ids this entry relies on. Empty when not extracted. */
  basis: string[];
  /** False = no rule card yet; only PRD facts are used. */
  extracted: boolean;
  /** Keyed by rule-card obligation index. */
  dutyOverrides?: Record<number, DutyOverride>;
  /** Duties from PRD facts, for laws with no rule card. */
  prdDuties?: PrdDuty[];
  /**
   * Replaces the card's items for a field. Audited by hand against the law
   * text for enforcedBy, penalties and curePeriod (8 Nov 2026).
   */
  reviewedFacts?: Partial<Record<RuleField, ReviewedFact[]>>;
}

const EMPLOYMENT: FeatureId[] = ["resume_screening", "automated_employment_decision"];

/**
 * "Large frontier developer" duties: both laws define that as over $500M
 * annual revenue with affiliates, and the profile has no revenue field.
 */
const LARGE_FRONTIER_ONLY: DutyOverride = {
  needsReview: "Only for large frontier developers (over $500M annual revenue with affiliates). Confirm whether this is you",
  note: 'who = "large frontier developer"; the keyword rules would read this as any developer.',
};

const CALCOMPUTE: DutyOverride = {
  namedBody: "the CalCompute consortium",
  note: 'who = "consortium": a state-created body the keyword rules read as unknown.',
};

const FEDERAL_ROUTE_ONLY = "Only if you choose to meet the incident-reporting duty through designated federal standards";

export const LAW_RULES: LawRule[] = [
  {
    lawId: "nyc-ll144",
    jurisdictionKey: "NYC",
    triggerFeatures: EMPLOYMENT,
    coveredRoles: ["deployer"],
    covers: "Employers and employment agencies using an automated employment decision tool in New York City",
    effectiveDate: "2023-01-01",
    basis: ["nyc-ll144/coveredParties/0", "nyc-ll144/triggers/0", "nyc-ll144/effectiveDate/0"],
    extracted: true,
    reviewedFacts: {
      enforcedBy: [
        {
          text: "The corporation counsel, or someone it designates on behalf of the department, can go to court to correct violations, including an order to follow the law.",
          quote:
            "The corporation counsel or such other persons designated by the corporation counsel on behalf of the department may initiate in any court of competent jurisdiction any action or proceeding that may be appropriate or necessary for correction of any violation issued pursuant this subchapter, including mandating compliance with the provisions of this chapter or such other relief as may be appropriate.",
        },
        {
          text: "Civil penalty proceedings go to a tribunal at the Office of Administrative Trials and Hearings, or another designated city agency.",
          quote:
            "A proceeding to recover any civil penalty authorized by this subchapter is returnable to any tribunal established within the office of administrative trials and hearings or within any agency of the city designated to conduct such proceedings.",
        },
        {
          text: "The law doesn't limit a candidate's or employee's right to bring a civil action, or the human rights commission's authority under title 8.",
          quote:
            "The provisions of this subchapter shall not be construed to limit any right of any candidate or employee for an employment decision to bring a civil action in any court of competent jurisdiction, or to limit the authority of the commission on human rights to enforce the provisions of title 8, in accordance with law.",
        },
      ],
      penalties: [
        {
          text: "Civil penalty of up to $500 for a first violation and each additional violation that same day, then $500 to $1,500 for each subsequent violation.",
          quote:
            "Any person that violates any provision of this subchapter or any rule promulgated pursuant to this subchapter is liable for a civil penalty of not more than $500 for a first violation and each additional violation occurring on the same day as the first violation, and not less than $500 nor more than $1,500 for each subsequent violation.",
        },
        {
          text: "Each day a tool is used in violation counts as a separate violation.",
          quote:
            "Each day on which an automated employment decision tool is used in violation of this section shall give rise to a separate violation of subdivision a of section 20-871.",
        },
        {
          text: "Each failure to give a required notice counts as a separate violation.",
          quote:
            "Failure to provide any notice to a candidate or an employee in violation of paragraphs 1, 2 or 3 of subdivision b of section 20-871 shall constitute a separate violation.",
        },
      ],
      curePeriod: notStated(NO_CURE_PERIOD),
    },
  },
  {
    lawId: "il-hb3773",
    jurisdictionKey: "IL",
    // Employer law: only an employment feature triggers it. Location/ZIP use
    // never triggers it alone; it only adds the ZIP-proxy duty below.
    triggerFeatures: EMPLOYMENT,
    coveredRoles: ["deployer"],
    covers: "Employers using AI in hiring, promotion, firing and other employment decisions",
    effectiveDate: "2026-01-01",
    basis: [],
    extracted: false,
    prdDuties: [
      { index: 0, addressees: ["employer"] },
      {
        index: 1,
        addressees: ["employer"],
        requiresFeature: {
          feature: "uses_location_or_zip",
          reason: "Only relevant if your product uses location or ZIP code data",
        },
      },
      { index: 2, addressees: ["employer"] },
    ],
  },
  {
    lawId: "tx-traiga",
    jurisdictionKey: "TX",
    triggerFeatures: "any",
    coveredRoles: ["developer", "deployer"],
    covers: "Anyone who develops or deploys an AI system in Texas, or does business there",
    effectiveDate: "2026-01-01",
    basis: [
      "tx-traiga/coveredParties/0",
      "tx-traiga/coveredParties/1",
      "tx-traiga/coveredParties/2",
      "tx-traiga/triggers/0",
      "tx-traiga/triggers/2",
      "tx-traiga/effectiveDate/0",
    ],
    extracted: true,
    reviewedFacts: {
      enforcedBy: [
        {
          text: "The Attorney General has exclusive authority to enforce, except for state-agency sanctions under Section 552.106.",
          quote: "The attorney general has exclusive authority to enforce this chapter, except to the extent provided by Section 552.106.",
        },
        {
          text: "No private right of action.",
          quote:
            "This chapter does not provide a basis for, and is not subject to, a private right of action for a violation of this chapter or any other law.",
        },
        {
          text: "A state agency may sanction someone it licenses, registers or certifies, once that person is found in violation and the Attorney General recommends it.",
          quote:
            "A state agency may impose sanctions against a person licensed, registered, or certified by that agency for a violation of Subchapter B if: (1) the person has been found in violation of this chapter under Section 552.105; and (2) the attorney general has recommended additional enforcement by the applicable agency.",
        },
      ],
      penalties: [
        {
          text: "If a violation isn't cured: $10,000 to $12,000 per violation a court finds curable (or a breach of a cure statement), $80,000 to $200,000 per violation it finds uncurable, and $2,000 to $40,000 per day for a continued violation.",
          quote:
            "A person who violates this chapter and does not cure the violation under Section 552.104 is liable to this state for a civil penalty in an amount of: (1) for each violation the court determines to be curable or a breach of a statement submitted to the attorney general under Section 552.104(b)(2), not less than $10,000 and not more than $12,000; (2) for each violation the court determines to be uncurable, not less than $80,000 and not more than $200,000; and (3) for a continued violation, not less than $2,000 and not more than $40,000 for each day the violation continues.",
        },
        {
          text: "The Attorney General can also seek an injunction, attorney's fees, court costs and investigative expenses.",
          quote:
            "The attorney general may bring an action in the name of this state to: (1) collect a civil penalty under this section; (2) seek injunctive relief against further violation of this chapter; and (3) recover attorney's fees and reasonable court costs or other investigative expenses.",
        },
        {
          text: "State agency sanctions can include suspension, probation or revocation of a license, and a monetary penalty of up to $100,000.",
          quote:
            "Sanctions under this section may include: (1) suspension, probation, or revocation of a license, registration, certificate, or other authorization to engage in an activity; and (2) a monetary penalty not to exceed $100,000.",
        },
        {
          text: "No civil penalty action for an AI system that hasn't been deployed.",
          quote:
            "The attorney general may not bring an action to collect a civil penalty under this section against a person for an artificial intelligence system that has not been deployed.",
        },
      ],
      curePeriod: [
        {
          text: "The Attorney General can't sue before the 60th day after giving notice, or at all if before then the person cures the violation and sends a written statement with supporting documentation and any needed policy changes.",
          quote:
            "The attorney general may not bring an action against the person: (1) before the 60th day after the date the attorney general provides the notice under Subsection (a); or (2) if, before the 60th day after the date the attorney general provides the notice under Subsection (a), the person: (A) cures the identified violation; and (B) provides the attorney general with a written statement that the person has: (i) cured the alleged violation; (ii) provided supporting documentation to show the manner in which the person cured the violation; and (iii) made any necessary changes to internal policies to reasonably prevent further violation of this chapter.",
        },
      ],
    },
    dutyOverrides: {
      5: {
        addressees: ["government"],
        note: 'Quote: "A person is required to make the disclosure under Subsection (b)". Subsection (b) is the governmental-agency disclosure (obligations/4).',
      },
      6: {
        addressees: ["government"],
        note: "Form rules (clear and conspicuous) for the governmental-agency disclosure in obligations/4.",
      },
      7: {
        addressees: ["government"],
        note: "Form rules (plain language) for the governmental-agency disclosure in obligations/4.",
      },
      8: {
        addressees: ["government"],
        note: "Form rules (no dark pattern) for the governmental-agency disclosure in obligations/4.",
      },
      17: {
        onlyIf: "Only after the Texas Attorney General sends you a notice of violation (60-day cure)",
        note: "Cure procedure, not a standing duty.",
      },
      18: {
        onlyIf: "Only if the Texas Attorney General issues you a civil investigative demand",
        note: "Investigation procedure, not a standing duty.",
      },
      20: {
        onlyIf: "Only if you apply to test AI in the Texas regulatory sandbox",
        note: "Sandbox is voluntary.",
      },
      22: {
        onlyIf: "Only if you join the Texas regulatory sandbox",
        note: "Sandbox is voluntary.",
      },
    },
  },
  {
    lawId: "co-sb26-189",
    jurisdictionKey: "CO",
    triggerFeatures: [...EMPLOYMENT, "consequential_decision_lending_housing_insurance"],
    coveredRoles: ["developer", "deployer"],
    covers:
      "Developers and deployers of automated decision-making technology used in consequential decisions (jobs, loans, housing, insurance)",
    effectiveDate: "2027-01-01",
    basis: [
      "co-sb26-189/coveredParties/0",
      "co-sb26-189/coveredParties/1",
      "co-sb26-189/triggers/0",
      "co-sb26-189/effectiveDate/3",
      "co-sb26-189/effectiveDate/4",
    ],
    extracted: true,
    reviewedFacts: {
      enforcedBy: [
        {
          text: "The Attorney General enforces this law through the Colorado Consumer Protection Act.",
          quote: 'THE ATTORNEY GENERAL SHALL ENFORCE THIS PART 17 THROUGH THE "COLORADO CONSUMER PROTECTION ACT", THIS ARTICLE 1.',
        },
        {
          text: "Violations of the disclosure and consumer-rights sections are enforceable only by the Attorney General.",
          quote:
            "VIOLATIONS OF THE DISCLOSURE REQUIREMENTS AND CONSUMER RIGHTS DESCRIBED IN SECTIONS 6-1-1702, 6-1-1703, 6-1-1704, AND 6-1-1705 ARE ENFORCEABLE EXCLUSIVELY BY THE ATTORNEY GENERAL WITHOUT REGARD TO ANY OTHER PROVISION IN THIS TITLE 6.",
        },
        {
          text: "No new private right of action, but existing rights and remedies stay, including anti-discrimination, consumer protection and product liability law.",
          quote:
            'NOTHING IN THIS PART 17 CREATES A NEW PRIVATE RIGHT OF ACTION. NOTHING IN THIS PART 17 LIMITS OR REDUCES ANY EXISTING RIGHTS OR REMEDIES AVAILABLE UNDER STATE OR FEDERAL LAW, INCLUDING THE "COLORADO ANTI-DISCRIMINATION ACT", PARTS 3 TO 8 OF ARTICLE 34 OF TITLE 24; THE "COLORADO CONSUMER PROTECTION ACT", THIS ARTICLE 1; PRODUCT LIABILITY LAW; OR OTHER APPLICABLE LAW.',
        },
        {
          text: "A developer or deployer may be held liable in an action alleging unlawful discrimination under state anti-discrimination laws.",
          quote:
            'A DEVELOPER OR DEPLOYER MAY BE HELD LIABLE IN AN ACTION ALLEGING UNLAWFUL DISCRIMINATION UNDER STATE ANTI-DISCRIMINATION LAWS, INCLUDING THE "COLORADO ANTI-DISCRIMINATION ACT", PARTS 3 TO 8 OF ARTICLE 34 OF TITLE 24, ARISING FROM A CONSEQUENTIAL DECISION MATERIALLY INFLUENCED BY A COVERED ADMT.',
        },
      ],
      penalties: [
        {
          text: "A violation is a deceptive trade practice under the Colorado Consumer Protection Act. This law's text states no dollar amount for violations.",
          quote:
            'A VIOLATION OF THIS PART 17 IS A DECEPTIVE TRADE PRACTICE AND IS SUBJECT TO THE PROVISIONS OF THE "COLORADO CONSUMER PROTECTION ACT", THIS ARTICLE 1.',
        },
      ],
      curePeriod: [
        {
          text: "60 days after a notice of violation, but the Attorney General issues that notice only if it deems a cure possible.",
          quote:
            "PRIOR TO ANY ENFORCEMENT ACTION FOR A VIOLATION OF THIS PART 17, THE ATTORNEY GENERAL SHALL ISSUE A NOTICE OF VIOLATION TO A DEVELOPER OR DEPLOYER IF A CURE IS DEEMED POSSIBLE BY THE ATTORNEY GENERAL. (b) IF THE DEVELOPER OR DEPLOYER FAILS TO CURE A VIOLATION WITHIN SIXTY DAYS AFTER RECEIPT OF A NOTICE OF VIOLATION, THE ATTORNEY GENERAL MAY BRING AN ACTION PURSUANT TO THIS SECTION.",
        },
        {
          text: "No cure period is required for knowing or repeated violations.",
          quote:
            "IF THE ATTORNEY GENERAL FINDS AND CAN DEMONSTRATE THAT A DEVELOPER OR DEPLOYER KNOWINGLY VIOLATED THIS PART 17 OR A DEVELOPER OR DEPLOYER REPEATEDLY VIOLATED THIS PART 17, THE ATTORNEY GENERAL IS NOT REQUIRED TO PROVIDE A CURE PERIOD BEFORE SEEKING PENALTIES OR OTHER RELIEF.",
        },
        {
          text: "A court may treat a cure within 60 days of written notice as a mitigating factor.",
          quote:
            "IF A VIOLATION IS DISCOVERED IN THE COURSE OF AN ENFORCEMENT ACTION, A COURT MAY CONSIDER THAT A DEVELOPER OR DEPLOYER CURED THE VIOLATION WITHIN SIXTY DAYS AFTER RECEIPT OF WRITTEN NOTICE AS A MITIGATING FACTOR IN DETERMINING CIVIL PENALTIES OR OTHER MONETARY RELIEF, IF ANY.",
        },
        {
          text: "The subsection with these cure rules is repealed effective Jan 1, 2030.",
          quote: "THIS SUBSECTION (3) IS REPEALED, EFFECTIVE JANUARY 1, 2030.",
        },
      ],
    },
    dutyOverrides: {
      3: { notADuty: "Same duty as the developer record-keeping duty above", note: "Duplicate of obligations/2." },
      12: { notADuty: "Same duty as the accessible-notices duty above", note: "Duplicate of obligations/11." },
      18: {
        onlyIf: "Only after the Colorado Attorney General sends you a notice of violation (60-day cure)",
        note: "Cure procedure, not a standing duty.",
      },
      21: {
        notADuty: "Makes indemnity clauses in developer-deployer contracts void; a contract rule, not a task",
        note: "Quote says such provisions are 'contrary to public policy and void'.",
      },
    },
  },
  {
    lawId: "ca-sb243",
    jurisdictionKey: "CA",
    triggerFeatures: ["companion_chatbot"],
    coveredRoles: ["developer", "deployer"],
    covers: "Operators who make a companion chatbot platform available to users in California",
    effectiveDate: "2026-01-01",
    basis: ["ca-sb243/coveredParties/0", "ca-sb243/triggers/0", "ca-sb243/effectiveDate/0"],
    extracted: true,
    // The card says the Office "enforces reporting", but § 22603 only has it receive and post
    // reports. § 22605 is the only enforcement route the text names, and the card missed it.
    reviewedFacts: {
      enforcedBy: [
        {
          text: "A person who suffers injury in fact from a violation can bring a civil action for injunctive relief, damages (the greater of actual damages or $1,000 per violation), and reasonable attorney's fees and costs.",
          quote:
            "A person who suffers injury in fact as a result of a violation of this chapter may bring a civil action to recover all of the following relief: (a) Injunctive relief. (b) Damages in an amount equal to the greater of actual damages or one thousand dollars ($1,000) per violation. (c) Reasonable attorney’s fees and costs.",
        },
        {
          text: "Annual reports go to the Office of Suicide Prevention, which posts the data. This law doesn't name it as an enforcer.",
          quote:
            "“Office” means the Office of Suicide Prevention established pursuant to Section 131300 of the Health and Safety Code. ... Beginning July 1, 2027, an operator shall annually report to the office all of the following ... The office shall post data from a report required by this section on its internet website.",
        },
      ],
      // The card hid injunctive relief: its quote alone was too short to verify.
      penalties: [
        {
          text: "In a civil action: injunctive relief, damages (the greater of actual damages or $1,000 per violation), and reasonable attorney's fees and costs.",
          quote:
            "may bring a civil action to recover all of the following relief: (a) Injunctive relief. (b) Damages in an amount equal to the greater of actual damages or one thousand dollars ($1,000) per violation. (c) Reasonable attorney’s fees and costs.",
        },
        {
          text: "These remedies add to any under other law.",
          quote:
            "The duties, remedies, and obligations imposed by this chapter are cumulative to the duties, remedies, or obligations imposed under other law",
        },
      ],
      curePeriod: notStated(NO_CURE_PERIOD),
    },
    dutyOverrides: {
      3: {
        requiresFeature: { feature: "chatbot_used_by_minors", reason: "Applies to users the operator knows are minors" },
        note: "Minor-user section.",
      },
      4: {
        requiresFeature: { feature: "chatbot_used_by_minors", reason: "Applies to users the operator knows are minors" },
        note: "Minor-user section (3-hour break reminder).",
      },
      5: {
        requiresFeature: { feature: "chatbot_used_by_minors", reason: "Applies to users the operator knows are minors" },
        note: "Quote refers to 'the minor'.",
      },
      6: {
        effectiveDate: "2027-07-01",
        note: 'Quote: "Beginning July 1, 2027, an operator shall annually report"; also effectiveDate/0.',
      },
    },
  },
  {
    lawId: "ca-ab2013",
    jurisdictionKey: "CA",
    triggerFeatures: ["generative_ai_public"],
    coveredRoles: ["developer"],
    covers: "Developers of generative AI systems made publicly available to Californians",
    effectiveDate: "2026-01-01",
    basis: ["ca-ab2013/coveredParties/0", "ca-ab2013/triggers/0", "ca-ab2013/obligations/0"],
    extracted: true,
    reviewedFacts: {
      enforcedBy: notStated(NO_ENFORCER),
      penalties: notStated(NO_PENALTY),
      curePeriod: notStated(NO_CURE_PERIOD),
    },
    dutyOverrides: {
      1: { notADuty: "An exemption list, not a duty", note: 'Quote: "A developer shall not be required to post..."' },
    },
  },
  {
    lawId: "ca-sb53",
    jurisdictionKey: "CA",
    triggerFeatures: ["frontier_model_training"],
    coveredRoles: ["developer"],
    covers: "Frontier model developers (heaviest duties at $500M+ revenue)",
    effectiveDate: "2026-01-01",
    // The card's only date item (effectiveDate/0) is about the CalCompute section, not the law.
    effectiveDateFromPrd: true,
    basis: ["ca-sb53/coveredParties/0", "ca-sb53/coveredParties/1", "ca-sb53/triggers/0", "ca-sb53/triggers/4"],
    extracted: true,
    reviewedFacts: {
      enforcedBy: [
        {
          text: "Civil penalties can be recovered only in a civil action brought by the Attorney General.",
          quote: "A civil penalty described in this section shall be recovered in a civil action brought only by the Attorney General.",
        },
        {
          text: "In a civil action or administrative proceeding under the whistleblower section, a covered employee may ask a superior court for temporary or preliminary injunctive relief.",
          quote:
            "In a civil action or administrative proceeding brought pursuant to this section, a covered employee may petition the superior court in any county wherein the violation in question is alleged to have occurred, or wherein the person resides or transacts business, for appropriate temporary or preliminary injunctive relief.",
        },
      ],
      penalties: [
        {
          text: "A large frontier developer faces a civil penalty based on severity, up to $1,000,000 per violation, for failing to publish or send a required document, a false statement covered by Section 22757.12(e), failing to report an incident, or not following its own frontier AI framework.",
          quote:
            "A large frontier developer that fails to publish or transmit a compliant document required to be published or transmitted under this chapter, makes a statement in violation of subdivision (e) of Section 22757.12, fails to report an incident as required by Section 22757.13, or fails to comply with its own frontier AI framework shall be subject to a civil penalty in an amount dependent upon the severity of the violation that does not exceed one million dollars ($1,000,000) per violation.",
        },
        {
          text: "In a successful action under the whistleblower section, the court may award reasonable attorney's fees to the plaintiff.",
          quote: "The court is authorized to award reasonable attorney’s fees to a plaintiff who brings a successful action for a violation of this section.",
        },
      ],
      curePeriod: notStated(NO_CURE_PERIOD),
    },
    dutyOverrides: {
      0: LARGE_FRONTIER_ONLY,
      1: LARGE_FRONTIER_ONLY,
      2: LARGE_FRONTIER_ONLY,
      4: LARGE_FRONTIER_ONLY,
      5: LARGE_FRONTIER_ONLY,
      7: LARGE_FRONTIER_ONLY,
      8: { notice: false, note: "Content rule for documents already published, not a notice of its own." },
      14: { notADuty: "Optional: a developer may file an amended report", note: 'Quote: "may file an amended report".' },
      22: { onlyIf: FEDERAL_ROUTE_ONLY, note: 'Quote: "A frontier developer that intends to comply ... by complying with" federal standards.' },
      29: CALCOMPUTE,
      30: CALCOMPUTE,
      31: CALCOMPUTE,
      32: {
        namedBody: "the Government Operations Agency",
        note: 'The keyword rules read "Government Operations Agency" as any government agency.',
      },
      33: CALCOMPUTE,
      34: { notice: false, note: 'Anti-retaliation ban; "disclosing" in the quote misfires the notice keywords.' },
      35: { notice: false, note: 'Ban on restrictive contracts; "disclosure" in the quote misfires the notice keywords.' },
      38: LARGE_FRONTIER_ONLY,
      39: LARGE_FRONTIER_ONLY,
      40: CALCOMPUTE,
      41: CALCOMPUTE,
      42: {
        notADuty: "A court step for an employee who sues, not a duty of the company",
        note: 'who = "covered employee": the petitioner serving notice of an injunction petition.',
      },
    },
  },
  {
    lawId: "ny-raise",
    jurisdictionKey: "NY",
    triggerFeatures: ["frontier_model_training"],
    coveredRoles: ["developer"],
    covers: "Frontier developers only",
    effectiveDate: "2027-01-01",
    // Date: ch. 96 § 3 of the official text, verified as the ny-raise-effective event in
    // law-events.ts. Not from the card: effectiveDate/0 is unverified, effectiveDate/1 only
    // points to another chapter's date.
    basis: ["ny-raise/coveredParties/1", "ny-raise/coveredParties/5", "ny-raise/triggers/0", "ny-raise/triggers/5"],
    extracted: true,
    reviewedFacts: {
      enforcedBy: [
        {
          text: "The Attorney General can bring a civil action to recover civil penalties.",
          quote: "The attorney general may bring a civil action to recover a civil penalty",
        },
        {
          text: "An office within the Department of Financial Services can levy civil penalties, fees and costs after notice and hearing, for disclosure and assessment failures.",
          quote:
            '"Office" means an office within the department of financial services ... without a current disclosure filed with the office as required by this section, submits false information in its disclosure or fails to timely pay any assessment required by this article, in addition to any other penalty or liability that may be imposed under this article, the office may, after notice and hearing, levy civil penalties, fees, and costs',
        },
        {
          text: "No private right of action.",
          quote:
            "Nothing in this article shall be construed to establish, authorize or create a private right of action associated with violations of this article.",
        },
      ],
      penalties: [
        {
          text: "A large frontier developer faces a civil penalty based on severity, up to $1 million for a first violation and up to $3 million per subsequent violation, for failing to publish or send a required document, a false statement covered by § 1421(4), failing to report an incident, or not following its own frontier AI framework.",
          quote:
            "The attorney general may bring a civil action to recover a civil penalty in an amount not to exceed one million dollars for a first violation and in an amount not to exceed three million dollars per subsequent violation, determined based on the severity of the violation where a large frontier developer fails to publish or transmit a compliant document required to be published or transmitted under this article, makes a statement in violation of subdivision four of section fourteen hundred twenty-one of this article, fails to report an incident as required by section fourteen hundred twenty-two of this article, or fails to comply with its own frontier AI framework.",
        },
        {
          text: "The office can levy $1,000 per day for failing to file a disclosure or correct false information.",
          quote:
            "a civil penalty of one thousand dollars for each day the entity fails to file a disclosure as required by this section or fails to correct false information",
        },
        {
          text: "The office can also levy an amount equal to the assessments owed.",
          quote: "an amount equal to the assessments owed",
        },
      ],
      curePeriod: notStated(NO_CURE_PERIOD),
    },
    dutyOverrides: {
      0: LARGE_FRONTIER_ONLY,
      1: LARGE_FRONTIER_ONLY,
      2: LARGE_FRONTIER_ONLY,
      4: LARGE_FRONTIER_ONLY,
      6: LARGE_FRONTIER_ONLY,
      9: { notice: false, note: "Content rule for documents already published, not a notice of its own." },
      10: LARGE_FRONTIER_ONLY,
      11: { onlyIf: FEDERAL_ROUTE_ONLY, note: 'Quote: "frontier developers who comply ... by meeting such federal standards".' },
      12: LARGE_FRONTIER_ONLY,
      13: LARGE_FRONTIER_ONLY,
      14: LARGE_FRONTIER_ONLY,
      15: LARGE_FRONTIER_ONLY,
    },
  },
];

export const LAW_RULES_BY_ID: Record<string, LawRule> = Object.fromEntries(LAW_RULES.map((r) => [r.lawId, r]));

/**
 * A field's reviewed items, shaped like rule-card items. Undefined = use the
 * card's. An empty quote marks a "not stated in the law text" line.
 */
export function reviewedItems(rule: LawRule, field: RuleField): RuleItem[] | undefined {
  return rule.reviewedFacts?.[field]?.map((f) => ({ text: f.text, quote: f.quote ?? "", verified: true, chunks: [] }));
}

/**
 * The enforcement facts every screen shows for a law: reviewed facts, else
 * verified rule-card items, else the PRD fact. Empty = nothing verified.
 */
export function enforcementFacts(rule: LawRule, field: "enforcedBy" | "penalties" | "curePeriod"): RuleItem[] {
  const reviewed = reviewedItems(rule, field);
  if (reviewed) return reviewed;
  const card = ruleCard(rule.lawId)?.[field].filter((i) => i.verified) ?? [];
  if (card.length > 0) return card;
  const law = LAWS_BY_ID[rule.lawId];
  const prd = field === "penalties" ? law.penalty : law.enforcement[field === "enforcedBy" ? "enforcer" : "curePeriod"];
  return prd ? [{ text: prd, quote: "", verified: false, chunks: [] }] : [];
}

/** Whether any enforcement line for this law is a "not stated in the law text" line. */
export function hasSilentFacts(rule: LawRule): boolean {
  return (["enforcedBy", "penalties", "curePeriod"] as const).some((field) =>
    enforcementFacts(rule, field).some(isNotStated),
  );
}

/** Resolve a "lawId/field/index" rule-card item id. */
export function ruleCardItem(id: string): RuleItem | undefined {
  const [lawId, field, index] = id.split("/");
  const card = ruleCard(lawId);
  if (!card) return undefined;
  return (card[field as RuleField] as RuleItem[] | undefined)?.[Number(index)];
}

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

export type DutyBucket = "applicable" | "needsReview" | "notApplicable";

export interface Duty {
  /** "lawId/obligations/index" for rule-card duties, "lawId/prd/index" for PRD duties. */
  id: string;
  lawId: string;
  text: string;
  who: string;
  timing: string | null;
  /** Verified quote from the official text; null for PRD-only duties. */
  quote: string | null;
  source: "rule-card" | "prd";
  effectiveDate: string;
  /** The effective date is from the PRD summary, not a verified quote. */
  dateFromPrd: boolean;
  addressees: Addressee[];
  /** A notice or disclosure duty (eligible for the notice drafter). */
  isNotice: boolean;
  bucket: DutyBucket;
  /** Why it is in this bucket (empty for applicable duties). */
  reason: string;
}

export interface LawMatch {
  law: Law;
  rule: LawRule;
  applies: boolean;
  /** Why the law applies or doesn't. */
  reason: string;
  applicable: Duty[];
  needsReview: Duty[];
  notApplicable: Duty[];
  /** Extracted obligations whose quote was not verified (never shown as facts). */
  unverifiedCount: number;
}

const NOTICE = /\b(notice|notif\w*|disclos\w*|inform\w*|tell|post\w*|publish\w*)\b/i;

/**
 * Notice/disclosure duty toward consumers, candidates or the public.
 * Developer-to-deployer documentation duties (B2B) don't count.
 */
export function isNoticeDuty(text: string, quote: string, addressees: Addressee[]): boolean {
  if (!NOTICE.test(`${text} ${quote}`)) return false;
  const b2b = addressees.every((a) => a === "developer") && /\bdeployers?\b/i.test(text);
  return !b2b;
}

/** Leading "May not" / "Person must not" / "Do not" ... of a prohibition. */
const LEADING_BAN = /^(?:(?:a|an|the)\s+)?(?:[a-z]+\s+)?(?:must not|may not|shall not|cannot|do not|does not)\s+/i;
const ANY_BAN = /\b(must not|may not|shall not|do not|does not|prohibit\w*|bans?|banned)\b/i;

/** A "must not / may not / ban" duty. */
export function isProhibition(text: string): boolean {
  return ANY_BAN.test(text);
}

/**
 * Checkbox label for a duty. Prohibitions read as something to confirm:
 * "May not develop AI that..." -> "Confirm you don't: develop AI that...".
 */
export function checkboxLabel(text: string): string {
  if (!isProhibition(text)) return text;
  const m = text.match(LEADING_BAN);
  return `Confirm you don't: ${m ? text.slice(m[0].length) : text}`;
}

/** Jurisdiction keys a profile reaches. NYC is inside New York State. */
export function profileKeys(profile: ConfirmedProfile): Set<string> {
  const keys = new Set(profile.jurisdictions);
  if (keys.has("NYC")) keys.add("NY");
  return keys;
}

function sortDuty(
  base: Omit<Duty, "bucket" | "reason" | "addressees" | "isNotice">,
  cls: AddresseeClass,
  override: Pick<DutyOverride, "notADuty" | "onlyIf" | "requiresFeature" | "needsReview" | "notice"> | undefined,
  profile: ConfirmedProfile,
  lawReason: string | null,
): Duty {
  const make = (bucket: DutyBucket, reason: string): Duty => ({
    ...base,
    addressees: cls.addressees,
    bucket,
    reason,
    isNotice:
      bucket === "applicable" && (override?.notice ?? isNoticeDuty(base.text, base.quote ?? "", cls.addressees)),
  });

  if (lawReason) return make("notApplicable", lawReason);
  if (override?.notADuty) return make("notApplicable", override.notADuty);
  if (override?.onlyIf) return make("notApplicable", override.onlyIf);
  if (override?.requiresFeature && !profile.features.includes(override.requiresFeature.feature)) {
    return make("notApplicable", override.requiresFeature.reason);
  }
  if (cls.namedBody) {
    const body = /^the\b/i.test(cls.namedBody) ? cls.namedBody : `the ${cls.namedBody}`;
    return make("notApplicable", `Duty of ${body} (a state body), not of companies`);
  }
  if (override?.needsReview) return make("needsReview", override.needsReview);

  const mine = addresseesFor(profile);
  if (cls.addressees.some((a) => mine.has(a))) return make("applicable", "");
  if (cls.addressees.some((a) => a === "processor" || a === "controller")) {
    return make(
      "needsReview",
      "Texas privacy-law role: confirm whether you process personal data for others (processor) or decide how it is used (controller)",
    );
  }
  if (cls.addressees.includes("unknown")) {
    return make(
      "needsReview",
      cls.sector ? `Sector-specific: ${cls.sector}. Confirm whether this is you` : `Couldn't tell who "${base.who}" is`,
    );
  }
  const first = cls.addressees.find((a) => NOT_APPLICABLE_REASON[a]);
  return make("notApplicable", first ? NOT_APPLICABLE_REASON[first]! : `Applies to: ${base.who}`);
}

function lawLevel(rule: LawRule, profile: ConfirmedProfile, keys: Set<string>, law: Law) {
  const where = rule.jurisdictionKey === "NYC" ? "New York City" : law.jurisdiction;
  if (!keys.has(rule.jurisdictionKey)) {
    return { inScope: false, reason: `You have no users, applicants or employees in ${where}` };
  }
  const triggered =
    rule.triggerFeatures === "any" || rule.triggerFeatures.some((f) => profile.features.includes(f));
  if (!triggered) return { inScope: false, reason: `Doesn't match your product. Covers: ${rule.covers}` };

  const roles: CoveredRole[] =
    profile.role === "both" ? ["developer", "deployer"] : [profile.role as CoveredRole];
  if (!rule.coveredRoles.some((r) => roles.includes(r))) {
    const why =
      rule.coveredRoles.includes("deployer") && rule.covers.toLowerCase().includes("employ")
        ? "Covers employers using the tool (your customers), not a company that only builds it"
        : `Covers ${rule.coveredRoles.join(" / ")}s only`;
    return { inScope: false, roleMismatch: true, reason: why };
  }
  return { inScope: true, reason: `Covers: ${rule.covers}` };
}

/** Match one law against a confirmed profile. */
export function matchLaw(rule: LawRule, profile: ConfirmedProfile): LawMatch {
  const law = LAWS_BY_ID[rule.lawId];
  const keys = profileKeys(profile);
  const level = lawLevel(rule, profile, keys, law);
  const lawReason = level.inScope ? null : level.reason;
  const duties: Duty[] = [];
  let unverifiedCount = 0;

  if (rule.extracted) {
    const card = ruleCard(rule.lawId);
    (card?.obligations ?? []).forEach((o: RuleObligation, index) => {
      if (!o.verified) {
        unverifiedCount++;
        return;
      }
      const override = rule.dutyOverrides?.[index];
      const cls: AddresseeClass = override?.namedBody
        ? { addressees: ["government"], namedBody: override.namedBody, sector: null }
        : override?.addressees
          ? { addressees: override.addressees, namedBody: null, sector: null }
          : classifyAddressee(o.who);
      duties.push(
        sortDuty(
          {
            id: `${rule.lawId}/obligations/${index}`,
            lawId: rule.lawId,
            text: o.text,
            who: o.who,
            timing: o.timing,
            quote: o.quote,
            source: "rule-card",
            effectiveDate: override?.effectiveDate ?? rule.effectiveDate,
            dateFromPrd: !override?.effectiveDate && Boolean(rule.effectiveDateFromPrd),
          },
          cls,
          override,
          profile,
          lawReason,
        ),
      );
    });
  } else {
    for (const d of rule.prdDuties ?? []) {
      const text = law.obligations[d.index];
      duties.push(
        sortDuty(
          {
            id: `${rule.lawId}/prd/${d.index}`,
            lawId: rule.lawId,
            text,
            who: d.addressees.join(" / "),
            timing: null,
            quote: null,
            source: "prd",
            effectiveDate: d.effectiveDate ?? rule.effectiveDate,
            dateFromPrd: true,
          },
          { addressees: d.addressees, namedBody: null, sector: null },
          d,
          profile,
          lawReason,
        ),
      );
    }
  }

  return {
    law,
    rule,
    applies: level.inScope,
    reason: level.reason,
    applicable: duties.filter((d) => d.bucket === "applicable"),
    needsReview: duties.filter((d) => d.bucket === "needsReview"),
    notApplicable: duties.filter((d) => d.bucket === "notApplicable"),
    unverifiedCount,
  };
}

export function matchCompany(profile: ConfirmedProfile): LawMatch[] {
  return LAW_RULES.map((rule) => matchLaw(rule, profile));
}

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

/**
 * Honest status for a set of laws (one law, or one jurisdiction):
 * - not-applicable: no law applies;
 * - non-compliant (red): an applicable duty already in force is unchecked;
 * - action-soon (amber): only future duties are unchecked, OR nothing is
 *   unchecked but some duties still need review (never green by default);
 * - compliant (green): every applicable duty is checked and none need review.
 */
export function statusFor(laws: LawMatch[], checked: ReadonlySet<string>, todayIso: string): ComplianceStatus {
  const applying = laws.filter((l) => l.applies);
  if (applying.length === 0) return "not-applicable";
  const duties = applying.flatMap((l) => l.applicable);
  const open = duties.filter((d) => !checked.has(d.id));
  if (open.some((d) => d.effectiveDate <= todayIso)) return "non-compliant";
  if (open.length > 0) return "action-soon";
  if (applying.some((l) => l.needsReview.length > 0)) return "action-soon";
  return "compliant";
}

/** Earliest effective date among unchecked applicable duties not yet in force. */
export function earliestOpenDate(laws: LawMatch[], checked: ReadonlySet<string>, todayIso: string): string | null {
  const dates = laws
    .filter((l) => l.applies)
    .flatMap((l) => l.applicable)
    .filter((d) => !checked.has(d.id) && d.effectiveDate > todayIso)
    .map((d) => d.effectiveDate)
    .sort();
  return dates[0] ?? null;
}

/** Display label for a set of laws, e.g. "Action needed by Jan 1, 2027". */
export function statusLabelFor(laws: LawMatch[], checked: ReadonlySet<string>, todayIso: string): string {
  return statusText(statusFor(laws, checked, todayIso), earliestOpenDate(laws, checked, todayIso));
}

export interface JurisdictionRollup {
  key: string;
  status: ComplianceStatus;
  /** Display label for the status (see statusText). */
  label: string;
  /** All tracked laws for this jurisdiction (applying first). */
  laws: LawMatch[];
  /** Status per law id (same rules as the jurisdiction status). */
  lawStatus: Record<string, ComplianceStatus>;
  /** Display label per law id. */
  lawLabel: Record<string, string>;
  needsReview: number;
}

/**
 * One entry per jurisdiction the profile reaches that has at least one
 * tracked law (passing `include`). NYC LL144 only ever lands on "NYC";
 * New York State ("NY") gets only state-level laws.
 */
export function rollupByJurisdiction(
  matches: LawMatch[],
  profile: ConfirmedProfile,
  checked: ReadonlySet<string>,
  todayIso: string,
  include: (law: Law) => boolean = () => true,
): Record<string, JurisdictionRollup> {
  const keys = profileKeys(profile);
  const out: Record<string, JurisdictionRollup> = {};
  for (const m of matches) {
    const key = m.rule.jurisdictionKey;
    if (!keys.has(key) || !include(m.law)) continue;
    (out[key] ??= {
      key,
      status: "not-applicable",
      label: "",
      laws: [],
      lawStatus: {},
      lawLabel: {},
      needsReview: 0,
    }).laws.push(m);
  }
  for (const r of Object.values(out)) {
    r.laws.sort((a, b) => Number(b.applies) - Number(a.applies));
    r.status = statusFor(r.laws, checked, todayIso);
    r.label = statusLabelFor(r.laws, checked, todayIso);
    for (const l of r.laws) {
      r.lawStatus[l.law.id] = statusFor([l], checked, todayIso);
      r.lawLabel[l.law.id] = statusLabelFor([l], checked, todayIso);
    }
    r.needsReview = r.laws.filter((l) => l.applies).reduce((n, l) => n + l.needsReview.length, 0);
  }
  return out;
}

/** Today's date as an ISO day (UTC). */
export function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
