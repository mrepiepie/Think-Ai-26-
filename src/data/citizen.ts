import type { GridFact, Headline, OfficialStatement } from "./types";

/**
 * SAMPLE DATA. Placeholder headlines for the ticker. These are not real
 * news reports and are not attributed to any real outlet.
 */
export const SAMPLE_HEADLINES: Headline[] = [
  { id: "h1", source: "Sample feed", text: "Placeholder: county board schedules public hearing on proposed data center" },
  { id: "h2", source: "Sample feed", text: "Placeholder: utility files new rate request citing large-load growth" },
  { id: "h3", source: "Sample feed", text: "Placeholder: residents ask for water-use study before rezoning vote" },
  { id: "h4", source: "Sample feed", text: "Placeholder: state committee reviews data center tax incentive" },
  { id: "h5", source: "Sample feed", text: "Placeholder: proposed campus withdraws application after zoning dispute" },
  { id: "h6", source: "Sample feed", text: "Placeholder: grid operator updates long-term demand forecast" },
  { id: "h7", source: "Sample feed", text: "Placeholder: town council approves noise limits for server facilities" },
  { id: "h8", source: "Sample feed", text: "Placeholder: new existing-site expansion announced, hearing date pending" },
];

/**
 * SAMPLE DATA. Placeholder statements from generic roles (no real,
 * named officials). Balanced across positions on purpose.
 */
export const SAMPLE_STATEMENTS: OfficialStatement[] = [
  {
    id: "s1",
    role: "County commissioner (placeholder)",
    stance: "supports",
    statement:
      "Sample statement: the project would add to the local tax base and fund schools.",
  },
  {
    id: "s2",
    role: "State legislator (placeholder)",
    stance: "opposes",
    statement:
      "Sample statement: households should not pay for grid upgrades that serve large users.",
  },
  {
    id: "s3",
    role: "Utility regulator (placeholder)",
    stance: "mixed",
    statement:
      "Sample statement: we are reviewing how large-load costs are shared between customer classes.",
  },
  {
    id: "s4",
    role: "Residents' group (placeholder)",
    stance: "opposes",
    statement:
      "Sample statement: we want water and noise studies published before any vote.",
  },
  {
    id: "s5",
    role: "Economic development office (placeholder)",
    stance: "supports",
    statement:
      "Sample statement: construction jobs and long-term technician roles are expected.",
  },
];

/**
 * VERIFIED CONTEXT from docs/prd.txt section F10 (PJM grid, 13 states
 * plus DC). Shown as regional context, not tied to a specific marker.
 */
export const PJM_FACTS: GridFact[] = [
  {
    text: "Data centers are over 90% of PJM's forecast new power demand (long-term forecast: about 94%).",
    source: {
      label: "Reuters via TradingView",
      url: "https://tr.tradingview.com/news/reuters.com,2025:newsml_L1N3TP0R8:0-power-costs-soar-in-pjm-region-as-data-center-demand-spikes/",
    },
  },
  {
    text: "Capacity auction price rose from $28.92 to $329.17/MW-day in two years; the 2027/28 auction cleared at $333.44.",
    source: {
      label: "IEEFA",
      url: "https://ieefa.org/resources/projected-data-center-growth-spurs-pjm-capacity-prices-factor-10",
    },
  },
  {
    text: "The independent market monitor attributed 63% of the 2025/26 price jump to data centers.",
    source: {
      label: "IEEFA",
      url: "https://ieefa.org/resources/projected-data-center-growth-spurs-pjm-capacity-prices-factor-10",
    },
  },
  {
    text: "ICF projects home rates could rise 30–60% by 2030.",
    source: {
      label: "Introl",
      url: "https://introl.com/ar/blog/pjm-rate-shock-100-billion-data-center-electricity-2026",
    },
  },
];
