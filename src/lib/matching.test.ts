import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { STATUS_LABEL } from "./compliance";
import {
  LAW_RULES,
  LAW_RULES_BY_ID,
  NO_CURE_PERIOD,
  NO_ENFORCER,
  NO_PENALTY,
  OTHER_LAWS_NOTE,
  checkboxLabel,
  classifyAddressee,
  enforcementFacts,
  hasSilentFacts,
  isNotStated,
  reviewedItems,
  statusLabelFor,
  matchCompany,
  rollupByJurisdiction,
  ruleCardItem,
  statusFor,
  type LawMatch,
} from "./matching";
import type { ConfirmedProfile } from "./product-profile";
import { normalizeForMatch, verifyQuote } from "./quote-verify";

const TODAY = "2026-11-07";
const none = new Set<string>();

const byId = (matches: LawMatch[], id: string) => {
  const m = matches.find((x) => x.law.id === id);
  assert.ok(m, `missing law ${id}`);
  return m;
};
const ids = (m: LawMatch, bucket: "applicable" | "needsReview" | "notApplicable") => m[bucket].map((d) => d.id);
const allIds = (m: LawMatch) => [...m.applicable, ...m.needsReview, ...m.notApplicable].map((d) => d.id);

const EXAMPLE: ConfirmedProfile = {
  role: "both",
  features: ["resume_screening", "automated_employment_decision", "uses_location_or_zip"],
  jurisdictions: ["NYC", "IL", "CO", "TX"],
  isGovernment: false,
};

describe("classifyAddressee", () => {
  it("maps plain roles", () => {
    assert.deepEqual(classifyAddressee("employer or employment agency").addressees, ["employer"]);
    assert.deepEqual(classifyAddressee("operator").addressees, ["operator"]);
    assert.deepEqual(classifyAddressee("deployer or developer").addressees, ["deployer", "developer"]);
    assert.deepEqual(classifyAddressee("processor").addressees, ["processor"]);
    assert.deepEqual(classifyAddressee("person").addressees, ["any_person"]);
  });
  it("marks named state bodies", () => {
    const c = classifyAddressee("the Department of Information Resources and the council");
    assert.deepEqual(c.addressees, ["government"]);
    assert.ok(c.namedBody);
    assert.ok(classifyAddressee("attorney general").namedBody);
  });
  it("keeps generic government separate from named bodies", () => {
    const c = classifyAddressee("governmental agency");
    assert.deepEqual(c.addressees, ["government"]);
    assert.equal(c.namedBody, null);
  });
  it("sends sector-specific and unclear addressees to unknown", () => {
    assert.deepEqual(classifyAddressee("deployer subject to FERPA").addressees, ["unknown"]);
    assert.deepEqual(classifyAddressee("health care provider").addressees, ["unknown"]);
    assert.deepEqual(classifyAddressee("Covered entity").addressees, ["unknown"]);
    assert.deepEqual(classifyAddressee("someone vague").addressees, ["unknown"]);
  });
});

describe("reviewed law table", () => {
  it("every basis id exists in the rule cards and is verified", () => {
    for (const rule of LAW_RULES) {
      for (const id of rule.basis) {
        const item = ruleCardItem(id);
        assert.ok(item, `${id} not found`);
        assert.equal(item.verified, true, `${id} is not verified`);
      }
      for (const index of Object.keys(rule.dutyOverrides ?? {})) {
        const item = ruleCardItem(`${rule.lawId}/obligations/${index}`);
        assert.ok(item?.verified, `${rule.lawId}/obligations/${index} override targets a missing/unverified item`);
      }
    }
  });
  it("only Illinois has no rule card", () => {
    assert.deepEqual(LAW_RULES.filter((r) => !r.extracted).map((r) => r.lawId), ["il-hb3773"]);
  });
  it("SB 53's date rests on the PRD; RAISE's on the official text, not a rule-card date item", () => {
    const sb53 = LAW_RULES.find((r) => r.lawId === "ca-sb53");
    assert.equal(sb53?.effectiveDateFromPrd, true);
    const raise = LAW_RULES.find((r) => r.lawId === "ny-raise");
    assert.equal(raise?.effectiveDateFromPrd, undefined);
    for (const rule of [sb53, raise]) {
      assert.equal(rule?.extracted, true);
      assert.ok(rule?.basis.length, `${rule?.lawId} has no basis`);
      assert.ok(!rule?.basis.some((b) => b.includes("/effectiveDate/")), `${rule?.lawId} uses a date item`);
    }
    assert.equal(ruleCardItem("ny-raise/effectiveDate/0")?.verified, false);
  });
  it("RAISE keys to New York State, never NYC", () => {
    assert.equal(LAW_RULES.find((r) => r.lawId === "ny-raise")?.jurisdictionKey, "NY");
  });
});

