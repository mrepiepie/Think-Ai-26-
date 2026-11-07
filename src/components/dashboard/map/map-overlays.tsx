"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";

/** Floating zoom controls, bottom-right of a map. */
export function MapControls({
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  const items = [
    { label: "Zoom in", icon: Plus, onClick: onZoomIn },
    { label: "Zoom out", icon: Minus, onClick: onZoomOut },
    { label: "Reset", icon: Maximize2, onClick: onReset },
  ];
  return (
    <div className="absolute right-3 bottom-9 z-10 flex flex-col overflow-hidden rounded-md border border-border bg-background/80 backdrop-blur-sm">
      {items.map(({ label, icon: Icon, onClick }) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          className="flex items-center gap-2 border-b border-border px-2.5 py-1.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase transition-colors last:border-b-0 hover:bg-primary/15 hover:text-foreground focus-visible:bg-primary/15 focus-visible:text-foreground focus-visible:outline-none"
        >
          <Icon className="size-3" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}

/** Lon/lat readout under the cursor. */
export function CoordinateReadout({ coords }: { coords: [number, number] | null }) {
  const fmt = (v: number, pos: string, neg: string) =>
    `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`;
  return (
    <div className="pointer-events-none absolute right-3 bottom-2.5 z-10 font-mono text-[10px] tracking-wider text-muted-foreground tabular-nums">
      {coords
        ? `${fmt(coords[1], "N", "S")}  ${fmt(coords[0], "E", "W")}`
        : "--.--°  --.--°"}
    </div>
  );
}

/** Small tooltip that follows the pointer inside a map container. */
export function MapTooltip({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: ReactNode;
}) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 max-w-64 rounded-md border border-border bg-popover/95 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur-sm"
      style={{ left: x + 14, top: y + 14 }}
    >
      {children}
    </div>
  );
}

export function MapLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
      <span className="animate-pulse">Loading map data…</span>
    </div>
  );
}
