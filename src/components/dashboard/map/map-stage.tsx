"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Backdrop for a map: faint grid lines and slots for floating overlays
 * (top-left status, bottom-left legend).
 */
export function MapStage({
  children,
  topLeft,
  bottomLeft,
  tinted = false,
  className,
}: {
  children: ReactNode;
  topLeft?: ReactNode;
  bottomLeft?: ReactNode;
  tinted?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative h-full min-h-[340px] w-full",
        tinted ? "bg-[oklch(0.1_0.02_220)]" : "bg-[oklch(0.1_0.008_275)]",
        className,
      )}
      style={{
        backgroundImage:
          "linear-gradient(oklch(1 0 0 / 0.025) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.025) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }}
    >
      {children}
      {topLeft && (
        <div className="pointer-events-none absolute top-2.5 left-3 z-10 max-w-[70%]">
          {topLeft}
        </div>
      )}
      {bottomLeft && (
        <div className="absolute bottom-2.5 left-3 z-10 max-w-[60%]">{bottomLeft}</div>
      )}
    </div>
  );
}

/** Compact legend row used inside map overlays. */
export function LegendItem({
  color,
  label,
  shape = "dot",
}: {
  color: string;
  label: string;
  shape?: "dot" | "square";
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cn("inline-block size-2.5 shrink-0", shape === "dot" ? "rounded-full" : "rounded-[2px]")}
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
        aria-hidden
      />
      {label}
    </span>
  );
}

export function LegendBox({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 rounded-md border border-border bg-background/80 px-2.5 py-1.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase backdrop-blur-sm">
      {children}
    </div>
  );
}
