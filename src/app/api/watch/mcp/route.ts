import { createMcpHandler } from "mcp-handler";
import { localOnly } from "@/lib/local-only";
import { registerWatchTools } from "@/lib/watch-mcp-tools";

/**
 * LEGISLATURE WATCH MCP SERVER (Streamable HTTP, stateless). See
 * docs/legislature-watch.md.
 *
 * ************************************************************************
 * UNAUTHENTICATED: FOR LOCAL DEMO USE ONLY.
 * There is no auth and no rate limiting, the check tools send requests to
 * government sites and can spend the Groq key. So this route answers
 * localhost only (src/lib/local-only.ts).
 * ************************************************************************
 */

// check_all waits on every site in turn, so it needs far longer than one request.
export const maxDuration = 300;

const handler = localOnly(
  createMcpHandler(registerWatchTools, {
    serverInfo: { name: "legislature-watch", version: "0.1.0" },
  }),
);

export { handler as GET, handler as POST };
