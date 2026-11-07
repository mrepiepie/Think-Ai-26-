import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LAW_RULES,
  classifyAddressee,
  matchCompany,
  rollupByJurisdiction,
  ruleCardItem,
  statusFor,
  type LawMatch,
} from "./matching";
import type { ConfirmedProfile } from "./product-profile";

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
  it("laws without a rule card are marked not extracted", () => {
    for (const id of ["il-hb3773", "ca-sb53", "ny-raise"]) {
      assert.equal(LAW_RULES.find((r) => r.lawId === id)?.extracted, false);
    }
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

  it("SB 53 and RAISE apply as not-extracted laws; AB 2013 applies", () => {
    assert.equal(byId(matches, "ca-sb53").applies, true);
    assert.equal(byId(matches, "ca-sb53").rule.extracted, false);
    assert.equal(byId(matches, "ny-raise").applies, true);
    assert.equal(byId(matches, "ca-ab2013").applies, true);
    assert.ok(ids(byId(matches, "ca-ab2013"), "notApplicable").includes("ca-ab2013/obligations/1")); // exemption
  });

  it("RAISE colors New York State; there is no NYC entry", () => {
    const r = rollupByJurisdiction(matches, profile, none, TODAY);
    assert.notEqual(r.NY.status, "not-applicable");
    assert.equal(r.NYC, undefined);
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
