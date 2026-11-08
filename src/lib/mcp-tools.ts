import "server-only";

import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  LAW_IDS,
  analyzeProductView,
  checkProductView,
  listLawsView,
  ruleCardView,
  searchLaws,
} from "./compliance-views";
import { isoDay } from "./matching";
import { addTool, errorResult, jsonResult, textResult } from "./mcp-helpers";
import { citedLabels, fillCompanyName } from "./notice";
import { draftNoticeText, prepareNoticeDraft } from "./notice-draft";
import { ConfirmedProfile, JURISDICTION_CODES } from "./product-profile";
import { ProductDescription, readProduct } from "./product-reader";

/**
 * The Compliance MCP tools. All are read-only. They only call the shared
 * functions (matching, rule cards, product reader, notice drafter); no tool
 * touches files or environment variables, and only groq.ts reads the API key.
 *
 * See docs/mcp.md. The route in src/app/api/mcp/route.ts is unauthenticated
 * and local-only.
 */

const LawId = z.enum(LAW_IDS, { error: `law_id must be one of: ${LAW_IDS.join(", ")}.` });

const Profile = ConfirmedProfile.extend({
  jurisdictions: ConfirmedProfile.shape.jurisdictions.min(1, "List at least one jurisdiction."),
}).describe(
  'A confirmed profile: role, features, jurisdictions (state codes, or "NYC" for New York City), isGovernment and, optionally, companyName (used in drafts).',
);

export function registerComplianceTools(server: McpServer) {
  addTool(server, "list_laws", {
    title: "List tracked laws",
    description:
      'List the state AI laws this tool tracks, with status, effective date, official URL and whether a rule card has been extracted. Optional filters: state (a USPS code, or "NYC" for New York City only) and status.',
    input: z.strictObject({
      state: z
        .enum(JURISDICTION_CODES, { error: 'state must be a two-letter US code such as "TX", or "NYC".' })
        .optional(),
      status: z
        .enum(["in-force", "coming-soon", "challenged", "enforcement-paused"], {
          error: 'status must be "in-force", "coming-soon", "challenged" or "enforcement-paused".',
        })
        .optional(),
    }),
    run: (input) => jsonResult(listLawsView(input)),
  });

  addTool(server, "get_rule_card", {
    title: "Get a law's rule card",
    description:
      "Get a law's rule card: only items whose quote was found in the official text, each with its exact quote and the official URL, plus how many unverified items were hidden.",
    input: z.strictObject({ law_id: LawId }),
    run: ({ law_id }) => jsonResult(ruleCardView(law_id)),
  });

  addTool(server, "search_laws", {
    title: "Search verified law items",
    description:
      'Plain keyword search (no AI) over verified rule-card items. Every word must match the start of a word, so "disclos" finds "disclosure". Returns each match with its quote and law.',
    input: z.strictObject({
      query: z
        .string()
        .trim()
        .min(2, "query must be at least 2 characters.")
        .max(200, "query must be at most 200 characters.")
        .regex(/[\p{L}\p{N}]/u, "query must contain a letter or digit."),
      law_id: LawId.optional(),
      limit: z
        .number({ error: "limit must be a whole number from 1 to 50." })
        .int("limit must be a whole number from 1 to 50.")
        .min(1, "limit must be a whole number from 1 to 50.")
        .max(50, "limit must be a whole number from 1 to 50.")
        .optional(),
    }),
    run: ({ query, law_id, limit }) => jsonResult(searchLaws({ query, lawId: law_id, limit })),
  });

  addTool(server, "analyze_product", {
    title: "Read a product description (AI)",
    description:
      'Runs the AI product reader (Groq) on a plain-language description. Returns a DRAFT profile with "unknown" where the description is unclear and a check of each supporting quote. A human should confirm it before using check_product.',
    usesAi: true,
    input: z.strictObject({ description: ProductDescription }),
    run: async ({ description }) => {
      const result = await readProduct(description);
      return jsonResult(analyzeProductView(result.data, description));
    },
  });

  addTool(server, "check_product", {
    title: "Check a confirmed profile (no AI)",
    description:
      "Runs the matching engine on a confirmed profile, with no AI. Per jurisdiction: status, applicable duties with quotes, duties needing review, and duties that don't apply with reasons.",
    input: z.strictObject({ profile: Profile }),
    run: ({ profile }) => jsonResult(checkProductView(profile, isoDay(Date.now()))),
  });

  addTool(server, "draft_notice", {
    title: "Draft a notice (AI)",
    description:
      "Drafts a notice for a law with a notice or disclosure duty that applies to the profile. The server re-runs matching and gives the AI only verified quotes, cited as [Qn]. Returns the full text, starting with the DRAFT header.",
    usesAi: true,
    input: z.strictObject({ law_id: LawId, profile: Profile }),
    run: async ({ law_id, profile }, signal) => {
      const prepared = prepareNoticeDraft(law_id, profile);
      if (!prepared.ok) return errorResult(prepared.error);
      const draft = fillCompanyName(await draftNoticeText(prepared.prompt, signal), profile.companyName);
      const known = new Set(prepared.quotes.map((q) => q.label));
      const stray = [...citedLabels(draft)].filter((label) => !known.has(label));
      return textResult(
        [
          draft.trimEnd(),
          "",
          "---",
          `Verified quotes from the official text (${prepared.match.law.name}):`,
          ...prepared.quotes.map((q) => `[${q.label}] "${q.quote}"`),
          ...(stray.length ? ["", `Warning: the draft cites unknown quotes: ${stray.join(", ")}. Remove those claims.`] : []),
        ].join("\n"),
      );
    },
  });
}
