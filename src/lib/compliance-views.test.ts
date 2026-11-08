import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ruleCard } from "@/data/law-library";
import {
  analyzeProductView,
  checkProductView,
  listLawsView,
  ruleCardView,
  searchLaws,
  withDisclaimer,
} from "./compliance-views";
import type { ConfirmedProfile } from "./product-profile";

const TODAY = "2026-11-08";
const EXAMPLE: ConfirmedProfile = {
  role: "both",
  features: ["resume_screening", "automated_employment_decision", "uses_location_or_zip"],
  jurisdictions: ["NYC", "IL", "CO", "TX"],
  isGovernment: false,
};

describe("withDisclaimer", () => {
  it("ends every response the same way", () => {
    assert.ok(withDisclaimer("x").endsWith("Not legal advice."));
  });
});

describe("listLawsView", () => {
  it("lists all 8 laws: RAISE dated from the official text, SB 53 from the PRD", () => {
    const { count, laws } = listLawsView({});
    assert.equal(count, 8);
    const raise = laws.find((l) => l.id === "ny-raise");
    assert.equal(raise?.extracted, true);
    assert.equal(raise?.effective_date, "2027-01-01");
    assert.equal(raise?.effective_date_source, "Official law text");
    assert.equal(laws.find((l) => l.id === "ca-sb53")?.effective_date_source, "From PRD summary");
    assert.equal(laws.find((l) => l.id === "tx-traiga")?.effective_date_source, "Official law text");
    assert.equal(laws.find((l) => l.id === "il-hb3773")?.extracted, false);
  });
  it("NYC is the city only; NY includes the city's law", () => {
    assert.deepEqual(listLawsView({ state: "NYC" }).laws.map((l) => l.id), ["nyc-ll144"]);
    assert.deepEqual(listLawsView({ state: "NY" }).laws.map((l) => l.id).sort(), ["ny-raise", "nyc-ll144"]);
  });
  it("filters by status", () => {
    assert.deepEqual(listLawsView({ status: "challenged" }).laws.map((l) => l.id), ["ca-ab2013"]);
  });
  it("shows Colorado's paused enforcement next to Coming soon, with the date unchanged", () => {
    const { laws } = listLawsView({ status: "enforcement-paused" });
    assert.deepEqual(laws.map((l) => l.id), ["co-sb26-189"]);
    assert.deepEqual(laws[0].status, ["Coming soon", "Enforcement paused (court order)"]);
    assert.equal(laws[0].effective_date, "2027-01-01");
    assert.deepEqual(listLawsView({ status: "coming-soon" }).laws.map((l) => l.id), ["co-sb26-189", "ny-raise"]);
  });
  it("gives NYC's enforcement start from the DCWP page", () => {
    assert.match(listLawsView({ state: "NYC" }).laws[0].effective, /Enforced since July 5, 2023 \(NYC DCWP\)/);
  });
});

describe("ruleCardView", () => {
  it("returns only verified items and counts the hidden ones", () => {
    const view = ruleCardView("ca-sb53");
    assert.equal(view.verified_items, 89);
    assert.equal(view.unverified_hidden, 2);
    const obligations = (view as unknown as Record<string, { id: string; quote: string; official_url: string }[]>).obligations;
    const ids = obligations.map((o) => o.id);
    assert.ok(!ids.includes("ca-sb53/obligations/11"));
    assert.ok(ids.includes("ca-sb53/obligations/12"));
    assert.ok(obligations.every((o) => o.quote && o.official_url.startsWith("https://")));
  });
  it("hides RAISE's unverified effective-date item", () => {
    const view = ruleCardView("ny-raise") as unknown as Record<string, { id: string }[]> & { unverified_hidden: number };
    assert.equal(view.unverified_hidden, 1);
    assert.ok(!view.effectiveDate.some((i) => i.id === "ny-raise/effectiveDate/0"));
  });
  it("says so when a law has no card", () => {
    const view = ruleCardView("il-hb3773");
    assert.equal(view.extracted, false);
    assert.match(view.message, /No rule card/);
  });
});

describe("searchLaws", () => {
  it("finds verified duties by keyword, across laws", () => {
    const { matches } = searchLaws({ query: "critical safety incident report" });
    assert.ok(matches.some((m) => m.law_id === "ca-sb53"));
    assert.ok(matches.some((m) => m.law_id === "ny-raise"));
  });
  it("needs every word, matches word starts, and can stay within one law", () => {
    const { matches } = searchLaws({ query: "disclos", lawId: "ny-raise" });
    assert.ok(matches.length > 0);
    assert.ok(matches.every((m) => m.law_id === "ny-raise"));
    assert.equal(searchLaws({ query: "critical zzzznothing" }).total_matches, 0);
    assert.equal(searchLaws({ query: "ritical" }).total_matches, 0);
  });
  it("never returns an unverified item", () => {
    const { matches } = searchLaws({ query: "safety", limit: 50 });
    for (const m of matches) {
      const [lawId, field, index] = m.id.split("/");
      const items = ruleCard(lawId)?.[field as "obligations"];
      assert.equal(items?.[Number(index)].verified, true, m.id);
    }
    const dates = searchLaws({ query: "take effect January" });
    assert.ok(!dates.matches.some((m) => m.id === "ny-raise/effectiveDate/0"));
  });
  it("respects the limit and shows a repeated quote once", () => {
    const { matches, total_matches } = searchLaws({ query: "frontier", limit: 3 });
    assert.equal(matches.length, 3);
    assert.ok(total_matches > 3);
    const all = searchLaws({ query: "frontier", limit: 50 }).matches;
    assert.equal(new Set(all.map((m) => `${m.law_id}|${m.quote}`)).size, all.length);
  });
});

