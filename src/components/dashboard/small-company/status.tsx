import type { ComplianceStatus, LawStatusTag } from "@/data/types";
import { STATUS_COLOR, STATUS_LABEL, TAG_LABEL } from "@/lib/compliance";
import { cn } from "@/lib/utils";

export function StatusDot({
  status,
  className,
}: {
  status: ComplianceStatus | null;
  className?: string;
}) {
  const color = status ? STATUS_COLOR[status] : "oklch(0.3 0.01 275)";
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ background: color, boxShadow: status ? `0 0 6px ${color}` : undefined }}
    />
  );
}

/** Coloured status label; `label` overrides the generic text (e.g. with a date). */
export function StatusPill({ status, label }: { status: ComplianceStatus; label?: string }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      className="inline-flex h-5 shrink-0 items-center gap-1.5 rounded-sm border px-1.5 font-mono text-[9.5px] font-medium tracking-wider whitespace-nowrap uppercase"
      style={{
        color,
        borderColor: `color-mix(in oklch, ${color} 45%, transparent)`,
        background: `color-mix(in oklch, ${color} 12%, transparent)`,
      }}
    >
      <StatusDot status={status} className="size-1.5" />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}

/** Neutral chips for a law's lifecycle tags. */
export function LawTags({ tags }: { tags: LawStatusTag[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className={cn(
            "rounded-sm border px-1 font-mono text-[9px] tracking-wider text-muted-foreground uppercase",
            tag === "challenged" ? "border-primary/50 text-primary" : "border-border",
          )}
        >
          {TAG_LABEL[tag]}
        </span>
      ))}
    </span>
  );
}
