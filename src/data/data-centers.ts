import type { DataCenter, DataCenterStatus } from "./types";

/**
 * SAMPLE DATA. Placeholder data center markers for the citizen view.
 * Names, operators, locations, capacities and hearing dates are all
 * generated. They do not describe real facilities.
 *
 * Markers are scattered (deterministically) around a few anchor points
 * so the map shows realistic clustering behaviour.
 */

interface Anchor {
  state: string;
  lon: number;
  lat: number;
  count: number;
  /** Share of markers that are "proposed". */
  proposed: number;
  spread: number;
}

const ANCHORS: Anchor[] = [
  { state: "VA", lon: -77.75, lat: 38.55, count: 22, proposed: 0.3, spread: 0.32 },
  { state: "TX", lon: -97.0, lat: 32.8, count: 12, proposed: 0.4, spread: 0.7 },
  { state: "TX", lon: -97.8, lat: 30.3, count: 7, proposed: 0.5, spread: 0.5 },
  { state: "AZ", lon: -112.0, lat: 33.45, count: 9, proposed: 0.45, spread: 0.5 },
  { state: "OH", lon: -82.9, lat: 40.0, count: 9, proposed: 0.35, spread: 0.6 },
  { state: "GA", lon: -84.4, lat: 33.75, count: 7, proposed: 0.3, spread: 0.5 },
  { state: "IL", lon: -88.1, lat: 41.85, count: 6, proposed: 0.2, spread: 0.4 },
  { state: "OR", lon: -121.0, lat: 45.5, count: 5, proposed: 0.2, spread: 0.4 },
  { state: "WA", lon: -119.6, lat: 47.2, count: 4, proposed: 0.25, spread: 0.5 },
  { state: "NV", lon: -115.1, lat: 36.2, count: 5, proposed: 0.4, spread: 0.4 },
  { state: "UT", lon: -111.9, lat: 40.65, count: 3, proposed: 0.33, spread: 0.3 },
  { state: "IA", lon: -93.6, lat: 41.6, count: 4, proposed: 0.25, spread: 0.6 },
  { state: "NE", lon: -96.1, lat: 41.25, count: 3, proposed: 0.33, spread: 0.4 },
  { state: "PA", lon: -77.2, lat: 40.4, count: 6, proposed: 0.6, spread: 0.7 },
  { state: "NC", lon: -80.8, lat: 35.4, count: 4, proposed: 0.5, spread: 0.6 },
  { state: "IN", lon: -86.2, lat: 39.9, count: 4, proposed: 0.75, spread: 0.6 },
  { state: "WY", lon: -104.8, lat: 41.15, count: 2, proposed: 0.5, spread: 0.4 },
  { state: "LA", lon: -91.9, lat: 32.4, count: 2, proposed: 1, spread: 0.3 },
  { state: "WI", lon: -87.95, lat: 42.7, count: 2, proposed: 1, spread: 0.2 },
];

/** Small deterministic PRNG (mulberry32) so markers never move between renders. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OPERATORS = [
  "Placeholder Operator A",
  "Placeholder Operator B",
  "Placeholder Operator C",
  "Placeholder Operator D",
];

const HEARING_DATES = [
  "2026-11-19",
  "2026-12-03",
  "2026-12-10",
  "2027-01-14",
  "2027-02-04",
];

function build(): DataCenter[] {
  const rand = mulberry32(2026);
  const out: DataCenter[] = [];
  let n = 1;
  for (const anchor of ANCHORS) {
    const proposedCount = Math.round(anchor.count * anchor.proposed);
    for (let i = 0; i < anchor.count; i++) {
      const status: DataCenterStatus = i < proposedCount ? "proposed" : "existing";
      // Gaussian-ish jitter (sum of two uniforms) keeps points near the anchor.
      const dx = (rand() + rand() - 1) * anchor.spread * 1.3;
      const dy = (rand() + rand() - 1) * anchor.spread;
      const capacityMW = Math.round((40 + rand() * 360) / 10) * 10;
      const low = Math.round(1 + rand() * 5);
      out.push({
        id: `dc-${String(n).padStart(3, "0")}`,
        name: `SAMPLE SITE ${String(n).padStart(3, "0")}`,
        operator: OPERATORS[Math.floor(rand() * OPERATORS.length)],
        status,
        lon: +(anchor.lon + dx).toFixed(4),
        lat: +(anchor.lat + dy).toFixed(4),
        state: anchor.state,
        capacityMW,
        waterMgd: +(0.2 + rand() * 1.6).toFixed(1),
        billImpactPerMonth: [low, low + Math.round(2 + rand() * 6)],
        hearingDate:
          status === "proposed"
            ? HEARING_DATES[Math.floor(rand() * HEARING_DATES.length)]
            : null,
      });
      n++;
    }
  }
  return out;
}

export const SAMPLE_DATA_CENTERS: DataCenter[] = build();
