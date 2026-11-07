/**
 * Quote verification: does a quote really appear in the law text?
 *
 * Comparison ignores case, whitespace and punctuation (so curly vs
 * straight quotes, line breaks, dashes and the official ALL-CAPS
 * convention don't matter). Every letter and digit must match, in order,
 * as one contiguous run. If the model used an ellipsis, each part must
 * appear, in order; tiny parts don't count.
 */

/** Minimum letters/digits a quote (or each ellipsis part) must have. */
export const MIN_QUOTE_CHARS = 25;

export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export interface QuoteCheck {
  verified: boolean;
  reason?: string;
}

/** `normalizedLaw` must come from normalizeForMatch(lawText). */
export function verifyQuote(quote: string, normalizedLaw: string): QuoteCheck {
  const parts = quote
    .split(/\.\s*\.\s*\.|…|\[\s*\.\.\.\s*\]/)
    .map(normalizeForMatch)
    .filter((p) => p.length > 0);

  if (parts.length === 0) return { verified: false, reason: "empty quote" };

  const total = parts.reduce((n, p) => n + p.length, 0);
  if (total < MIN_QUOTE_CHARS) {
    return { verified: false, reason: `quote too short to verify (${total} letters/digits)` };
  }
  if (parts.length > 1 && parts.some((p) => p.length < MIN_QUOTE_CHARS)) {
    return { verified: false, reason: "ellipsis quote with a part too short to verify" };
  }

  let from = 0;
  for (const part of parts) {
    const at = normalizedLaw.indexOf(part, from);
    if (at === -1) {
      return {
        verified: false,
        reason: parts.length > 1 ? "a part of the quote is not in the law text" : "quote not found in the law text",
      };
    }
    from = at + part.length;
  }
  return { verified: true };
}
