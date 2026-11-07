import type { OfficialStatement } from "@/data/types";
import { Panel } from "../panel";

const STANCE_LABEL: Record<OfficialStatement["stance"], string> = {
  supports: "Supports",
  opposes: "Opposes",
  mixed: "Mixed / reviewing",
};

/** Placeholder statements from generic roles, all sides, neutral styling. */
export function OfficialsPanel({
  statements,
  className,
}: {
  statements: OfficialStatement[];
  className?: string;
}) {
  return (
    <Panel title="What officials are saying" sample className={className}>
      <ul className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-5">
        {statements.map((s) => (
          <li key={s.id} className="flex flex-col gap-1.5 bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                {s.role}
              </span>
            </div>
            <span className="w-fit rounded-sm border border-border px-1 font-mono text-[9px] tracking-wider text-foreground/80 uppercase">
              {STANCE_LABEL[s.stance]}
            </span>
            <p className="text-xs leading-relaxed text-muted-foreground">{s.statement}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
