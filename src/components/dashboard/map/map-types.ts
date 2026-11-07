import type { ReactNode } from "react";

export type MapTone = "compliance" | "citizen";
export type MapView = "globe" | "map";

export interface MapMarker {
  id: string;
  lon: number;
  lat: number;
  kind: "existing" | "proposed";
}

export interface MapPin {
  /** Stable id passed to onPinClick (defaults to label). */
  id?: string;
  label: string;
  lon: number;
  lat: number;
  /** Ring/dot color, e.g. a compliance status color (default white). */
  color?: string | null;
}

/** Props shared by the globe and the flat map. */
export interface MapLayerProps {
  tone: MapTone;
  /** CSS color for a state (USPS code), or null for the neutral base fill. */
  stateFill: (code: string) => string | null;
  selectedState: string | null;
  onStateClick?: (code: string) => void;
  stateTooltip?: (code: string) => ReactNode;
  markers?: MapMarker[];
  selectedMarkerId?: string | null;
  onMarkerClick?: (id: string) => void;
  markerTooltip?: (markers: MapMarker[]) => ReactNode;
  pins?: MapPin[];
  /** Makes city pins clickable (e.g. NYC as its own jurisdiction). */
  onPinClick?: (id: string) => void;
  selectedPinId?: string | null;
  /** Hover content for a pin. */
  pinTooltip?: (id: string) => ReactNode;
  showCoordinates?: boolean;
}
