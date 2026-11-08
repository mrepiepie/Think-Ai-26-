import { createMcpHandler } from "mcp-handler";
import { localOnly } from "@/lib/local-only";
import { registerComplianceTools } from "@/lib/mcp-tools";

/**
 * COMPLIANCE MCP SERVER (Streamable HTTP, stateless). See docs/mcp.md.
 *
 * ************************************************************************
 * UNAUTHENTICATED: FOR LOCAL DEMO USE ONLY.
 * There is no auth and no rate limiting, and two tools spend the Groq key.
 * So this route answers localhost only (src/lib/local-only.ts).
 * ************************************************************************
 */

export const maxDuration = 60;

const handler = localOnly(
  createMcpHandler(registerComplianceTools, {
    serverInfo: { name: "compliance-mapper", version: "0.1.0" },
  }),
);

export { handler as GET, handler as POST };
