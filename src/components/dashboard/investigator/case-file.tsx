"use client";

import { ArrowUpRight, Check, FileDown, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { readTheLawLink } from "@/data/law-library";
import { LAWS_BY_ID } from "@/data/laws";
import type { Complaint, InvestigatedCompany } from "@/data/types";
import { cn } from "@/lib/utils";
import { Eyebrow, Panel } from "../panel";
import { totalComplaints } from "./flagged-companies";

/** F20 preview: bundle complaints, data-flow traces and law text into a case file. */
export function CaseFile({
  company,
  complaints,
  className,
}: {
  company: InvestigatedCompany;
  complaints: Complaint[];
  className?: string;
}) {
  // Complaints the investigator has removed from the bundle (all included by default).
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const related = complaints.filter((c) => c.companyId === company.id);
  const included = related.filter((c) => !excluded.has(c.id));
  const lawIds = [...new Set(Object.values(company.lawByState).filter((id): id is string => !!id))];

  function toggle(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Panel
      title="Case file"
      sample
      className={className}
      actions={
        <span className="rounded-sm bg-primary/15 px-1.5 font-mono text-[9.5px] tracking-wider text-primary uppercase">
          Draft
        </span>
      }
    >
      <div className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-mono text-[10px] tracking-wider text-muted-foreground">
              CF-2026-{company.id.slice(0, 3).toUpperCase()}-001 · sample
            </div>
            <div className="text-sm font-semibold">{company.name}</div>
            <div className="text-[11px] text-muted-foreground">
              {company.tool} · {totalComplaints(company)} complaints on file
            </div>
          </div>
        </div>

        <section className="space-y-1">
          <Eyebrow>
            Complaints in bundle ({included.length}/{related.length} recent)
          </Eyebrow>
          {related.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No recent complaints in the feed.</p>
          ) : (
            <ul className="space-y-1">
              {related.map((c) => {
                const on = !excluded.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      aria-pressed={on}
                      className="flex w-full items-start gap-2 rounded-sm px-1 py-0.5 text-left text-[11px] hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-3 shrink-0 items-center justify-center rounded-[3px] border",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-input",
                        )}
                      >
                        {on && <Check className="size-2" strokeWidth={3} />}
                      </span>
                      <span className="font-mono text-muted-foreground">{c.id}</span>
                      <span className="truncate">{c.summary}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-1">
          <Eyebrow>Data flow traces (F9)</Eyebrow>
          <ul className="space-y-0.5 text-[11px] text-muted-foreground">
            {company.dataFlowNotes.map((n) => (
              <li key={n} className="border-l border-border pl-2">
                {n}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-1">
          <Eyebrow>Possibly relevant law</Eyebrow>
          <ul className="space-y-1">
            {lawIds.map((id) => {
              const law = LAWS_BY_ID[id];
              return (
                <li key={id} className="flex items-center justify-between gap-2 text-[11px]">
                  <span>
                    {law.name}
                    <span className="text-muted-foreground"> · {law.effective}</span>
                  </span>
                  <a
                    href={readTheLawLink(law).url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-0.5 text-primary hover:underline"
                  >
                    Source
                    <ArrowUpRight className="size-3" aria-hidden />
                  </a>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="xs" disabled title="Coming soon">
            <Sparkles data-icon="inline-start" />
            Draft summary
          </Button>
          <Button size="xs" variant="outline" disabled title="Coming soon">
            <FileDown data-icon="inline-start" />
            Export pack
          </Button>
          <span className="self-center font-mono text-[9.5px] text-muted-foreground uppercase">
            Preview only
          </span>
        </div>
      </div>
    </Panel>
  );
}
