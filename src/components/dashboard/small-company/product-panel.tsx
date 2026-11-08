"use client";

import { Check, Loader2, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SAMPLE_COMPANY } from "@/data/company";
import { LAWS } from "@/data/laws";
import { jurisdictionName } from "@/data/states";
import type { LawStatusTag } from "@/data/types";
import { TAG_LABEL, lawPassesFilters, type LawFilters } from "@/lib/compliance";
import type { EditableProfile } from "@/lib/confirm-questions";
import type { JurisdictionRollup } from "@/lib/matching";
import { DESCRIPTION_LIMITS, type ConfirmedProfile } from "@/lib/product-profile";
import { cn } from "@/lib/utils";
import { Eyebrow, Panel } from "../panel";
import { ProfileEditor } from "./profile-editor";
import { StatusDot } from "./status";

const TAGS: LawStatusTag[] = ["in-force", "coming-soon", "challenged", "enforcement-paused"];

export type ReaderState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "done"; model: string };

/** Left panel: describe the product, confirm the AI's reading, run matching. */
export function ProductPanel({
  description,
  onDescriptionChange,
  isExample,
  onLoadExample,
  reader,
  onAnalyze,
  profile,
  onProfileChange,
  canRun,
  stale,
  onRun,
  confirmed,
  rollup,
  selected,
  onSelect,
  filters,
  onFiltersChange,
  className,
}: {
  description: string;
  onDescriptionChange: (v: string) => void;
  isExample: boolean;
  onLoadExample: () => void;
  reader: ReaderState;
  onAnalyze: () => void;
  profile: EditableProfile | null;
  onProfileChange: (p: EditableProfile) => void;
  canRun: boolean;
  /** The edited profile differs from the one last matched. */
  stale: boolean;
  onRun: () => void;
  confirmed: ConfirmedProfile | null;
  rollup: Record<string, JurisdictionRollup>;
  selected: string | null;
  onSelect: (key: string) => void;
  filters: LawFilters;
  onFiltersChange: (f: LawFilters) => void;
  className?: string;
}) {
  const len = description.trim().length;
  const tooLong = description.length > DESCRIPTION_LIMITS.max;
  const tooShort = len < DESCRIPTION_LIMITS.min;
  const loading = reader.status === "loading";

  return (
    <Panel title="Your AI product" sample={isExample} className={className} bodyClassName="p-3 space-y-3.5">
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="product-description">
            <Eyebrow>Describe your AI product</Eyebrow>
          </label>
          <button
            type="button"
            onClick={onLoadExample}
            className="font-mono text-[9.5px] tracking-wider text-primary uppercase hover:underline focus-visible:underline focus-visible:outline-none"
          >
            Load example
          </button>
        </div>
        {isExample && (
          <div className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">{SAMPLE_COMPANY.name}</span> · {SAMPLE_COMPANY.tagline}
          </div>
        )}
        <Textarea
          id="product-description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          maxLength={DESCRIPTION_LIMITS.max + 200}
          rows={5}
          placeholder="What does your AI do, who uses it, do you build it or use it yourself, and where are your users, applicants or employees?"
          aria-invalid={tooLong || undefined}
          aria-describedby="product-description-count"
          className="max-h-56 min-h-24 resize-y text-xs leading-relaxed md:text-xs"
        />
        <div className="flex items-center justify-between gap-2">
          <span
            id="product-description-count"
            className={cn("font-mono text-[10px] text-muted-foreground", tooLong && "text-status-noncompliant")}
          >
            {description.length}/{DESCRIPTION_LIMITS.max}
          </span>
          <Button size="sm" onClick={onAnalyze} disabled={loading || tooShort || tooLong}>
            {loading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
            {loading ? "Analyzing" : "Analyze"}
          </Button>
        </div>
        {reader.status === "error" && (
          <p role="alert" className="rounded-sm border border-status-noncompliant/40 bg-status-noncompliant/10 p-2 text-[11px] text-status-noncompliant">
            {reader.error}
          </p>
        )}
        {reader.status === "done" && (
          <p className="font-mono text-[9.5px] tracking-wider text-muted-foreground uppercase">
            Read by AI ({reader.model}). Check it below.
          </p>
        )}
      </div>

      {profile && (
        <>
          <ProfileEditor profile={profile} onChange={onProfileChange} />
          <div className="space-y-1">
            <Button className="w-full" size="sm" onClick={onRun} disabled={!canRun}>
              {confirmed && !stale ? <Check data-icon="inline-start" /> : <Play data-icon="inline-start" />}
              {confirmed && !stale ? "Matched" : confirmed ? "Run matching again" : "Run matching"}
            </Button>
            <p className="text-[10.5px] text-muted-foreground">
              {!canRun
                ? "Answer the open questions above first (role, government status, generative AI)."
                : "Matching is plain code (no AI) against verified quotes from the law text."}
            </p>
          </div>
        </>
      )}

      {confirmed && (
        <div className="space-y-1.5">
          <Eyebrow>Your jurisdictions</Eyebrow>
          <ul className="grid grid-cols-2 gap-1">
            {[...new Set([...confirmed.jurisdictions, ...Object.keys(rollup)])].map((key) => (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => onSelect(key)}
                  aria-pressed={selected === key}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm border border-border px-2 py-1.5 text-left text-xs transition-colors hover:border-primary/50 focus-visible:border-primary focus-visible:outline-none",
                    selected === key && "border-primary/60 bg-primary/10",
                  )}
                >
                  <StatusDot status={rollup[key]?.status ?? null} />
                  <span className="truncate">{jurisdictionName(key)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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
                  "flex w-full items-center gap-2 rounded-sm border px-2 py-1.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
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
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">{count}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[10.5px] text-muted-foreground">
          {LAWS.filter((l) => lawPassesFilters(l, filters)).length} of {LAWS.length} tracked laws shown.
        </p>
      </div>
    </Panel>
  );
}
