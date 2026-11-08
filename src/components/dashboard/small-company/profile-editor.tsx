"use client";

import { Check, CircleHelp, Plus, Quote, X } from "lucide-react";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { jurisdictionName } from "@/data/states";
import {
  COMPANY_NAME_MAX,
  FEATURES,
  JURISDICTION_CODES,
  ROLES,
  ROLE_LABEL,
  checkQuote,
  cleanCompanyName,
  readCompanyName,
  type ConfirmedProfile,
  type FeatureId,
  type ProductProfileDraft,
  type Role,
} from "@/lib/product-profile";
import { cn } from "@/lib/utils";
import { Eyebrow } from "../panel";

/** The profile while the user reviews it. null = still unknown. */
export interface EditableProfile {
  /** "" = not stated. Used only in drafts. */
  companyName: string;
  companyNameQuote: string;
  /** The reader offered a name that isn't in the user's text. */
  companyNameRejected: boolean;
  role: Role | null;
  roleQuote: string;
  features: Record<FeatureId, { on: boolean; unknown: boolean; quote: string; quoteFound: boolean }>;
  jurisdictions: { code: string; on: boolean; unknown: boolean; quote: string; quoteFound: boolean }[];
  isGovernment: boolean | null;
  notes: string[];
}

export function fromDraft(draft: ProductProfileDraft, description: string): EditableProfile {
  const features = Object.fromEntries(
    FEATURES.map((f) => [f.id, { on: false, unknown: false, quote: "", quoteFound: false }]),
  ) as EditableProfile["features"];
  for (const f of draft.features) {
    features[f.id] = {
      on: f.status === "yes",
      unknown: f.status === "unknown",
      quote: f.quote,
      quoteFound: checkQuote(f.quote, description),
    };
  }
  const seen = new Set<string>();
  const jurisdictions = draft.jurisdictions
    .filter((j) => !seen.has(j.code) && seen.add(j.code))
    .map((j) => ({
      code: j.code,
      on: j.status === "yes",
      unknown: j.status === "unknown",
      quote: j.quote,
      quoteFound: checkQuote(j.quote, description),
    }));
  const company = readCompanyName(draft, description);
  return {
    companyName: company.name ?? "",
    companyNameQuote: company.quote,
    companyNameRejected: company.rejected,
    role: draft.role === "unknown" ? null : draft.role,
    roleQuote: draft.role_quote,
    features,
    jurisdictions,
    isGovernment: draft.is_government === "unknown" ? null : draft.is_government === "yes",
    notes: draft.notes.slice(0, 5),
  };
}

/** null while role or government status is still unresolved. */
export function toConfirmed(p: EditableProfile): ConfirmedProfile | null {
  if (!p.role || p.isGovernment === null) return null;
  return {
    companyName: cleanCompanyName(p.companyName),
    role: p.role,
    features: FEATURES.map((f) => f.id).filter((id) => p.features[id].on),
    jurisdictions: p.jurisdictions.filter((j) => j.on).map((j) => j.code),
    isGovernment: p.isGovernment,
  };
}

/** "We assumed / please confirm" list with toggle chips. */
export function ProfileEditor({
  profile,
  onChange,
}: {
  profile: EditableProfile;
  onChange: (p: EditableProfile) => void;
}) {
  const unknownFeatures = FEATURES.filter((f) => profile.features[f.id].unknown);
  const unknownPlaces = profile.jurisdictions.filter((j) => j.unknown);
  const unfoundQuotes =
    FEATURES.filter((f) => profile.features[f.id].on && profile.features[f.id].quote && !profile.features[f.id].quoteFound)
      .length + profile.jurisdictions.filter((j) => j.on && j.quote && !j.quoteFound).length;
  const available = JURISDICTION_CODES.filter((c) => !profile.jurisdictions.some((j) => j.code === c));

  const confirmItems: string[] = [
    ...(profile.companyNameRejected && !profile.companyName
      ? ["We couldn't confirm a company name from your text. Add it below if you want it in drafts."]
      : []),
    ...(profile.role ? [] : ["Pick your role below: we couldn't tell from the description."]),
    ...(profile.isGovernment === null ? ["Are you a government agency? Pick yes or no below."] : []),
    ...unknownFeatures.map((f) => `Not sure about "${f.label}". Turn it on if it applies.`),
    ...unknownPlaces.map((j) => `Not sure you have users in ${jurisdictionName(j.code)}. Turn it on if you do.`),
    ...(unfoundQuotes > 0
      ? [`${unfoundQuotes} detected item${unfoundQuotes === 1 ? "" : "s"} had a quote not found in your text. Check them.`]
      : []),
    ...profile.notes,
  ];

  return (
    <div className="space-y-3">
      {confirmItems.length > 0 && (
        <div className="space-y-1 rounded-md border border-status-soon/40 bg-status-soon/5 p-2">
          <Eyebrow className="text-status-soon">We assumed / please confirm</Eyebrow>
          <ul className="space-y-1 text-[11px] leading-snug">
            {confirmItems.map((t) => (
              <li key={t} className="flex gap-1.5">
                <CircleHelp className="mt-px size-3 shrink-0 text-status-soon" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
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
                  onChange({
                    ...profile,
                    features: { ...profile.features, [f.id]: { ...st, on: !st.on, unknown: false } },
                  })
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
