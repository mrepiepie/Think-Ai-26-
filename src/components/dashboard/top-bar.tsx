"use client";

import { Radar } from "lucide-react";
import { lawsVerified } from "@/data/law-library";
import type { Persona } from "@/data/types";
import { useNow } from "@/lib/use-now";
import { useWatch } from "@/lib/use-watch";
import { STATUS_LABEL, type WatchStatus } from "@/lib/watch-types";
import { PersonaSwitcher } from "./persona-switcher";

const VERIFIED = lawsVerified();
const VERIFIED_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(`${VERIFIED.date}T00:00:00Z`));
const VERIFIED_DETAIL =
  `Official text fetched for ${VERIFIED.fetched} of ${VERIFIED.total} tracked laws.` +
  (VERIFIED.notFetched.length ? ` Not fetched (PRD section 3 only): ${VERIFIED.notFetched.join(", ")}.` : "");

const dayLabel = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);

/** Says how many laws were really compared, so a date alone can't overstate coverage. */
function LastChecked() {
  const summary = useWatch().status?.summary;
  if (!summary?.lastCheckedAt) return null;
  const { compared, total, counts } = summary;
  const detail = (Object.keys(counts) as WatchStatus[])
    .filter((s) => counts[s] > 0)
    .map((s) => `${STATUS_LABEL[s]}: ${counts[s]}`)
    .join(", ");
  return (
    <span title={`Latest on-demand check per law. ${detail}.`}>
      Last checked {dayLabel(new Date(summary.lastCheckedAt))} ({compared} of {total} compared)
    </span>
  );
}

function Clock() {
  const now = useNow();
  const d = now === null ? null : new Date(now);
  const date = d
    ? d
        .toLocaleDateString("en-GB", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        })
        .replace(/,/g, "")
        .toUpperCase()
    : "--- -- --- ----";
  const time = d
    ? d.toLocaleTimeString("en-GB", { hour12: false, timeZone: "UTC" })
    : "--:--:--";
  return (
    <div className="flex items-center gap-3 font-mono text-[11px] tracking-wider text-muted-foreground tabular-nums">
      <span className="font-semibold text-foreground" title={VERIFIED_DETAIL}>
        Laws verified {VERIFIED_DATE}
      </span>
      <LastChecked />
      <time dateTime={d?.toISOString()} suppressHydrationWarning>
        {date} <span className="hidden sm:inline">· {time} UTC</span>
      </time>
    </div>
  );
}

export function TopBar({
  persona,
  onPersonaChange,
}: {
  persona: Persona;
  onPersonaChange: (p: Persona) => void;
}) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b border-border bg-background/80 px-3 py-2 backdrop-blur-md lg:h-12 lg:flex-nowrap lg:py-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <Radar className="size-4 shrink-0 text-primary" aria-hidden />
        <h1 className="truncate font-mono text-[12px] font-semibold tracking-[0.18em] uppercase">
          State AI Law Compliance Mapper
        </h1>
      </div>
      <Clock />
      <div className="ml-auto">
        <PersonaSwitcher value={persona} onChange={onPersonaChange} />
      </div>
    </header>
  );
}
