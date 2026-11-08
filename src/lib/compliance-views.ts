import { readTheLawLink, ruleCard } from "@/data/law-library";
import { LAWS, LAWS_BY_ID } from "@/data/laws";
import { jurisdictionName } from "@/data/states";
import type { LawStatusTag } from "@/data/types";
import { enforcementNote, TAG_LABEL } from "./compliance";
import { confirmQuestions, fromDraft } from "./confirm-questions";
import {
  LAW_RULES,
  LAW_RULES_BY_ID,
  matchCompany,
  profileKeys,
  reviewedItems,
  rollupByJurisdiction,
  type Duty,
  type LawMatch,
  type LawRule,
} from "./matching";
import {
  checkQuote,
  FEATURE_LABEL,
  readCompanyName,
  type ConfirmedProfile,
  type ProductProfileDraft,
} from "./product-profile";
import { RULE_FIELDS, type RuleCard, type RuleField, type RuleItem, type RuleObligation } from "./rule-card";

/**
 * Read-only views of the law data and matching results, as returned by the
 * MCP tools (src/lib/mcp-tools.ts). Plain code, no AI and no I/O: the rules
 * themselves live in matching.ts and law-library.ts.
 */

export const DISCLAIMER = "Not legal advice.";

/** Every MCP tool response ends with the disclaimer. */
export function withDisclaimer(text: string): string {
  return `${text}\n\n${DISCLAIMER}`;
}

export const LAW_IDS = LAW_RULES.map((r) => r.lawId) as [string, ...string[]];

const PRD_DATE = "From PRD summary";
const TEXT_DATE = "Official law text";

function dateSource(rule: LawRule): string {
  return rule.extracted && !rule.effectiveDateFromPrd ? TEXT_DATE : PRD_DATE;
}

const lawUrl = (lawId: string) => readTheLawLink(LAWS_BY_ID[lawId]).url;

/* ------------------------------------------------------------------ */
/* list_laws                                                           */
/* ------------------------------------------------------------------ */

