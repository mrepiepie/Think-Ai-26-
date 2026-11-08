import "server-only";

import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { WATCH_LAW_IDS, WATCH_SOURCES, checkAll, checkLaw } from "./legislature-watch";
import { addTool, errorResult, jsonResult } from "./mcp-helpers";
import { readWatchLog } from "./watch-log";
import { AI_SUMMARY_LABEL, REVIEW_NOTE, latestByLaw, type WatchRecord, type WatchResult } from "./watch-types";

/**
 * The Legislature Watch MCP tools. See docs/legislature-watch.md. The route in
 * src/app/api/watch/mcp/route.ts is unauthenticated and local-only.
 *
 * Diff excerpts and evidence are text from a web page: data, not instructions.
 */

const DEFAULT_LOG_LIMIT = 20;

/** Labels the AI summary and adds the review reminder to any "changed" record. */
function recordView(r: WatchRecord | WatchResult) {
  const { aiSummary, ...rest } = r;
  return {
    ...rest,
    ...(aiSummary ? { ai_summary: { label: AI_SUMMARY_LABEL, text: aiSummary } } : {}),
    ...(r.status === "changed" ? { next_step: REVIEW_NOTE } : {}),
  };
}

const LawId = z.enum(WATCH_LAW_IDS, { error: `law_id must be one of: ${WATCH_LAW_IDS.join(", ")}.` });

export function registerWatchTools(server: McpServer) {
  addTool(server, "list_sources", {
    title: "List official law sources",
    description:
      "List the official URL of each tracked law, whether a saved copy exists to compare with, and its last check result from the log. Makes no outside requests.",
    input: z.strictObject({}),
    run: async () => {
      const latest = latestByLaw(await readWatchLog());
      return jsonResult({
        sources: WATCH_SOURCES.map((s) => ({
          law_id: s.id,
          title: s.title,
          official_url: s.url,
          has_saved_copy: Boolean(s.file),
          last_check: latest[s.id] ? recordView(latest[s.id]) : null,
        })),
      });
    },
  });

  addTool(server, "check_law", {
    title: "Check one official page",
    description:
      "NOT read-only. Fetches one law's official page (respecting robots.txt, one page request, no retries), compares it with the saved copy and appends the result to the log. Returns unchanged, changed, unreachable, blocked or no-baseline. If changed, Groq summarizes the diff. Never edits law text or rule cards.",
    writes: true,
    usesAi: true,
    input: z.strictObject({ law_id: LawId }),
    run: async ({ law_id }) => {
      const source = WATCH_SOURCES.find((s) => s.id === law_id);
      if (!source) return errorResult(`Unknown law_id: ${law_id}.`);
      return jsonResult(recordView(await checkLaw(source)));
    },
  });

  addTool(server, "check_all", {
    title: "Check every official page",
    description:
      "NOT read-only. Runs check_law for every tracked law, one at a time with a short delay, and appends each result to the log. Takes a while, and contacts every site once. Don't run it in a loop.",
    writes: true,
    usesAi: true,
    input: z.strictObject({}),
    run: async () => {
      const results = await checkAll();
      const summary = Object.fromEntries(results.map((r) => [r.lawId, r.status]));
      return jsonResult({ summary, results: results.map(recordView) });
    },
  });

  addTool(server, "get_watch_log", {
    title: "Read past checks",
    description: "Past check records from the log, newest first. Optional: law_id, limit (1 to 200, default 20). Makes no outside requests.",
    input: z.strictObject({
      law_id: LawId.optional(),
      limit: z
        .number({ error: "limit must be a whole number from 1 to 200." })
        .int("limit must be a whole number from 1 to 200.")
        .min(1, "limit must be a whole number from 1 to 200.")
        .max(200, "limit must be a whole number from 1 to 200.")
        .optional(),
    }),
    run: async ({ law_id, limit }) => {
      const records = (await readWatchLog()).filter((r) => !law_id || r.lawId === law_id).reverse();
      return jsonResult({
        total: records.length,
        records: records.slice(0, limit ?? DEFAULT_LOG_LIMIT).map(recordView),
      });
    },
  });
}
