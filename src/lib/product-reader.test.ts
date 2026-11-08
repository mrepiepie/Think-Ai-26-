import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { analyzeProductView } from "./compliance-views";
import { matchCompany } from "./matching";
import type { ProductProfileDraft } from "./product-profile";
import { readProduct } from "./product-reader";

/**
 * No live calls: fetch is replaced, so these check what we send to Groq and
 * how we handle its reply. They can't show that the real model obeys the prompt.
 */

const DESCRIPTION = "We build and operate our own companion chatbot for users in California";

const REPLY: ProductProfileDraft = {
  company_name: null,
  company_name_quote: "",
  role: "both",
  role_quote: "We build and operate our own companion chatbot",
  features: [{ id: "companion_chatbot", status: "yes", quote: "companion chatbot" }],
  jurisdictions: [{ code: "CA", status: "yes", quote: "users in California" }],
  is_government: "unknown",
  notes: [],
};

describe("product reader: builds AND operates means role both", () => {
  const savedKey = process.env.GROQ_API_KEY;
  let sent: { url: string; messages: { role: string; content: string }[] }[] = [];

  beforeEach(() => {
    sent = [];
    process.env.GROQ_API_KEY = "test-key-not-real";
    mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
      sent.push({ url, messages: JSON.parse(String(init.body)).messages });
      return Response.json({
        model: "mock-model",
        choices: [{ finish_reason: "stop", message: { content: JSON.stringify(REPLY) } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    });
  });

  afterEach(() => {
    mock.restoreAll();
    if (savedKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = savedKey;
  });

  it("returns role both, with a quote from the description", async () => {
    const { data } = await readProduct(DESCRIPTION);
    assert.equal(data.role, "both");
    const view = analyzeProductView(data, DESCRIPTION);
    assert.equal(view.draft_profile.role.value, "both");
    assert.equal(view.draft_profile.role.quote_check, "found");
  });

  it("sends the rule and the description to Groq", async () => {
    await readProduct(DESCRIPTION);
    assert.equal(sent.length, 1);
    const [system, user] = sent[0].messages;
    assert.match(
      system.content,
      /"both" if the description says the company builds or develops the AI AND runs, operates or offers it to its own users, applicants or employees/,
    );
    assert.ok(user.content.includes(DESCRIPTION));
  });

  it("role both picks up the operator duties a developer-only reading would miss", () => {
    const profile = { features: ["companion_chatbot" as const], jurisdictions: ["CA"], isGovernment: false };
    const operatorDuties = (role: "both" | "developer") =>
      matchCompany({ ...profile, role })
        .find((m) => m.law.id === "ca-sb243")!
        .applicable.filter((d) => d.addressees.includes("operator")).length;
    assert.equal(operatorDuties("developer"), 0);
    assert.ok(operatorDuties("both") > 0);
  });
});
