import type { LawEvent, LawEventSourceKind, LawEventType } from "@/data/law-events";
import { LAWS_BY_ID } from "@/data/laws";
import { formatDay } from "./compliance";
import { LAW_RULES_BY_ID, type Duty, type LawMatch } from "./matching";
import { daysUntil } from "./use-now";

/**
 * Law change alerts and upcoming deadlines: plain code, no AI.
 *
 * Facts come from src/data/law-events.ts. Everything said about the user's
 * product comes from the templates in this file, filled in from the match
 * result, so no panel line can be hand-written or invented.
 */

export const EVENT_TYPE_LABEL: Record<LawEventType, string> = {
  signed: "Signed",
  effective: "Effective",
  delayed: "Delayed",
  stayed: "Stayed",
  challenged: "Challenged",
  "court-date": "Court date",
  "repealed-replaced": "Repealed / replaced",
  rulemaking: "Rulemaking",
  registration: "Registration",
  enforcement: "Enforcement",
};

const isMonthOnly = (date: string) => date.length === 7;

/** Day dates count from today on. A month-only date counts until its month ends. */
export function isUpcoming(date: string, todayIso: string): boolean {
  return isMonthOnly(date) ? date >= todayIso.slice(0, 7) : date >= todayIso;
}

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** "2026-11-18" -> "Nov 18, 2026"; "2026-11" -> "Nov 2026". */
function formatEventDate(date: string): string {
  return isMonthOnly(date) ? MONTH_FMT.format(new Date(`${date}-01T00:00:00Z`)) : formatDay(date);
}

const dutyWord = (n: number) => (n === 1 ? "duty" : "duties");

const applyingLaws = (matches: LawMatch[]) => new Map(matches.filter((m) => m.applies).map((m) => [m.law.id, m]));

const openCount = (duties: Duty[], checked: ReadonlySet<string>) => duties.filter((d) => !checked.has(d.id)).length;

/** The only source of "how this affects you" text. */
export function impactLine(match: LawMatch, checked: ReadonlySet<string>): string {
  const total = match.applicable.length;
  const review = match.needsReview.length;
  if (total === 0) {
    return review > 0
      ? `${review} ${dutyWord(review)} under this law need review`
      : "No duties listed for your role under this law";
  }
  const suffix = review > 0 ? ` · ${review} need review` : "";
  const open = openCount(match.applicable, checked);
  return open > 0
    ? `You have ${open} open ${dutyWord(open)} under this law${suffix}`
    : `All duties under this law are confirmed (${total})${suffix}`;
}

/* ------------------------------------------------------------------ */
/* Alerts                                                              */
/* ------------------------------------------------------------------ */

export type AlertScope = "All tracked laws" | "Affecting your product";

export interface AlertRow {
  id: string;
  dateLabel: string;
  upcoming: boolean;
  typeLabel: string;
  description: string;
  /** Map key: state code or "NYC". */
  jurisdictionKey: string;
  sourceUrl: string;
  sourceKind: LawEventSourceKind;
  /** Computed from the match result; null before matching. */
  impact: string | null;
}

export interface AlertsView {
  scope: AlertScope;
  rows: AlertRow[];
}

/**
 * Before matching (matches = null): every event. After matching: only events
 * for laws that apply. Newest first. No upcoming tags until the clock is known.
 */
