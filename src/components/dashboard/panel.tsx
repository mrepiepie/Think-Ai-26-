import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SampleBadge } from "./sample-badge";

/**
 * Mission-control panel: thin border, small uppercase mono title,
 * optional header actions and a "Sample data" badge.
 */
export function Panel({
  title,
  sample = false,
  actions,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  sample?: boolean;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-border bg-card/70 backdrop-blur-sm",
        className,
      )}
    >
      <header className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3">
        <span className="size-1.5 shrink-0 rounded-[1px] bg-primary" aria-hidden />
        <h2 className="truncate font-mono text-[10.5px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
          {title}
        </h2>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {actions}
          {sample && <SampleBadge />}
        </div>
      </header>
      <div className={cn("min-h-0 flex-1 overflow-auto", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Small uppercase mono label used inside panels. */
export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase",
        className,
      )}
    >
      {children}
    </div>
  );
}
