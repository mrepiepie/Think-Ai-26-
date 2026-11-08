import type { LawMatch } from "./matching";

/** First line of every notice draft (written by the server, not the model). */
export const DRAFT_HEADER = "DRAFT - not legal advice - review with a lawyer\n\n";

export interface NoticeQuote {
  /** "Q1", "Q2", ... in the order sent to the model. */
  label: string;
  dutyId: string;
  text: string;
  quote: string;
}

/**
 * The verified quotes behind a law's applicable notice/disclosure duties.
 * Only rule-card duties qualify (PRD-only duties have no quote).
 */
export function noticeQuotes(match: LawMatch): NoticeQuote[] {
  if (!match.applies) return [];
  return match.applicable
    .filter((d) => d.isNotice && d.source === "rule-card" && d.quote)
    .map((d, i) => ({ label: `Q${i + 1}`, dutyId: d.id, text: d.text, quote: d.quote! }));
}

/**
 * Deterministic backstop: if the model still wrote the [Company name]
 * placeholder, fill in the confirmed name. No name leaves the placeholder.
 */
export function fillCompanyName(draft: string, name: string | null | undefined): string {
  if (!name) return draft;
  return draft.replace(/\[\s*company(?:'s)?\s+name\s*\]/gi, () => name);
}

/** Quote labels a draft cites, e.g. "[Q1]" or "[Q2, Q3]" -> {"Q1","Q2","Q3"}. */
export function citedLabels(draft: string): Set<string> {
  const out = new Set<string>();
  for (const [, inner] of draft.matchAll(/\[((?:Q\d+\s*,?\s*)+)\]/g)) {
    for (const m of inner.matchAll(/Q\d+/g)) out.add(m[0]);
  }
  return out;
}
