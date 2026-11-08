import "server-only";

import type { McpServer, StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import { z } from "zod";
import { groqErrorInfo } from "./api-errors";
import {
  LAW_IDS,
  analyzeProductView,
  checkProductView,
  listLawsView,
  ruleCardView,
  searchLaws,
  withDisclaimer,
} from "./compliance-views";
import { GroqError } from "./groq";
import { isoDay } from "./matching";
import { citedLabels } from "./notice";
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

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const textResult = (text: string): ToolResult => ({ content: [{ type: "text", text: withDisclaimer(text) }] });
const jsonResult = (data: unknown) => textResult(JSON.stringify(data, null, 2));
const errorResult = (message: string): ToolResult => ({ ...textResult(`Error: ${message}`), isError: true });

type Parsed<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * The SDK answers invalid input itself, with its own wording and no
 * disclaimer. This keeps the zod schema for tools/list but hands validation
 * failures to our handler, so those responses follow the same rules.
 */
function reportInvalid<S extends z.ZodType>(schema: S): StandardSchemaWithJSON<z.input<S>, Parsed<z.output<S>>> {
  const standard = schema["~standard"] as unknown as StandardSchemaWithJSON<z.input<S>, z.output<S>>["~standard"];
  return {
    "~standard": {
      version: standard.version,
      vendor: standard.vendor,
      jsonSchema: standard.jsonSchema,
      validate: (value: unknown) => {
        const result = schema.safeParse(value);
        if (result.success) return { value: { ok: true, data: result.data } };
        const error = result.error.issues
          .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
          .join("; ");
        return { value: { ok: false, error } };
      },
    },
  };
}

interface ToolSpec<S extends z.ZodType> {
  title: string;
  description: string;
  input: S;
  /** Calls the Groq API, an outside service. */
  usesAi?: boolean;
  run: (input: z.output<S>, signal: AbortSignal) => ToolResult | Promise<ToolResult>;
}

function addTool<S extends z.ZodType>(server: McpServer, name: string, spec: ToolSpec<S>) {
  server.registerTool(
    name,
    {
      title: spec.title,
      description: spec.description,
      inputSchema: reportInvalid(spec.input),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: !spec.usesAi,
        openWorldHint: Boolean(spec.usesAi),
      },
    },
    async (parsed, ctx) => {
      if (!parsed.ok) return errorResult(`Invalid input for ${name}. ${parsed.error}`);
      try {
        return await spec.run(parsed.data, ctx.mcpReq.signal);
      } catch (err) {
        if (err instanceof GroqError) {
          const info = groqErrorInfo(err);
          const retry = info.retryAfterSeconds ? ` (retry_after_seconds: ${info.retryAfterSeconds})` : "";
          return errorResult(`${info.message}${retry}`);
        }
        // Name only: an unexpected error's message could carry anything.
        console.error(`MCP tool ${name} failed:`, err instanceof Error ? err.name : "unknown error");
        return errorResult(`${name} failed unexpectedly. Please try again.`);
      }
    },
  );
}

const LawId = z.enum(LAW_IDS, { error: `law_id must be one of: ${LAW_IDS.join(", ")}.` });

const Profile = ConfirmedProfile.extend({
  jurisdictions: ConfirmedProfile.shape.jurisdictions.min(1, "List at least one jurisdiction."),
}).describe('A confirmed profile: role, features, jurisdictions (state codes, or "NYC" for New York City) and isGovernment.');

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
        .enum(["in-force", "coming-soon", "challenged"], {
          error: 'status must be "in-force", "coming-soon" or "challenged".',
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
      const draft = await draftNoticeText(prepared.prompt, signal);
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
