"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Topology } from "topojson-specification";

/**
 * Loads a TopoJSON file from /public once and shares it between all map
 * components. Returns null until it has loaded.
 */
const cache = new Map<string, Topology>();
const inflight = new Set<string>();
const listeners = new Set<() => void>();

function load(url: string) {
  if (cache.has(url) || inflight.has(url)) return;
  inflight.add(url);
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
      return res.json() as Promise<Topology>;
    })
    .then((topo) => {
      cache.set(url, topo);
      listeners.forEach((l) => l());
    })
    .catch((err) => console.error(err))
    .finally(() => inflight.delete(url));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useTopology(url: string | null): Topology | null {
  useEffect(() => {
    if (url) load(url);
  }, [url]);
  return useSyncExternalStore(
    subscribe,
    () => (url ? cache.get(url) ?? null : null),
    () => null,
  );
}

export const GEO = {
  states: "/geo/states-10m.json",
  counties: "/geo/counties-10m.json",
  world: "/geo/countries-110m.json",
} as const;
