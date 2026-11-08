import {
  hostHeaderValidationResponse,
  localhostAllowedHostnames,
  localhostAllowedOrigins,
  originValidationResponse,
} from "@modelcontextprotocol/server";

/**
 * ************************************************************************
 * UNAUTHENTICATED ROUTES: FOR LOCAL DEMO USE ONLY.
 * There is no auth and no rate limiting, and these routes spend the Groq key
 * or send requests to government sites. So they answer localhost only: any
 * other Host or Origin gets a 403, including on a Vercel deployment. Before
 * any public deployment, add auth AND rate limiting, and only then change the
 * allowed hosts below.
 * ************************************************************************
 */

const ALLOWED_HOSTS = localhostAllowedHostnames();
const ALLOWED_ORIGINS = localhostAllowedOrigins();

/** A 403 for anything not from localhost, otherwise the handler's response. */
export function localOnly(handler: (request: Request) => Response | Promise<Response>) {
  return async (request: Request): Promise<Response> =>
    hostHeaderValidationResponse(request, ALLOWED_HOSTS) ??
    originValidationResponse(request, ALLOWED_ORIGINS) ??
    handler(request);
}
