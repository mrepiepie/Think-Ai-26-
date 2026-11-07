"use client";

import { useState } from "react";
import { SAMPLE_HEADLINES, SAMPLE_STATEMENTS } from "@/data/citizen";
import { SAMPLE_DATA_CENTERS } from "@/data/data-centers";
import type { MapView } from "../map/map-types";
import { DataCenterMapPanel } from "./data-center-map-panel";
import { LocalImpactPanel } from "./local-impact-panel";
import { NewsTicker } from "./news-ticker";
import { OfficialsPanel } from "./officials-panel";

/** Persona 2: citizen using the data center watchdog. */
export function CitizenScreen() {
  const [view, setView] = useState<MapView>("globe");
  const [focusState, setFocusState] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const site = SAMPLE_DATA_CENTERS.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="grid gap-2 lg:h-full lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[minmax(0,1fr)_minmax(0,176px)_auto]">
      <DataCenterMapPanel
        dataCenters={SAMPLE_DATA_CENTERS}
        view={view}
        onViewChange={setView}
        focusState={focusState}
        onFocusState={setFocusState}
        selectedId={selectedId}
        onSelect={setSelectedId}
        className="h-[62vh] lg:col-start-1 lg:row-start-1 lg:h-auto"
      />
      <LocalImpactPanel
        site={site}
        className="lg:col-start-2 lg:row-span-2 lg:row-start-1"
      />
      <OfficialsPanel
        statements={SAMPLE_STATEMENTS}
        className="lg:col-start-1 lg:row-start-2"
      />
      <NewsTicker headlines={SAMPLE_HEADLINES} className="lg:col-span-2 lg:row-start-3" />
    </div>
  );
}
