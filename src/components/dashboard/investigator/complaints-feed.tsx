"use client";

import type { Complaint, InvestigatedCompany } from "@/data/types";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";
import { Panel } from "../panel";

function timeAgo(iso: string, now: number | null) {
  const t = Date.parse(iso);
  if (now === null) {
    return new Date(t).toISOString().slice(0, 10);
  }
  const mins = Math.max(0, Math.round((now - t) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** Left column: incoming complaints (unverified allegations). */
export function ComplaintsFeed({
  complaints,
  companies,
  selectedCompanyId,
  onSelectCompany,
  className,
}: {
  complaints: Complaint[];
  companies: Record<string, InvestigatedCompany>;
  selectedCompanyId: string;
  onSelectCompany: (id: string) => void;
  className?: string;
}) {
  const now = useNow();
  const sorted = [...complaints].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  return (
    <Panel
      title="Complaints feed"
      sample
      className={className}
      actions={
        <span className="font-mono text-[10px] text-muted-foreground">{complaints.length} recent</span>
      }
    >
      <p className="border-b border-border px-3 py-1.5 text-[10.5px] text-muted-foreground">
        Fictional companies. Complaints are unverified allegations, not findings.
      </p>
      <ul className="divide-y divide-border">
        {sorted.map((c) => {
          const company = companies[c.companyId];
          const active = c.companyId === selectedCompanyId;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelectCompany(c.companyId)}
                aria-pressed={active}
                className={cn(
                  "w-full space-y-1 border-l-2 px-3 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none",
                  active ? "border-l-primary bg-primary/5" : "border-l-transparent",
                )}
              >
                <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                  <span className="text-foreground">{c.id}</span>
                  <span className="rounded-sm border border-border px-1">{c.state}</span>
                  <span>{c.channel}</span>
                  <span className="ml-auto tabular-nums" suppressHydrationWarning>
                    {timeAgo(c.receivedAt, now)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium">{company?.name}</span>
                  <span className="shrink-0 font-mono text-[9.5px] tracking-wide text-primary uppercase">
                    {c.category}
                  </span>
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">{c.summary}</p>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
