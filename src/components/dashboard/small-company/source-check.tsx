"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runWatchCheck, useWatch } from "@/lib/use-watch";
import { cn } from "@/lib/utils";
import { AI_SUMMARY_LABEL, REVIEW_NOTE, STATUS_LABEL, type WatchRecord, type WatchStatus } from "@/lib/watch-types";
import { Eyebrow } from "../panel";

const CHECKED_AT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const STATUS_STYLE: Record<WatchStatus, string> = {
  unchanged: "border-border text-foreground",
  changed: "border-status-soon/60 text-status-soon",
  unreachable: "border-border text-muted-foreground",
  blocked: "border-border text-muted-foreground",
  "no-baseline": "border-border text-muted-foreground",
};

const STATUS_MEANING: Record<WatchStatus, string> = {
  unchanged: "The official page matches the saved copy.",
  changed: "The official page differs from the saved copy.",
  unreachable: "Not compared.",
  blocked: "Not compared.",
  "no-baseline": "Not compared.",
};

/**
 * "Check official source": runs one Legislature Watch check on click and shows
 * what it found. Page text is rendered as plain text only.
 */
export function SourceCheck({ lawId }: { lawId: string }) {
  const { status, pending, errors } = useWatch();
  const record = status?.latest[lawId];
  const running = pending.has(lawId);
  const error = errors[lawId];
  return (
    <div className="space-y-1.5">
      <Button variant="outline" size="xs" onClick={() => void runWatchCheck(lawId)} disabled={running}>
        {running ? (
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
        ) : (
          <RefreshCw data-icon="inline-start" />
        )}
        {running ? "Checking official source…" : "Check official source"}
      </Button>
      {error && (
        <p role="alert" className="text-[11px] text-status-soon">
          {error}
        </p>
      )}
      {record && <CheckResult record={record} />}
    </div>
  );
}

function CheckResult({ record }: { record: WatchRecord }) {
  return (
    <div className="space-y-1.5 text-[11px]" aria-live="polite">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span
          className={cn(
            "rounded-sm border px-1 font-mono text-[9.5px] tracking-wider uppercase",
            STATUS_STYLE[record.status],
          )}
        >
          {STATUS_LABEL[record.status]}
        </span>
        <span className="font-mono text-[9.5px] text-muted-foreground">
          Checked {CHECKED_AT.format(new Date(record.checkedAt))} UTC
        </span>
      </div>
      <p className="text-muted-foreground">
        {STATUS_MEANING[record.status]}
        {record.reason && ` ${record.reason}`}
      </p>
      {record.status === "changed" && (
        <div className="space-y-1.5 rounded-md border border-status-soon/40 bg-status-soon/5 p-2">
          <p className="font-medium">{REVIEW_NOTE}.</p>
          {record.aiSummary ? (
            <div>
              <Eyebrow>{AI_SUMMARY_LABEL}</Eyebrow>
              <p className="leading-relaxed">{record.aiSummary}</p>
            </div>
          ) : (
            record.aiSummaryError && <p className="text-muted-foreground italic">{record.aiSummaryError}</p>
          )}
          {record.diff && (
            <>
              <DiffList title="Removed from the saved copy" items={record.diff.removed} total={record.diff.removedCount} />
              <DiffList title="New on the official page" items={record.diff.added} total={record.diff.addedCount} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DiffList({ title, items, total }: { title: string; items: string[]; total: number }) {
  if (total === 0) return null;
  return (
    <div className="space-y-0.5">
      <Eyebrow>
        {title} ({items.length === total ? total : `${items.length} of ${total}`})
      </Eyebrow>
      <ul className="max-h-40 space-y-1 overflow-y-auto">
        {items.map((text, i) => (
          <li key={i} className="border-l-2 border-border pl-1.5 leading-relaxed text-muted-foreground">
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}