describe("analyzeProductView", () => {
  const description = "Acme Hiring LLC builds a resume screener used in Texas.";
  const view = analyzeProductView(
    {
      company_name: "Acme Hiring LLC",
      company_name_quote: "Acme Hiring LLC",
      role: "unknown",
      role_quote: "",
      features: [{ id: "resume_screening", status: "yes", quote: "resume screener" }],
      jurisdictions: [
        { code: "TX", status: "yes", quote: "made-up words" },
        { code: "CO", status: "unknown", quote: "" },
      ],
      is_government: "no",
      notes: [],
    },
    description,
  );
  it("checks quotes against the description", () => {
    assert.equal(view.draft_profile.features[0].quote_check, "found");
    assert.equal(view.draft_profile.jurisdictions[0].quote_check, "not_found");
    assert.equal(view.draft_profile.jurisdictions[1].quote_check, "no_quote");
  });
  it("returns the company name only when it is in the description", () => {
    assert.equal(view.draft_profile.company_name.value, "Acme Hiring LLC");
    assert.equal(view.draft_profile.company_name.quote_check, "found");
    const invented = analyzeProductView(
      {
        company_name: "Globex Corp",
        company_name_quote: "Globex Corp",
        role: "developer",
        role_quote: "",
        features: [],
        jurisdictions: [],
        is_government: "no",
        notes: [],
      },
      description,
    );
    assert.equal(invented.draft_profile.company_name.value, null);
    assert.equal(invented.draft_profile.company_name.quote_check, "not_found");
  });
  it("lists unknowns and asks a human to confirm", () => {
    assert.deepEqual(view.unknown_fields, ["role", "jurisdiction:CO"]);
    assert.match(view.human_review, /human should confirm/);
  });
});

describe("checkProductView", () => {
  const view = checkProductView(EXAMPLE, TODAY);
  const jur = (key: string) => view.jurisdictions.find((j) => j.key === key);

  it("uses the honest labels and never says compliant", () => {
    assert.equal(jur("NYC")?.status, "Action needed now");
    assert.equal(jur("CO")?.status, "Action needed by Jan 1, 2027");
    assert.equal(jur("NY")?.status, "Not applicable");
    assert.doesNotMatch(JSON.stringify(view.jurisdictions.map((j) => j.status)), /compliant/i);
  });
  it("adds the paused note to Colorado's amber label, and to no other law", () => {
    const laws = view.jurisdictions.flatMap((j) => j.laws) as { law_id: string; status: string; status_note?: string }[];
    const co = laws.find((l) => l.law_id === "co-sb26-189");
    assert.equal(co?.status, "Action needed by Jan 1, 2027");
    assert.equal(co?.status_note, "Enforcement currently paused by a court order");
    assert.ok(laws.filter((l) => l.law_id !== "co-sb26-189").every((l) => l.status_note === undefined));
  });
  it("gives applicable duties with quotes, and labels PRD-only duties", () => {
    const nyc = jur("NYC")?.laws[0] as { applicable: { quote?: string }[] };
    assert.ok(nyc.applicable.length > 0 && nyc.applicable.every((d) => d.quote));
    const il = jur("IL")?.laws[0] as { applicable: { quote?: string; source?: string }[] };
    assert.ok(il.applicable.every((d) => d.quote === undefined && d.source === "From PRD summary"));
  });
  it("says why duties don't apply and which need review", () => {
    const tx = jur("TX")?.laws[0] as { doesnt_apply: { why: string }[]; needs_review: { why: string }[] };
    assert.ok(tx.doesnt_apply.length > 0 && tx.doesnt_apply.every((d) => d.why));
    assert.ok(tx.needs_review.length > 0 && tx.needs_review.every((d) => d.why));
  });
  it("gives a law-level reason for a law that doesn't apply", () => {
    const raise = jur("NY")?.laws[0] as { applies: boolean; reason: string; applicable?: unknown };
    assert.equal(raise.applies, false);
    assert.match(raise.reason, /Doesn't match your product/);
    assert.equal(raise.applicable, undefined);
  });
  it("names jurisdictions with no tracked law", () => {
    const fl = checkProductView({ ...EXAMPLE, jurisdictions: ["FL"] }, TODAY);
    assert.deepEqual(fl.jurisdictions, []);
    assert.deepEqual(fl.no_tracked_laws, ["Florida"]);
  });
});
