import { Flag, TrendingUp } from "lucide-react";
import type { InvestigatedCompany } from "@/data/types";
import { cn } from "@/lib/utils";
import { Panel } from "../panel";

export function totalComplaints(c: InvestigatedCompany) {
  return Object.values(c.complaintsByState).reduce((s, n) => s + n, 0);
}

/** F19: companies ranked by complaint volume, flagged above a threshold. */
export function FlaggedCompanies({
  companies,
  threshold,
  selectedId,
  onSelect,
  className,
}: {
  companies: InvestigatedCompany[];
  threshold: number;
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const ranked = [...companies].sort((a, b) => totalComplaints(b) - totalComplaints(a));
  const max = Math.max(...ranked.map(totalComplaints));
  return (
    <Panel
      title="Flagged companies"
      sample
      className={className}
      actions={
        <span className="font-mono text-[10px] text-muted-foreground">
          Flag at ≥{threshold} complaints
        </span>
      }
    >
      <ul className="divide-y divide-border">
        {ranked.map((c) => {
          const total = totalComplaints(c);
          const flagged = total >= threshold;
          const active = c.id === selectedId;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                aria-pressed={active}
                className={cn(
                  "grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 border-l-2 px-3 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none",
                  active ? "border-l-primary bg-primary/5" : "border-l-transparent",
                  !flagged && "opacity-60",
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    {flagged && <Flag className="size-3 text-primary" aria-label="Flagged" />}
                    <span className="truncate">{c.name}</span>
                    <span className="shrink-0 rounded-sm border border-dashed border-border px-1 font-mono text-[8.5px] tracking-wider text-muted-foreground uppercase">
                      Fictional
                    </span>
                  </div>
                  <div className="text-[10.5px] text-muted-foreground">
                    {c.tool} · {Object.keys(c.complaintsByState).join(", ")}
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-base leading-none tabular-nums">{total}</div>
                  <div className="mt-0.5 flex items-center justify-end gap-1 text-[9.5px] text-muted-foreground uppercase">
                    {c.trend === "rising" && <TrendingUp className="size-3 text-primary" aria-hidden />}
                    {c.trend}
                  </div>
                </div>
                <div className="col-span-2 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", flagged ? "bg-primary" : "bg-muted-foreground/50")}
                    style={{ width: `${(total / max) * 100}%` }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