describe("example company (Parrotfish, hiring tool, role both)", () => {
  const matches = matchCompany(EXAMPLE);

  it("matches NYC LL144, Illinois, TRAIGA and Colorado; not frontier or CA laws", () => {
    const applying = matches.filter((m) => m.applies).map((m) => m.law.id).sort();
    assert.deepEqual(applying, ["co-sb26-189", "il-hb3773", "nyc-ll144", "tx-traiga"]);
  });

  it("applies all five NYC employer duties", () => {
    assert.equal(byId(matches, "nyc-ll144").applicable.length, 5);
  });

  it("Illinois uses PRD duties including the ZIP proxy flag", () => {
    const il = byId(matches, "il-hb3773");
    assert.deepEqual(ids(il, "applicable"), ["il-hb3773/prd/0", "il-hb3773/prd/1", "il-hb3773/prd/2"]);
  });

  it("filters Texas: state-body duties out, processor duties to review", () => {
    const tx = byId(matches, "tx-traiga");
    assert.ok(ids(tx, "notApplicable").includes("tx-traiga/obligations/25")); // the council
    assert.ok(ids(tx, "notApplicable").includes("tx-traiga/obligations/4")); // government agency
    assert.ok(ids(tx, "notApplicable").includes("tx-traiga/obligations/5")); // override: gov disclosure
    assert.ok(ids(tx, "needsReview").includes("tx-traiga/obligations/0")); // processor
    assert.ok(ids(tx, "needsReview").includes("tx-traiga/obligations/9")); // health care
    assert.ok(ids(tx, "applicable").includes("tx-traiga/obligations/14")); // no discrimination
  });

  it("NYC is red, New York State not applicable, Colorado amber", () => {
    const r = rollupByJurisdiction(matches, EXAMPLE, none, TODAY);
    assert.equal(r.NYC.status, "non-compliant");
    assert.equal(r.NY.status, "not-applicable");
    assert.deepEqual(r.NY.laws.map((l) => l.law.id), ["ny-raise"]);
    assert.equal(r.CO.status, "action-soon");
    assert.equal(r.NYC.laws.length, 1);
  });

  it("developer-to-deployer documentation is not a consumer notice duty", () => {
    const co = byId(matches, "co-sb26-189");
    const notice = co.applicable.filter((d) => d.isNotice).map((d) => d.id);
    assert.ok(!notice.includes("co-sb26-189/obligations/0"));
    assert.ok(!notice.includes("co-sb26-189/obligations/1"));
    assert.ok(notice.includes("co-sb26-189/obligations/5"));
  });

  it("named-body reasons read naturally", () => {
    const tx = byId(matches, "tx-traiga");
    const dept = tx.notApplicable.find((d) => d.id === "tx-traiga/obligations/19");
    assert.equal(dept?.reason, "Duty of the department (a state body), not of companies");
    const council = tx.notApplicable.find((d) => d.id === "tx-traiga/obligations/25");
    assert.equal(council?.reason, "Duty of the council (a state body), not of companies");
  });

  it("NYC turns green when all its duties are checked", () => {
    const nyc = byId(matches, "nyc-ll144");
    const checked = new Set(nyc.applicable.map((d) => d.id));
    assert.equal(statusFor([nyc], checked, TODAY), "compliant");
  });
});

describe("developer-only hiring vendor", () => {
  it("employer laws don't apply and their duties say why", () => {
    const matches = matchCompany({ ...EXAMPLE, role: "developer" });
    const nyc = byId(matches, "nyc-ll144");
    assert.equal(nyc.applies, false);
    assert.equal(nyc.applicable.length, 0);
    assert.match(nyc.notApplicable[0].reason, /employers using the tool/);
    assert.equal(byId(matches, "il-hb3773").applies, false);
  });
});

