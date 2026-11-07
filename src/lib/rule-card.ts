import { z } from "zod";

/**
 * Rule card schema: what the AI "law reader" extracts from each law.
 * Every item carries a `quote`: the exact sentence(s) from the official
 * law text that support it. Quotes are checked in code afterwards
 * (see quote-verify.ts); only verified items are shown as facts.
 */

const quote = z
  .string()
  .describe(
    "Exact, contiguous words copied character-for-character from the law text that support this item. One or two full sentences or clauses. No ellipses, no paraphrase, no added words.",
  );

export const ExtractedItem = z.object({
  text: z.string().describe("Plain-English summary of this item, at most 25 words."),
  quote,
});

export const ExtractedObligation = z.object({
  text: z
    .string()
    .describe("What the covered party must do or must not do, in plain English, at most 25 words."),
  who: z.string().describe("Who must do it, as the law names them (e.g. 'employer', 'operator', 'large frontier developer')."),
  timing: z
    .string()
    .nullable()
    .describe("Deadline or timing stated in the law for this duty (e.g. 'within 15 days', 'at least every three hours', 'annually'), or null if the law states none."),
  quote,
});

/** What the model returns for one chunk of law text. */
export const ChunkExtraction = z.object({
  coveredParties: z.array(ExtractedItem).describe("Who the law covers or applies to."),
  triggers: z.array(ExtractedItem).describe("What activity or condition makes the law apply."),
  obligations: z.array(ExtractedObligation).describe("Duties and prohibitions, each with its deadline or timing."),
  penalties: z.array(ExtractedItem).describe("Civil penalties, fines, damages or other remedies for violations."),
  enforcedBy: z.array(ExtractedItem).describe("Who enforces the law (e.g. attorney general), and whether there is a private right of action."),
  curePeriod: z.array(ExtractedItem).describe("Any period to cure a violation before enforcement or penalties."),
  effectiveDate: z.array(ExtractedItem).describe("When the law or parts of it take effect or apply."),
});

export type ChunkExtraction = z.infer<typeof ChunkExtraction>;

export const RULE_FIELDS = [
  "coveredParties",
  "triggers",
  "obligations",
  "penalties",
  "enforcedBy",
  "curePeriod",
  "effectiveDate",
] as const;

export type RuleField = (typeof RULE_FIELDS)[number];

export interface RuleItem {
  text: string;
  quote: string;
  /** True only when the quote was found in the official law text. */
  verified: boolean;
  /** Why verification failed, when it did. */
  failReason?: string;
  /** Which text chunk(s) the item came from (1-based). */
  chunks: number[];
}

export interface RuleObligation extends RuleItem {
  who: string;
  timing: string | null;
}

export interface RuleCard {
  lawId: string;
  title: string;
  sourceUrl: string;
  fetched: string;
  model: string;
  extractedAt: string;
  chunkCount: number;
  coveredParties: RuleItem[];
  triggers: RuleItem[];
  obligations: RuleObligation[];
  penalties: RuleItem[];
  enforcedBy: RuleItem[];
  curePeriod: RuleItem[];
  effectiveDate: RuleItem[];
  stats: { items: number; verified: number; failed: number };
}

export interface RuleCardsFile {
  generatedAt: string | null;
  model: string | null;
  note: string;
  cards: Record<string, RuleCard>;
  /** Laws the script could not process, with the reason. */
  skipped: Record<string, string>;
}
