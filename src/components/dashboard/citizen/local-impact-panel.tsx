import { ArrowUpRight, MousePointerClick } from "lucide-react";
import { PJM_FACTS } from "@/data/citizen";
import { stateName } from "@/data/states";
import type { DataCenter } from "@/data/types";
import { MARKER_COLOR } from "../map/map-theme";
import { Eyebrow, Panel } from "../panel";
import { SampleBadge } from "../sample-badge";

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Right panel: local impact for the clicked marker, plus grid context. */
export function LocalImpactPanel({
  site,
  className,
}: {
  site: DataCenter | null;
  className?: string;
}) {
  return (
    <Panel title="Local impact" sample className={className}>
      {site ? <SiteDetails site={site} /> : <Empty />}
      <GridContext />
    </Panel>
  );
}

function SiteDetails({ site }: { site: DataCenter }) {
  const color = MARKER_COLOR[site.status];
  const stats = [
    { label: "Capacity", value: `${site.capacityMW} MW` },
    { label: "Water use", value: `${site.waterMgd} M gal/day` },
    {
      label: "Est. household bill",
      value: `+$${site.billImpactPerMonth[0]}–${site.billImpactPerMonth[1]}/mo`,
    },
    { label: "Operator", value: site.operator },
  ];
  return (
    <div className="space-y-3 border-b border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-sm font-semibold tracking-wider">{site.name}</div>
          <div className="text-[11px] text-muted-foreground">
            {stateName(site.state)} · {site.lat.toFixed(2)}°N {Math.abs(site.lon).toFixed(2)}°W ·
            placeholder location
          </div>
        </div>
        <span
          className="rounded-sm border px-1.5 py-0.5 font-mono text-[9.5px] tracking-wider uppercase"
          style={{
            color,
            borderColor: `color-mix(in oklch, ${color} 50%, transparent)`,
            background: `color-mix(in oklch, ${color} 12%, transparent)`,
          }}
        >
          {site.status}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border">
        {stats.map((s) => (
          <div key={s.label} className="bg-card px-2.5 py-2">
            <dt className="font-mono text-[9.5px] tracking-wider text-muted-foreground uppercase">
              {s.label}
            </dt>
            <dd className="mt-0.5 truncate font-mono text-[13px] tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      {site.hearingDate && (
        <div className="rounded-md border border-dc-proposed/40 bg-dc-proposed/10 px-2.5 py-2 text-xs">
          <Eyebrow className="text-dc-proposed">Next public hearing (sample)</Eyebrow>
          <div className="mt-0.5 font-mono">{formatDate(site.hearingDate)}</div>
        </div>
      )}

      <div className="space-y-1">
        <Eyebrow>What you can do</Eyebrow>
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground marker:text-primary">
          {site.hearingDate && <li>Sign up to speak or submit a written comment at the hearing.</li>}
          <li>Ask your utility how large-load costs are shared with households.</li>
          <li>Request the site&apos;s water and noise studies from your county.</li>
        </ul>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 border-b border-border px-6 py-8 text-center text-xs text-muted-foreground">
      <MousePointerClick className="size-5 text-primary/70" aria-hidden />
      Click a single marker to see its local impact. Click a cluster or a state to zoom in.
    </div>
  );
}

/** Verified context from the PRD (F10). Not sample data. */
function GridContext() {
  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Grid context · PJM (13 states + DC)</Eyebrow>
        <SampleBadge label="Verified · PRD" className="border-solid" />
      </div>
      <ul className="space-y-2">
        {PJM_FACTS.map((f) => (
          <li key={f.text} className="text-[11.5px] leading-relaxed">
            {f.text}{" "}
            <a
              href={f.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              {f.source.label}
              <ArrowUpRight className="size-3" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
