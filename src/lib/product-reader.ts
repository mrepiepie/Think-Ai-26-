import "server-only";

import { z } from "zod";
import { GROQ_MODELS, groqStructured } from "./groq";
import { DESCRIPTION_LIMITS, FEATURES, ProductProfileDraft } from "./product-profile";

/**
 * PRODUCT READER (AI). Turns a plain-language product description into a
 * draft profile (company name, role, features from a fixed list,
 * jurisdictions, government flag). Unclear items come back as "unknown" for the user to
 * confirm; matching itself is done later in code (src/lib/matching.ts).
 * Used by /api/product-reader and the analyze_product MCP tool.
 */

export const ProductDescription = z
  .string()
  .trim()
  .min(DESCRIPTION_LIMITS.min, `Please describe your product in at least ${DESCRIPTION_LIMITS.min} characters.`)
  .max(DESCRIPTION_LIMITS.max, `Please keep the description under ${DESCRIPTION_LIMITS.max} characters.`);

const SYSTEM = `You read a company's plain-language description of its AI product and fill in a profile. You do not give legal advice and you do not decide which laws apply.

Rules:
- Use ONLY what the description says. Never guess. If something is hinted at but unclear, use "unknown" (role, is_government) or status "unknown" (features, jurisdictions).
- Every quote must be words copied exactly from the description (a short phrase is fine). Use "" if there is nothing to quote.
- company_name: the company's own name, copied exactly as written in the description. Never use a product, customer or vendor name. Use null if the description doesn't state the company's name, and set company_name_quote to the words you copied ("" if none).
- role: "developer" if the company builds or sells the AI to others; "deployer" if it uses AI in its own operations or decisions (e.g. on its own applicants, customers or users); "both" if the description says both; else "unknown".
- features: pick only from this fixed list. Include a feature only if the description mentions or clearly hints at it:
${FEATURES.map((f) => `  - ${f.id}: ${f.definition}`).join("\n")}
- jurisdictions: US states (two-letter codes, e.g. "TX"), "DC", or "NYC" for New York City, ONLY where the description says the company has users, customers, applicants or employees. "New York City" -> "NYC" (not "NY"). "New York State" or just "New York" (not the city) -> "NY". Countries other than the US are ignored.
- is_government: "yes" only if the company itself is a government agency; "no" if it is clearly a private business; else "unknown".
- notes: up to 5 short assumptions the user should confirm (e.g. "Assumed applicants are adults").`;

/** Throws GroqError on failure (rate limits fail fast rather than waiting long). */
export function readProduct(description: string) {
  return groqStructured({
    schema: ProductProfileDraft,
    schemaName: "product_profile",
    system: SYSTEM,
    user: `Product description:\n"""\n${description}\n"""`,
    model: GROQ_MODELS.productReader,
    maxCompletionTokens: 3000,
    reasoningEffort: "low",
    maxRetries: 1,
    maxWaitMs: 10_000,
    timeoutMs: 45_000,
  });
}
