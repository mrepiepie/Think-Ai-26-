import { ArrowUpRight } from "lucide-react";
import type { DeadlineRow } from "@/lib/law-alerts";
import { cn } from "@/lib/utils";
import { Panel } from "../panel";

/**
 * Bottom strip: upcoming dates (F14), all computed. `rows` is null until the
 * clock is available, because "upcoming" can't be worked out before then.
 */
export function DeadlinesList({
  rows,
  matched,
  className,
}: {
  rows: DeadlineRow[] | null;
  matched: boolean;
  className?: string;
}) {
  return (
    <Panel title="Upcoming deadlines" className={className}>
      {rows?.length === 0 && (
        <p className="p-3 text-xs text-muted-foreground">
          {matched ? "No upcoming dates for the laws that apply to you." : "No upcoming dates across the tracked laws."}
        </p>
      )}
      <ol className="divide-y divide-border">
        {rows?.map((d) => (
          <li key={d.id} className="grid grid-cols-[92px_1fr_auto] items-center gap-3 px-3 py-2">
            <div className="font-mono text-[10px]">
              <div>{d.dateLabel}</div>
              <div className={cn("text-muted-foreground", d.daysLeft !== null && d.daysLeft <= 30 && "text-primary")}>
                {d.countdown}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-xs leading-snug">{d.title}</div>
              <div className="flex flex-wrap items-center gap-x-2 text-[10.5px] text-muted-foreground">
                <span>{d.lawName}</span>
                {d.sourceUrl && (
                  <a
                    href={d.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 font-mono text-[9.5px] tracking-wider uppercase hover:text-primary hover:underline focus-visible:text-primary focus-visible:underline focus-visible:outline-none"
                  >
                    Source: {d.sourceKind}
                    <ArrowUpRight className="size-2.5" aria-hidden />
                  </a>
                )}
              </div>
            </div>
            {d.tag && (
              <span
                className={cn(
                  "shrink-0 rounded-sm border px-1 font-mono text-[9px] tracking-wider uppercase",
                  d.tag === "Applies to you" ? "border-primary/50 text-primary" : "border-border text-muted-foreground",
                )}
              >
                {d.tag}
              </span>
            )}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
