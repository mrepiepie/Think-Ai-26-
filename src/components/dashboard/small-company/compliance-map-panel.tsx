"use client";

import { useState } from "react";
import type { CompanyProfile, ComplianceStatus } from "@/data/types";
import { stateName } from "@/data/states";
import { STATUS_COLOR, STATUS_LABEL, type StateRollup } from "@/lib/compliance";
import { FlatMap } from "../map/flat-map";
import { GlobeView } from "../map/globe-view";
import { LegendBox, LegendItem, MapStage } from "../map/map-stage";
import type { MapLayerProps, MapView } from "../map/map-types";
import { ViewToggle } from "../map/view-toggle";
import { Panel } from "../panel";
import { StatusDot } from "./status";

const LEGEND: ComplianceStatus[] = [
  "compliant",
  "action-soon",
  "non-compliant",
  "not-applicable",
];

/** Centre panel: states coloured by the sample company's compliance. */
export function ComplianceMapPanel({
  company,
  rollup,
  selectedState,
  onSelectState,
  className,
}: {
  company: CompanyProfile;
  rollup: Record<string, StateRollup>;
  selectedState: string | null;
  onSelectState: (code: string) => void;
  className?: string;
}) {
  const [view, setView] = useState<MapView>("globe");

  const counts = Object.values(rollup).reduce<Partial<Record<ComplianceStatus, number>>>(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
    {},
  );

  const layer: MapLayerProps = {
    tone: "compliance",
    stateFill: (code) => (rollup[code] ? STATUS_COLOR[rollup[code].status] : null),
    selectedState,
    onStateClick: onSelectState,
    pins: company.cityPins,
    stateTooltip: (code) => {
      const r = rollup[code];
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <StatusDot status={r?.status ?? null} />
            {stateName(code)}
            <span className="font-mono text-[10px] text-muted-foreground uppercase">
              {r ? STATUS_LABEL[r.status] : "No tracked laws"}
            </span>
          </div>
          {r?.items.map(({ law, assessment }) => (
            <div key={law.id} className="text-[11px] text-muted-foreground">
              {law.name}: {STATUS_LABEL[assessment.status].toLowerCase()}
            </div>
          ))}
        </div>
      );
    },
  };

  return (
    <Panel
      title="Compliance map"
      sample
      className={className}
      actions={<ViewToggle value={view} onChange={setView} />}
    >
      <MapStage
        topLeft={
          <div className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            <div className="text-foreground">{company.productName} · {Object.keys(rollup).length} jurisdictions tracked</div>
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
