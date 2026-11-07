import { ruleCard } from "@/data/law-library";
import { LAWS_BY_ID } from "@/data/laws";
import type { ComplianceStatus, Law } from "@/data/types";
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
  /** Not an action item (exemption, duplicate, rule about contracts...). */
  notADuty?: string;
  /** Only applies in a situation the profile doesn't describe. */
  onlyIf?: string;
  /** Duty only applies when the profile has this feature. */
  requiresFeature?: { feature: FeatureId; reason: string };
  /** Duty-specific start date (ISO), with the rule-card item it comes from. */
  effectiveDate?: string;
  /** Why this override exists (reviewed by hand). */
  note: string;
}

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
  /** Rule-card item ids this entry relies on. Empty when not extracted. */
  basis: string[];
  /** False = no rule card yet; only PRD facts are used. */
  extracted: boolean;
  /** Keyed by rule-card obligation index. */
  dutyOverrides?: Record<number, DutyOverride>;
  /** Duties from PRD facts, for laws with no rule card. */
  prdDuties?: PrdDuty[];
}

const EMPLOYMENT: FeatureId[] = ["resume_screening", "automated_employment_decision"];

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
    basis: [],
    extracted: false,
    prdDuties: [
      { index: 0, addressees: ["developer"] },
      { index: 1, addressees: ["developer"] },
    ],
  },
  {
    lawId: "ny-raise",
    jurisdictionKey: "NY",
    triggerFeatures: ["frontier_model_training"],
    coveredRoles: ["developer"],
    covers: "Frontier developers only",
    effectiveDate: "2027-01-01",
    basis: [],
    extracted: false,
    prdDuties: [
      { index: 0, addressees: ["developer"] },
      // PRD: "Developer registration begins Nov 2026" (month only).
      { index: 1, addressees: ["developer"], effectiveDate: "2026-11-01" },
    ],
  },
];

export const LAW_RULES_BY_ID: Record<string, LawRule> = Object.fromEntries(LAW_RULES.map((r) => [r.lawId, r]));

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

/** Jurisdiction keys a profile reaches. NYC is inside New York State. */
export function profileKeys(profile: ConfirmedProfile): Set<string> {
  const keys = new Set(profile.jurisdictions);
  if (keys.has("NYC")) keys.add("NY");
  return keys;
}

function sortDuty(
  base: Omit<Duty, "bucket" | "reason" | "addressees" | "isNotice">,
  cls: AddresseeClass,
  override: Pick<DutyOverride, "notADuty" | "onlyIf" | "requiresFeature"> | undefined,
  profile: ConfirmedProfile,
  lawReason: string | null,
): Duty {
  const make = (bucket: DutyBucket, reason: string): Duty => ({
    ...base,
    addressees: cls.addressees,
    bucket,
    reason,
    isNotice: bucket === "applicable" && isNoticeDuty(base.text, base.quote ?? "", cls.addressees),
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
      const cls = override?.addressees
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

export interface JurisdictionRollup {
  key: string;
  status: ComplianceStatus;
  /** All tracked laws for this jurisdiction (applying first). */
  laws: LawMatch[];
  /** Status per law id (same rules as the jurisdiction status). */
  lawStatus: Record<string, ComplianceStatus>;
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
    (out[key] ??= { key, status: "not-applicable", laws: [], lawStatus: {}, needsReview: 0 }).laws.push(m);
  }
  for (const r of Object.values(out)) {
    r.laws.sort((a, b) => Number(b.applies) - Number(a.applies));
    r.status = statusFor(r.laws, checked, todayIso);
    for (const l of r.laws) r.lawStatus[l.law.id] = statusFor([l], checked, todayIso);
    r.needsReview = r.laws.filter((l) => l.applies).reduce((n, l) => n + l.needsReview.length, 0);
  }
  return out;
}

/** Today's date as an ISO day (UTC). */
export function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
