import {
  FEATURES,
  checkQuote,
  cleanCompanyName,
  readCompanyName,
  type ConfirmedProfile,
  type FeatureId,
  type ProductProfileDraft,
  type Role,
} from "./product-profile";
import { jurisdictionName } from "@/data/states";

/**
 * The confirm step between the AI's draft and matching. Plain code, no AI:
 * every question comes from a template here, filled in from the draft, so the
 * AI's free-text notes never become questions.
 */

/** The profile while the user reviews it. null = still unknown. */
export interface EditableProfile {
  /** "" = not stated. Used only in drafts. */
  companyName: string;
  companyNameQuote: string;
  /** The reader offered a name that isn't in the user's text. */
  companyNameRejected: boolean;
  role: Role | null;
  roleQuote: string;
  roleQuoteFound: boolean;
  features: Record<FeatureId, { on: boolean; unknown: boolean; quote: string; quoteFound: boolean }>;
  jurisdictions: { code: string; on: boolean; unknown: boolean; quote: string; quoteFound: boolean }[];
  isGovernment: boolean | null;
  /** The reader saw a chatbot but didn't say "yes" to public generative AI. */
  askGenerative: boolean;
  /** The user's answer to that question. Only the user ever sets this. */
  generativeAnswer: boolean | null;
  /** The AI's own notes. They may be wrong and are never used as questions. */
  notes: string[];
}

export const GENERATIVE_QUESTION_ID = "generative";
export const GENERATIVE_QUESTION =
  "Does your AI generate its own text, images, audio or video for users in California or elsewhere? (This decides whether training-data laws like California AB 2013 apply.)";

const CHATBOT_FEATURES: FeatureId[] = ["consumer_chatbot", "companion_chatbot"];

export function fromDraft(draft: ProductProfileDraft, description: string): EditableProfile {
  const features = Object.fromEntries(
    FEATURES.map((f) => [f.id, { on: false, unknown: false, quote: "", quoteFound: false }]),
  ) as EditableProfile["features"];
  for (const f of draft.features) {
    features[f.id] = {
      on: f.status === "yes",
      unknown: f.status === "unknown",
      quote: f.quote,
      quoteFound: checkQuote(f.quote, description),
    };
  }
  const seen = new Set<string>();
  const jurisdictions = draft.jurisdictions
    .filter((j) => !seen.has(j.code) && seen.add(j.code))
    .map((j) => ({
      code: j.code,
      on: j.status === "yes",
      unknown: j.status === "unknown",
      quote: j.quote,
      quoteFound: checkQuote(j.quote, description),
    }));
  const company = readCompanyName(draft, description);
  const hasChatbot = CHATBOT_FEATURES.some((id) => features[id].on || features[id].unknown);
  return {
    companyName: company.name ?? "",
    companyNameQuote: company.quote,
    companyNameRejected: company.rejected,
    role: draft.role === "unknown" ? null : draft.role,
    roleQuote: draft.role_quote,
    roleQuoteFound: checkQuote(draft.role_quote, description),
    features,
    jurisdictions,
    isGovernment: draft.is_government === "unknown" ? null : draft.is_government === "yes",
    askGenerative: hasChatbot && !features.generative_ai_public.on,
    generativeAnswer: null,
    notes: draft.notes.slice(0, 5),
  };
}

/** Record the user's answer. This is the only path that turns the feature on from the question. */
export function answerGenerative(p: EditableProfile, yes: boolean): EditableProfile {
  return {
    ...p,
    generativeAnswer: yes,
    features: {
      ...p.features,
      generative_ai_public: { ...p.features.generative_ai_public, on: yes, unknown: false },
    },
  };
}

/** null while role, government status or the generative AI question is unresolved. */
export function toConfirmed(p: EditableProfile): ConfirmedProfile | null {
  if (!p.role || p.isGovernment === null) return null;
  if (p.askGenerative && p.generativeAnswer === null) return null;
  return {
    companyName: cleanCompanyName(p.companyName),
    role: p.role,
    features: FEATURES.map((f) => f.id).filter((id) => p.features[id].on),
    jurisdictions: p.jurisdictions.filter((j) => j.on).map((j) => j.code),
    isGovernment: p.isGovernment,
  };
}

export interface ConfirmQuestion {
  id: string;
  text: string;
}

const quoteMissing = (label: string, quote: string) =>
  `We couldn't find the quote for ${label} in your text: "${quote}". Check it.`;

/** Every open question for this profile, from code templates only. */
export function confirmQuestions(p: EditableProfile): ConfirmQuestion[] {
  const out: ConfirmQuestion[] = [];
  const ask = (id: string, text: string) => out.push({ id, text });

  if (p.companyNameRejected && !p.companyName) {
    ask("company", "We couldn't confirm a company name from your text. Add it below if you want it in drafts.");
  }
  if (!p.role) ask("role", "Pick your role below: we couldn't tell from the description.");
  if (p.isGovernment === null) ask("government", "Are you a government agency? Pick yes or no below.");
  if (p.askGenerative) ask(GENERATIVE_QUESTION_ID, GENERATIVE_QUESTION);

  for (const f of FEATURES) {
    // The generative question already covers this feature.
    if (p.features[f.id].unknown && !(p.askGenerative && f.id === "generative_ai_public")) {
      ask(`feature:${f.id}`, `Not sure about "${f.label}". Turn it on if it applies.`);
    }
  }
  for (const j of p.jurisdictions) {
    if (j.unknown) ask(`place:${j.code}`, `Not sure you have users in ${jurisdictionName(j.code)}. Turn it on if you do.`);
  }

  if (p.role && p.roleQuote && !p.roleQuoteFound) ask("quote:role", quoteMissing("your role", p.roleQuote));
  for (const f of FEATURES) {
    const st = p.features[f.id];
    if ((st.on || st.unknown) && st.quote && !st.quoteFound) {
      ask(`quote:feature:${f.id}`, quoteMissing(`"${f.label}"`, st.quote));
    }
  }
  for (const j of p.jurisdictions) {
    if ((j.on || j.unknown) && j.quote && !j.quoteFound) {
      ask(`quote:place:${j.code}`, quoteMissing(jurisdictionName(j.code), j.quote));
    }
  }
  return out;
}
