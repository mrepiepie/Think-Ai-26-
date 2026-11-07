"use client";

import { useMemo, useState } from "react";
import { LAW_CHANGE_ALERTS, UPCOMING_DEADLINES } from "@/data/alerts";
import { SAMPLE_ASSESSMENTS, SAMPLE_COMPANY } from "@/data/company";
import { DEFAULT_FILTERS, rollupByState, type LawFilters } from "@/lib/compliance";
import { AlertsFeed } from "./alerts-feed";
import { ComplianceMapPanel } from "./compliance-map-panel";
import { DeadlinesList } from "./deadlines-list";
import { ProductPanel } from "./product-panel";
import { StateChecklist } from "./state-checklist";

/** Persona 1: small company. */
export function SmallCompanyScreen() {
  const [selectedState, setSelectedState] = useState<string | null>("NY");
  const [filters, setFilters] = useState<LawFilters>(DEFAULT_FILTERS);
  const rollup = useMemo(() => rollupByState(SAMPLE_ASSESSMENTS, filters), [filters]);

  return (
    <div className="grid gap-2 lg:h-full lg:grid-cols-[280px_minmax(0,1fr)_350px] lg:grid-rows-[minmax(0,1fr)_minmax(0,210px)]">
      <ComplianceMapPanel
        company={SAMPLE_COMPANY}
        rollup={rollup}
        selectedState={selectedState}
        onSelectState={setSelectedState}
        className="h-[62vh] lg:col-start-2 lg:row-start-1 lg:h-auto"
      />
      <ProductPanel
        company={SAMPLE_COMPANY}
        rollup={rollup}
        selectedState={selectedState}
        onSelectState={setSelectedState}
        filters={filters}
        onFiltersChange={setFilters}
        className="lg:col-start-1 lg:row-start-1"
      />
      <StateChecklist
        state={selectedState}
        rollup={selectedState ? rollup[selectedState] : undefined}
        className="max-h-[70vh] lg:col-start-3 lg:row-start-1 lg:max-h-none"
      />
      <div className="grid gap-2 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:col-span-3 lg:row-start-2 lg:min-h-0">
        <AlertsFeed
          alerts={LAW_CHANGE_ALERTS}
          onSelectState={setSelectedState}
          className="max-h-72 lg:max-h-none"
        />
        <DeadlinesList deadlines={UPCOMING_DEADLINES} className="max-h-72 lg:max-h-none" />
      </div>
    </div>
  );
}
