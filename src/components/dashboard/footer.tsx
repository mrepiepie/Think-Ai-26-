export function Footer() {
  return (
    <footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-3 py-1.5 font-mono text-[10px] tracking-wide text-muted-foreground">
      <span className="font-semibold text-foreground">Not legal advice.</span>
      <span>
        Law facts from the team PRD, section 3 (verified 7 Nov 2026). Panels
        marked “Sample data” use placeholder content.
      </span>
      <span className="ml-auto">
        Map data: US Census Bureau (us-atlas) · Natural Earth (India point-of-view)
      </span>
    </footer>
  );
}
