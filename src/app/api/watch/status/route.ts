import { connection } from "next/server";
import { watchStatus } from "@/lib/legislature-watch";

/**
 * What past checks found, from the log. Makes no outside requests. connection()
 * keeps cacheComponents from prerendering a stale result at build time.
 *
 * Vercel's file system isn't persistent, so a deployment only sees a log
 * bundled at build time. A real deployment needs a database or KV store.
 */
export async function GET() {
  await connection();
  return Response.json(await watchStatus());
}