export function buildAlerts(
  events: LawEvent[],
  matches: LawMatch[] | null,
  checked: ReadonlySet<string>,
  todayIso: string | null,
): AlertsView {
  const applying = matches ? applyingLaws(matches) : null;
  const rows = events
    .filter((e) => !applying || applying.has(e.lawId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => {
      const match = applying?.get(e.lawId);
      return {
        id: e.id,
        dateLabel: e.dateLabel ?? formatEventDate(e.date),
        upcoming: todayIso !== null && isUpcoming(e.date, todayIso),
        typeLabel: EVENT_TYPE_LABEL[e.type],
        description: e.description,
        jurisdictionKey: LAW_RULES_BY_ID[e.lawId].jurisdictionKey,
        sourceUrl: e.sourceUrl,
        sourceKind: e.sourceKind,
        impact: match ? impactLine(match, checked) : null,
      };
    });
  return { scope: applying ? "Affecting your product" : "All tracked laws", rows };
}

/* ------------------------------------------------------------------ */
/* Deadlines                                                           */
/* ------------------------------------------------------------------ */

export type DeadlineTag = "Applies to you" | "FYI";

export interface DeadlineRow {
  id: string;
  /** Sort key: "YYYY-MM-DD" or "YYYY-MM". */
  date: string;
  dateLabel: string;
  /** "in N days", "today", or "day not stated" for a month-only date. */
  countdown: string;
  /** Whole days left; null for a month-only date. */
  daysLeft: number | null;
  title: string;
  lawName: string;
  /** Null before matching, when nothing is known about the company. */
  tag: DeadlineTag | null;
  sourceUrl: string | null;
  sourceKind: LawEventSourceKind | null;
}

function countdown(date: string, todayIso: string): Pick<DeadlineRow, "countdown" | "daysLeft"> {
  if (isMonthOnly(date)) return { countdown: "day not stated", daysLeft: null };
  const daysLeft = daysUntil(date, Date.parse(`${todayIso}T00:00:00Z`));
  const label = daysLeft === 0 ? "today" : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
  return { countdown: label, daysLeft };
}

function eventRow(e: LawEvent, todayIso: string, tag: DeadlineTag | null): DeadlineRow {
  return {
    id: e.id,
    date: e.date,
    dateLabel: e.dateLabel ?? formatEventDate(e.date),
    ...countdown(e.date, todayIso),
    title: e.description,
    lawName: LAWS_BY_ID[e.lawId].name,
    tag,
    sourceUrl: e.sourceUrl,
    sourceKind: e.sourceKind,
  };
}

/** One row per future effective date of a law's applicable duties. */
function dutyRows(m: LawMatch, events: LawEvent[], checked: ReadonlySet<string>, todayIso: string): DeadlineRow[] {
  const byDate = new Map<string, Duty[]>();
  for (const d of m.applicable) {
    if (d.effectiveDate >= todayIso) byDate.set(d.effectiveDate, [...(byDate.get(d.effectiveDate) ?? []), d]);
  }
  return [...byDate].map(([date, duties]) => {
    const open = openCount(duties, checked);
    const verb = duties.length === 1 ? "takes" : "take";
    const event = events.find((e) => e.lawId === m.law.id && e.type === "effective" && e.date === date);
    return {
      id: `duties-${m.law.id}-${date}`,
      date,
      dateLabel: formatDay(date),
      ...countdown(date, todayIso),
      title: `${duties.length} ${dutyWord(duties.length)} ${verb} effect, ${open > 0 ? `${open} open` : "all confirmed"}`,
      lawName: m.law.name,
      tag: "Applies to you" as const,
      sourceUrl: event?.sourceUrl ?? null,
      sourceKind: event?.sourceKind ?? null,
    };
  });
}

/**
 * Before matching: upcoming events across all tracked laws. After matching:
 * future duty dates plus upcoming events (FYI) for laws that apply. An
 * "effective" event is dropped when a duty row already covers that law and date.
 */
export function buildDeadlines(
  events: LawEvent[],
  matches: LawMatch[] | null,
  checked: ReadonlySet<string>,
  todayIso: string,
): DeadlineRow[] {
  const upcoming = events.filter((e) => isUpcoming(e.date, todayIso));
  let rows: DeadlineRow[];
  if (!matches) {
    rows = upcoming.map((e) => eventRow(e, todayIso, null));
  } else {
    const applying = applyingLaws(matches);
    const duties = [...applying.values()].flatMap((m) => dutyRows(m, events, checked, todayIso));
    const covered = new Set(duties.map((r) => r.id));
    const fyi = upcoming
      .filter((e) => applying.has(e.lawId))
      .filter((e) => !(e.type === "effective" && covered.has(`duties-${e.lawId}-${e.date}`)))
      .map((e) => eventRow(e, todayIso, "FYI"));
    rows = [...duties, ...fyi];
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}
