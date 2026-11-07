"use client";

import { useState } from "react";
import {
  FLAG_THRESHOLD,
  INVESTIGATED_COMPANIES,
  SAMPLE_COMPLAINTS,
} from "@/data/investigator";
import { CaseFile } from "./case-file";
import { ComplaintsFeed } from "./complaints-feed";
import { CrossStateTable } from "./cross-state-table";
import { FlaggedCompanies } from "./flagged-companies";

const COMPANIES_BY_ID = Object.fromEntries(INVESTIGATED_COMPANIES.map((c) => [c.id, c]));

/** Persona 3: state attorney general investigator (no map). */
export function InvestigatorScreen() {
  const [companyId, setCompanyId] = useState(INVESTIGATED_COMPANIES[0].id);
  const company = COMPANIES_BY_ID[companyId];

  return (
    <div className="grid gap-2 lg:h-full lg:grid-cols-[340px_minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
      <ComplaintsFeed
        complaints={SAMPLE_COMPLAINTS}
        companies={COMPANIES_BY_ID}
        selectedCompanyId={companyId}
        onSelectCompany={setCompanyId}
        className="max-h-[70vh] lg:row-span-2 lg:max-h-none"
      />
      <FlaggedCompanies
        companies={INVESTIGATED_COMPANIES}
        threshold={FLAG_THRESHOLD}
        selectedId={companyId}
        onSelect={setCompanyId}
      />
      {/* key resets the bundle selection when switching company */}
      <CaseFile key={company.id} company={company} complaints={SAMPLE_COMPLAINTS} />
      <CrossStateTable company={company} className="lg:col-span-2" />
    </div>
  );
}