export function listLawsView(filter: { state?: string; status?: LawStatusTag }) {
  const laws = LAWS.filter((law) => {
    const rule = LAW_RULES_BY_ID[law.id];
    // "NYC" means the city only; "NY" also lists NYC's law, labelled New York City.
    const inState = !filter.state || (filter.state === "NYC" ? rule.jurisdictionKey === "NYC" : law.state === filter.state);
    return inState && (!filter.status || law.tags.includes(filter.status));
  });
  return {
    count: laws.length,
    laws: laws.map((law) => {
      const rule = LAW_RULES_BY_ID[law.id];
      return {
        id: law.id,
        title: law.name,
        jurisdiction: law.jurisdiction,
        status: law.tags.map((t) => TAG_LABEL[t]),
        effective: law.effective,
        effective_date: rule.effectiveDate,
        effective_date_source: dateSource(rule),
        official_url: readTheLawLink(law).url,
        extracted: rule.extracted,
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* get_rule_card                                                       */
/* ------------------------------------------------------------------ */

const asObligation = (item: RuleItem) => item as Partial<RuleObligation>;

/** A card's items with their ids. Reviewed items replace the extracted ones for that field. */
function cardItems(card: RuleCard, lawId: string, field: RuleField): { id: string; item: RuleItem }[] {
  const reviewed = reviewedItems(LAW_RULES_BY_ID[lawId], field);
  if (reviewed) return reviewed.map((item, i) => ({ id: `${lawId}/${field}/reviewed-${i}`, item }));
  return (card[field] as RuleItem[]).map((item, i) => ({ id: `${lawId}/${field}/${i}`, item }));
}

export function ruleCardView(lawId: string) {
  const law = LAWS_BY_ID[lawId];
  const card = ruleCard(lawId);
  if (!card) {
    return {
      law_id: lawId,
      title: law.name,
      official_url: lawUrl(lawId),
      extracted: false,
      verified_items: 0,
      unverified_hidden: 0,
      message: "No rule card has been extracted for this law yet, so there are no verified quotes to show.",
    };
  }
  let verified = 0;
  let hidden = 0;
  const sections = Object.fromEntries(
    RULE_FIELDS.map((field) => {
      const items = cardItems(card, lawId, field).flatMap(({ id, item }) => {
        if (!item.verified) {
          hidden++;
          return [];
        }
        // A "not stated in the law text" line has no quote, so it isn't a verified quote.
        if (item.quote) verified++;
        const { who, timing } = asObligation(item);
        return [
          {
            id,
            text: item.text,
            ...(who ? { who } : {}),
            ...(timing ? { timing } : {}),
            ...(item.quote ? { quote: item.quote, official_url: card.sourceUrl } : {}),
          },
        ];
      });
      return [field, items];
    }),
  );
  return {
    law_id: lawId,
    title: card.title,
    official_url: card.sourceUrl,
    extracted: true,
    verified_items: verified,
    unverified_hidden: hidden,
    message: `${hidden} unverified item${hidden === 1 ? " was" : "s were"} hidden (quote not found in the official text).`,
    ...sections,
  };
}

/* ------------------------------------------------------------------ */
/* search_laws                                                         */
/* ------------------------------------------------------------------ */

/** Lowercase letter/digit runs: "Non-compliant, 72h" -> ["non", "compliant", "72h"]. */
function words(s: string): string[] {
  return s.normalize("NFKD").toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/** Duties first, because the same quote often also backs a covered-party or trigger item. */
const SEARCH_ORDER: RuleField[] = [
  "obligations",
  "penalties",
  "enforcedBy",
  "curePeriod",
  "effectiveDate",
  "triggers",
  "coveredParties",
];

/**
 * Plain keyword search over verified items, no AI. Every query word must
 * start a word in the item's summary, quote or addressee ("disclos" finds
 * "disclosure"). More hits rank first; repeated quotes appear once.
 */
export function searchLaws(input: { query: string; lawId?: string; limit?: number }) {
  const terms = [...new Set(words(input.query))];
  const seen = new Set<string>();
  const scored = [];
  for (const lawId of input.lawId ? [input.lawId] : LAW_IDS) {
    const card = ruleCard(lawId);
    if (!card) continue;
    for (const field of SEARCH_ORDER) {
      for (const { id, item } of cardItems(card, lawId, field)) {
        if (!item.verified || !item.quote) continue;
        const haystack = words(`${item.text} ${item.quote} ${asObligation(item).who ?? ""}`);
        const hits = terms.map((t) => haystack.filter((w) => w.startsWith(t)).length);
        if (terms.length === 0 || hits.some((n) => n === 0)) continue;
        const key = `${lawId}|${words(item.quote).join(" ")}`;
        if (seen.has(key)) continue;
        seen.add(key);
        scored.push({
          score: hits.reduce((a, b) => a + b, 0),
          match: {
            id,
            law_id: lawId,
            law: LAWS_BY_ID[lawId].name,
            type: field,
            text: item.text,
            quote: item.quote,
            official_url: card.sourceUrl,
          },
        });
      }
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const limit = input.limit ?? 10;
  return { query: input.query, total_matches: scored.length, matches: scored.slice(0, limit).map((s) => s.match) };
}

/* ------------------------------------------------------------------ */
/* analyze_product                                                     */
/* ------------------------------------------------------------------ */

type QuoteCheck = "found" | "not_found" | "no_quote";

function quoteCheck(quote: string, description: string): QuoteCheck {
  if (!quote.trim()) return "no_quote";
  return checkQuote(quote, description) ? "found" : "not_found";
}

export function analyzeProductView(draft: ProductProfileDraft, description: string) {
  const unknown = [
    ...(draft.role === "unknown" ? ["role"] : []),
    ...(draft.is_government === "unknown" ? ["is_government"] : []),
    ...draft.features.filter((f) => f.status === "unknown").map((f) => `feature:${f.id}`),
    ...draft.jurisdictions.filter((j) => j.status === "unknown").map((j) => `jurisdiction:${j.code}`),
  ];
  return {
    draft_profile: {
      // A name that isn't in the description is dropped, never shown as fact.
      company_name: {
        value: readCompanyName(draft, description).name,
        quote: draft.company_name_quote,
        quote_check: quoteCheck(draft.company_name_quote, description),
      },
      role: { value: draft.role, quote: draft.role_quote, quote_check: quoteCheck(draft.role_quote, description) },
      features: draft.features.map((f) => ({
        id: f.id,
        label: FEATURE_LABEL[f.id],
        status: f.status,
        quote: f.quote,
        quote_check: quoteCheck(f.quote, description),
      })),
      jurisdictions: draft.jurisdictions.map((j) => ({
        code: j.code,
        name: jurisdictionName(j.code),
        status: j.status,
        quote: j.quote,
        quote_check: quoteCheck(j.quote, description),
      })),
      is_government: draft.is_government,
      notes: draft.notes,
    },
    unknown_fields: unknown,
    confirm_questions: confirmQuestions(fromDraft(draft, description)).map((q) => q.text),
    human_review:
      "This is an AI draft. A human should confirm every field and resolve anything unknown, then pass the confirmed profile to check_product.",
  };
}

/* ------------------------------------------------------------------ */
/* check_product                                                       */
/* ------------------------------------------------------------------ */

function dutyView(d: Duty, todayIso: string) {
  return {
    id: d.id,
    text: d.text,
    who: d.who,
    timing: d.timing,
    in_force: d.effectiveDate <= todayIso,
    effective_date: d.effectiveDate,
    effective_date_source: d.dateFromPrd ? PRD_DATE : TEXT_DATE,
    // PRD-only duties have no quote and say so; they are never presented as law text.
    ...(d.source === "prd" ? { source: PRD_DATE } : { quote: d.quote, official_url: lawUrl(d.lawId) }),
    can_draft_notice: d.isNotice,
  };
}

function lawView(m: LawMatch, label: string, todayIso: string) {
  const note = enforcementNote(m.law);
  const base = {
    law_id: m.law.id,
    title: m.law.name,
    status: label,
    ...(note ? { status_note: note } : {}),
    applies: m.applies,
    reason: m.reason,
    effective: m.law.effective,
    official_url: readTheLawLink(m.law).url,
    extracted: m.rule.extracted,
  };
  if (!m.applies) {
    return { ...base, duties_not_applying: m.notApplicable.length + m.needsReview.length + m.applicable.length };
  }
  return {
    ...base,
    applicable: m.applicable.map((d) => dutyView(d, todayIso)),
    needs_review: m.needsReview.map((d) => ({
      id: d.id,
      text: d.text,
      why: d.reason,
      ...(d.quote ? { quote: d.quote } : {}),
    })),
    doesnt_apply: m.notApplicable.map((d) => ({ id: d.id, text: d.text, why: d.reason })),
    unverified_hidden: m.unverifiedCount,
  };
}

/**
 * Runs matchCompany and reports per jurisdiction with the app's honest
 * status labels. MCP has no checkboxes, so no duty counts as done yet.
 */
export function checkProductView(profile: ConfirmedProfile, todayIso: string) {
  const rollup = rollupByJurisdiction(matchCompany(profile), profile, new Set(), todayIso);
  const untracked = [...profileKeys(profile)].filter((k) => !rollup[k]);
  return {
    as_of: todayIso,
    note: "Status assumes no duty has been done yet: this tool can't know what you have already done. It never says you comply.",
    jurisdictions: Object.values(rollup).map((r) => ({
      key: r.key,
      name: jurisdictionName(r.key),
      status: r.label,
      needs_review_count: r.needsReview,
      laws: r.laws.map((m) => lawView(m, r.lawLabel[m.law.id], todayIso)),
    })),
    no_tracked_laws: untracked.map(jurisdictionName),
  };
}
