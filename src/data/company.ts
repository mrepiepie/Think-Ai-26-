import type { CompanyProfile } from "./types";

/**
 * SAMPLE DATA. A fictional startup used for the demo (PRD section 7).
 * The company and its product are invented. "Load example" puts
 * `productDescription` into the product reader; everything after that
 * (profile, matching, checklist) is computed, not hand-written.
 */
export const SAMPLE_COMPANY: CompanyProfile = {
  name: "Parrotfish Hiring Co.",
  tagline: "Fictional startup · sample profile",
  productName: "ShortlistBot",
  productDescription:
    "Parrotfish Hiring Co. (14 staff) makes ShortlistBot, an AI resume screener that ranks job applicants for small employers and auto-rejects low scores. The scoring model is licensed from a third-party vendor, and it uses each applicant's location as an input. We also use ShortlistBot to screen applicants for our own open roles. Our customers and job applicants are in New York City, Illinois, Colorado and Texas.",
  employees: 14,
};

/** Map pin for New York City (the only city-level jurisdiction tracked). */
export const NYC_PIN = { id: "NYC", label: "NYC", lon: -74.006, lat: 40.7128 };
