"use client";

import { Check, Copy, Loader2, RotateCcw, Square, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { jurisdictionName } from "@/data/states";
import type { LawMatch } from "@/lib/matching";
import { citedLabels, fillCompanyName, noticeQuotes } from "@/lib/notice";
import type { ConfirmedProfile } from "@/lib/product-profile";
import { Eyebrow } from "../panel";
import { SampleBadge } from "../sample-badge";

type Phase = "streaming" | "done" | "stopped" | "error";

/**
 * Notice drafter: `open(match)` (called from the "Draft notice" click)
 * opens the dialog and starts streaming right away. Streaming starts from
 * the event handler, not an effect, so exactly one Groq request is sent.
 */
export function useNoticeDrafter(profile: ConfirmedProfile | null, isExample: boolean) {
  const [match, setMatch] = useState<LawMatch | null>(null);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("done");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function start(m: LawMatch) {
    if (!profile) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    // A newer run (Redraft) supersedes this one; a superseded run never touches state.
    const current = () => abortRef.current === ac;
    setText("");
    setError(null);
    setPhase("streaming");
    try {
      const res = await fetch("/api/draft-notice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lawId: m.law.id, profile }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Draft failed (HTTP ${res.status}).`);
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!current()) return;
        setText((t) => t + value);
      }
      if (current()) setPhase("done");
    } catch (err) {
      if (!current()) return;
      if (ac.signal.aborted) {
        setPhase("stopped");
        return;
      }
      setError(
        err instanceof Error && err.message !== "Failed to fetch"
          ? err.message
          : "Couldn't reach the server. Check your connection and try again.",
      );
      setPhase("error");
    }
  }

  function open(m: LawMatch) {
    setMatch(m);
    void start(m);
  }

  function close() {
    abortRef.current?.abort();
    abortRef.current = null;
    setMatch(null);
  }

  const dialog = (
    <Dialog open={!!match} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-2xl">
        {match && (
          <DrafterBody
            match={match}
            text={fillCompanyName(text, profile?.companyName)}
            isExample={isExample}
            phase={phase}
            error={error}
            onStop={() => abortRef.current?.abort()}
            onRedraft={() => void start(match)}
            onError={setError}
          />
        )}
      </DialogContent>
    </Dialog>
  );

  return { open, dialog };
}

function DrafterBody({
  match,
  text,
  isExample,
  phase,
  error,
  onStop,
  onRedraft,
  onError,
}: {
  match: LawMatch;
  text: string;
  isExample: boolean;
  phase: Phase;
  error: string | null;
  onStop: () => void;
  onRedraft: () => void;
  onError: (msg: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const quotes = noticeQuotes(match);
  const cited = citedLabels(text);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      onError("Couldn't copy to the clipboard. Select the text and copy it manually.");
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Draft notice: {match.law.name}</DialogTitle>
        <DialogDescription>
          {jurisdictionName(match.rule.jurisdictionKey)}. Written by AI from {quotes.length} verified quote
          {quotes.length === 1 ? "" : "s"} of the law and your profile only. Not legal advice.
        </DialogDescription>
        {isExample && <SampleBadge />}
      </DialogHeader>

      <div className="min-h-0 space-y-3 overflow-auto">
        <pre
          aria-live="polite"
          aria-busy={phase === "streaming"}
          className="min-h-40 rounded-md border border-border bg-background/60 p-3 font-sans text-xs leading-relaxed whitespace-pre-wrap"
        >
          {text}
          {phase === "streaming" && <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-primary align-middle" />}
        </pre>

        {phase === "stopped" && <p className="text-[11px] text-muted-foreground">Stopped. The draft above is incomplete.</p>}
        {error && (
          <p role="alert" className="rounded-sm border border-status-noncompliant/40 bg-status-noncompliant/10 p-2 text-[11px] text-status-noncompliant">
            {error}
          </p>
        )}
        {phase === "done" && cited.size === 0 && (
          <p className="flex items-center gap-1.5 text-[11px] text-status-soon">
            <TriangleAlert className="size-3.5" aria-hidden />
            This draft cites none of the quotes. Treat it with extra care, or redraft.
          </p>
        )}

        <div className="space-y-1">
          <Eyebrow>Quotes sent to the AI</Eyebrow>
          <ol className="space-y-1.5">
            {quotes.map((q) => (
              <li key={q.label} className="text-[11px]">
                <span className={cited.has(q.label) ? "font-mono font-semibold text-primary" : "font-mono text-muted-foreground"}>
                  [{q.label}]
                </span>{" "}
                {cited.has(q.label) && <span className="font-mono text-[9.5px] text-primary uppercase">cited · </span>}
                <span className="text-muted-foreground">“{q.quote}”</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {phase === "streaming" ? (
          <Button variant="outline" size="sm" onClick={onStop}>
            <Square data-icon="inline-start" />
            Stop
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={onRedraft}>
            <RotateCcw data-icon="inline-start" />
            Redraft
          </Button>
        )}
        <Button size="sm" onClick={copy} disabled={!text || phase === "streaming"}>
          {copied ? (
            <Check data-icon="inline-start" />
          ) : phase === "streaming" ? (
            <Loader2 className="animate-spin" data-icon="inline-start" />
          ) : (
            <Copy data-icon="inline-start" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </>
  );
}
