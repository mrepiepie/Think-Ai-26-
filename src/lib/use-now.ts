"use client";

import { useSyncExternalStore } from "react";

/**
 * Current time, ticking once a second. Returns null on the server and
 * during the first client render, so prerendering never reads the clock
 * (required with cacheComponents) and hydration stays consistent.
 */
let now: number | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function tick() {
  now = Date.now();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    timer = setInterval(tick, 1000);
    queueMicrotask(tick);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => null,
  );
}

const DAY = 86_400_000;

/** Whole days from `now` until an ISO date (UTC midnight). */
export function daysUntil(iso: string, nowMs: number): number {
  const target = Date.parse(iso + "T00:00:00Z");
  const today = Math.floor(nowMs / DAY) * DAY;
  return Math.round((target - today) / DAY);
}
