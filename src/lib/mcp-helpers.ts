import "server-only";

import type { McpServer, StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import type { z } from "zod";
import { groqErrorInfo } from "./api-errors";
import { withDisclaimer } from "./compliance-views";
import { GroqError } from "./groq";

/** Shared by both MCP servers. Every response ends with the disclaimer, including errors. */

export type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

export const textResult = (text: string): ToolResult => ({ content: [{ type: "text", text: withDisclaimer(text) }] });
export const jsonResult = (data: unknown) => textResult(JSON.stringify(data, null, 2));
export const errorResult = (message: string): ToolResult => ({ ...textResult(`Error: ${message}`), isError: true });

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

export interface ToolSpec<S extends z.ZodType> {
  title: string;
  description: string;
  input: S;
  /** Calls the Groq API, an outside service. */
  usesAi?: boolean;
  /** Reaches outside and writes a record, so it isn't read-only. */
  writes?: boolean;
  run: (input: z.output<S>, signal: AbortSignal) => ToolResult | Promise<ToolResult>;
}

export function addTool<S extends z.ZodType>(server: McpServer, name: string, spec: ToolSpec<S>) {
  server.registerTool(
    name,
    {
      title: spec.title,
      description: spec.description,
      inputSchema: reportInvalid(spec.input),
      annotations: {
        readOnlyHint: !spec.writes,
        destructiveHint: false,
        idempotentHint: !spec.usesAi && !spec.writes,
        openWorldHint: Boolean(spec.usesAi || spec.writes),
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