describe("government agency with a Texas chatbot", () => {
  const profile: ConfirmedProfile = {
    role: "deployer",
    features: ["consumer_chatbot"],
    jurisdictions: ["TX"],
    isGovernment: true,
  };
  const tx = byId(matchCompany(profile), "tx-traiga");

  it("applies the governmental-agency disclosure duties", () => {
    for (const i of [4, 5, 6, 7, 8]) assert.ok(ids(tx, "applicable").includes(`tx-traiga/obligations/${i}`), `obl ${i}`);
    assert.ok(tx.applicable.some((d) => d.isNotice));
  });

  it("still excludes duties of named state bodies", () => {
    for (const i of [19, 25, 41, 44]) {
      assert.ok(ids(tx, "notApplicable").includes(`tx-traiga/obligations/${i}`), `obl ${i}`);
    }
  });
});

describe("frontier model developer in California and New York", () => {
  const profile: ConfirmedProfile = {
    role: "developer",
    features: ["frontier_model_training", "generative_ai_public"],
    jurisdictions: ["CA", "NY"],
    isGovernment: false,
  };
  const matches = matchCompany(profile);

  const sb53 = byId(matches, "ca-sb53");
  const raise = byId(matches, "ny-raise");
  const duty = (m: LawMatch, id: string) => {
    const d = [...m.applicable, ...m.needsReview, ...m.notApplicable].find((x) => x.id === id);
    assert.ok(d, `missing duty ${id}`);
    return d;
  };

  it("SB 53 and RAISE apply from their rule cards; AB 2013 applies", () => {
    assert.equal(sb53.applies, true);
    assert.equal(sb53.rule.extracted, true);
    assert.equal(raise.applies, true);
    assert.equal(raise.rule.extracted, true);
    assert.ok([...sb53.applicable, ...raise.applicable].every((d) => d.source === "rule-card" && d.quote));
    assert.equal(byId(matches, "ca-ab2013").applies, true);
    assert.ok(ids(byId(matches, "ca-ab2013"), "notApplicable").includes("ca-ab2013/obligations/1")); // exemption
  });

  it("SB 53: real duties land in the right buckets", () => {
    assert.ok(ids(sb53, "applicable").includes("ca-sb53/obligations/3")); // transparency report
    assert.equal(duty(sb53, "ca-sb53/obligations/12").bucket, "applicable"); // incident report
    assert.equal(duty(sb53, "ca-sb53/obligations/12").timing, "within 15 days");
    assert.match(duty(sb53, "ca-sb53/obligations/0").reason, /large frontier developers/i);
    assert.equal(duty(sb53, "ca-sb53/obligations/0").bucket, "needsReview");
    assert.match(duty(sb53, "ca-sb53/obligations/9").reason, /Office of Emergency Services \(a state body\)/);
    assert.match(duty(sb53, "ca-sb53/obligations/29").reason, /CalCompute consortium \(a state body\)/);
    assert.equal(duty(sb53, "ca-sb53/obligations/14").bucket, "notApplicable"); // optional amended report
    assert.equal(duty(sb53, "ca-sb53/obligations/42").bucket, "notApplicable"); // employee's court step
    assert.equal(sb53.unverifiedCount, 2);
  });

  it("SB 53: Draft covers real notices, not bans that mention disclosure", () => {
    assert.deepEqual(sb53.applicable.filter((d) => d.isNotice).map((d) => d.id), [
      "ca-sb53/obligations/3",
      "ca-sb53/obligations/13",
      "ca-sb53/obligations/36",
      "ca-sb53/obligations/37",
    ]);
    assert.equal(duty(sb53, "ca-sb53/obligations/34").isNotice, false);
  });

  it("RAISE: real duties land in the right buckets", () => {
    assert.ok(ids(raise, "applicable").includes("ny-raise/obligations/3")); // transparency report
    assert.equal(duty(raise, "ny-raise/obligations/7").bucket, "applicable"); // incident report
    assert.equal(duty(raise, "ny-raise/obligations/7").timing, "within seventy-two hours");
    assert.equal(duty(raise, "ny-raise/obligations/13").bucket, "needsReview"); // disclosure statement
    assert.equal(duty(raise, "ny-raise/obligations/16").reason, "Duty of the office (a state body), not of companies");
    assert.deepEqual(raise.applicable.filter((d) => d.isNotice).map((d) => d.id), [
      "ny-raise/obligations/3",
      "ny-raise/obligations/8",
    ]);
  });

  it("every RAISE duty starts Jan 1, 2027, dated from the official text", () => {
    for (const d of [...raise.applicable, ...raise.needsReview, ...raise.notApplicable]) {
      assert.equal(d.effectiveDate, "2027-01-01", d.id);
      assert.equal(d.dateFromPrd, false, d.id);
    }
  });

  it("RAISE colors New York State; there is no NYC entry", () => {
    const r = rollupByJurisdiction(matches, profile, none, TODAY);
    assert.equal(r.NY.label, "Action needed by Jan 1, 2027");
    assert.equal(r.CA.label, "Action needed now");
    assert.equal(r.NYC, undefined);
  });

  it("an NYC-only frontier developer gets RAISE on NY, never on NYC", () => {
    const nycOnly: ConfirmedProfile = { ...profile, jurisdictions: ["NYC"] };
    const m = matchCompany(nycOnly);
    assert.equal(byId(m, "ny-raise").applies, true);
    const r = rollupByJurisdiction(m, nycOnly, none, TODAY);
    assert.ok(r.NY.laws.some((l) => l.law.id === "ny-raise"));
    assert.ok(r.NYC.laws.every((l) => l.law.id !== "ny-raise"));
  });

  it("a government frontier developer still gets no consortium or agency duties", () => {
    const gov = byId(matchCompany({ ...profile, isGovernment: true }), "ca-sb53");
    for (const i of [29, 30, 31, 32, 33, 40, 41]) {
      assert.ok(ids(gov, "notApplicable").includes(`ca-sb53/obligations/${i}`), `obl ${i}`);
    }
  });
});

