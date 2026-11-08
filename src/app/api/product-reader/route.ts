import { z } from "zod";
import { GroqError } from "@/lib/groq";
import { groqErrorResponse } from "@/lib/api-errors";
import { ProductDescription, readProduct } from "@/lib/product-reader";

/** Product reader over HTTP. The reader itself is in src/lib/product-reader.ts. */

export const maxDuration = 60;

const Body = z.object({ description: ProductDescription });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON.", kind: "bad-input" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request.", kind: "bad-input" },
      { status: 400 },
    );
  }

  try {
    const result = await readProduct(parsed.data.description);
    return Response.json({ profile: result.data, model: result.model, usage: result.usage });
  } catch (err) {
    if (err instanceof GroqError) return groqErrorResponse(err);
    console.error("product-reader failed", err);
    return Response.json({ error: "Something went wrong reading your description.", kind: "server" }, { status: 500 });
  }
}
