"use client";

import { Check, CircleHelp, Plus, Quote, X } from "lucide-react";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { jurisdictionName } from "@/data/states";
import {
  GENERATIVE_QUESTION_ID,
  answerGenerative,
  confirmQuestions,
  type EditableProfile,
} from "@/lib/confirm-questions";
import { COMPANY_NAME_MAX, FEATURES, JURISDICTION_CODES, ROLES, ROLE_LABEL } from "@/lib/product-profile";
import { cn } from "@/lib/utils";
import { Eyebrow } from "../panel";

/** Code-generated "please confirm" questions, plus toggle chips for the profile. */
export function ProfileEditor({
  profile,
  onChange,
}: {
  profile: EditableProfile;
  onChange: (p: EditableProfile) => void;
}) {
  const available = JURISDICTION_CODES.filter((c) => !profile.jurisdictions.some((j) => j.code === c));
  const questions = confirmQuestions(profile);

  return (
    <div className="space-y-3">
      {questions.length > 0 && (
        <div className="space-y-1 rounded-md border border-status-soon/40 bg-status-soon/5 p-2">
          <Eyebrow className="text-status-soon">Please confirm</Eyebrow>
          <ul className="space-y-1 text-[11px] leading-snug">
            {questions.map((q) => (
              <li key={q.id} className="flex gap-1.5">
                <CircleHelp className="mt-px size-3 shrink-0 text-status-soon" aria-hidden />
                <div className="min-w-0 space-y-1">
                  <div>{q.text}</div>
                  {q.id === GENERATIVE_QUESTION_ID && (
                    <div className="flex gap-1">
                      <Chip on={profile.generativeAnswer === true} onClick={() => onChange(answerGenerative(profile, true))}>
                        Yes
                      </Chip>
                      <Chip on={profile.generativeAnswer === false} onClick={() => onChange(answerGenerative(profile, false))}>
                        No
                      </Chip>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {profile.notes.length > 0 && (
        <details className="text-[11px] leading-snug text-muted-foreground">
          <summary className="cursor-pointer font-mono text-[10px] tracking-wider uppercase hover:text-foreground">
            AI&apos;s notes (may be wrong)
          </summary>
          <ul className="mt-1 space-y-1 border-l border-border pl-2">
            {profile.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="space-y-1.5">
        <label htmlFor="company-name">
          <Eyebrow>Company name (used in drafts)</Eyebrow>
        </label>
        <Input
          id="company-name"
          value={profile.companyName}
          maxLength={COMPANY_NAME_MAX}
          placeholder="Not stated. Drafts will say [Company name]"
          onChange={(e) => onChange({ ...profile, companyName: e.target.value, companyNameQuote: "" })}
          className="h-7 text-xs md:text-xs"
        />
        {profile.companyNameQuote && <QuoteLine quote={profile.companyNameQuote} />}
      </div>

      <div className="space-y-1.5">
        <Eyebrow>Your role</Eyebrow>
        <div className="flex flex-wrap gap-1">
          {ROLES.map((r) => (
            <Chip key={r} on={profile.role === r} onClick={() => onChange({ ...profile, role: r })}>
              {ROLE_LABEL[r]}
            </Chip>
          ))}
        </div>
        <p className="text-[10.5px] leading-snug text-muted-foreground">
          Developer = you build or sell the AI. Deployer/operator = you use it or offer it to your own users. Pick Both if
          you do both.
        </p>
        {profile.roleQuote && <QuoteLine quote={profile.roleQuote} />}
      </div>

      <div className="space-y-1.5">
        <Eyebrow>Government agency?</Eyebrow>
        <div className="flex gap-1">
          <Chip on={profile.isGovernment === false} onClick={() => onChange({ ...profile, isGovernment: false })}>
            No, private business
          </Chip>
          <Chip on={profile.isGovernment === true} onClick={() => onChange({ ...profile, isGovernment: true })}>
            Yes
          </Chip>
        </div>
      </div>

      <div className="space-y-1.5">
        <Eyebrow>AI features</Eyebrow>
        <div className="flex flex-wrap gap-1">
          {FEATURES.map((f) => {
            const st = profile.features[f.id];
            return (
              <Chip
                key={f.id}
                on={st.on}
                unsure={st.unknown}
                title={st.quote ? `From your text: "${st.quote}"${st.quoteFound ? "" : " (not found in your text)"}` : f.definition}
                onClick={() =>
                  onChange(
                    f.id === "generative_ai_public"
                      ? answerGenerative(profile, !st.on)
                      : { ...profile, features: { ...profile.features, [f.id]: { ...st, on: !st.on, unknown: false } } },
                  )
                }
              >
                {f.label}
              </Chip>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Eyebrow>Users, applicants or employees in</Eyebrow>
        <div className="flex flex-wrap gap-1">
          {profile.jurisdictions.map((j) => (
            <Chip
              key={j.code}
              on={j.on}
              unsure={j.unknown}
              title={j.quote ? `From your text: "${j.quote}"${j.quoteFound ? "" : " (not found in your text)"}` : undefined}
              onClick={() =>
                onChange({
                  ...profile,
                  jurisdictions: profile.jurisdictions.map((x) =>
                    x.code === j.code ? { ...x, on: !x.on, unknown: false } : x,
                  ),
                })
              }
            >
              {jurisdictionName(j.code)}
            </Chip>
          ))}
          <label className="relative inline-flex items-center">
            <span className="sr-only">Add a state</span>
            <Plus className="pointer-events-none absolute left-1.5 size-3 text-muted-foreground" aria-hidden />
            <select
              value=""
              onChange={(e) => {
                const code = e.target.value;
                if (!code) return;
                onChange({
                  ...profile,
                  jurisdictions: [...profile.jurisdictions, { code, on: true, unknown: false, quote: "", quoteFound: false }],
                });
              }}
              className="h-6 rounded-sm border border-dashed border-border bg-transparent pr-1 pl-5 text-[11px] text-muted-foreground focus-visible:border-primary focus-visible:outline-none"
            >
              <option value="">Add</option>
              {available.map((c) => (
                <option key={c} value={c}>
                  {jurisdictionName(c)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

function Chip({
  on,
  unsure,
  title,
  onClick,
  children,
}: {
  on: boolean;
  unsure?: boolean;
  title?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-sm border px-1.5 text-[11px] transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        on
          ? "border-primary/60 bg-primary/15 text-foreground"
          : unsure
            ? "border-dashed border-status-soon/60 text-status-soon hover:bg-status-soon/10"
            : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {on ? (
        <Check className="size-3" strokeWidth={3} aria-hidden />
      ) : unsure ? (
        <CircleHelp className="size-3" aria-hidden />
      ) : (
        <X className="size-3 opacity-50" aria-hidden />
      )}
      {children}
      {unsure && !on && <span className="sr-only">(please confirm)</span>}
    </button>
  );
}

function QuoteLine({ quote }: { quote: string }) {
  return (
    <p className="flex gap-1 text-[10.5px] text-muted-foreground italic">
      <Quote className="mt-px size-2.5 shrink-0" aria-hidden />
      {quote}
    </p>
  );
}
