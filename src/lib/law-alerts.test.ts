import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { LAW_EVENTS } from "@/data/law-events";
import { lawsVerified } from "@/data/law-library";
import { LAWS, LAWS_BY_ID } from "@/data/laws";
import sources from "../../data/laws/sources.json";
import { DEFAULT_FILTERS, enforcementNote, lawPassesFilters, TAG_LABEL } from "./compliance";
import { buildAlerts, buildDeadlines, impactLine, isUpcoming } from "./law-alerts";
import { LAW_RULES, LAW_RULES_BY_ID, matchCompany, matchLaw, statusLabelFor } from "./matching";
import { fillCompanyName } from "./notice";
import { cleanCompanyName, ConfirmedProfile, readCompanyName } from "./product-profile";
import { normalizeForMatch, verifyQuote } from "./quote-verify";

const TODAY = "2026-11-08";
const NONE = new Set<string>();

const EXAMPLE: ConfirmedProfile = {
  role: "both",
  features: ["resume_screening", "automated_employment_decision", "uses_location_or_zip"],
  jurisdictions: ["NYC", "IL", "CO", "TX"],
  isGovernment: false,
};
const CA_COMPANION: ConfirmedProfile = {
  role: "both",
  features: ["companion_chatbot", "chatbot_used_by_minors", "generative_ai_public"],
  jurisdictions: ["CA"],
  isGovernment: false,
};
const CA_CONSUMER_ONLY: ConfirmedProfile = {
  role: "deployer",
  features: ["consumer_chatbot"],
  jurisdictions: ["CA"],
  isGovernment: false,
};
const PROFILES = [EXAMPLE, CA_COMPANION, CA_CONSUMER_ONLY];

const read = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), "utf8");
const PRD = read("docs", "prd.txt");
const PRD_SECTION_3 = PRD.slice(PRD.indexOf("3. THE PROBLEM AND EVIDENCE"), PRD.indexOf("4. PERSONAS"));

const lawIds = (rows: { id: string }[]) =>
  [...new Set(rows.map((r) => LAW_EVENTS.find((e) => e.id === r.id)?.lawId))].sort();

describe("law events: every one has a real source", () => {
  it("found the PRD's section 3", () => {
    assert.ok(PRD_SECTION_3.length > 1000);
  });
  for (const e of LAW_EVENTS) {
    it(`${e.id}: evidence and URL check out`, () => {
      assert.ok(LAW_RULES_BY_ID[e.lawId], "unknown law");
      assert.match(e.date, /^\d{4}-\d{2}(-\d{2})?$/);
      assert.ok(!Number.isNaN(Date.parse(e.date.length === 7 ? `${e.date}-01` : e.date)), "not a real date");
      const text = e.sourceKind === "Official law text" ? read("data", "laws", `${e.lawId}.txt`) : PRD_SECTION_3;
      const check = verifyQuote(e.evidence, normalizeForMatch(text));
      assert.ok(check.verified, check.reason);
      if (e.sourceKind === "Official law text") {
        assert.equal(e.sourceUrl, sources.find((s) => s.id === e.lawId)?.url);
      } else {
        assert.ok(PRD_SECTION_3.includes(e.sourceUrl), "URL is not cited in PRD section 3");
      }
    });
  }
  it("ids are unique", () => {
    assert.equal(new Set(LAW_EVENTS.map((e) => e.id)).size, LAW_EVENTS.length);
  });
  it("RAISE's effective date is in the official text; its registration date is not", () => {
    const effective = LAW_EVENTS.find((e) => e.id === "ny-raise-effective");
    assert.equal(effective?.sourceKind, "Official law text");
    assert.equal(effective?.date, LAW_RULES_BY_ID["ny-raise"].effectiveDate);

    const registration = LAW_EVENTS.find((e) => e.id === "ny-raise-registration");
    assert.equal(registration?.sourceKind, "PRD section 3");
    assert.match(registration?.description ?? "", /not in the official text/);
    // The text mentions "the time of registration" (§ 1428) but gives no such date.
    assert.doesNotMatch(read("data", "laws", "ny-raise.txt"), /\bNov(ember|\.)?\b/i);
  });
  it("every effective date in the law table has an event, so the panels can't disagree", () => {
    for (const rule of LAW_RULES) {
      const overrides = Object.values(rule.dutyOverrides ?? {}).flatMap((o) => o.effectiveDate ?? []);
      for (const date of [rule.effectiveDate, ...overrides]) {
        assert.ok(
          LAW_EVENTS.some((e) => e.lawId === rule.lawId && e.date === date && e.type === "effective"),
          `${rule.lawId} ${date}`,
        );
      }
    }
  });
});

