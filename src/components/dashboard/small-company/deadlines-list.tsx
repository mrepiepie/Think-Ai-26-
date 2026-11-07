"use client";

import { LAWS_BY_ID } from "@/data/laws";
import type { Deadline } from "@/data/types";
import { daysUntil, useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";
import { Panel } from "../panel";
import { SampleBadge } from "../sample-badge";

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Countdown({ days }: { days: number }) {
  if (days < 0) return <span>passed</span>;
  if (days === 0) return <span className="text-primary">today</span>;
  return (
    <span className={cn(days <= 30 && "text-primary")}>
      in {days} day{days === 1 ? "" : "s"}
    </span>
  );
}

/** Bottom strip: upcoming effective dates and filing deadlines (F14). */
export function DeadlinesList({
  deadlines,
  className,
}: {
  deadlines: Deadline[];
  className?: string;
}) {
  const now = useNow();
  const sorted = [...deadlines].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <Panel title="Upcoming deadlines" sample className={className}>
      <ol className="divide-y divide-border">
        {sorted.map((d) => (
          <li key={d.id} className="grid grid-cols-[92px_1fr_auto] items-center gap-3 px-3 py-2">
            <div className="font-mono text-[10px]">
              <div>{d.dateLabel ?? formatDate(d.date)}</div>
              <div className="text-muted-foreground">
                {d.approximate
                  ? "month only"
                  : now !== null
                    ? <Countdown days={daysUntil(d.date, now)} />
                    : " "}
              </div>
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs">{d.title}</div>
              {d.lawId && (
                <div className="truncate text-[10.5px] text-muted-foreground">
                  {LAWS_BY_ID[d.lawId]?.name}
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span
                className={cn(
                  "rounded-sm border px-1 font-mono text-[9px] tracking-wider uppercase",
                  d.affectsYou ? "border-primary/50 text-primary" : "border-border text-muted-foreground",
                )}
              >
                {d.affectsYou ? "Applies to you" : "FYI"}
              </span>
              {d.sample && <SampleBadge label="Sample task" />}
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
