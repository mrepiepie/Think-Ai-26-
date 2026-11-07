"use client";

import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { stateName } from "@/data/states";
import type { DataCenter } from "@/data/types";
import { FlatMap } from "../map/flat-map";
import { GlobeView } from "../map/globe-view";
import { LegendBox, LegendItem, MapStage } from "../map/map-stage";
import { MARKER_COLOR } from "../map/map-theme";
import type { MapLayerProps, MapMarker, MapView } from "../map/map-types";
import { ViewToggle } from "../map/view-toggle";
import { Panel } from "../panel";

/** Centre panel for the citizen: clustered sample data center markers. */
export function DataCenterMapPanel({
  dataCenters,
  view,
  onViewChange,
  focusState,
  onFocusState,
  selectedId,
  onSelect,
  className,
}: {
  dataCenters: DataCenter[];
  view: MapView;
  onViewChange: (v: MapView) => void;
  focusState: string | null;
  onFocusState: (code: string | null) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const markers = useMemo<MapMarker[]>(
    () => dataCenters.map((d) => ({ id: d.id, lon: d.lon, lat: d.lat, kind: d.status })),
    [dataCenters],
  );
  const byId = useMemo(() => new Map(dataCenters.map((d) => [d.id, d])), [dataCenters]);
  const existing = dataCenters.filter((d) => d.status === "existing").length;
  const inFocus = focusState ? dataCenters.filter((d) => d.state === focusState).length : null;

  const layer: MapLayerProps = {
    tone: "citizen",
    stateFill: () => null,
    selectedState: focusState,
    onStateClick: (code) => {
      // Clicking a state drills down to county level on the flat map.
      if (view === "globe") onViewChange("map");
      onFocusState(code);
    },
    stateTooltip: (code) => {
      const n = dataCenters.filter((d) => d.state === code).length;
      return (
        <span>
          <span className="font-medium">{stateName(code)}</span>
          <span className="text-muted-foreground">
            {" "}· {n} sample site{n === 1 ? "" : "s"} · click for county view
          </span>
        </span>
      );
    },
    markers,
    selectedMarkerId: selectedId,
    onMarkerClick: onSelect,
    markerTooltip: (items) => {
      if (items.length === 1) {
        const d = byId.get(items[0].id);
        return (
          <span>
            <span className="font-mono text-[11px]">{d?.name}</span>
            <span style={{ color: MARKER_COLOR[items[0].kind] }}> · {items[0].kind}</span>
          </span>
        );
      }
      const proposed = items.filter((m) => m.kind === "proposed").length;
      return (
        <span className="font-mono text-[11px]">
          {items.length} sample sites ·{" "}
          <span style={{ color: MARKER_COLOR.existing }}>{items.length - proposed} existing</span> ·{" "}
          <span style={{ color: MARKER_COLOR.proposed }}>{proposed} proposed</span>
          <span className="block text-muted-foreground">Click to expand</span>
        </span>
      );
    },
    showCoordinates: true,
  };

  return (
    <Panel
      title="Data center watchdog"
      sample
      className={className}
      actions={<ViewToggle value={view} onChange={onViewChange} />}
    >
      <MapStage
        tinted
        topLeft={
          <div className="space-y-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            <div>
              <span className="text-foreground">{dataCenters.length} sample sites</span> ·{" "}
              <span style={{ color: MARKER_COLOR.existing }}>{existing} existing</span> ·{" "}
              <span style={{ color: MARKER_COLOR.proposed }}>
                {dataCenters.length - existing} proposed
              </span>
            </div>
            {focusState && view === "map" && (
              <div className="text-foreground">
                {stateName(focusState)} · county view · {inFocus} site{inFocus === 1 ? "" : "s"}
              </div>
            )}
          </div>
        }
        bottomLeft={
          <div className="flex flex-col items-start gap-1.5">
            {focusState && view === "map" && (
              <button
                type="button"
                onClick={() => onFocusState(null)}
                className="flex items-center gap-1.5 rounded-md border border-border bg-background/80 px-2 py-1 font-mono text-[10px] tracking-wider uppercase backdrop-blur-sm hover:border-primary/60 focus-visible:border-primary focus-visible:outline-none"
              >
                <ArrowLeft className="size-3" aria-hidden />
                Back to US
              </button>
            )}
            <LegendBox>
              <LegendItem color={MARKER_COLOR.existing} label="Existing" />
              <LegendItem color={MARKER_COLOR.proposed} label="Proposed" />
              <span>Circle size = count</span>
            </LegendBox>
          </div>
        }
      >
        {view === "globe" ? (
          <GlobeView {...layer} />
        ) : (
          <FlatMap
            {...layer}
            focusState={focusState}
            showCounties
            onReset={() => onFocusState(null)}
          />
        )}
      </MapStage>
    </Panel>
  );
}
