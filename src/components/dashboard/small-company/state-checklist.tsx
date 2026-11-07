"use client";

import { ArrowUpRight, CheckCircle2, Circle, MapPinned } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { stateName } from "@/data/states";
import type { Law, LawAssessment } from "@/data/types";
import type { StateRollup } from "@/lib/compliance";
import { cn } from "@/lib/utils";
import { Eyebrow, Panel } from "../panel";
import { LawTags, StatusPill } from "./status";

/** Right panel: per-state obligations for the selected state. */
export function StateChecklist({
  state,
  rollup,
  className,
}: {
  state: string | null;
  rollup: StateRollup | undefined;
  className?: string;
}) {
  return (
    <Panel title="State checklist" sample className={className}>
      {!state ? (
        <EmptyState text="Click a state on the map to see its checklist." />
      ) : (
        <div>
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-2.5 backdrop-blur">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{stateName(state)}</div>
              <div className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                {rollup ? `${rollup.items.length} tracked law${rollup.items.length === 1 ? "" : "s"}` : "No tracked laws"}
              </div>
            </div>
            {rollup && <StatusPill status={rollup.status} />}
          </div>
          {!rollup ? (
            <EmptyState text="No tracked laws for this state in the sample set, or they are hidden by your filters." />
          ) : (
            <ul className="divide-y divide-border">
              {rollup.items.map(({ law, assessment }) => (
                <LawCard key={law.id} law={law} assessment={assessment} />
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}

function LawCard({ law, assessment }: { law: Law; assessment: LawAssessment }) {
  const na = assessment.status === "not-applicable";
  return (
    <li className="space-y-2.5 px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="text-[13px] leading-tight font-semibold">{law.name}</div>
          <LawTags tags={law.tags} />
        </div>
        <StatusPill status={assessment.status} />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{assessment.reason}</p>

      {!na && assessment.checklist.length > 0 && (
        <div className="space-y-1">
          <Eyebrow>Obligations</Eyebrow>
          <ul className="space-y-1">
            {assessment.checklist.map((item) => (
              <li key={item.task} className="flex items-start gap-2 text-xs">
                {item.done ? (
                  <CheckCircle2 className="mt-px size-3.5 shrink-0 text-status-compliant" aria-label="Done" />
                ) : (
                  <Circle className="mt-px size-3.5 shrink-0 text-muted-foreground" aria-label="To do" />
                )}
                <span className={cn("flex-1", item.done && "text-muted-foreground line-through decoration-muted-foreground/40")}>
                  {item.task}
                </span>
                <span className="shrink-0 font-mono text-[9.5px] text-muted-foreground">
                  {item.deadline}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="grid grid-cols-[72px_1fr] gap-x-2 gap-y-1 text-[11px]">
        <dt className="text-muted-foreground">Applies to</dt>
        <dd>{law.appliesTo}</dd>
        <dt className="text-muted-foreground">Deadline</dt>
        <dd>{law.effective}</dd>
        <dt className="text-muted-foreground">Penalty</dt>
        <dd className={cn(!law.penalty && "text-muted-foreground italic")}>
          {law.penalty ?? "Not in verified sources yet"}
        </dd>
        {law.enforcement.enforcer && (
          <>
            <dt className="text-muted-foreground">Enforced by</dt>
            <dd>
              {law.enforcement.enforcer}
              {law.enforcement.curePeriod && ` · ${law.enforcement.curePeriod} cure period`}
            </dd>
          </>
        )}
      </dl>

      {law.notes.length > 0 && (
        <ul className="space-y-1 border-l border-primary/40 pl-2 text-[11px] leading-relaxed text-muted-foreground">
          {law.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      <a
        href={law.sources[0].url}
        target="_blank"
        rel="noopener noreferrer"
        title={`Opens the source cited for this law: ${law.sources[0].label}`}
        className={cn(buttonVariants({ variant: "outline", size: "xs" }), "font-mono text-[10px] tracking-wider uppercase")}
      >
        Read the law
        <ArrowUpRight data-icon="inline-end" />
      </a>
    </li>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 p-6 text-center text-xs text-muted-foreground">
      <MapPinned className="size-5 text-primary/70" aria-hidden />
      {text}
    </div>
  );
}
