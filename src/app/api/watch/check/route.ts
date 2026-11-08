import { z } from "zod";
import { WATCH_LAW_IDS, WATCH_SOURCES, checkLaw, watchStatus } from "@/lib/legislature-watch";
import { localOnly } from "@/lib/local-only";

/**
 * The checklist's "Check official source" button. Localhost only, like the MCP
 * servers: it sends requests to government sites and can spend the Groq key.
 * Only law ids from sources.json are accepted, so a caller can't supply a URL.
 */

export const maxDuration = 120;

const Body = z.strictObject({ law_id: z.enum(WATCH_LAW_IDS) });

export const POST = localOnly(async (request) => {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Unknown law." }, { status: 400 });
  const source = WATCH_SOURCES.find((s) => s.id === parsed.data.law_id)!;
  try {
    const result = await checkLaw(source);
    return Response.json({ result, status: await watchStatus() });
  } catch (err) {
    console.error("watch check failed:", err instanceof Error ? err.name : "unknown error");
    return Response.json({ error: "The check failed unexpectedly. Please try again." }, { status: 500 });
  }
});
