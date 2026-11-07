"use client";

import { geoAlbersUsa, geoPath } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import {
  zoom as d3zoom,
  zoomIdentity,
  type ZoomBehavior,
  type ZoomTransform,
} from "d3-zoom";
import { useEffect, useMemo, useRef, useState } from "react";
import { FIPS_BY_CODE, stateName } from "@/data/states";
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
import { useCounties, useUsStates } from "./use-geo";

const CLUSTER_PX = 30;
const MAX_ZOOM = 48;

type Hover =
  | { type: "state"; code: string }
  | { type: "county"; name: string; state: string }
  | { type: "cluster"; items: MapMarker[] };

interface FlatMapProps extends MapLayerProps {
  /**
   * When provided, the map zooms to this state (and null zooms back out).
   * Leave undefined for a map that never auto-zooms.
   */
  focusState?: string | null;
  /** Draw county borders for the focused state. */
  showCounties?: boolean;
  /** Called by the Reset control, e.g. to clear focus in the parent. */
  onReset?: () => void;
}

export function FlatMap({
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
  showCoordinates,
  focusState,
  showCounties,
  onReset,
}: FlatMapProps) {
  const theme = MAP_THEME[tone];
  const [containerRef, { width, height }] = useElementSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [t, setT] = useState<ZoomTransform>(zoomIdentity);
  const [hover, setHover] = useState<Hover | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [coords, setCoords] = useState<[number, number] | null>(null);

  const us = useUsStates();
  const counties = useCounties(
    showCounties && focusState ? (FIPS_BY_CODE[focusState] ?? null) : null,
  );

  const projection = useMemo(() => {
    if (!us || width === 0 || height === 0) return null;
    const pad = Math.min(24, width * 0.04);
    return geoAlbersUsa().fitExtent(
      [
        [pad, pad],
        [width - pad, height - pad],
      ],
      us.nation,
    );
  }, [us, width, height]);

  const statePaths = useMemo(() => {
    if (!us || !projection) return [];
    const path = geoPath(projection);
    return us.states
      .map((s) => ({ code: s.code, feature: s.feature, d: path(s.feature) ?? "" }))
      .filter((s) => s.d);
  }, [us, projection]);

  const countyPaths = useMemo(() => {
    if (!counties || !projection) return [];
    const path = geoPath(projection);
    return counties.map((c) => ({ ...c, d: path(c.feature) ?? "" }));
  }, [counties, projection]);

  // d3-zoom: wheel, drag-to-pan, pinch, double-click.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || width === 0 || height === 0) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, MAX_ZOOM])
      .extent([
        [0, 0],
        [width, height],
      ])
      .translateExtent([
        [0, 0],
        [width, height],
      ])
      .clickDistance(4)
      .on("zoom", (event) => setT(event.transform));
    select(svg).call(z);
    zoomRef.current = z;
    return () => {
      select(svg).on(".zoom", null);
    };
  }, [width, height]);

  // Zoom to the focused state (county level), or back out when cleared.
  useEffect(() => {
    if (focusState === undefined) return;
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (!svg || !z || !projection) return;
    const sel = select(svg);
    const target = focusState
      ? statePaths.find((s) => s.code === focusState)
      : null;
    if (!target) {
      z.transform(sel.transition().duration(650), zoomIdentity);
      return;
    }
    const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(target.feature);
    const k = Math.min(
      MAX_ZOOM,
      0.82 / Math.max((x1 - x0) / width, (y1 - y0) / height),
    );
    const next = zoomIdentity
      .translate(width / 2 - (k * (x0 + x1)) / 2, height / 2 - (k * (y0 + y1)) / 2)
      .scale(k);
    z.transform(sel.transition().duration(800), next);
  }, [focusState, projection, statePaths, width, height]);

  const clusters = useMemo<Cluster<MapMarker>[]>(() => {
    if (!markers?.length || !projection) return [];
    const margin = 40;
    const pts = [];
    for (const m of markers) {
      const p = projection([m.lon, m.lat]);
      if (!p) continue;
      const [x, y] = t.apply(p);
      if (x < -margin || y < -margin || x > width + margin || y > height + margin) continue;
      pts.push({ x, y, item: m });
    }
    return clusterPoints(pts, CLUSTER_PX, (m) => m.id);
  }, [markers, projection, t, width, height]);

  const pinPoints = useMemo(() => {
    if (!pins?.length || !projection) return [];
    return pins.flatMap((pin) => {
      const p = projection([pin.lon, pin.lat]);
      if (!p) return [];
      const [x, y] = t.apply(p);
      return [{ pin, x, y }];
    });
  }, [pins, projection, t]);

  function zoomBy(factor: number) {
    const svg = svgRef.current;
    if (svg && zoomRef.current) {
      zoomRef.current.scaleBy(select(svg).transition().duration(350), factor);
    }
  }

  function reset() {
    const svg = svgRef.current;
    if (svg && zoomRef.current) {
      zoomRef.current.transform(select(svg).transition().duration(650), zoomIdentity);
    }
    onReset?.();
  }

  function handleClusterClick(c: Cluster<MapMarker>) {
    if (c.items.length === 1) {
      onMarkerClick?.(c.items[0].id);
      return;
    }
    const svg = svgRef.current;
    if (!svg || !zoomRef.current) return;
    const [mx, my] = t.invert([c.x, c.y]);
    const k = Math.min(MAX_ZOOM, t.k * 2.5);
    zoomRef.current.transform(
      select(svg).transition().duration(600),
      zoomIdentity.translate(width / 2 - mx * k, height / 2 - my * k).scale(k),
    );
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPointer({ x, y });
    if (showCoordinates && projection) {
      const ll = projection.invert?.(t.invert([x, y]));
      setCoords(ll ? [ll[0], ll[1]] : null);
    }
  }

  const selected = statePaths.find((s) => s.code === selectedState);
  const tooltip =
    hover?.type === "state"
      ? stateTooltip?.(hover.code)
      : hover?.type === "county"
        ? (
            <span>
              <span className="font-medium">{hover.name} County</span>
              <span className="text-muted-foreground"> · {stateName(hover.state)}</span>
            </span>
          )
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
        aria-label="Map of US states. Scroll or use the controls to zoom; drag to pan."
      >
        <g transform={t.toString()}>
          {statePaths.map((s) => {
            const fill = stateFill(s.code);
            const dimmed = focusState && s.code !== focusState;
            return (
              <path
                key={s.code}
                data-state={s.code}
                d={s.d}
                fill={fill ?? theme.stateBase}
                fillOpacity={(fill ? theme.stateFillOpacity : 1) * (dimmed ? 0.45 : 1)}
                stroke={theme.stateStroke}
                strokeWidth={0.8}
                vectorEffect="non-scaling-stroke"
                className="cursor-pointer hover:brightness-150"
                onPointerEnter={() => setHover({ type: "state", code: s.code })}
                onPointerLeave={() => setHover(null)}
                onClick={() => onStateClick?.(s.code)}
              />
            );
          })}
          {focusState &&
            countyPaths.map((c) => (
              <path
                key={c.fips}
                d={c.d}
                fill="transparent"
                stroke={theme.stateStroke}
                strokeOpacity={0.7}
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
                className="hover:fill-white/5"
                onPointerEnter={() =>
                  setHover({ type: "county", name: c.name, state: focusState })
                }
                onPointerLeave={() => setHover(null)}
              />
            ))}
          {selected && (
            <path
              d={selected.d}
              fill="none"
              stroke="white"
              strokeWidth={1.6}
              vectorEffect="non-scaling-stroke"
              className="pointer-events-none"
            />
          )}
        </g>
        <PinLayer pins={pinPoints} />
        <MarkerLayer
          clusters={clusters}
          selectedId={selectedMarkerId}
          onClusterClick={handleClusterClick}
          onHover={(c) => setHover(c ? { type: "cluster", items: c.items } : null)}
        />
      </svg>

      {!us && <MapLoading />}
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
