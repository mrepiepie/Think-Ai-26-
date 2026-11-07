import type { RuleCard, RuleCardsFile, RuleItem, RuleObligation } from "@/lib/rule-card";
import sourcesJson from "../../data/laws/sources.json";
import ruleCardsJson from "./generated/rule-cards.json";
import type { Law } from "./types";

/**
 * Law library: official law text sources (data/laws/sources.json) and the
 * AI-extracted rule cards (src/data/generated/rule-cards.json, written by
 * `npm run extract-laws`).
 *
 * Only rule-card items with verified: true (their quote was found in the
 * official text) are exposed as facts. Everything else counts as
 * "Not verified".
 */

export interface OfficialSource {
  id: string;
  title: string;
  url: string;
  fetched: string | null;
}

const SOURCES: Record<string, OfficialSource> = Object.fromEntries(
  (sourcesJson as OfficialSource[]).map((s) => [s.id, s]),
);

const RULE_CARDS = ruleCardsJson as unknown as RuleCardsFile;

export function officialSource(lawId: string): OfficialSource | undefined {
  return SOURCES[lawId];
}

/** Link for "Read the law": the official text, else the PRD citation. */
export function readTheLawLink(law: Law): { url: string; label: string; official: boolean } {
  const official = SOURCES[law.id];
  if (official) return { url: official.url, label: official.title, official: true };
  return { url: law.sources[0].url, label: law.sources[0].label, official: false };
}

export function ruleCard(lawId: string): RuleCard | undefined {
  return RULE_CARDS.cards[lawId];
}

export interface VerifiedRules {
  card: RuleCard;
  obligations: RuleObligation[];
  penalties: RuleItem[];
  enforcedBy: RuleItem[];
  curePeriod: RuleItem[];
  /** Extracted obligations whose quote did not match the law text. */
  unverifiedObligations: number;
}

/** Verified rule-card data for a law, or undefined if there is no card. */
export function verifiedRules(lawId: string): VerifiedRules | undefined {
  const card = RULE_CARDS.cards[lawId];
  if (!card) return undefined;
  const ok = <T extends RuleItem>(items: T[]) => items.filter((i) => i.verified);
  return {
    card,
    obligations: ok(card.obligations),
    penalties: ok(card.penalties),
    enforcedBy: ok(card.enforcedBy),
    curePeriod: ok(card.curePeriod),
    unverifiedObligations: card.obligations.length - ok(card.obligations).length,
  };
}
