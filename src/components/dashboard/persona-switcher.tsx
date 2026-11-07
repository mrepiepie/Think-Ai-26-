"use client";

import { Building2, Gavel, UserRound } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Persona } from "@/data/types";

const PERSONAS: { value: Persona; label: string; icon: typeof Building2 }[] = [
  { value: "company", label: "Small Company", icon: Building2 },
  { value: "citizen", label: "Citizen", icon: UserRound },
  { value: "investigator", label: "AG Investigator", icon: Gavel },
];

/** Segmented 3-button persona switcher in the top bar. */
export function PersonaSwitcher({
  value,
  onChange,
}: {
  value: Persona;
  onChange: (p: Persona) => void;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as Persona)}>
      <TabsList
        aria-label="Persona"
        className="h-8! rounded-md border border-border bg-background/60 p-0.5"
      >
        {PERSONAS.map(({ value: v, label, icon: Icon }) => (
          <TabsTrigger
            key={v}
            value={v}
            className="rounded-[5px] px-2.5 font-mono text-[10.5px] tracking-wider uppercase data-active:border-primary/40! data-active:bg-primary/15! data-active:text-foreground"
          >
            <Icon aria-hidden />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
