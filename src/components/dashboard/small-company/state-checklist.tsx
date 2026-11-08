"use client";

import { ArrowUpRight, ChevronRight, CircleHelp, FilePenLine, MapPinned, Quote } from "lucide-react";
import { useId, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { readTheLawLink, verifiedRules } from "@/data/law-library";
import { jurisdictionName } from "@/data/states";
import type { ComplianceStatus } from "@/data/types";
import { enforcementNote, formatDay } from "@/lib/compliance";
import { checkboxLabel, type Duty, type JurisdictionRollup, type LawMatch } from "@/lib/matching";
import { noticeQuotes } from "@/lib/notice";
import type { RuleItem } from "@/lib/rule-card";
import { cn } from "@/lib/utils";
import { Eyebrow, Panel } from "../panel";
import { LawTags, StatusPill } from "./status";

/** Right panel: computed per-jurisdiction checklist. */
export function StateChecklist({
  jurisdiction,
  rollup,
  hasProfile,
  checked,
  onToggle,
  today,
  onDraft,
  isExample,
  className,
}: {
  jurisdiction: string | null;
  rollup: JurisdictionRollup | undefined;
  hasProfile: boolean;
  checked: ReadonlySet<string>;
  onToggle: (dutyId: string) => void;
  today: string;
  onDraft: (match: LawMatch) => void;
  isExample: boolean;
  className?: string;
}) {
  const applying = rollup?.laws.filter((l) => l.applies) ?? [];
  const notApplying = rollup?.laws.filter((l) => !l.applies) ?? [];
  return (
    <Panel title="Checklist" sample={isExample} className={className}>
      {!hasProfile ? (
        <EmptyState text="Describe your AI product, confirm what we found, then run matching. Your checklist appears here." />
      ) : !jurisdiction ? (
        <EmptyState text="Click a state or the NYC pin on the map to see its checklist." />
      ) : (
        <div>
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-2.5 backdrop-blur">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{jurisdictionName(jurisdiction)}</div>
              <div className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                {rollup
                  ? `${applying.length} of ${rollup.laws.length} tracked law${rollup.laws.length === 1 ? "" : "s"} apply`
                  : "No tracked laws"}
                {rollup && rollup.needsReview > 0 && (
                  <span className="text-status-soon"> · {rollup.needsReview} need review</span>
                )}
              </div>
            </div>
            {rollup && <StatusPill status={rollup.status} label={rollup.label} />}
          </div>
          {!rollup ? (
            <EmptyState text="No tracked laws for this jurisdiction, or they are hidden by your filters." />
          ) : (
            <>
              <ul className="divide-y divide-border">
                {applying.map((m) => (
                  <LawCard
                    key={m.law.id}
                    match={m}
                    status={rollup.lawStatus[m.law.id]}
                    statusLabel={rollup.lawLabel[m.law.id]}
                    checked={checked}
                    onToggle={onToggle}
                    today={today}
                    onDraft={onDraft}
                  />
                ))}
              </ul>
              {notApplying.length > 0 && (
                <div className="space-y-1.5 border-t border-border px-3 py-3">
                  <Eyebrow>Laws that don&apos;t apply to you</Eyebrow>
                  <ul className="space-y-1.5">
                    {notApplying.map((m) => (
                      <li key={m.law.id} className="text-xs">
                        <span className="font-medium">{m.law.name}</span>
                        <span className="text-muted-foreground">: {m.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Panel>
  );
}

function LawCard({
  match,
  status,
  statusLabel,
  checked,
  onToggle,
  today,
  onDraft,
}: {
  match: LawMatch;
  status: ComplianceStatus;
  statusLabel: string;
  checked: ReadonlySet<string>;
  onToggle: (id: string) => void;
  today: string;
  onDraft: (m: LawMatch) => void;
}) {
  const { law } = match;
  const rules = verifiedRules(law.id);
  const lawLink = readTheLawLink(law);
  const canDraft = noticeQuotes(match).length > 0;
  const done = match.applicable.filter((d) => checked.has(d.id)).length;
  const note = enforcementNote(law);

  return (
    <li className="space-y-2.5 px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="text-[13px] leading-tight font-semibold">{law.name}</div>
          <span className="flex flex-wrap gap-1">
            <LawTags tags={law.tags} />
            {!match.rule.extracted && (
              <span
                className="rounded-sm border border-status-soon/50 px-1 font-mono text-[9px] tracking-wider text-status-soon uppercase"
                title="No rule card has been extracted from the official text yet. Duties below come from the PRD summary only."
              >
                Rules not extracted yet
              </span>
            )}
          </span>
        </div>
        <StatusPill status={status} label={statusLabel} />
      </div>
      {note && <p className="text-right text-[10.5px] font-medium text-status-soon">{note}</p>}
      <p className="text-xs leading-relaxed text-muted-foreground">{match.reason}</p>

      {canDraft && (
        <Button variant="outline" size="xs" onClick={() => onDraft(match)}>
          <FilePenLine data-icon="inline-start" />
          Draft notice
        </Button>
      )}

      {match.applicable.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <Eyebrow>Your duties</Eyebrow>
            <span className="font-mono text-[9.5px] text-muted-foreground">
              {done}/{match.applicable.length} done
            </span>
          </div>
          <ul className="space-y-1.5">
            {match.applicable.map((d) => (
              <DutyRow key={d.id} duty={d} checked={checked.has(d.id)} onToggle={() => onToggle(d.id)} today={today} />
            ))}
          </ul>
        </div>
      )}

      {match.needsReview.length > 0 && (
        <div className="space-y-1 rounded-md border border-status-soon/40 bg-status-soon/5 p-2">
          <Eyebrow className="text-status-soon">Needs review ({match.needsReview.length})</Eyebrow>
          <p className="text-[10.5px] text-muted-foreground">
            We can&apos;t tell from your profile whether these apply. They are not counted as done or as applying.
          </p>
          <ul className="space-y-1.5">
            {match.needsReview.map((d) => (
              <li key={d.id} className="text-xs">
                <div className="flex items-start gap-1.5">
                  <CircleHelp className="mt-px size-3.5 shrink-0 text-status-soon" aria-hidden />
                  <span className="flex-1">
                    {d.text}
                    <span className="block text-[10.5px] text-muted-foreground">{d.reason}</span>
                  </span>
                </div>
                {d.quote && <QuoteToggle quote={d.quote} className="pl-5" />}
              </li>
            ))}
          </ul>
        </div>
      )}

      {match.notApplicable.length > 0 && <NotApplicableList duties={match.notApplicable} />}

      {match.unverifiedCount > 0 && (
        <p className="text-[10.5px] text-muted-foreground italic">
          {match.unverifiedCount} more extracted obligation{match.unverifiedCount === 1 ? "" : "s"}: not verified (quote
          not found in the law text), so not shown.
        </p>
      )}

      <dl className="grid grid-cols-[72px_1fr] gap-x-2 gap-y-1 text-[11px]">
        <dt className="text-muted-foreground">Applies to</dt>
        <dd>{law.appliesTo}</dd>
        <dt className="text-muted-foreground">Deadline</dt>
        <dd>
          {law.effective}
          {match.rule.effectiveDateFromPrd && " · From PRD summary"}
        </dd>
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

function DutyRow({
  duty,
  checked,
  onToggle,
  today,
}: {
  duty: Duty;
  checked: boolean;
  onToggle: () => void;
  today: string;
}) {
  const id = useId();
  const inForce = duty.effectiveDate <= today;
  return (
    <li className="text-xs">
      <div className="flex items-start gap-2">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-0.5 size-3.5 shrink-0 accent-[var(--status-compliant)]"
        />
        <label htmlFor={id} className="flex-1 cursor-pointer">
          <span className={cn(checked && "text-muted-foreground line-through decoration-muted-foreground/40")}>
            {checkboxLabel(duty.text)}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[9.5px] text-muted-foreground">
            <span
              className={cn(
                "rounded-sm border px-1 uppercase",
                inForce ? "border-status-noncompliant/50 text-status-noncompliant" : "border-status-soon/50 text-status-soon",
              )}
            >
              {inForce ? "In force" : `From ${formatDay(duty.effectiveDate)}`}
            </span>
            {duty.timing && <span>{duty.timing}</span>}
            {duty.source === "prd" ? (
              <span title="Not extracted from the law text yet">From PRD summary</span>
            ) : (
              duty.dateFromPrd && (
                <span title="The duty is quoted from the law text; its start date comes from the PRD summary">
                  Date: From PRD summary
                </span>
              )
            )}
          </span>
        </label>
      </div>
      {duty.quote && <QuoteToggle quote={duty.quote} className="pl-5.5" />}
    </li>
  );
}

/** Collapsed "Doesn't apply to you" section, grouped by reason. */
function NotApplicableList({ duties }: { duties: Duty[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const groups = new Map<string, Duty[]>();
  for (const d of duties) groups.set(d.reason, [...(groups.get(d.reason) ?? []), d]);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="flex items-center gap-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
      >
        <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} aria-hidden />
        Doesn&apos;t apply to you ({duties.length})
      </button>
      {open && (
        <ul id={id} className="mt-1.5 space-y-2 border-l border-border pl-2">
          {[...groups].map(([reason, items]) => (
            <li key={reason} className="space-y-0.5">
              <div className="text-[11px] font-medium">
                {reason} <span className="font-mono text-[10px] text-muted-foreground">({items.length})</span>
              </div>
              <ul className="space-y-0.5">
                {items.map((d) => (
                  <li key={d.id} className="text-[11px] text-muted-foreground">
                    {d.text}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
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
