import { CornerDownRight } from "lucide-react";
import type { LawChangeAlert } from "@/data/types";
import { cn } from "@/lib/utils";
import { Panel } from "../panel";

const KIND_LABEL: Record<LawChangeAlert["kind"], string> = {
  signed: "Signed",
  replaced: "Replaced",
  challenged: "Challenged",
  rulemaking: "Rulemaking",
  enforcement: "Enforcement",
  delayed: "Delayed",
};

/** Bottom strip: law change alerts (F5). */
export function AlertsFeed({
  alerts,
  onSelectState,
  className,
}: {
  alerts: LawChangeAlert[];
  onSelectState: (code: string) => void;
  className?: string;
}) {
  const sorted = [...alerts].sort((a, b) => b.sortDate.localeCompare(a.sortDate));
  return (
    <Panel
      title="Law change alerts"
      sample
      className={className}
      actions={
        <span className="font-mono text-[10px] text-muted-foreground">
          {alerts.filter((a) => a.affectsYou).length} affect you
        </span>
      }
    >
      <ul className="divide-y divide-border">
        {sorted.map((a, i) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onSelectState(a.state)}
              className={cn(
                "grid w-full grid-cols-[84px_1fr] gap-3 border-l-2 px-3 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none",
                a.affectsYou ? "border-l-primary" : "border-l-transparent",
              )}
            >
              <div className="space-y-1 font-mono text-[10px] text-muted-foreground">
                <div className="text-foreground">{a.dateLabel}</div>
                <div className="flex gap-1">
                  <span className="rounded-sm border border-border px-1">{a.state}</span>
                  {i === 0 && <span className="rounded-sm bg-primary/20 px-1 text-primary">LATEST</span>}
                </div>
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="text-xs leading-snug">
                  <span className="mr-1.5 font-mono text-[9.5px] tracking-wider text-muted-foreground uppercase">
                    {KIND_LABEL[a.kind]}
                  </span>
                  {a.headline}
                </div>
                <div
                  className={cn(
                    "flex items-start gap-1 text-[11px]",
                    a.affectsYou ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <CornerDownRight className="mt-0.5 size-3 shrink-0" aria-hidden />
                  {a.impact}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
