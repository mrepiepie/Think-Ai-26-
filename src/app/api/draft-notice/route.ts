import { z } from "zod";
import { groqErrorResponse } from "@/lib/api-errors";
import { GROQ_MODELS, GroqError } from "@/lib/groq";
import { ConfirmedProfile } from "@/lib/product-profile";
import { DRAFT_HEADER } from "@/lib/notice";
import { noticeDraftStream, prepareNoticeDraft } from "@/lib/notice-draft";

/**
 * Notice drafter, streamed as plain text over HTTP. The drafter itself
 * (re-matching, verified quotes only) is in src/lib/notice-draft.ts.
 */

export const maxDuration = 60;

const Body = z.object({ lawId: z.string(), profile: ConfirmedProfile });

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

  const prepared = prepareNoticeDraft(parsed.data.lawId, parsed.data.profile);
  if (!prepared.ok) return Response.json({ error: prepared.error, kind: "bad-input" }, { status: 400 });

  let stream: AsyncGenerator<string, void, undefined>;
  let first: IteratorResult<string, void>;
  try {
    stream = noticeDraftStream(prepared.prompt, request.signal);
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