describe("PRD section 3 matches the official text on enforcement facts", () => {
  const flat = PRD_SECTION_3.replace(/\s+/g, " ");

  it("has the change log line", () => {
    assert.ok(PRD.includes("- 8 Nov 2026: enforcement, penalty and cure facts corrected against official law text."));
  });
  it("no longer has the four old claims", () => {
    assert.doesNotMatch(flat, /up to \$1,500 per violation per day/);
    assert.doesNotMatch(flat, /\[UNCHECKED\] penalties/);
    assert.doesNotMatch(flat, /exclusive enforcement, must give/);
    assert.doesNotMatch(flat, /attorney general only, with a 60-day cure period/);
  });
  it("cites the section for each correction", () => {
    assert.match(flat, /each missed notice is a separate violation \(Admin\. Code 20-872\)/);
    assert.match(flat, /a person it licenses \(Sec\. 552\.101\(a\), 552\.106\)/);
    assert.match(flat, /repealed Jan 1, 2030 \(C\.R\.S\. 6-1-1706\(3\)\)/);
    assert.match(flat, /large frontier developers only \(Bus\. & Prof\. Code 22757\.15\)/);
  });
  it("the sections cited exist in the law text", () => {
    assert.match(read("data", "laws", "nyc-ll144.txt"), /§ 20-872 Penalties/);
    assert.match(read("data", "laws", "tx-traiga.txt"), /Sec\. 552\.106\. ENFORCEMENT ACTIONS BY STATE AGENCIES/);
    assert.match(read("data", "laws", "co-sb26-189.txt"), /6-1-1706\. Enforcement by the attorney general/);
    assert.match(read("data", "laws", "ca-sb53.txt"), /22757\.15\./);
  });
});

describe("NYC enforcement date", () => {
  const DCWP = "https://www.nyc.gov/site/dca/about/automated-employment-decision-tools.page";

  it("the event uses the exact day and quote from the official DCWP page", () => {
    const e = LAW_EVENTS.find((x) => x.id === "nyc-enforced");
    assert.equal(e?.date, "2023-07-05");
    assert.equal(e?.sourceUrl, DCWP);
    assert.equal(e?.sourceKind, "PRD section 3");
    assert.equal(e?.evidence, "DCWP will begin enforcement of this law and rule on July 5, 2023");
    const row = buildAlerts(LAW_EVENTS, null, NONE, TODAY).rows.find((r) => r.id === "nyc-enforced");
    assert.equal(row?.dateLabel, "Jul 5, 2023");
  });
  it("the law entry agrees with the event", () => {
    const law = LAWS_BY_ID["nyc-ll144"];
    assert.equal(law.effectiveDate, "2023-07-05");
    assert.match(law.effective, /Enforced since July 5, 2023/);
    assert.ok(law.sources.some((s) => s.url === DCWP));
  });
  it("no app text still says just July 2023", () => {
    assert.doesNotMatch(JSON.stringify(LAWS), /July 2023/);
    assert.doesNotMatch(JSON.stringify(LAW_EVENTS), /July 2023|"2023-07"/);
  });
});

