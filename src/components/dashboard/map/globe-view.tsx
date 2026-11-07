"use client";

import { drag } from "d3-drag";
import { geoDistance, geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { clusterPoints, type Cluster } from "@/lib/cluster";
import { useElementSize } from "@/lib/use-element-size";
import {
  CoordinateReadout,
  MapControls,
  MapLoading,
  MapTooltip,
} from "./map-overlays";
import { MAP_THEME } from "./map-theme";
import type { MapLayerProps, MapMarker } from "./map-types";
import { MarkerLayer, PinLayer } from "./marker-layer";
import { useUsStates, useWorld } from "./use-geo";

/** Rotation that centres the contiguous US, tilted slightly north. */
const DEFAULT_ROTATION: [number, number] = [97, -34];
const GRATICULE = geoGraticule10();
const CLUSTER_PX = 30;

type Hover =
  | { type: "state"; code: string }
  | { type: "pin"; id: string }
  | { type: "cluster"; items: MapMarker[] };

export function GlobeView({
  tone,
  stateFill,
  selectedState,
  onStateClick,
  stateTooltip,
  markers,
  selectedMarkerId,
  onMarkerClick,
  markerTooltip,
  pins,
  onPinClick,
  selectedPinId,
  pinTooltip,
  showCoordinates,
}: MapLayerProps) {
  const theme = MAP_THEME[tone];
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [containerRef, { width, height }] = useElementSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const radiusRef = useRef(1);
  const animRef = useRef<number | null>(null);

  const [rotation, setRotation] = useState<[number, number]>(DEFAULT_ROTATION);
  const [k, setK] = useState(1);
  const [hover, setHover] = useState<Hover | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [coords, setCoords] = useState<[number, number] | null>(null);

  const us = useUsStates();
  const world = useWorld();

  const baseRadius = Math.max(10, Math.min(width, height) / 2 - 22);
  const radius = baseRadius * k;

  useEffect(() => {
    radiusRef.current = radius;
  }, [radius]);

  const projection = useMemo(
    () =>
      geoOrthographic()
        .scale(radius)
        .translate([width / 2, height / 2])
        .rotate([rotation[0], rotation[1], 0])
        .clipAngle(90)
        .precision(0.6),
    [radius, width, height, rotation],
  );

  const paths = useMemo(() => {
    const path = geoPath(projection);
    return {
      sphere: path({ type: "Sphere" }) ?? "",
      graticule: path(GRATICULE) ?? "",
      land: world ? (path(world.countries) ?? "") : "",
      borders: world ? (path(world.borders) ?? "") : "",
      states: us
        ? us.states.map((s) => ({ code: s.code, d: path(s.feature) ?? "" }))
        : [],
    };
  }, [projection, us, world]);

  // Markers on the visible hemisphere, clustered in screen space.
  const clusters = useMemo<Cluster<MapMarker>[]>(() => {
    if (!markers?.length) return [];
    const center: [number, number] = [-rotation[0], -rotation[1]];
    const pts = [];
    for (const m of markers) {
      if (geoDistance([m.lon, m.lat], center) > Math.PI / 2 - 0.03) continue;
      const p = projection([m.lon, m.lat]);
      if (p) pts.push({ x: p[0], y: p[1], item: m });
    }
    return clusterPoints(pts, CLUSTER_PX, (m) => m.id);
  }, [markers, projection, rotation]);

  const pinPoints = useMemo(() => {
    if (!pins?.length) return [];
    const center: [number, number] = [-rotation[0], -rotation[1]];
    return pins.flatMap((pin) => {
      if (geoDistance([pin.lon, pin.lat], center) > Math.PI / 2 - 0.03) return [];
      const p = projection([pin.lon, pin.lat]);
      return p ? [{ pin, x: p[0], y: p[1] }] : [];
    });
  }, [pins, projection, rotation]);

  // d3 interaction: drag rotates, wheel / double-click zooms.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const sel = select(svg);
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.75, 10])
      .filter((event: Event) => event.type === "wheel" || event.type === "dblclick")
      .on("zoom", (event) => setK(event.transform.k));
    const d = drag<SVGSVGElement, unknown>()
      .clickDistance(4)
      .on("start", () => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
      })
      .on("drag", (event) => {
        const degPerPx = 57.3 / radiusRef.current;
        setRotation(([l, p]) => [
          l + event.dx * degPerPx,
          Math.max(-89, Math.min(89, p - event.dy * degPerPx)),
        ]);
      });
    sel.call(z).call(d);
    zoomRef.current = z;
    return () => {
      sel.on(".zoom", null).on(".drag", null);
    };
  }, []);

  useEffect(
    () => () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    },
    [],
  );

  function animateRotation(target: [number, number], ms = 650) {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const start = performance.now();
    const from = rotation;
    // Take the short way round in longitude.
    const dl = ((((target[0] - from[0]) % 360) + 540) % 360) - 180;
    const dp = target[1] - from[1];
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      setRotation([from[0] + dl * e, from[1] + dp * e]);
      animRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    animRef.current = requestAnimationFrame(step);
  }

  function zoomBy(factor: number) {
    const svg = svgRef.current;
    if (svg && zoomRef.current) {
      zoomRef.current.scaleBy(select(svg).transition().duration(350), factor);
    }
  }

  function reset() {
    animateRotation(DEFAULT_ROTATION);
    const svg = svgRef.current;
    if (svg && zoomRef.current) {
      zoomRef.current.transform(select(svg).transition().duration(650), zoomIdentity);
    }
  }

  function handleClusterClick(c: Cluster<MapMarker>) {
    if (c.items.length === 1) {
      onMarkerClick?.(c.items[0].id);
      return;
    }
    const lon = c.items.reduce((s, m) => s + m.lon, 0) / c.items.length;
    const lat = c.items.reduce((s, m) => s + m.lat, 0) / c.items.length;
    animateRotation([-lon, -lat]);
    zoomBy(2.2);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPointer({ x, y });
    if (showCoordinates) {
      const inside = Math.hypot(x - width / 2, y - height / 2) <= radius;
      const ll = inside ? projection.invert?.([x, y]) : null;
      setCoords(ll ? [ll[0], ll[1]] : null);
    }
  }

  const selectedPath = paths.states.find((s) => s.code === selectedState);
  const tooltip =
    hover?.type === "state"
      ? stateTooltip?.(hover.code)
      : hover?.type === "pin"
        ? (pinTooltip?.(hover.id) ?? null)
        : hover?.type === "cluster"
        ? markerTooltip?.(hover.items)
        : null;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        setPointer(null);
        setCoords(null);
        setHover(null);
      }}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="block cursor-grab touch-none select-none active:cursor-grabbing"
        role="img"
        aria-label="Globe centred on the United States. Drag to rotate, scroll to zoom."
      >
        <defs>
          <radialGradient id={`${uid}-ocean`} cx="38%" cy="32%" r="80%">
            <stop offset="0%" stopColor={theme.ocean} />
            <stop offset="100%" stopColor={theme.oceanEdge} />
          </radialGradient>
          <radialGradient id={`${uid}-atmo`}>
            <stop offset="80%" stopColor={theme.atmosphere} stopOpacity={0.4} />
            <stop offset="86%" stopColor={theme.atmosphere} stopOpacity={0.14} />
            <stop offset="100%" stopColor={theme.atmosphere} stopOpacity={0} />
          </radialGradient>
          <filter id={`${uid}-blur`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>

        {width > 0 && (
          <>
            <circle
              cx={width / 2}
              cy={height / 2}
              r={radius * 1.18}
              fill={`url(#${uid}-atmo)`}
              className="pointer-events-none"
            />
            <path d={paths.sphere} fill={`url(#${uid}-ocean)`} />
            <path
              d={paths.graticule}
              fill="none"
              stroke={theme.graticule}
              strokeWidth={0.6}
              className="pointer-events-none"
            />
            <path d={paths.land} fill={theme.land} className="pointer-events-none" />
            <path
              d={paths.borders}
              fill="none"
              stroke={theme.landStroke}
              strokeWidth={0.5}
              className="pointer-events-none"
            />
            <g>
              {paths.states.map((s) => {
                const fill = stateFill(s.code);
                return (
                  <path
                    key={s.code}
                    data-state={s.code}
                    d={s.d}
                    fill={fill ?? theme.stateBase}
                    fillOpacity={fill ? theme.stateFillOpacity : 1}
                    stroke={theme.stateStroke}
                    strokeWidth={0.6}
                    className="cursor-pointer hover:brightness-150"
                    onPointerEnter={() => setHover({ type: "state", code: s.code })}
                    onPointerLeave={() => setHover(null)}
                    onClick={() => onStateClick?.(s.code)}
                  />
                );
              })}
            </g>
            {selectedPath && (
              <path
                d={selectedPath.d}
                fill="none"
                stroke="white"
                strokeWidth={1.6}
                className="pointer-events-none"
              />
            )}
            {/* Glowing rim */}
            <path
              d={paths.sphere}
              fill="none"
              stroke={theme.atmosphere}
              strokeWidth={3}
              strokeOpacity={0.6}
              filter={`url(#${uid}-blur)`}
              className="pointer-events-none"
            />
            <path
              d={paths.sphere}
              fill="none"
              stroke={theme.atmosphere}
              strokeOpacity={0.55}
              strokeWidth={1}
              className="pointer-events-none"
            />
            <PinLayer
          pins={pinPoints}
          onPinClick={onPinClick}
          selectedId={selectedPinId}
          onHover={(id) => setHover(id ? { type: "pin", id } : null)}
        />
            <MarkerLayer
              clusters={clusters}
              selectedId={selectedMarkerId}
              onClusterClick={handleClusterClick}
              onHover={(c) => setHover(c ? { type: "cluster", items: c.items } : null)}
            />
          </>
        )}
      </svg>

      {(!us || !world) && <MapLoading />}
      {pointer && tooltip && (
        <MapTooltip x={pointer.x} y={pointer.y}>
          {tooltip}
        </MapTooltip>
      )}
      <MapControls
        onZoomIn={() => zoomBy(1.6)}
        onZoomOut={() => zoomBy(1 / 1.6)}
        onReset={reset}
      />
      {showCoordinates && <CoordinateReadout coords={coords} />}
    </div>
  );
}
