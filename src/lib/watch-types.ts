import type { LawEvent } from "@/data/law-events";

/**
 * Legislature Watch shapes and pure helpers. Safe to import from client code;
 * the fetching lives in legislature-watch.ts.
 */

export type WatchStatus = "unchanged" | "changed" | "unreachable" | "blocked" | "no-baseline";

export const AI_SUMMARY_LABEL = "AI summary of changes - verify against the official page";
export const REVIEW_NOTE = "Re-run the law reader after review";

export interface WatchDiff {
  /** Passages only in the new text, capped. */
  added: string[];
  /** Passages only in the saved text, capped. */
  removed: string[];
  addedCount: number;
  removedCount: number;
}

/** One line of the append-only log. */
export interface WatchRecord {
  lawId: string;
  url: string;
  /** ISO time of the check. */
  checkedAt: string;
  status: WatchStatus;
  /** The HTTP status that decided the result, when there was one. */
  httpStatus: number | null;
  /** Why it was blocked, unreachable or not compared, in plain words. */
  reason: string | null;
  /** sha256 of the normalized saved text; null if there is no saved text. */
  savedHash: string | null;
  /** sha256 of the normalized page text; null if no text was read. */
  liveHash: string | null;
  diff: WatchDiff | null;
  /** Exact excerpt of the NEW text. Only on "changed". */
  evidence: string | null;
  aiSummary: string | null;
  /** Why there is no AI summary on a "changed" record. */
  aiSummaryError: string | null;
}

/** A check's result: false means the log could not be written. */
export type WatchResult = WatchRecord & { persisted: boolean };

export const STATUS_LABEL: Record<WatchStatus, string> = {
  unchanged: "Unchanged",
  changed: "Changed",
  unreachable: "Unreachable",
  blocked: "Blocked",
  "no-baseline": "No saved copy",
};

/**
 * Law events from the log: one per law and new text, dated by the first check
 * that saw it, however many times it is re-checked. A record with no evidence
 * makes no event. These are derived, never added to LAW_EVENTS, because their
 * evidence is by definition not in the saved law text.
 */
export function watchEvents(records: readonly WatchRecord[]): LawEvent[] {
  const events = new Map<string, LawEvent>();
  const oldestFirst = [...records].sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));
  for (const r of oldestFirst) {
    if (r.status !== "changed" || !r.evidence || !r.liveHash) continue;
    const id = `watch-${r.lawId}-${r.liveHash.slice(0, 12)}`;
    if (events.has(id)) continue;
    events.set(id, {
      id,
      date: r.checkedAt.slice(0, 10),
      lawId: r.lawId,
      type: "text-changed",
      description: `The official page differs from the saved copy of this law. ${REVIEW_NOTE}.`,
      sourceUrl: r.url,
      sourceKind: "Official page check",
      evidence: r.evidence,
    });
  }
  return [...events.values()];
}

/** The newest record per law. */
export function latestByLaw(records: readonly WatchRecord[]): Record<string, WatchRecord> {
  const latest: Record<string, WatchRecord> = {};
  for (const r of records) {
    const seen = latest[r.lawId];
    if (!seen || r.checkedAt >= seen.checkedAt) latest[r.lawId] = r;
  }
  return latest;
}

export interface WatchSummary {
  lastCheckedAt: string | null;
  /** Laws whose latest check really compared the text. */
  compared: number;
  total: number;
  counts: Record<WatchStatus, number>;
}

export function summarizeWatch(latest: Record<string, WatchRecord>, total: number): WatchSummary {
  const counts: Record<WatchStatus, number> = { unchanged: 0, changed: 0, unreachable: 0, blocked: 0, "no-baseline": 0 };
  let lastCheckedAt: string | null = null;
  for (const r of Object.values(latest)) {
    counts[r.status]++;
    if (!lastCheckedAt || r.checkedAt > lastCheckedAt) lastCheckedAt = r.checkedAt;
  }
  return { lastCheckedAt, compared: counts.unchanged + counts.changed, total, counts };
}

/** What GET /api/watch/status returns. */
export interface WatchStatusPayload {
  latest: Record<string, WatchRecord>;
  events: LawEvent[];
  summary: WatchSummary;
}