describe("Colorado enforcement stay", () => {
  const co = LAWS_BY_ID["co-sb26-189"];

  it("is the only paused law, and stays Coming soon", () => {
    assert.deepEqual(co.tags, ["coming-soon", "enforcement-paused"]);
    assert.equal(TAG_LABEL["enforcement-paused"], "Enforcement paused (court order)");
    assert.deepEqual(LAWS.filter((l) => l.tags.includes("enforcement-paused")).map((l) => l.id), ["co-sb26-189"]);
  });
  it("has a stayed event saying the stay covers SB 26-189, from the new PRD text", () => {
    const e = LAW_EVENTS.find((x) => x.id === "co-sb26-189-stay-covers");
    assert.equal(e?.type, "stayed");
    assert.equal(e?.lawId, "co-sb26-189");
    assert.equal(e?.sourceKind, "PRD section 3");
    assert.match(e?.description ?? "", /SB 26-189 is also paused/);
    assert.match(e?.evidence ?? "", /stay's terms cover legislation replacing SB 24-205/);
  });
  it("the law's note is word for word from the PRD", () => {
    const note = co.notes.find((n) => n.startsWith("Enforcement of SB 26-189"));
    assert.ok(note);
    const check = verifyQuote(note, normalizeForMatch(PRD_SECTION_3));
    assert.ok(check.verified, check.reason);
  });
  it("keeps the effective date, the duties and the amber label, and adds the note", () => {
    const match = matchLaw(LAW_RULES_BY_ID["co-sb26-189"], EXAMPLE);
    assert.equal(LAW_RULES_BY_ID["co-sb26-189"].effectiveDate, "2027-01-01");
    assert.ok(match.applies);
    assert.ok(match.applicable.length > 0);
    assert.ok(match.applicable.every((d) => d.effectiveDate === "2027-01-01"));
    assert.equal(statusLabelFor([match], NONE, TODAY), "Action needed by Jan 1, 2027");
    assert.equal(enforcementNote(co), "Enforcement currently paused by a court order");
  });
  it("no other law gets the note", () => {
    for (const law of LAWS.filter((l) => l.id !== "co-sb26-189")) assert.equal(enforcementNote(law), null);
  });
  it("the filter hides Colorado only when both of its statuses are off", () => {
    assert.equal(DEFAULT_FILTERS["enforcement-paused"], true);
    assert.equal(lawPassesFilters(co, { ...DEFAULT_FILTERS, "coming-soon": false }), true);
    assert.equal(lawPassesFilters(co, { ...DEFAULT_FILTERS, "enforcement-paused": false }), true);
    assert.equal(lawPassesFilters(co, { ...DEFAULT_FILTERS, "coming-soon": false, "enforcement-paused": false }), false);
  });
});

describe("no invented text", () => {
  const TEMPLATES = [
    /^You have \d+ open (duty|duties) under this law( · \d+ need review)?$/,
    /^All duties under this law are confirmed \(\d+\)( · \d+ need review)?$/,
    /^\d+ (duty|duties) under this law need review$/,
    /^No duties listed for your role under this law$/,
  ];
  const INVENTED = /ShortlistBot|Parrotfish|Internal target|bias auditor|\bcompliant\b|non-compliant/i;

  it("events hold only sourced fields, and never talk about the reader", () => {
    const allowed = new Set(["id", "date", "dateLabel", "lawId", "type", "description", "sourceUrl", "sourceKind", "evidence"]);
    for (const e of LAW_EVENTS) {
      for (const key of Object.keys(e)) assert.ok(allowed.has(key), `${e.id}: ${key}`);
      assert.doesNotMatch(e.description, /\b(you|your)\b/i, e.id);
      assert.doesNotMatch(e.description, INVENTED, e.id);
    }
  });
  it("every alert line matches a code template, for every profile and checkbox state", () => {
    for (const profile of PROFILES) {
      const matches = matchCompany(profile);
      const allDone = new Set(matches.flatMap((m) => m.applicable.map((d) => d.id)));
      for (const checked of [NONE, allDone]) {
        for (const row of buildAlerts(LAW_EVENTS, matches, checked, TODAY).rows) {
          assert.ok(row.impact, row.id);
          assert.ok(TEMPLATES.some((t) => t.test(row.impact!)), row.impact!);
        }
      }
    }
  });
  it("the template picks the right wording for each case", () => {
    const m = matchLaw(LAW_RULES_BY_ID["tx-traiga"], EXAMPLE);
    const review = ` · ${m.needsReview.length} need review`;
    assert.equal(impactLine(m, NONE), `You have ${m.applicable.length} open duties under this law${review}`);
    const allDone = new Set(m.applicable.map((d) => d.id));
    assert.equal(impactLine(m, allDone), `All duties under this law are confirmed (${m.applicable.length})${review}`);
    const noDuties = { ...m, applicable: [], needsReview: m.needsReview.slice(0, 1) };
    assert.equal(impactLine(noDuties, NONE), "1 duty under this law need review");
    assert.equal(impactLine({ ...noDuties, needsReview: [] }, NONE), "No duties listed for your role under this law");
  });
  it("counts equal the match result and follow the checkboxes", () => {
    const m = matchLaw(LAW_RULES_BY_ID["nyc-ll144"], EXAMPLE);
    const total = m.applicable.length;
    assert.ok(total > 1);
    assert.match(impactLine(m, NONE), new RegExp(`^You have ${total} open duties`));
    assert.match(impactLine(m, new Set([m.applicable[0].id])), new RegExp(`^You have ${total - 1} open dut`));
  });
  it("no panel text carries invented names or status words", () => {
    for (const profile of [...PROFILES, null]) {
      const matches = profile ? matchCompany(profile) : null;
      const texts = [
        ...buildAlerts(LAW_EVENTS, matches, NONE, TODAY).rows.flatMap((r) => [r.description, r.impact ?? ""]),
        ...buildDeadlines(LAW_EVENTS, matches, NONE, TODAY).map((r) => r.title),
      ];
      for (const t of texts) assert.doesNotMatch(t, INVENTED, t);
    }
  });
});

describe("law change alerts", () => {
  it("before matching: all events, newest first, labelled, with no impact line", () => {
    const view = buildAlerts(LAW_EVENTS, null, NONE, TODAY);
    assert.equal(view.scope, "All tracked laws");
    assert.equal(view.rows.length, LAW_EVENTS.length);
    assert.ok(view.rows.every((r) => r.impact === null));
    const dates = view.rows.map((r) => LAW_EVENTS.find((e) => e.id === r.id)!.date);
    assert.deepEqual(dates, [...dates].sort().reverse());
  });
  it("doesn't change the shared event list", () => {
    const before = LAW_EVENTS.map((e) => e.id);
    buildAlerts(LAW_EVENTS, null, NONE, TODAY);
    assert.deepEqual(LAW_EVENTS.map((e) => e.id), before);
  });
  it("after matching the example: only its four applying laws", () => {
    const view = buildAlerts(LAW_EVENTS, matchCompany(EXAMPLE), NONE, TODAY);
    assert.equal(view.scope, "Affecting your product");
    assert.deepEqual(lawIds(view.rows), ["co-sb26-189", "il-hb3773", "nyc-ll144", "tx-traiga"]);
  });
  it("a California companion chatbot gets only the California laws that apply", () => {
    const view = buildAlerts(LAW_EVENTS, matchCompany(CA_COMPANION), NONE, TODAY);
    assert.deepEqual(lawIds(view.rows), ["ca-ab2013", "ca-sb243"]);
  });
  it("a customer-service chatbot in California matches no law, so shows no alerts", () => {
    assert.deepEqual(buildAlerts(LAW_EVENTS, matchCompany(CA_CONSUMER_ONLY), NONE, TODAY).rows, []);
  });
  it("uses the map's jurisdiction key, so NYC's law opens NYC", () => {
    const rows = buildAlerts(LAW_EVENTS, null, NONE, TODAY).rows;
    assert.equal(rows.find((r) => r.id === "nyc-effective")?.jurisdictionKey, "NYC");
    assert.equal(rows.find((r) => r.id === "ny-raise-signed")?.jurisdictionKey, "NY");
  });
  it("marks upcoming rows only once the clock is known", () => {
    const row = (today: string | null) =>
      buildAlerts(LAW_EVENTS, null, NONE, today).rows.find((r) => r.id === "ca-ab2013-argument");
    assert.equal(row(TODAY)?.upcoming, true);
    assert.equal(row("2026-11-19")?.upcoming, false);
    assert.equal(row(null)?.upcoming, false);
  });
  it("shows dates only as exactly as the source gives them", () => {
    const label = (id: string) => buildAlerts(LAW_EVENTS, null, NONE, TODAY).rows.find((r) => r.id === id)?.dateLabel;
    assert.equal(label("ca-ab2013-argument"), "Nov 18, 2026");
    assert.equal(label("ny-raise-registration"), "Nov 2026");
    assert.equal(label("il-rules-delayed"), "Mid-2026");
    assert.equal(label("co-final-rules-due"), "By Jan 1, 2027");
  });
});

describe("isUpcoming", () => {
  it("counts a day date through that day", () => {
    assert.equal(isUpcoming("2026-11-08", TODAY), true);
    assert.equal(isUpcoming("2026-11-07", TODAY), false);
  });
  it("counts a month-only date through the end of that month", () => {
    assert.equal(isUpcoming("2026-11", "2026-11-30"), true);
    assert.equal(isUpcoming("2026-11", "2026-12-01"), false);
  });
});

describe("upcoming deadlines", () => {
  it("before matching: only future events, soonest first, with no 'applies to you'", () => {
    const rows = buildDeadlines(LAW_EVENTS, null, NONE, TODAY);
    assert.deepEqual(rows.map((r) => r.id), [
      "ny-raise-registration",
      "ca-ab2013-argument",
      "co-final-rules-due",
      "co-effective",
      "ny-raise-effective",
      "ca-sb243-reporting",
    ]);
    assert.ok(rows.every((r) => r.tag === null));
  });
  it("computes the countdown from today", () => {
    const rows = buildDeadlines(LAW_EVENTS, null, NONE, TODAY);
    const find = (id: string) => rows.find((r) => r.id === id)!;
    assert.equal(find("ca-ab2013-argument").countdown, "in 10 days");
    assert.equal(find("co-effective").countdown, "in 54 days");
    assert.equal(find("ny-raise-registration").countdown, "day not stated");
    assert.equal(find("ny-raise-registration").daysLeft, null);
    const onTheDay = buildDeadlines(LAW_EVENTS, null, NONE, "2026-11-18");
    assert.equal(onTheDay.find((r) => r.id === "ca-ab2013-argument")?.countdown, "today");
    const dayBefore = buildDeadlines(LAW_EVENTS, null, NONE, "2026-11-17");
    assert.equal(dayBefore.find((r) => r.id === "ca-ab2013-argument")?.countdown, "in 1 day");
  });
  it("example company: Colorado duties plus the rules deadline as FYI, without a duplicate", () => {
    const matches = matchCompany(EXAMPLE);
    const rows = buildDeadlines(LAW_EVENTS, matches, NONE, TODAY);
    const co = matches.find((m) => m.law.id === "co-sb26-189")!;
    const n = co.applicable.length;
    assert.deepEqual(
      rows.map((r) => [r.title, r.tag]),
      [
        [`${n} duties take effect, ${n} open`, "Applies to you"],
        ["Colorado Attorney General must adopt rules under SB 26-189 by this date.", "FYI"],
      ].sort((a, b) => (a[1] === "FYI" ? 1 : b[1] === "FYI" ? -1 : 0)),
    );
    assert.equal(rows[0].lawName, "Colorado SB 26-189");
    assert.ok(rows[0].sourceUrl?.includes("leg.colorado.gov"));
    assert.equal(rows[0].sourceKind, "Official law text");
  });
  it("follows the checkboxes", () => {
    const matches = matchCompany(EXAMPLE);
    const co = matches.find((m) => m.law.id === "co-sb26-189")!;
    const n = co.applicable.length;
    const one = buildDeadlines(LAW_EVENTS, matches, new Set([co.applicable[0].id]), TODAY);
    assert.equal(one[0].title, `${n} duties take effect, ${n - 1} open`);
    const all = buildDeadlines(LAW_EVENTS, matches, new Set(co.applicable.map((d) => d.id)), TODAY);
    assert.equal(all[0].title, `${n} duties take effect, all confirmed`);
  });
  it("California companion chatbot: the court date is FYI, the reporting duty applies", () => {
    const rows = buildDeadlines(LAW_EVENTS, matchCompany(CA_COMPANION), NONE, TODAY);
    assert.deepEqual(
      rows.map((r) => [r.date, r.tag]),
      [
        ["2026-11-18", "FYI"],
        ["2027-07-01", "Applies to you"],
      ],
    );
    assert.equal(rows[0].title, "Ninth Circuit argument in xAI's challenge to California AB 2013.");
    assert.equal(rows[1].title, "1 duty takes effect, 1 open");
    assert.equal(rows[1].lawName, "California SB 243");
  });
  it("shows nothing when no law applies or nothing is upcoming", () => {
    assert.deepEqual(buildDeadlines(LAW_EVENTS, matchCompany(CA_CONSUMER_ONLY), NONE, TODAY), []);
    assert.deepEqual(buildDeadlines(LAW_EVENTS, null, NONE, "2028-01-01"), []);
  });
});

describe("laws verified label", () => {
  it("reads the date from the data and counts what wasn't fetched", () => {
    assert.deepEqual(lawsVerified(), { date: "2026-11-07", fetched: 7, total: 8, notFetched: ["Illinois HB 3773"] });
  });
});

describe("company name", () => {
  const text = "Acme Hiring LLC builds a resume screener used in Texas.";

  it("keeps a name found in the user's text", () => {
    assert.deepEqual(readCompanyName({ company_name: "Acme Hiring LLC", company_name_quote: "Acme Hiring LLC" }, text), {
      name: "Acme Hiring LLC",
      quote: "Acme Hiring LLC",
      rejected: false,
    });
  });
  it("drops a name the reader made up and says so", () => {
    assert.deepEqual(readCompanyName({ company_name: "Globex Corp", company_name_quote: "Acme Hiring LLC" }, text), {
      name: null,
      quote: "",
      rejected: true,
    });
  });
  it("is empty, not rejected, when the text states no name", () => {
    assert.deepEqual(readCompanyName({ company_name: null, company_name_quote: "" }, text), {
      name: null,
      quote: "",
      rejected: false,
    });
  });
  it("cleans typed names to fit the schema", () => {
    assert.equal(cleanCompanyName("   "), null);
    assert.equal(cleanCompanyName(" Acme [Q1]\nLLC "), "Acme Q1 LLC");
    assert.equal(cleanCompanyName("x".repeat(500))?.length, 120);
  });
  it("the schema rejects names that could forge a citation", () => {
    const parse = (companyName: unknown) => ConfirmedProfile.safeParse({ ...EXAMPLE, companyName }).success;
    assert.equal(parse("Acme LLC"), true);
    assert.equal(parse(null), true);
    assert.equal(parse(undefined), true);
    assert.equal(parse("Acme [Q1]"), false);
    assert.equal(parse("Acme\nLLC"), false);
    assert.equal(parse(""), false);
    assert.equal(parse("x".repeat(121)), false);
  });
  it("fills the placeholder in a draft", () => {
    assert.equal(fillCompanyName("From [Company name] and [company NAME].", "Acme"), "From Acme and Acme.");
  });
  it("leaves the placeholder when there is no name", () => {
    assert.equal(fillCompanyName("From [Company name].", null), "From [Company name].");
    assert.equal(fillCompanyName("From [Company name].", undefined), "From [Company name].");
  });
  it("treats a $ in a name literally", () => {
    assert.equal(fillCompanyName("[Company name]", "Cash $& Co"), "Cash $& Co");
  });
});
