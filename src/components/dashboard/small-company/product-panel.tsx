"use client";

import { Check } from "lucide-react";
import { LAWS } from "@/data/laws";
import type { CompanyProfile, LawStatusTag } from "@/data/types";
import {
  TAG_LABEL,
  lawPassesFilters,
  type LawFilters,
  type StateRollup,
} from "@/lib/compliance";
import { cn } from "@/lib/utils";
import { Eyebrow, Panel } from "../panel";
import { StatusDot } from "./status";

const TAGS: LawStatusTag[] = ["in-force", "coming-soon", "challenged"];

/** Left panel: the (fictional) company's AI product and law filters. */
export function ProductPanel({
  company,
  rollup,
  selectedState,
  onSelectState,
  filters,
  onFiltersChange,
  className,
}: {
  company: CompanyProfile;
  rollup: Record<string, StateRollup>;
  selectedState: string | null;
  onSelectState: (code: string) => void;
  filters: LawFilters;
  onFiltersChange: (f: LawFilters) => void;
  className?: string;
}) {
  return (
    <Panel title="Your AI product" sample className={className} bodyClassName="p-3 space-y-3.5">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{company.name}</div>
            <div className="text-[11px] text-muted-foreground">{company.tagline}</div>
          </div>
          <span className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
            {company.employees} staff
          </span>
        </div>
        <div className="mt-3 rounded-md border border-border bg-background/40 p-2.5">
          <div className="font-mono text-[11px] font-semibold tracking-wider text-primary uppercase">
            {company.productName}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {company.productDescription}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Eyebrow>Detected AI features</Eyebrow>
        <ul className="space-y-1">
          {company.features.map((f) => (
            <li key={f.label} className="flex items-center justify-between gap-2 text-xs">
              <span>{f.label}</span>
              <span className="truncate rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[9.5px] text-muted-foreground">
                {f.classification}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-1.5">
        <Eyebrow>Users in</Eyebrow>
        <ul className="grid grid-cols-2 gap-1">
          {company.markets.map((m) => (
            <li key={m.label}>
              <button
                type="button"
                onClick={() => onSelectState(m.state)}
                aria-pressed={selectedState === m.state}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm border border-border px-2 py-1.5 text-left text-xs transition-colors hover:border-primary/50 focus-visible:border-primary focus-visible:outline-none",
                  selectedState === m.state && "border-primary/60 bg-primary/10",
                )}
              >
                <StatusDot status={rollup[m.state]?.status ?? null} />
                <span className="truncate">{m.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-1.5">
        <Eyebrow>Show laws that are</Eyebrow>
        <div className="space-y-1">
          {TAGS.map((tag) => {
            const on = filters[tag];
            const count = LAWS.filter((l) => l.tags.includes(tag)).length;
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() => onFiltersChange({ ...filters, [tag]: !on })}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm border px-2 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  on
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-3.5 items-center justify-center rounded-[3px] border",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-input",
                  )}
                >
                  {on && <Check className="size-2.5" strokeWidth={3} />}
                </span>
                {TAG_LABEL[tag]}
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[10.5px] text-muted-foreground">
          {LAWS.filter((l) => lawPassesFilters(l, filters)).length} of {LAWS.length} tracked
          laws shown.
        </p>
      </div>
    </Panel>
  );
}
