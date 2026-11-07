"use client";

import type { Feature, FeatureCollection, Geometry, MultiLineString } from "geojson";
import { useMemo } from "react";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { STATES } from "@/data/states";
import { GEO, useTopology } from "@/lib/use-topology";

export interface StateFeature {
  fips: string;
  code: string;
  name: string;
  feature: Feature<Geometry>;
}

type UsTopology = Topology<{
  states: GeometryCollection<{ name: string }>;
  nation: GeometryCollection;
  counties?: GeometryCollection<{ name: string }>;
}>;

type WorldTopology = Topology<{
  countries: GeometryCollection<{ name: string }>;
}>;

/** US states (Census-based us-atlas), with FIPS -> USPS code attached. */
export function useUsStates() {
  const topo = useTopology(GEO.states) as UsTopology | null;
  return useMemo(() => {
    if (!topo) return null;
    const fc = feature(topo, topo.objects.states) as FeatureCollection<Geometry, { name: string }>;
    const states: StateFeature[] = fc.features
      .filter((f) => STATES[String(f.id)])
      .map((f) => {
        const fips = String(f.id);
        return { fips, code: STATES[fips].code, name: STATES[fips].name, feature: f };
      });
    const nation = feature(topo, topo.objects.nation) as FeatureCollection;
    return { states, nation };
  }, [topo]);
}

export interface CountyFeature {
  fips: string;
  name: string;
  feature: Feature<Geometry>;
}

/** Counties for one state. Only fetches the counties file when needed. */
export function useCounties(stateFips: string | null) {
  const topo = useTopology(stateFips ? GEO.counties : null) as UsTopology | null;
  return useMemo(() => {
    if (!topo || !stateFips || !topo.objects.counties) return null;
    const fc = feature(topo, topo.objects.counties) as FeatureCollection<Geometry, { name: string }>;
    return fc.features
      .filter((f) => String(f.id).startsWith(stateFips))
      .map<CountyFeature>((f) => ({
        fips: String(f.id),
        name: f.properties?.name ?? "",
        feature: f,
      }));
  }, [topo, stateFips]);
}

/** World land + country borders for the globe backdrop. */
export function useWorld() {
  const topo = useTopology(GEO.world) as WorldTopology | null;
  return useMemo(() => {
    if (!topo) return null;
    const countries = feature(topo, topo.objects.countries) as FeatureCollection;
    const borders = mesh(
      topo,
      topo.objects.countries,
      (a, b) => a !== b,
    ) as MultiLineString;
    return { countries, borders };
  }, [topo]);
}
