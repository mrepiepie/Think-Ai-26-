import { ArrowUpRight, CornerDownRight } from "lucide-react";
import type { AlertsView } from "@/lib/law-alerts";
import { cn } from "@/lib/utils";
import { Panel } from "../panel";

/**
 * Bottom strip: law change alerts (F5). Before matching onSelectJurisdiction
 * is undefined, because there is no checklist to jump to yet.
 */
export function AlertsFeed({
  view,
  onSelectJurisdiction,
  className,
}: {
  view: AlertsView;
  onSelectJurisdiction?: (key: string) => void;
  className?: string;
}) {
  return (
    <Panel
      title="Law change alerts"
      className={className}
      actions={<span className="font-mono text-[10px] text-muted-foreground">{view.scope}</span>}
    >
      {view.rows.length === 0 ? (
        <p className="p-3 text-xs text-muted-foreground">
          No tracked law applies to your confirmed profile, so there are no events to show.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {view.rows.map((a) => (
            <li
              key={a.id}
              className={cn(
                "grid grid-cols-[84px_1fr] gap-3 border-l-2 px-3 py-2",
                a.impact ? "border-l-primary" : "border-l-transparent",
              )}
            >
              <div className="space-y-1 font-mono text-[10px] text-muted-foreground">
                <div className="text-foreground">{a.dateLabel}</div>
                <div className="flex flex-wrap gap-1">
                  {onSelectJurisdiction ? (
                    <button
                      type="button"
                      onClick={() => onSelectJurisdiction(a.jurisdictionKey)}
                      aria-label={`Show the ${a.jurisdictionKey} checklist`}
                      className="rounded-sm border border-border px-1 transition-colors hover:border-primary/60 hover:text-foreground focus-visible:border-primary focus-visible:outline-none"
                    >
                      {a.jurisdictionKey}
                    </button>
                  ) : (
                    <span className="rounded-sm border border-border px-1">{a.jurisdictionKey}</span>
                  )}
                  {a.upcoming && <span className="rounded-sm bg-primary/20 px-1 text-primary">UPCOMING</span>}
                </div>
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="text-xs leading-snug">
                  <span className="mr-1.5 font-mono text-[9.5px] tracking-wider text-muted-foreground uppercase">
                    {a.typeLabel}
                  </span>
                  {a.description}
                </div>
                {a.impact && (
                  <div className="flex items-start gap-1 text-[11px] text-primary">
                    <CornerDownRight className="mt-0.5 size-3 shrink-0" aria-hidden />
                    {a.impact}
                  </div>
                )}
                <a
                  href={a.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-mono text-[9.5px] tracking-wider text-muted-foreground uppercase hover:text-primary hover:underline focus-visible:text-primary focus-visible:underline focus-visible:outline-none"
                >
                  Source: {a.sourceKind}
                  <ArrowUpRight className="size-2.5" aria-hidden />
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
