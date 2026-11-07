"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MapView } from "./map-types";

/** Small "MAP | GLOBE" tab toggle shown above the map. */
export function ViewToggle({
  value,
  onChange,
}: {
  value: MapView;
  onChange: (v: MapView) => void;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as MapView)}>
      <TabsList
        aria-label="Map view"
        className="h-6! rounded-sm border border-border bg-background/60 p-0.5"
      >
        {(["map", "globe"] as const).map((v) => (
          <TabsTrigger
            key={v}
            value={v}
            className="rounded-[3px] px-2 font-mono text-[9.5px] tracking-[0.16em] uppercase data-active:border-primary/40! data-active:bg-primary/15! data-active:text-foreground"
          >
            {v}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
