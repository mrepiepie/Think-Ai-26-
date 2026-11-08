"use client";

import { useSyncExternalStore } from "react";
import type { WatchResult, WatchStatusPayload } from "./watch-types";

/**
 * Legislature Watch state shared by the header, checklist and alerts. Loads
 * past results once from the log. Checks only ever run from runWatchCheck, on
 * a button click, never in the background.
 */

export interface WatchState {
  status: WatchStatusPayload | null;
  /** Law ids being checked right now. */
  pending: ReadonlySet<string>;
  /** Law id -> why the check itself couldn't run. */
  errors: Readonly<Record<string, string>>;
}

const EMPTY: WatchState = { status: null, pending: new Set(), errors: {} };

let state = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function setState(next: Partial<WatchState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

async function load() {
  try {
    const res = await fetch("/api/watch/status");
    if (res.ok) setState({ status: (await res.json()) as WatchStatusPayload });
  } catch {
    // No log to show. The header simply stays without "Last checked".
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!loaded) {
    loaded = true;
    void load();
  }
  return () => {
    listeners.delete(cb);
  };
}

export function useWatch(): WatchState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  );
}

const LOCAL_ONLY_MESSAGE = "Source checks only run on the local app, not on this deployment.";

export async function runWatchCheck(lawId: string) {
  if (state.pending.has(lawId)) return;
  const errors = Object.fromEntries(Object.entries(state.errors).filter(([id]) => id !== lawId));
  setState({ pending: new Set([...state.pending, lawId]), errors });
  let error: string | null = null;
  let status = state.status;
  try {
    const res = await fetch("/api/watch/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ law_id: lawId }),
    });
    const body = (await res.json().catch(() => null)) as
      | { result: WatchResult; status: WatchStatusPayload }
      | { error: string }
      | null;
    if (res.status === 403) error = LOCAL_ONLY_MESSAGE;
    else if (!res.ok || !body || "error" in body) error = body && "error" in body ? body.error : `The check failed (HTTP ${res.status}).`;
    else status = body.status;
  } catch {
    error = "Couldn't reach the server. Check your connection and try again.";
  }
  const pending = new Set(state.pending);
  pending.delete(lawId);
  setState({ status, pending, errors: error ? { ...state.errors, [lawId]: error } : state.errors });
}
