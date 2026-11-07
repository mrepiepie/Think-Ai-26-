import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Marks content that is placeholder / sample data. */
export function SampleBadge({
  label = "Sample data",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-4 rounded-sm border-dashed px-1.5 font-mono text-[9px] tracking-wider text-muted-foreground uppercase",
        className,
      )}
    >
      {label}
    </Badge>
  );
}
