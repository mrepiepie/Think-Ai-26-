"use client";

import { Radar } from "lucide-react";
import type { Persona } from "@/data/types";
import { useNow } from "@/lib/use-now";
import { PersonaSwitcher } from "./persona-switcher";

function LiveClock() {
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
      <span className="flex items-center gap-1.5 font-semibold text-live">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-70 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2 rounded-full bg-live" />
        </span>
        LIVE
      </span>
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
      <LiveClock />
      <div className="ml-auto">
        <PersonaSwitcher value={persona} onChange={onPersonaChange} />
      </div>
    </header>
  );
}