describe("California companion chatbot for minors", () => {
  const profile: ConfirmedProfile = {
    role: "deployer",
    features: ["consumer_chatbot", "companion_chatbot", "chatbot_used_by_minors"],
    jurisdictions: ["CA"],
    isGovernment: false,
  };
  const sb243 = byId(matchCompany(profile), "ca-sb243");

  it("applies the minor-user duties", () => {
    for (const i of [3, 4, 5]) assert.ok(ids(sb243, "applicable").includes(`ca-sb243/obligations/${i}`));
  });

  it("is amber once everything in force is checked (annual report starts July 2027)", () => {
    const report = sb243.applicable.find((d) => d.id === "ca-sb243/obligations/6");
    assert.equal(report?.effectiveDate, "2027-07-01");
    const checked = new Set(sb243.applicable.filter((d) => d.effectiveDate <= TODAY).map((d) => d.id));
    assert.equal(statusFor([sb243], checked, TODAY), "action-soon");
  });

  it("without minors, the minor duties move to Doesn't apply", () => {
    const adults = byId(
      matchCompany({ ...profile, features: ["consumer_chatbot", "companion_chatbot"] }),
      "ca-sb243",
    );
    assert.ok(ids(adults, "notApplicable").includes("ca-sb243/obligations/4"));
  });
});

describe("delivery app using location in Illinois", () => {
  it("Illinois HB 3773 is not applicable without an employment feature", () => {
    const profile: ConfirmedProfile = {
      role: "both",
      features: ["uses_location_or_zip", "consumer_chatbot"],
      jurisdictions: ["IL"],
      isGovernment: false,
    };
    const il = byId(matchCompany(profile), "il-hb3773");
    assert.equal(il.applies, false);
    assert.equal(il.applicable.length, 0);
    assert.equal(rollupByJurisdiction(matchCompany(profile), profile, none, TODAY).IL.status, "not-applicable");
  });
});

