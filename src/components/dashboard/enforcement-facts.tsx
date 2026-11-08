"use client";

import { Quote } from "lucide-react";
import { useId, useState } from "react";
import { OTHER_LAWS_NOTE, isNotStated } from "@/lib/matching";
import type { RuleItem } from "@/lib/rule-card";

/**
 * Enforcement, penalty or cure facts, each with its quote where there is one.
 * A "not stated in the law text" line carries a note so it doesn't read as "no risk".
 */
export function FactList({ items }: { items: RuleItem[] }) {
  if (items.length === 0) return <span className="text-muted-foreground italic">Not verified</span>;
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div key={item.text}>
          {item.text}
          {isNotStated(item) && <div className="text-[10px] text-muted-foreground italic">{OTHER_LAWS_NOTE}</div>}
          {item.quote && <QuoteToggle quote={item.quote} />}
        </div>
      ))}
    </div>
  );
}

/** Small toggle that reveals the exact supporting sentence(s) from the law. */
export function QuoteToggle({ quote, className }: { quote: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="inline-flex items-center gap-1 font-mono text-[9.5px] tracking-wider text-primary uppercase hover:underline focus-visible:underline focus-visible:outline-none"
      >
        <Quote className="size-2.5" aria-hidden />
        {open ? "Hide quote" : "Quote"}
      </button>
      {open && (
        <blockquote
          id={id}
          className="mt-1 border-l-2 border-primary/50 bg-muted/40 py-1 pr-1.5 pl-2 text-[11px] leading-relaxed text-muted-foreground"
        >
          “{quote}”
        </blockquote>
      )}
    </div>
  );
}
