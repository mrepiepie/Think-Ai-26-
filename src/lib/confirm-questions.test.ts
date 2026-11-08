import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeProductView } from "./compliance-views";
import {
  GENERATIVE_QUESTION,
  GENERATIVE_QUESTION_ID,
  answerGenerative,
  confirmQuestions,
  fromDraft,
  toConfirmed,
} from "./confirm-questions";
import { matchCompany } from "./matching";
import type { ProductProfileDraft } from "./product-profile";

const DESCRIPTION =
  "Luma Labs builds and operates its own AI companion chatbot app for users in California, including some users under 18.";

/** The reply from the live run, including its two wrong notes. */
const LUMA: ProductProfileDraft = {
  company_name: "Luma Labs",
  company_name_quote: "Luma Labs",
  role: "both",
  role_quote: "Luma Labs builds and operates its own AI companion chatbot app",
  features: [
    { id: "companion_chatbot", status: "yes", quote: "AI companion chatbot app" },
    { id: "chatbot_used_by_minors", status: "yes", quote: "some users under 18" },
  ],
  jurisdictions: [{ code: "CA", status: "yes", quote: "users in California" }],
  is_government: "no",
  notes: ["Confirm that all users are indeed in California", "Confirm that the app is only for users under 18"],
};

const ids = (draft: ProductProfileDraft, text = DESCRIPTION) => confirmQuestions(fromDraft(draft, text)).map((q) => q.id);
const appliesAb2013 = (p: ReturnType<typeof toConfirmed>) =>
  matchCompany(p!).find((m) => m.law.id === "ca-ab2013")?.applies;

describe("generative AI question", () => {
  it("uses the exact wording", () => {
    assert.equal(
      GENERATIVE_QUESTION,
      "Does your AI generate its own text, images, audio or video for users in California or elsewhere? (This decides whether training-data laws like California AB 2013 apply.)",
    );
  });
  it("is asked for a companion or consumer chatbot when generative AI isn't a yes", () => {
    assert.deepEqual(ids(LUMA), [GENERATIVE_QUESTION_ID]);
    const consumer = { ...LUMA, features: [{ id: "consumer_chatbot" as const, status: "yes" as const, quote: "AI companion chatbot app" }] };
    assert.deepEqual(ids(consumer), [GENERATIVE_QUESTION_ID]);
  });
  it("isn't asked without a chatbot, or when the reader already said yes", () => {
    assert.deepEqual(ids({ ...LUMA, features: [] }), []);
    const alreadyYes = {
      ...LUMA,
      features: [...LUMA.features, { id: "generative_ai_public" as const, status: "yes" as const, quote: "AI companion chatbot app" }],
    };
    assert.deepEqual(ids(alreadyYes), []);
  });
  it("replaces the generic question when the reader was unsure", () => {
    const unsure = {
      ...LUMA,
      features: [...LUMA.features, { id: "generative_ai_public" as const, status: "unknown" as const, quote: "AI companion chatbot app" }],
    };
    assert.deepEqual(ids(unsure), [GENERATIVE_QUESTION_ID]);
    assert.equal(fromDraft(unsure, DESCRIPTION).features.generative_ai_public.on, false);
  });
  it("is never answered automatically, and matching waits for an answer", () => {
    const p = fromDraft(LUMA, DESCRIPTION);
    assert.equal(p.generativeAnswer, null);
    assert.equal(p.features.generative_ai_public.on, false);
    assert.equal(toConfirmed(p), null);
  });
  it("yes turns the feature on, so AB 2013 applies; no leaves it off", () => {
    const p = fromDraft(LUMA, DESCRIPTION);
    const yes = toConfirmed(answerGenerative(p, true));
    assert.ok(yes?.features.includes("generative_ai_public"));
    assert.equal(appliesAb2013(yes), true);
    const no = toConfirmed(answerGenerative(p, false));
    assert.ok(no && !no.features.includes("generative_ai_public"));
    assert.equal(appliesAb2013(no), false);
  });
  it("stays on screen after an answer, so it can be changed", () => {
    const answered = answerGenerative(fromDraft(LUMA, DESCRIPTION), true);
    assert.ok(confirmQuestions(answered).some((q) => q.id === GENERATIVE_QUESTION_ID));
    assert.equal(answerGenerative(answered, false).features.generative_ai_public.on, false);
  });
  it("doesn't hold up matching for products with no chatbot", () => {
    assert.ok(toConfirmed(fromDraft({ ...LUMA, features: [] }, DESCRIPTION)));
  });
});

describe("confirm questions come from code", () => {
  it("never repeats the AI's notes, but keeps them for the collapsed section", () => {
    const p = fromDraft(LUMA, DESCRIPTION);
    const text = confirmQuestions(p).map((q) => q.text).join(" ");
    for (const note of LUMA.notes) assert.ok(!text.includes(note), note);
    assert.deepEqual(p.notes, LUMA.notes);
  });
  it("asks about each unknown field", () => {
    const draft: ProductProfileDraft = {
      ...LUMA,
      company_name: null,
      company_name_quote: "",
      role: "unknown",
      role_quote: "",
      is_government: "unknown",
      features: [{ id: "uses_location_or_zip", status: "unknown", quote: "" }],
      jurisdictions: [{ code: "TX", status: "unknown", quote: "" }],
    };
    assert.deepEqual(ids(draft), ["role", "government", "feature:uses_location_or_zip", "place:TX"]);
  });
  it("asks about each quote that isn't in the text, one by one", () => {
    const draft: ProductProfileDraft = {
      ...LUMA,
      role_quote: "made-up role words",
      features: [{ id: "uses_location_or_zip", status: "yes", quote: "made-up feature words" }],
      jurisdictions: [{ code: "CA", status: "yes", quote: "made-up place words" }],
    };
    assert.deepEqual(ids(draft), ["quote:role", "quote:feature:uses_location_or_zip", "quote:place:CA"]);
    const roleQuestion = confirmQuestions(fromDraft(draft, DESCRIPTION))[0].text;
    assert.match(roleQuestion, /made-up role words/);
  });
  it("drops a quote question once the user turns that item off", () => {
    const draft: ProductProfileDraft = {
      ...LUMA,
      features: [{ id: "uses_location_or_zip", status: "yes", quote: "made-up feature words" }],
    };
    const p = fromDraft(draft, DESCRIPTION);
    const off = {
      ...p,
      features: { ...p.features, uses_location_or_zip: { ...p.features.uses_location_or_zip, on: false } },
    };
    assert.deepEqual(confirmQuestions(off).map((q) => q.id), []);
  });
  it("flags a company name the reader made up", () => {
    assert.deepEqual(ids({ ...LUMA, company_name: "Globex Corp", features: [] }), ["company"]);
  });
  it("analyze_product returns the same code questions", () => {
    const view = analyzeProductView(LUMA, DESCRIPTION);
    assert.deepEqual(view.confirm_questions, [GENERATIVE_QUESTION]);
  });
});
