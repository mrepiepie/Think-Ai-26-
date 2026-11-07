"use client";

import { useMemo, useState } from "react";
import { LAW_CHANGE_ALERTS, UPCOMING_DEADLINES } from "@/data/alerts";
import { SAMPLE_COMPANY } from "@/data/company";
import { DEFAULT_FILTERS, lawPassesFilters, type LawFilters } from "@/lib/compliance";
import { isoDay, matchCompany, rollupByJurisdiction } from "@/lib/matching";
import type { ConfirmedProfile, ProductProfileDraft } from "@/lib/product-profile";
import { useNow } from "@/lib/use-now";
import { AlertsFeed } from "./alerts-feed";
import { ComplianceMapPanel } from "./compliance-map-panel";
import { DeadlinesList } from "./deadlines-list";
import { useNoticeDrafter } from "./notice-drafter";
import { ProductPanel, type ReaderState } from "./product-panel";
import { fromDraft, toConfirmed, type EditableProfile } from "./profile-editor";
import { StateChecklist } from "./state-checklist";

const SEVERITY = { "non-compliant": 3, "action-soon": 2, compliant: 1, "not-applicable": 0 } as const;

/**
 * Persona 1: small company.
 * Describe product (AI) -> confirm profile -> deterministic matching ->
 * checklist with honest status -> streamed notice drafts (AI).
 */
export function SmallCompanyScreen() {
  const [description, setDescription] = useState("");
  const [isExample, setIsExample] = useState(false);
  const [reader, setReader] = useState<ReaderState>({ status: "idle" });
  const [profile, setProfile] = useState<EditableProfile | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedProfile | null>(null);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [filters, setFilters] = useState<LawFilters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<string | null>(null);
  const drafter = useNoticeDrafter(confirmed);

  const nowMs = useNow();
  // Matching only runs after a click, by which time the clock is available.
  const today = nowMs ? isoDay(nowMs) : "1970-01-01";

  const matches = useMemo(() => (confirmed ? matchCompany(confirmed) : []), [confirmed]);
  const rollup = useMemo(
    () =>
      confirmed
        ? rollupByJurisdiction(matches, confirmed, checked, today, (law) => lawPassesFilters(law, filters))
        : {},
    [matches, confirmed, checked, today, filters],
  );

  const pending = profile ? toConfirmed(profile) : null;
  const stale = !!confirmed && JSON.stringify(pending) !== JSON.stringify(confirmed);

  async function analyze() {
    setReader({ status: "loading" });
    try {
      const res = await fetch("/api/product-reader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const body = (await res.json().catch(() => null)) as
        | { profile: ProductProfileDraft; model: string }
        | { error: string }
        | null;
      if (!res.ok || !body || "error" in body) {
        throw new Error(body && "error" in body ? body.error : `The product reader failed (HTTP ${res.status}).`);
      }
      setProfile(fromDraft(body.profile, description));
      setReader({ status: "done", model: body.model });
    } catch (err) {
      setReader({
        status: "error",
        error: err instanceof Error && err.message !== "Failed to fetch" ? err.message : "Couldn't reach the server. Check your connection and try again.",
      });
    }
  }

  function run() {
    if (!pending) return;
    setConfirmed(pending);
    setChecked(new Set());
    // Select the worst-off jurisdiction so the checklist opens on something useful.
    const next = rollupByJurisdiction(matchCompany(pending), pending, new Set(), today);
    const worst = Object.values(next).sort((a, b) => SEVERITY[b.status] - SEVERITY[a.status])[0];
    setSelected(worst?.key ?? pending.jurisdictions[0] ?? null);
  }

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="grid gap-2 lg:h-full lg:grid-cols-[300px_minmax(0,1fr)_370px] lg:grid-rows-[minmax(0,1fr)_minmax(0,210px)]">
      <ComplianceMapPanel
        title={isExample ? SAMPLE_COMPANY.productName : "Your product"}
        rollup={rollup}
        showNyc={!!confirmed?.jurisdictions.includes("NYC")}
        selected={selected}
        onSelect={setSelected}
        isExample={isExample}
        className="h-[62vh] lg:col-start-2 lg:row-start-1 lg:h-auto"
      />
      <ProductPanel
        description={description}
        onDescriptionChange={(v) => {
          setDescription(v);
          setIsExample(v === SAMPLE_COMPANY.productDescription);
        }}
        isExample={isExample}
        onLoadExample={() => {
          setDescription(SAMPLE_COMPANY.productDescription);
          setIsExample(true);
        }}
        reader={reader}
        onAnalyze={analyze}
        profile={profile}
        onProfileChange={setProfile}
        canRun={!!pending}
        stale={stale}
        onRun={run}
        confirmed={confirmed}
        rollup={rollup}
        selected={selected}
        onSelect={setSelected}
        filters={filters}
        onFiltersChange={setFilters}
        className="max-h-[80vh] lg:col-start-1 lg:row-start-1 lg:max-h-none"
      />
      <StateChecklist
        jurisdiction={selected}
        rollup={selected ? rollup[selected] : undefined}
        hasProfile={!!confirmed}
        checked={checked}
        onToggle={toggle}
        today={today}
        onDraft={drafter.open}
        isExample={isExample}
        className="max-h-[70vh] lg:col-start-3 lg:row-start-1 lg:max-h-none"
      />
      <div className="grid gap-2 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:col-span-3 lg:row-start-2 lg:min-h-0">
        <AlertsFeed alerts={LAW_CHANGE_ALERTS} onSelectState={setSelected} className="max-h-72 lg:max-h-none" />
        <DeadlinesList deadlines={UPCOMING_DEADLINES} className="max-h-72 lg:max-h-none" />
      </div>
      {drafter.dialog}
    </div>
  );
}