describe("status wording", () => {
  const matches = matchCompany(EXAMPLE);

  it("uses action wording, never compliant / non-compliant", () => {
    const r = rollupByJurisdiction(matches, EXAMPLE, none, TODAY);
    assert.equal(r.NYC.label, "Action needed now");
    assert.equal(r.CO.label, "Action needed by Jan 1, 2027");
    assert.equal(r.NY.label, "Not applicable");
    const nyc = byId(matches, "nyc-ll144");
    const all = new Set(nyc.applicable.map((d) => d.id));
    assert.equal(rollupByJurisdiction(matches, EXAMPLE, all, TODAY).NYC.label, "All confirmed");
    const labels = [...Object.values(STATUS_LABEL), ...Object.values(r).map((x) => x.label)];
    for (const l of labels) assert.doesNotMatch(l, /compliant/i);
  });

  it("amber date is the earliest unchecked future duty", () => {
    const profile: ConfirmedProfile = {
      role: "deployer",
      features: ["companion_chatbot", "chatbot_used_by_minors"],
      jurisdictions: ["CA"],
      isGovernment: false,
    };
    const sb243 = byId(matchCompany(profile), "ca-sb243");
    const inForce = new Set(sb243.applicable.filter((d) => d.effectiveDate <= TODAY).map((d) => d.id));
    assert.equal(statusLabelFor([sb243], inForce, TODAY), "Action needed by Jul 1, 2027");
  });

  it("prohibitions read as 'Confirm you don't:'", () => {
    assert.equal(
      checkboxLabel("May not develop or deploy AI to unlawfully discriminate against a protected class."),
      "Confirm you don't: develop or deploy AI to unlawfully discriminate against a protected class.",
    );
    assert.equal(checkboxLabel("Do not use ZIP codes as a proxy"), "Confirm you don't: use ZIP codes as a proxy");
    assert.match(checkboxLabel("Person must not develop or distribute AI that simulates..."), /^Confirm you don't: develop/);
    assert.equal(checkboxLabel("Publish a safety framework"), "Publish a safety framework");
    const tx = byId(matches, "tx-traiga");
    for (const d of tx.applicable) assert.match(checkboxLabel(d.text), /^Confirm you don't: /, d.id);
  });
});

describe("reviewed enforcement facts", () => {
  const lawText = (lawId: string) => readFileSync(path.join(process.cwd(), "data", "laws", `${lawId}.txt`), "utf8");

  const AUDITED = ["nyc-ll144", "tx-traiga", "co-sb26-189", "ca-sb243", "ca-ab2013", "ca-sb53", "ny-raise"];
  const FIELDS = ["enforcedBy", "penalties", "curePeriod"] as const;
  const facts = (lawId: string, field: (typeof FIELDS)[number]) => reviewedItems(LAW_RULES_BY_ID[lawId], field)!;
  const CURE_WORDS = /\bcur(e|es|ed|ing)\b/i;

  it("all 7 laws with rule cards have reviewed facts for all 3 fields", () => {
    for (const lawId of AUDITED) {
      for (const field of FIELDS) assert.ok(facts(lawId, field)?.length > 0, `${lawId} ${field}`);
    }
  });
  it("every reviewed quote is in that law's official text", () => {
    let checked = 0;
    for (const rule of LAW_RULES.filter((r) => r.reviewedFacts)) {
      const text = normalizeForMatch(lawText(rule.lawId));
      for (const list of Object.values(rule.reviewedFacts!)) {
        for (const { quote } of list) {
          if (quote === null) continue;
          const check = verifyQuote(quote, text);
          assert.ok(check.verified, `${rule.lawId}: ${check.reason}: ${quote}`);
          checked++;
        }
      }
    }
    assert.equal(checked, 37);
  });
  it('a line with no quote is only ever a "not stated" line', () => {
    for (const rule of LAW_RULES) {
      for (const list of Object.values(rule.reviewedFacts ?? {})) {
        for (const { text, quote } of list) {
          if (quote === null) assert.ok([NO_ENFORCER, NO_PENALTY, NO_CURE_PERIOD].includes(text), text);
        }
      }
    }
  });
  it('"no cure period" is only said of laws whose text never mentions a cure', () => {
    for (const lawId of AUDITED) {
      const says = facts(lawId, "curePeriod").some((f) => f.text === NO_CURE_PERIOD);
      assert.equal(says, !CURE_WORDS.test(lawText(lawId)), lawId);
    }
  });
  it("AB 2013: the text is silent on enforcement and penalties, and the app says so", () => {
    assert.doesNotMatch(lawText("ca-ab2013"), /penalt|damages|civil action|enforce|attorney general|injunct|liable|violation/i);
    assert.deepEqual(facts("ca-ab2013", "enforcedBy").map((f) => f.text), ["No enforcer named in the law text"]);
    assert.deepEqual(facts("ca-ab2013", "penalties").map((f) => f.text), ["No penalty stated in the law text"]);
  });
  it("no law but AB 2013 says it has no penalty or enforcer", () => {
    for (const lawId of AUDITED.filter((id) => id !== "ca-ab2013")) {
      assert.ok(!facts(lawId, "penalties").some((f) => f.text === NO_PENALTY), lawId);
      assert.ok(!facts(lawId, "enforcedBy").some((f) => f.text === NO_ENFORCER), lawId);
    }
  });
  it("every dollar figure shown appears in its own quote", () => {
    // RAISE spells its amounts out in words, so it is checked separately below.
    for (const lawId of AUDITED.filter((id) => id !== "ny-raise")) {
      for (const field of FIELDS) {
        for (const { text, quote } of facts(lawId, field)) {
          for (const [amount] of text.matchAll(/\$[\d,]*\d/g)) assert.ok(quote.includes(amount), `${lawId}: ${amount}`);
        }
      }
    }
    const raise = facts("ny-raise", "penalties");
    assert.match(raise[0].text, /\$1 million .*\$3 million/);
    assert.match(raise[0].quote, /one million dollars for a first violation .*three million dollars per subsequent/);
    assert.match(raise[1].text, /\$1,000 per day/);
    assert.match(raise[1].quote, /one thousand dollars for each day/);
  });
  it("NYC: same-day violations, each day and each missed notice are spelled out", () => {
    const texts = facts("nyc-ll144", "penalties").map((f) => f.text).join(" ");
    assert.match(texts, /each additional violation that same day/);
    assert.match(texts, /Each day a tool is used/);
    assert.match(texts, /Each failure to give a required notice/);
  });
  it("Texas: the agency exception is named, and penalties are only for uncured violations", () => {
    assert.match(facts("tx-traiga", "enforcedBy")[0].text, /except for state-agency sanctions/);
    assert.ok(facts("tx-traiga", "enforcedBy").some((f) => /private right of action/.test(f.text)));
    assert.match(facts("tx-traiga", "penalties")[0].text, /^If a violation isn't cured/);
    assert.ok(facts("tx-traiga", "penalties").some((f) => /\$100,000/.test(f.text)));
    assert.match(facts("tx-traiga", "curePeriod")[0].quote, /provides the attorney general with a written statement/);
  });
  it("Colorado: rule-making isn't enforcement, and cure is conditional and repealed in 2030", () => {
    assert.ok(!facts("co-sb26-189", "enforcedBy").some((f) => /rules|stakeholder/i.test(f.text)));
    const cure = facts("co-sb26-189", "curePeriod").map((f) => f.text).join(" ");
    assert.match(cure, /only if it deems a cure possible/);
    assert.match(cure, /knowing or repeated/);
    assert.match(cure, /repealed effective Jan 1, 2030/);
    // The only dollar figure in the text is the budget appropriation.
    const withDollars = lawText("co-sb26-189").split(/\r?\n/).filter((l) => l.includes("$"));
    assert.equal(withDollars.length, 1);
    assert.match(withDollars[0], /SECTION 4\. Appropriation/);
    assert.match(facts("co-sb26-189", "penalties")[0].text, /states no dollar amount/);
  });
  it("SB 53: the penalty is limited to large frontier developers; fees are for whistleblower suits", () => {
    const [penalty, fees] = facts("ca-sb53", "penalties");
    assert.match(penalty.text, /^A large frontier developer/);
    assert.match(fees.text, /whistleblower section/);
    assert.match(facts("ca-sb53", "enforcedBy")[0].text, /only in a civil action brought by the Attorney General/);
  });
  it("RAISE: no private right of action, and the office is identified", () => {
    const enforcedBy = facts("ny-raise", "enforcedBy");
    assert.ok(enforcedBy.some((f) => /^No private right of action/.test(f.text)));
    assert.match(enforcedBy[1].text, /Department of Financial Services/);
  });
  it("wrong or misplaced rule-card lines are no longer shown", () => {
    const shown = AUDITED.flatMap((id) => FIELDS.flatMap((field) => facts(id, field).map((f) => f.text))).join("\n");
    assert.doesNotMatch(shown, /enforces reporting|adopting rules|^Violations are enforceable only/m);
    assert.doesNotMatch(shown, /Violations can incur civil penalties/);
  });
  it("Illinois has no card, so it keeps its labelled PRD facts", () => {
    assert.equal(reviewedItems(LAW_RULES_BY_ID["il-hb3773"], "penalties"), undefined);
  });
  it("every screen gets the same facts from enforcementFacts", () => {
    for (const lawId of AUDITED) {
      for (const field of FIELDS) assert.deepEqual(enforcementFacts(LAW_RULES_BY_ID[lawId], field), facts(lawId, field));
    }
  });
  it("Illinois is never called silent: its text isn't on file, so it is just not verified", () => {
    const il = LAW_RULES_BY_ID["il-hb3773"];
    for (const field of FIELDS) assert.deepEqual(enforcementFacts(il, field), []);
  });
  it('only "not stated" lines count as silence, for the "other laws" note', () => {
    assert.equal(OTHER_LAWS_NOTE, "Other laws may still apply");
    assert.equal(isNotStated({ text: NO_PENALTY }), true);
    assert.equal(isNotStated({ text: NO_ENFORCER }), true);
    assert.equal(isNotStated({ text: NO_CURE_PERIOD }), true);
    for (const lawId of ["tx-traiga", "ny-raise"]) {
      assert.ok(!facts(lawId, "penalties").some(isNotStated), lawId);
    }
  });
  it("the cross-state table and checklist read the shared facts, not the PRD fields", () => {
    for (const file of ["investigator/cross-state-table.tsx", "small-company/state-checklist.tsx"]) {
      const src = readFileSync(path.join(process.cwd(), "src", "components", "dashboard", file), "utf8");
      assert.match(src, /enforcementFacts\(/, file);
      assert.doesNotMatch(src, /\.penalty\b|\.enforcement\b/, file);
    }
  });
  it("the note shows once per law on both screens, not once per silent line", () => {
    const dashboard = path.join(process.cwd(), "src", "components", "dashboard");
    const shared = readFileSync(path.join(dashboard, "enforcement-facts.tsx"), "utf8");
    const factList = shared.slice(shared.indexOf("function FactList"), shared.indexOf("function OtherLawsNote"));
    assert.doesNotMatch(factList, /OTHER_LAWS_NOTE/);
    assert.match(shared, /hasSilentFacts\(rule\)/);
    for (const file of ["investigator/cross-state-table.tsx", "small-company/state-checklist.tsx"]) {
      const src = readFileSync(path.join(dashboard, file), "utf8");
      assert.equal(src.match(/<OtherLawsNote /g)?.length, 1, file);
    }
  });
  it("hasSilentFacts: true only when a line is silent, and Illinois is never silent", () => {
    assert.equal(hasSilentFacts(LAW_RULES_BY_ID["ca-ab2013"]), true);
    assert.equal(hasSilentFacts(LAW_RULES_BY_ID["il-hb3773"]), false);
  });
  it("SB 243: a civil action with all three remedies; the Office only receives and posts reports", () => {
    const items = reviewedItems(LAW_RULES_BY_ID["ca-sb243"], "enforcedBy")!;
    assert.equal(items.length, 2);
    assert.match(items[0].text, /civil action/);
    assert.match(items[0].text, /injunctive relief/);
    assert.match(items[0].text, /\$1,000 per violation/);
    assert.match(items[0].text, /attorney's fees/);
    assert.match(items[0].quote, /may bring a civil action/);
    assert.match(items[1].text, /Annual reports go to the Office of Suicide Prevention/);
    assert.match(items[1].text, /doesn't name it as an enforcer/);
    assert.ok(items.every((i) => i.verified));
    assert.ok(!items.some((i) => /enforces reporting/.test(i.text)));
  });
  it("the text gives the Office no enforcement power and names no attorney general", () => {
    const text = lawText("ca-sb243");
    assert.doesNotMatch(text, /attorney general/i);
    const officeLines = text.split(/\r?\n/).filter((l) => /\bthe office\b/i.test(l));
    // The definition, the duty to report to it, and its duty to post the data.
    assert.equal(officeLines.length, 3);
    for (const line of officeLines) assert.doesNotMatch(line, /enforce|penalt|civil action/i);
  });
  it("SB 243's penalty line now includes the injunctive relief the card hid", () => {
    const [remedies] = reviewedItems(LAW_RULES_BY_ID["ca-sb243"], "penalties")!;
    assert.match(remedies.text, /injunctive relief/);
    assert.match(remedies.quote, /\(a\) Injunctive relief\./);
  });
});

describe("NYC vs New York State", () => {
  it("NYC LL144 never lands on the NY key", () => {
    const r = rollupByJurisdiction(matchCompany(EXAMPLE), EXAMPLE, none, TODAY);
    assert.ok(!r.NY.laws.some((l) => l.law.id === "nyc-ll144"));
    assert.ok(r.NYC.laws.every((l) => l.law.id === "nyc-ll144"));
  });

  it("every duty id is unique", () => {
    const all = matchCompany(EXAMPLE).flatMap(allIds);
    assert.equal(new Set(all).size, all.length);
  });
});
