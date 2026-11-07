import { z } from "zod";
import { jurisdictionName } from "@/data/states";
import { groqErrorResponse } from "@/lib/api-errors";
import { GROQ_MODELS, GroqError, groqStream } from "@/lib/groq";
import { LAW_RULES_BY_ID, matchLaw } from "@/lib/matching";
import { ConfirmedProfile, FEATURE_LABEL, ROLE_LABEL } from "@/lib/product-profile";
import { DRAFT_HEADER, noticeQuotes } from "@/lib/notice";

/**
 * NOTICE DRAFTER (AI, streamed as plain text over HTTP).
 *
 * The server re-runs the matching engine for the requested law, so the
 * only law text sent to Groq is the verified quotes of the notice /
 * disclosure duties that apply to this profile. Nothing the client sends
 * is used as a quote.
 */

export const maxDuration = 60;

const Body = z.object({ lawId: z.string(), profile: ConfirmedProfile });

const SYSTEM = `You draft a short notice or disclosure that a company could give to people affected by its AI product. You are not a lawyer and this is not legal advice.

Rules:
- Base every requirement ONLY on the numbered quotes provided. Do not add other legal requirements, deadlines, penalties or facts.
- After each sentence that relies on a quote, cite it in square brackets, e.g. [Q1] or [Q2, Q3].
- Use [square-bracket placeholders] for anything you don't know: [Company name], [Product name], [Contact email], [Date], [Link to bias audit summary], etc. Never invent names, dates, numbers or links.
- Write in plain English, short paragraphs, addressed to the reader of the notice (e.g. job applicants or consumers).
- Do NOT write a title line saying it is a draft; that is added for you.
- End with a final line exactly in the form: "Quotes relied on: Q1, Q3" listing every quote you cited.`;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON.", kind: "bad-input" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request.", kind: "bad-input" }, { status: 400 });
  }
  const { lawId, profile } = parsed.data;
  const rule = LAW_RULES_BY_ID[lawId];
  if (!rule) return Response.json({ error: "Unknown law.", kind: "bad-input" }, { status: 400 });

  const match = matchLaw(rule, profile);
  const quotes = noticeQuotes(match);
  if (!match.applies || quotes.length === 0) {
    return Response.json(
      { error: "This law has no verified notice or disclosure duty that applies to your profile.", kind: "bad-input" },
      { status: 400 },
    );
  }

  const user = [
    `Law: ${match.law.name} (${jurisdictionName(rule.jurisdictionKey)})`,
    "",
    "Company profile:",
    `- Role: ${ROLE_LABEL[profile.role]}`,
    `- AI features: ${profile.features.map((f) => FEATURE_LABEL[f]).join(", ") || "none listed"}`,
    `- Has users/applicants/employees in: ${profile.jurisdictions.map(jurisdictionName).join(", ")}`,
    `- Government agency: ${profile.isGovernment ? "yes" : "no"}`,
    "",
    "Verified quotes from the official law text (the ONLY legal basis you may use):",
    ...quotes.map((q) => `[${q.label}] "${q.quote}"`),
    "",
    "Draft the notice now.",
  ].join("\n");

  let stream: AsyncGenerator<string, void, undefined>;
  let first: IteratorResult<string, void>;
  try {
    stream = groqStream({
      system: SYSTEM,
      user,
      model: GROQ_MODELS.drafter,
      reasoningEffort: "none",
      maxCompletionTokens: 1200,
      temperature: 0.3,
      signal: request.signal,
    });
    // Pull the first chunk before answering, so setup errors become a proper HTTP status.
    first = await stream.next();
  } catch (err) {
    if (err instanceof GroqError) return groqErrorResponse(err);
    console.error("draft-notice failed", err);
    return Response.json({ error: "Could not start the draft.", kind: "server" }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(DRAFT_HEADER));
      try {
        if (!first.done && first.value) controller.enqueue(encoder.encode(first.value));
        if (!first.done) {
          for await (const chunk of stream) controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        const msg = err instanceof GroqError ? err.message : "unexpected error";
        controller.enqueue(encoder.encode(`\n\n[Draft stopped: ${msg}]`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      void stream.return(undefined);
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Content-Type-Options": "nosniff",
      "X-Groq-Model": GROQ_MODELS.drafter,
    },
  });
}
