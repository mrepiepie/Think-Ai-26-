import type { MapTone } from "./map-types";

/** Colors for the map backdrop per screen. Status colors live in globals.css. */
export const MAP_THEME: Record<
  MapTone,
  {
    ocean: string;
    oceanEdge: string;
    atmosphere: string;
    graticule: string;
    land: string;
    landStroke: string;
    stateBase: string;
    stateStroke: string;
    stateFillOpacity: number;
  }
> = {
  compliance: {
    ocean: "oklch(0.15 0.03 275)",
    oceanEdge: "oklch(0.075 0.015 275)",
    atmosphere: "oklch(0.7 0.15 275)",
    graticule: "oklch(0.7 0.12 275 / 0.14)",
    land: "oklch(0.27 0.014 275)",
    landStroke: "oklch(1 0 0 / 0.12)",
    stateBase: "oklch(0.3 0.014 275)",
    stateStroke: "oklch(1 0 0 / 0.16)",
    stateFillOpacity: 0.62,
  },
  citizen: {
    ocean: "oklch(0.14 0.035 220)",
    oceanEdge: "oklch(0.065 0.015 220)",
    atmosphere: "oklch(0.75 0.11 210)",
    graticule: "oklch(0.75 0.1 210 / 0.1)",
    land: "oklch(0.22 0.03 215)",
    landStroke: "oklch(0.8 0.08 210 / 0.12)",
    stateBase: "oklch(0.24 0.035 215)",
    stateStroke: "oklch(0.8 0.08 210 / 0.2)",
    stateFillOpacity: 0.5,
  },
};

export const MARKER_COLOR = {
  existing: "var(--dc-existing)",
  proposed: "var(--dc-proposed)",
} as const;
