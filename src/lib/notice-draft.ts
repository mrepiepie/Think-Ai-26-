import "server-only";

import { jurisdictionName } from "@/data/states";
import { GROQ_MODELS, groqStream } from "./groq";
import { LAW_RULES_BY_ID, matchLaw, type LawMatch } from "./matching";
import { DRAFT_HEADER, noticeQuotes, type NoticeQuote } from "./notice";
import { FEATURE_LABEL, ROLE_LABEL, type ConfirmedProfile } from "./product-profile";

/**
 * NOTICE DRAFTER (AI). Used by /api/draft-notice and the draft_notice MCP tool.
 *
 * The server re-runs the matching engine for the requested law, so the
 * only law text sent to Groq is the verified quotes of the notice /
 * disclosure duties that apply to this profile. Nothing the client sends
 * is used as a quote.
 */

const SYSTEM = `You draft a short notice or disclosure that a company could give to people affected by its AI product. You are not a lawyer and this is not legal advice.

Rules:
- Base every requirement ONLY on the numbered quotes provided. Do not add other legal requirements, deadlines, penalties or facts.
- After each sentence that relies on a quote, cite it in square brackets, e.g. [Q1] or [Q2, Q3].
- Use [square-bracket placeholders] for anything you don't know: [Company name], [Product name], [Contact email], [Date], [Link to bias audit summary], etc. Never invent names, dates, numbers or links.
- Write in plain English, short paragraphs, addressed to the reader of the notice (e.g. job applicants or consumers).
- Do NOT write a title line saying it is a draft; that is added for you.
- End with a final line exactly in the form: "Quotes relied on: Q1, Q3" listing every quote you cited.`;

export interface PreparedDraft {
  match: LawMatch;
  quotes: NoticeQuote[];
  /** The user message for the model. */
  prompt: string;
}

export type PrepareResult = ({ ok: true } & PreparedDraft) | { ok: false; error: string };

/** Re-run matching and build the prompt, or say why this law can't be drafted. */
export function prepareNoticeDraft(lawId: string, profile: ConfirmedProfile): PrepareResult {
  const rule = LAW_RULES_BY_ID[lawId];
  if (!rule) return { ok: false, error: "Unknown law." };

  const match = matchLaw(rule, profile);
  const quotes = noticeQuotes(match);
  if (!match.applies || quotes.length === 0) {
    return { ok: false, error: "This law has no verified notice or disclosure duty that applies to your profile." };
  }

  const prompt = [
    `Law: ${match.law.name} (${jurisdictionName(rule.jurisdictionKey)})`,
    "",
    "Company profile:",
    `- Role: ${ROLE_LABEL[profile.role]}`,
    `- AI features: ${profile.features.map((f) => FEATURE_LABEL[f]).join(", ") || "none listed"}`,
    `- Has users/applicants/employees in: ${profile.jurisdictions.map(jurisdictionName).join(", ")}`,
    `- Government agency: ${profile.isGovernment ? "yes" : "no"}`,
    "",
    "Verified quotes from the official law text (the ONLY legal basis you may use):",
    ...quotes.map((q) => `[${q.label}] "${q.quote}"`),
    "",
    "Draft the notice now.",
  ].join("\n");

  return { ok: true, match, quotes, prompt };
}

/** Stream the draft's text (without the DRAFT header). Throws GroqError. */
export function noticeDraftStream(prompt: string, signal?: AbortSignal) {
  return groqStream({
    system: SYSTEM,
    user: prompt,
    model: GROQ_MODELS.drafter,
    reasoningEffort: "none",
    maxCompletionTokens: 1200,
    temperature: 0.3,
    signal,
  });
}

/** The whole draft at once, starting with the DRAFT header. Throws GroqError. */
export async function draftNoticeText(prompt: string, signal?: AbortSignal): Promise<string> {
  let text = DRAFT_HEADER;
  for await (const chunk of noticeDraftStream(prompt, signal)) text += chunk;
  return text;
}
