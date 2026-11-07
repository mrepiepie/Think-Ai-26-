"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { clusterRadius, type Cluster } from "@/lib/cluster";
import { MARKER_COLOR } from "./map-theme";
import type { MapMarker, MapPin } from "./map-types";

/**
 * Draws clustered markers in screen space (so they keep a fixed size at
 * any zoom). A cluster is coloured by its majority kind; single markers
 * use their own kind's colour.
 */
export function MarkerLayer({
  clusters,
  selectedId,
  onClusterClick,
  onHover,
}: {
  clusters: Cluster<MapMarker>[];
  selectedId?: string | null;
  onClusterClick: (cluster: Cluster<MapMarker>) => void;
  onHover: (cluster: Cluster<MapMarker> | null) => void;
}) {
  return (
    <g>
      {clusters.map((c) => {
        const count = c.items.length;
        const proposed = c.items.filter((m) => m.kind === "proposed").length;
        const kind = proposed > count / 2 ? "proposed" : "existing";
        const color = MARKER_COLOR[kind];
        const r = clusterRadius(count);
        const selected = count === 1 && c.items[0].id === selectedId;
        const label =
          count === 1
            ? `Sample data center, ${c.items[0].kind}`
            : `${count} sample data centers: ${count - proposed} existing, ${proposed} proposed`;
        return (
          <g
            key={c.id}
            transform={`translate(${c.x},${c.y})`}
            className="cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label={label}
            onClick={(e) => {
              e.stopPropagation();
              onClusterClick(c);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClusterClick(c);
              }
            }}
            onPointerEnter={() => onHover(c)}
            onPointerLeave={() => onHover(null)}
          >
            <circle r={r + 7} fill={color} opacity={0.12} />
            <circle
              r={r}
              fill={color}
              fillOpacity={count === 1 ? 0.95 : 0.3}
              stroke={color}
              strokeWidth={count === 1 ? 0 : 1.5}
            />
            {count > 1 && proposed > 0 && proposed < count && (
              // Thin arc showing the minority kind's share of a mixed cluster.
              <circle
                r={r + 3}
                fill="none"
                stroke={MARKER_COLOR[kind === "existing" ? "proposed" : "existing"]}
                strokeWidth={2}
                pathLength={100}
                strokeDasharray={`${((kind === "existing" ? proposed : count - proposed) / count) * 100} 100`}
                transform="rotate(-90)"
                opacity={0.9}
              />
            )}
            {selected && (
              <circle r={r + 5} fill="none" stroke="white" strokeWidth={1.5} />
            )}
            {count > 1 && (
              <text
                textAnchor="middle"
                dy="0.35em"
                className="pointer-events-none fill-white font-mono text-[10px] font-semibold"
              >
                {count}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/**
 * City pins (e.g. NYC) drawn as a small crosshair with a label. When
 * `onPinClick` is set they are buttons (click / Enter / Space).
 */
export function PinLayer({
  pins,
  onPinClick,
  selectedId,
  onHover,
}: {
  pins: { pin: MapPin; x: number; y: number }[];
  onPinClick?: (id: string) => void;
  selectedId?: string | null;
  onHover?: (id: string | null) => void;
}) {
  return (
    <g className={onPinClick ? undefined : "pointer-events-none"}>
      {pins.map(({ pin, x, y }) => {
        const id = pin.id ?? pin.label;
        const color = pin.color ?? "white";
        const selected = selectedId === id;
        const interactive = onPinClick
          ? {
              role: "button",
              tabIndex: 0,
              "aria-label": `${pin.label}: open checklist`,
              "aria-pressed": selected,
              className: "cursor-pointer outline-none",
              onClick: (e: MouseEvent) => {
                e.stopPropagation();
                onPinClick(id);
              },
              onKeyDown: (e: KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPinClick(id);
                }
              },
              onPointerEnter: () => onHover?.(id),
              onPointerLeave: () => onHover?.(null),
            }
          : {};
        return (
          <g key={id} transform={`translate(${x},${y})`} {...interactive}>
            {onPinClick && <circle r={12} fill="transparent" />}
            {pin.color && <circle r={9} fill={color} opacity={0.18} />}
            <circle r={6} fill="none" stroke={color} strokeOpacity={pin.color ? 1 : 0.7} strokeWidth={pin.color ? 2 : 1} />
            <circle r={2.2} fill={color} />
            {selected && <circle r={10} fill="none" stroke="white" strokeWidth={1.5} />}
            <text
              x={12}
              dy="0.35em"
              className="pointer-events-none fill-white font-mono text-[10px] font-semibold tracking-wider"
              style={{ paintOrder: "stroke", stroke: "black", strokeWidth: 3 }}
            >
              {pin.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
