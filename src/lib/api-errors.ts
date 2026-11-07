import "server-only";

import type { GroqError } from "./groq";

/** Clear, user-facing JSON error for a Groq failure (never includes the key). */
export function groqErrorResponse(err: GroqError): Response {
  switch (err.kind) {
    case "missing-key":
      return Response.json(
        { error: "The AI service is not configured on this server (GROQ_API_KEY missing).", kind: err.kind },
        { status: 503 },
      );
    case "rate-limit": {
      const secs = err.retryAfterMs ? Math.ceil(err.retryAfterMs / 1000) : null;
      const daily = /daily/i.test(err.message);
      const wait = secs ? (secs > 120 ? `about ${Math.ceil(secs / 60)} minutes` : `${secs} seconds`) : "a minute";
      return Response.json(
        {
          error: daily
            ? `The AI service has used its daily allowance for this model. Try again in ${wait}, or use "Load example".`
            : `The AI service is busy (rate limit). Try again in ${wait}.`,
          kind: err.kind,
          retryAfterSeconds: secs,
        },
        { status: 429, headers: secs ? { "Retry-After": String(secs) } : undefined },
      );
    }
    case "timeout":
      return Response.json({ error: "The AI service took too long to answer. Please try again.", kind: err.kind }, { status: 504 });
    case "request-too-large":
      return Response.json({ error: "That input is too large for the AI service. Please shorten it.", kind: err.kind }, { status: 413 });
    default:
      console.error(`Groq ${err.kind}:`, err.message);
      return Response.json(
        { error: "The AI service could not complete the request. Please try again.", kind: err.kind },
        { status: 502 },
      );
  }
}
