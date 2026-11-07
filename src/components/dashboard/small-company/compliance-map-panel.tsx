"use client";

import { useState } from "react";
import { NYC_PIN } from "@/data/company";
import { jurisdictionName } from "@/data/states";
import type { ComplianceStatus } from "@/data/types";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/compliance";
import type { JurisdictionRollup } from "@/lib/matching";
import { FlatMap } from "../map/flat-map";
import { GlobeView } from "../map/globe-view";
import { LegendBox, LegendItem, MapStage } from "../map/map-stage";
import type { MapLayerProps, MapView } from "../map/map-types";
import { ViewToggle } from "../map/view-toggle";
import { Panel } from "../panel";
import { StatusDot } from "./status";

const LEGEND: ComplianceStatus[] = ["compliant", "action-soon", "non-compliant", "not-applicable"];

/**
 * Centre panel: jurisdictions coloured by computed compliance status.
 * States are coloured only by state-level laws; New York City is its own
 * jurisdiction, shown as a coloured pin (never colours New York State).
 */
export function ComplianceMapPanel({
  title,
  rollup,
  showNyc,
  selected,
  onSelect,
  isExample,
  className,
}: {
  title: string;
  rollup: Record<string, JurisdictionRollup>;
  showNyc: boolean;
  selected: string | null;
  onSelect: (key: string) => void;
  isExample: boolean;
  className?: string;
}) {
  const [view, setView] = useState<MapView>("globe");

  const entries = Object.values(rollup);
  const counts = entries.reduce<Partial<Record<ComplianceStatus, number>>>(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
    {},
  );

  const tooltip = (key: string) => {
    const r = rollup[key];
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 font-medium">
          <StatusDot status={r?.status ?? null} />
          {jurisdictionName(key)}
          <span className="font-mono text-[10px] text-muted-foreground uppercase">
            {r ? r.label : "No tracked laws"}
          </span>
        </div>
        {r?.laws.map((l) => (
          <div key={l.law.id} className="text-[11px] text-muted-foreground">
            {l.law.name}: {r.lawLabel[l.law.id].toLowerCase()}
          </div>
        ))}
        {r && r.needsReview > 0 && (
          <div className="text-[11px] text-status-soon">{r.needsReview} duties need review</div>
        )}
      </div>
    );
  };

  const nycStatus = rollup.NYC?.status ?? null;
  const layer: MapLayerProps = {
    tone: "compliance",
    // State keys only: "NYC" is never a state fill, so NY State reflects state laws alone.
    stateFill: (code) => (rollup[code] ? STATUS_COLOR[rollup[code].status] : null),
    selectedState: selected === "NYC" ? null : selected,
    onStateClick: onSelect,
    stateTooltip: tooltip,
    pins: showNyc ? [{ ...NYC_PIN, color: nycStatus ? STATUS_COLOR[nycStatus] : null }] : [],
    onPinClick: onSelect,
    selectedPinId: selected,
    pinTooltip: tooltip,
  };

  return (
    <Panel
      title="Compliance map"
      sample={isExample}
      className={className}
      actions={<ViewToggle value={view} onChange={setView} />}
    >
      <MapStage
        topLeft={
          <div className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            <div className="text-foreground">
              {title} · {entries.length} jurisdiction{entries.length === 1 ? "" : "s"} with tracked laws
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-3">
              {(["non-compliant", "action-soon", "compliant"] as const).map((s) => (
                <span key={s} style={{ color: STATUS_COLOR[s] }}>
                  {counts[s] ?? 0} {STATUS_LABEL[s]}
                </span>
              ))}
            </div>
          </div>
        }
        bottomLeft={
          <LegendBox>
            {LEGEND.map((s) => (
              <LegendItem key={s} color={STATUS_COLOR[s]} label={STATUS_LABEL[s]} shape="square" />
            ))}
          </LegendBox>
        }
      >
        {view === "globe" ? <GlobeView {...layer} /> : <FlatMap {...layer} />}
      </MapStage>
    </Panel>
  );
}
