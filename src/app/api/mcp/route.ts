import {
  hostHeaderValidationResponse,
  localhostAllowedHostnames,
  localhostAllowedOrigins,
  originValidationResponse,
} from "@modelcontextprotocol/server";
import { createMcpHandler } from "mcp-handler";
import { registerComplianceTools } from "@/lib/mcp-tools";

/**
 * COMPLIANCE MCP SERVER (Streamable HTTP, stateless). See docs/mcp.md.
 *
 * ************************************************************************
 * UNAUTHENTICATED: FOR LOCAL DEMO USE ONLY.
 * There is no auth and no rate limiting, and two tools spend the Groq key.
 * So this route answers localhost only: any other Host or Origin gets a
 * 403, including on a Vercel deployment. Before any public deployment, add
 * auth AND rate limiting, and only then change the allowed hosts below.
 * ************************************************************************
 */

export const maxDuration = 60;

const ALLOWED_HOSTS = localhostAllowedHostnames();
const ALLOWED_ORIGINS = localhostAllowedOrigins();

const handler = createMcpHandler(registerComplianceTools, {
  serverInfo: { name: "compliance-mapper", version: "0.1.0" },
});

async function localOnly(request: Request): Promise<Response> {
  return (
    hostHeaderValidationResponse(request, ALLOWED_HOSTS) ??
    originValidationResponse(request, ALLOWED_ORIGINS) ??
    handler(request)
  );
}

export { localOnly as GET, localOnly as POST };
