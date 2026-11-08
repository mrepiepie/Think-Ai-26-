import "server-only";

import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { WatchRecord } from "./watch-types";

/**
 * Append-only log of Legislature Watch checks: one JSON record per line.
 *
 * VERCEL: the deployed file system is not persistent, so appends there fail or
 * vanish. A deployed version needs a database or KV store behind these two
 * functions. Until then a failed write returns false rather than crashing,
 * and the result says it wasn't saved.
 */

const LOG_FILE = () => path.join(process.cwd(), "data", "watch", "checks.ndjson");

export async function appendWatchRecord(record: WatchRecord): Promise<boolean> {
  try {
    const file = LOG_FILE();
    await mkdir(path.dirname(file), { recursive: true });
    await appendFile(file, `${JSON.stringify(record)}\n`, "utf8");
    return true;
  } catch (err) {
    console.error("Legislature Watch log write failed:", err instanceof Error ? err.name : "unknown error");
    return false;
  }
}

/** Oldest first. No log yet = no records. A line that won't parse is skipped. */
export async function readWatchLog(): Promise<WatchRecord[]> {
  let text: string;
  try {
    text = await readFile(LOG_FILE(), "utf8");
  } catch {
    return [];
  }
  return parseWatchLog(text);
}

export function parseWatchLog(text: string): WatchRecord[] {
  return text.split("\n").flatMap((line) => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line) as WatchRecord];
    } catch {
      return [];
    }
  });
}
