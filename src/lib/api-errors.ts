import "server-only";

import type { GroqError } from "./groq";

export interface GroqErrorInfo {
  /** Clear, user-facing text (never includes the key or raw Groq output). */
  message: string;
  kind: GroqError["kind"];
  /** HTTP status for the API routes. */
  status: number;
  retryAfterSeconds?: number | null;
  /** The model's daily allowance is used up. */
  daily?: boolean;
}

/** What to tell the caller about a Groq failure. Shared by the API routes and the MCP tools. */
export function groqErrorInfo(err: GroqError): GroqErrorInfo {
  switch (err.kind) {
    case "missing-key":
      return {
        message: "The AI service is not configured on this server (GROQ_API_KEY missing).",
        kind: err.kind,
        status: 503,
      };
    case "rate-limit": {
      const secs = err.retryAfterMs ? Math.ceil(err.retryAfterMs / 1000) : null;
      const daily = /daily/i.test(err.message);
      const wait = secs ? (secs > 120 ? `about ${Math.ceil(secs / 60)} minutes` : `${secs} seconds`) : "a minute";
      return {
        message: daily
          ? `The AI service has used its daily allowance for this model. Try again in ${wait}.`
          : `The AI service is busy (rate limit). Try again in ${wait}.`,
        kind: err.kind,
        status: 429,
        retryAfterSeconds: secs,
        daily,
      };
    }
    case "timeout":
      return { message: "The AI service took too long to answer. Please try again.", kind: err.kind, status: 504 };
    case "request-too-large":
      return { message: "That input is too large for the AI service. Please shorten it.", kind: err.kind, status: 413 };
    default:
      console.error(`Groq ${err.kind}:`, err.message);
      return { message: "The AI service could not complete the request. Please try again.", kind: err.kind, status: 502 };
  }
}

/** Clear, user-facing JSON error for a Groq failure (never includes the key). */
export function groqErrorResponse(err: GroqError): Response {
  const info = groqErrorInfo(err);
  // The web app has a "Load example" button to fall back on.
  const error = info.daily ? info.message.replace(/\.$/, ', or use "Load example".') : info.message;
  if (info.kind === "rate-limit") {
    const secs = info.retryAfterSeconds;
    return Response.json(
      { error, kind: info.kind, retryAfterSeconds: secs },
      { status: info.status, headers: secs ? { "Retry-After": String(secs) } : undefined },
    );
  }
  return Response.json({ error, kind: info.kind }, { status: info.status });
}
