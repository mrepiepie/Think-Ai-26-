import { LAWS_BY_ID } from "@/data/laws";
import { stateName } from "@/data/states";
import type { InvestigatedCompany } from "@/data/types";
import { TAG_LABEL } from "@/lib/compliance";
import { LAW_RULES_BY_ID, enforcementFacts } from "@/lib/matching";
import { FactList, OtherLawsNote } from "../enforcement-facts";
import { Panel } from "../panel";

const DASH = <span className="text-muted-foreground">—</span>;

/** F21: how the same company is treated in different states. */
export function CrossStateTable({
  company,
  className,
}: {
  company: InvestigatedCompany;
  className?: string;
}) {
  const rows = Object.entries(company.complaintsByState).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...rows.map(([, n]) => n));
  return (
    <Panel
      title="Cross-state comparison"
      sample
      className={className}
      actions={<span className="truncate text-[11px] text-muted-foreground">{company.name}</span>}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left align-top text-xs">
          <thead className="sticky top-0 bg-card font-mono text-[9.5px] tracking-wider text-muted-foreground uppercase">
            <tr className="border-b border-border">
              <th className="px-3 py-2 font-medium">State</th>
              <th className="px-3 py-2 font-medium">Complaints</th>
              <th className="px-3 py-2 font-medium">Possibly relevant law</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="w-[22%] px-3 py-2 font-medium">Enforced by</th>
              <th className="w-[20%] px-3 py-2 font-medium">Cure period</th>
              <th className="w-[22%] px-3 py-2 font-medium">Penalty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(([state, n]) => {
              const lawId = company.lawByState[state];
              const law = lawId ? LAWS_BY_ID[lawId] : null;
              const rule = lawId ? LAW_RULES_BY_ID[lawId] : null;
              return (
                <tr key={state} className="align-top hover:bg-muted/30">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="mr-1.5 font-mono text-[10px] text-muted-foreground">{state}</span>
                    {stateName(state)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 font-mono tabular-nums">{n}</span>
                      <span className="h-1 w-16 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${(n / max) * 100}%` }}
                        />
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {law ? law.name : <span className="text-muted-foreground">No tracked law</span>}
                    {rule && <OtherLawsNote rule={rule} />}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {law ? law.tags.map((t) => TAG_LABEL[t]).join(" · ") : DASH}
                  </td>
                  <td className="px-3 py-2 text-[11px]">
                    {rule ? <FactList items={enforcementFacts(rule, "enforcedBy")} /> : DASH}
                  </td>
                  <td className="px-3 py-2 text-[11px]">
                    {rule ? <FactList items={enforcementFacts(rule, "curePeriod")} /> : DASH}
                  </td>
                  <td className="px-3 py-2 text-[11px]">
                    {rule ? <FactList items={enforcementFacts(rule, "penalties")} /> : DASH}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-3 py-2 text-[10.5px] text-muted-foreground">
        Complaint counts are sample data. Enforcement, cure and penalty facts are reviewed against the
        official law text and match the checklist. &quot;Not verified&quot; = no official text on file for that
        law yet. — = no tracked law.
      </p>
    </Panel>
  );
}
