"use client";

import { useState } from "react";
import type { Persona } from "@/data/types";
import { CitizenScreen } from "./citizen/citizen-screen";
import { Footer } from "./footer";
import { InvestigatorScreen } from "./investigator/investigator-screen";
import { SmallCompanyScreen } from "./small-company/small-company-screen";
import { TopBar } from "./top-bar";

/** App shell: top bar, the active persona's screen, and the footer. */
export function Dashboard() {
  const [persona, setPersona] = useState<Persona>("company");

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <TopBar persona={persona} onPersonaChange={setPersona} />
      <main className="min-h-0 flex-1 p-2">
        {persona === "company" && <SmallCompanyScreen />}
        {persona === "citizen" && <CitizenScreen />}
        {persona === "investigator" && <InvestigatorScreen />}
      </main>
      <Footer />
    </div>
  );
}
