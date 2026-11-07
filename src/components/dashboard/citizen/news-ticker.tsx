import type { Headline } from "@/data/types";
import { SampleBadge } from "../sample-badge";

/** Scrolling "LIVE" ticker of placeholder headlines. Pauses on hover. */
export function NewsTicker({
  headlines,
  className,
}: {
  headlines: Headline[];
  className?: string;
}) {
  const items = headlines.map((h) => (
    <span key={h.id} className="flex shrink-0 items-center gap-3 pr-8">
      <span className="text-primary/70" aria-hidden>
        ◆
      </span>
      <span>{h.text}</span>
      <span className="text-muted-foreground/60">[{h.source}]</span>
    </span>
  ));

  return (
    <section
      aria-label="Sample headlines"
      className={`flex h-8 items-center overflow-hidden rounded-md border border-border bg-card/70 ${className ?? ""}`}
    >
      <div className="flex h-full shrink-0 items-center gap-2 border-r border-border px-3">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-70 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2 rounded-full bg-live" />
        </span>
        <span className="font-mono text-[10.5px] font-semibold tracking-widest text-live">LIVE</span>
        <SampleBadge />
      </div>
      <div className="group relative min-w-0 flex-1 overflow-hidden">
        <div
          className="flex w-max animate-ticker font-mono text-[10.5px] tracking-wider whitespace-nowrap text-foreground/85 uppercase group-hover:[animation-play-state:paused] motion-reduce:animate-none"
          style={{ ["--ticker-duration" as string]: `${headlines.length * 9}s` }}
        >
          <div className="flex">{items}</div>
          <div className="flex" aria-hidden>
            {items}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-card to-transparent" />
      </div>
    </section>
  );
}
