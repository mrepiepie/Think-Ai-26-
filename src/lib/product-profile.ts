import { z } from "zod";
import { STATES } from "@/data/states";
import { normalizeForMatch } from "./quote-verify";

/**
 * Company product profile: what the AI product reader returns (a draft
 * with "unknown" where the description is unclear) and what the user
 * confirms before matching runs. Safe to import on the client.
 */

export const FEATURES = [
  {
    id: "resume_screening",
    label: "Resume screening",
    definition: "Screens, scores, ranks or filters job applicants or their resumes.",
  },
  {
    id: "automated_employment_decision",
    label: "Automated employment decision",
    definition:
      "The AI makes or substantially drives a hiring, promotion, firing or other employment decision (e.g. auto-reject, auto-advance).",
  },
  {
    id: "uses_location_or_zip",
    label: "Uses location / ZIP code",
    definition: "Uses a person's location, address or ZIP code as an input.",
  },
  {
    id: "consumer_chatbot",
    label: "Consumer chatbot",
    definition: "A chatbot or AI assistant that talks with members of the public or customers.",
  },
  {
    id: "companion_chatbot",
    label: "Companion chatbot",
    definition:
      "A chatbot meant to give social or emotional companionship, an ongoing relationship or human-like friendship (not just customer service).",
  },
  {
    id: "chatbot_used_by_minors",
    label: "Chatbot used by minors",
    definition: "The chatbot is used by, or offered to, people under 18.",
  },
  {
    id: "generative_ai_public",
    label: "Public generative AI",
    definition:
      "A generative AI system or service (generates text, images, audio or video) made available to the public.",
  },
  {
    id: "consequential_decision_lending_housing_insurance",
    label: "Lending / housing / insurance decision",
    definition: "AI that makes or materially influences decisions about loans, credit, housing or insurance.",
  },
  {
    id: "frontier_model_training",
    label: "Frontier model training",
    definition: "Trains its own very large frontier AI foundation model (not just using someone else's model).",
  },
] as const;

export type FeatureId = (typeof FEATURES)[number]["id"];
export const FEATURE_IDS = FEATURES.map((f) => f.id) as [FeatureId, ...FeatureId[]];
export const FEATURE_LABEL = Object.fromEntries(FEATURES.map((f) => [f.id, f.label])) as Record<
  FeatureId,
  string
>;

/** US states, DC and territories (USPS codes), plus "NYC" for New York City. */
export const JURISDICTION_CODES: [string, ...string[]] = [
  "NYC",
  ...Object.values(STATES)
    .map((s) => s.code)
    .sort(),
];

export const ROLES = ["developer", "deployer", "both"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  developer: "Developer (builds / sells the AI)",
  deployer: "Deployer (uses the AI itself)",
  both: "Both",
};

const quote = z
  .string()
  .describe("Exact words copied from the user's description that support this, or an empty string if none.");

/** What the model returns. Strict-mode friendly: every field required. */
export const ProductProfileDraft = z.object({
  role: z
    .enum(["developer", "deployer", "both", "unknown"])
    .describe(
      "developer = builds or sells the AI product to others; deployer = uses AI in its own operations or decisions; both = does both; unknown = the description does not say.",
    ),
  role_quote: quote,
  features: z
    .array(
      z.object({
        id: z.enum(FEATURE_IDS),
        status: z
          .enum(["yes", "unknown"])
          .describe("yes = the description clearly says this; unknown = it hints at it but is unclear."),
        quote,
      }),
    )
    .describe("Only features the description mentions or hints at. Leave out features that clearly do not apply."),
  jurisdictions: z
    .array(
      z.object({
        code: z.enum(JURISDICTION_CODES).describe('Two-letter US state code, "DC", or "NYC" for New York City.'),
        status: z.enum(["yes", "unknown"]),
        quote,
      }),
    )
    .describe("Places where the company has users, customers, applicants or employees, as named in the description."),
  is_government: z.enum(["yes", "no", "unknown"]).describe("Is the company itself a government agency?"),
  notes: z
    .array(z.string())
    .describe("Short assumptions or open questions for the user to confirm (at most 5, each under 20 words)."),
});

export type ProductProfileDraft = z.infer<typeof ProductProfileDraft>;

/** The profile after the user resolves every "unknown". Matching runs on this. */
export const ConfirmedProfile = z.object({
  role: z.enum(ROLES),
  features: z.array(z.enum(FEATURE_IDS)),
  jurisdictions: z.array(z.enum(JURISDICTION_CODES)),
  isGovernment: z.boolean(),
});

export type ConfirmedProfile = z.infer<typeof ConfirmedProfile>;

export const DESCRIPTION_LIMITS = { min: 20, max: 4000 } as const;

/** True when the quote appears (whitespace/case-insensitive) in the description. */
export function checkQuote(quoteText: string, description: string): boolean {
  const q = normalizeForMatch(quoteText);
  if (!q) return false;
  return normalizeForMatch(description).includes(q);
}
