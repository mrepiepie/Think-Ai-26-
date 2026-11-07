"use client";

import { ArrowUpRight, CheckCircle2, Circle, MapPinned, Quote, ScrollText } from "lucide-react";
import { useId, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { readTheLawLink, verifiedRules } from "@/data/law-library";
import { stateName } from "@/data/states";
import type { Law, LawAssessment } from "@/data/types";
import type { StateRollup } from "@/lib/compliance";
import type { RuleItem, RuleObligation } from "@/lib/rule-card";
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
  const rules = verifiedRules(law.id);
  const lawLink = readTheLawLink(law);
  const fromLaw = rules && rules.obligations.length > 0;
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

      {!na && fromLaw && (
        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <Eyebrow>What the law requires</Eyebrow>
            <span
              className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase"
              title="Extracted by AI from the official law text. Each item shown has a quote that was matched word-for-word against that text. Not legal advice."
            >
              From official text
            </span>
          </div>
          <ObligationList obligations={rules.obligations} />
          {rules.unverifiedObligations > 0 && (
            <p className="text-[10.5px] text-muted-foreground italic">
              {rules.unverifiedObligations} more extracted obligation
              {rules.unverifiedObligations === 1 ? "" : "s"}: Not verified (quote not found in the law text), so
              not shown.
            </p>
          )}
        </div>
      )}

      {!na && assessment.checklist.length > 0 && (
        <div className="space-y-1">
          <Eyebrow>{fromLaw ? "Your progress (sample)" : "Obligations"}</Eyebrow>
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
        <FactCell items={rules?.penalties} fallback={law.penalty} />
        <dt className="text-muted-foreground">Enforced by</dt>
        <FactCell items={rules?.enforcedBy} fallback={law.enforcement.enforcer} />
        {(rules?.curePeriod.length || law.enforcement.curePeriod) && (
          <>
            <dt className="text-muted-foreground">Cure period</dt>
            <FactCell items={rules?.curePeriod} fallback={law.enforcement.curePeriod} />
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
        href={lawLink.url}
        target="_blank"
        rel="noopener noreferrer"
        title={
          lawLink.official
            ? `Opens the official law text: ${lawLink.label}`
            : `Opens the source cited for this law: ${lawLink.label}`
        }
        className={cn(buttonVariants({ variant: "outline", size: "xs" }), "font-mono text-[10px] tracking-wider uppercase")}
      >
        Read the law
        <ArrowUpRight data-icon="inline-end" />
      </a>
    </li>
  );
}

const OBLIGATIONS_SHOWN = 6;

/** Verified obligations from the rule card; long lists collapse. */
function ObligationList({ obligations }: { obligations: RuleObligation[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? obligations : obligations.slice(0, OBLIGATIONS_SHOWN);
  const hidden = obligations.length - OBLIGATIONS_SHOWN;
  return (
    <>
      <ul className="space-y-1.5">
        {visible.map((o) => (
          <li key={o.quote} className="text-xs">
            <div className="flex items-start gap-2">
              <ScrollText className="mt-px size-3.5 shrink-0 text-primary/70" aria-hidden />
              <span className="flex-1">
                {o.who && <span className="text-muted-foreground">{o.who}: </span>}
                {o.text}
              </span>
              {o.timing && (
                <span className="max-w-[40%] shrink-0 text-right font-mono text-[9.5px] text-muted-foreground">
                  {o.timing}
                </span>
              )}
            </div>
            <QuoteToggle quote={o.quote} className="pl-5.5" />
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="font-mono text-[9.5px] tracking-wider text-primary uppercase hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {showAll ? "Show fewer" : `Show all ${obligations.length}`}
        </button>
      )}
    </>
  );
}

/**
 * A fact row value: verified rule-card items (each with a quote toggle)
 * when there are any, else the PRD-verified fallback, else "Not verified".
 */
function FactCell({ items, fallback }: { items: RuleItem[] | undefined; fallback: string | null }) {
  if (items && items.length > 0) {
    return (
      <dd className="space-y-1">
        {items.map((item) => (
          <div key={item.quote}>
            {item.text}
            <QuoteToggle quote={item.quote} />
          </div>
        ))}
      </dd>
    );
  }
  return <dd className={cn(!fallback && "text-muted-foreground italic")}>{fallback ?? "Not verified"}</dd>;
}

/** Small toggle that reveals the exact supporting sentence(s) from the law. */
function QuoteToggle({ quote, className }: { quote: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="inline-flex items-center gap-1 font-mono text-[9.5px] tracking-wider text-primary uppercase hover:underline focus-visible:underline focus-visible:outline-none"
      >
        <Quote className="size-2.5" aria-hidden />
        {open ? "Hide quote" : "Quote"}
      </button>
      {open && (
        <blockquote
          id={id}
          className="mt-1 border-l-2 border-primary/50 bg-muted/40 py-1 pr-1.5 pl-2 text-[11px] leading-relaxed text-muted-foreground"
        >
          “{quote}”
        </blockquote>
      )}
    </div>
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
