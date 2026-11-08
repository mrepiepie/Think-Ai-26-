/**
 * Law reader: turn official law text into structured rule cards with Groq.
 *
 *   npm run extract-laws                 all laws in data/laws/sources.json
 *   npm run extract-laws -- ca-sb243     only the listed law ids
 *   npm run extract-laws -- --no-cache   ignore cached chunk results
 *
 * Reads data/laws/<id>.txt, splits long laws into chunks, asks Groq for a
 * rule card per chunk (strict JSON schema), merges the chunks in code,
 * then VERIFIES every quote against the law text. Unverified items are
 * kept but flagged (verified: false) and listed in the output.
 *
 * Writes src/data/generated/rule-cards.json. Chunk replies are cached in
 * .cache/extract-laws/ so re-runs are cheap and can resume after a rate
 * limit. Runs with the "react-server" condition so src/lib/groq.ts
 * (which imports "server-only") can be used here.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { GROQ_MODELS, GroqError, type GroqModel, groqStructured } from "@/lib/groq";
import { lawBody } from "@/lib/law-text";
import { normalizeForMatch, verifyQuote } from "@/lib/quote-verify";
import {
  ChunkExtraction,
  RULE_FIELDS,
  type RuleCard,
  type RuleCardsFile,
  type RuleField,
  type RuleItem,
  type RuleObligation,
} from "@/lib/rule-card";

const ROOT = process.cwd();
const LAWS_DIR = path.join(ROOT, "data", "laws");
const OUT_FILE = path.join(ROOT, "src", "data", "generated", "rule-cards.json");
const CACHE_DIR = path.join(ROOT, ".cache", "extract-laws");

/** Bump when the prompt or schema changes, to invalidate the cache. */
const PROMPT_VERSION = "2";
/**
 * Chunk size in characters. Groq's base tier allows 8K tokens/minute for
 * gpt-oss-120b, and one request must fit in that (input + max output),
 * so chunks stay around 2K tokens. Raise on a higher tier.
 */
const CHUNK_CHARS = Number(process.env.EXTRACT_CHUNK_CHARS ?? 7000);
const MAX_COMPLETION_TOKENS = Number(process.env.EXTRACT_MAX_TOKENS ?? 4000);
const MODEL: GroqModel = GROQ_MODELS.extraction;

interface SourceEntry {
  id: string;
  title: string;
  url: string;
  fetched: string | null;
  file: string | null;
}

const SYSTEM_PROMPT = `You are a careful legal analyst. You read one part of an official US state or city law and extract a structured "rule card".

Rules:
- Use ONLY the law text you are given. Never use outside knowledge, never guess, never fill gaps.
- For EVERY item, "quote" must be copied exactly, character for character, from the law text: one contiguous passage of one or two sentences or clauses that directly supports the item. Do not paraphrase, shorten, fix typos, change capitalization, or add words. Do not use ellipses. Do not quote section numbers or headings alone.
- "text" is a short plain-English summary (max 25 words) for a small-business reader.
- obligations: each separate duty or prohibition on a regulated party (employer, developer, deployer, operator, etc.). Put its deadline or timing in "timing" (e.g. "within 15 days", "no less than ten business days before use", "annually"), or null if the text gives none. The quote must contain the duty and, when present, the timing words.
- Skip definitions, legislative findings, severability and appropriation clauses unless they state who is covered, a trigger, an obligation, a penalty, an enforcer, a cure period or an effective date.
- Skip duties that fall only on government agencies unless they are about enforcement.
- If this part of the law has nothing for a field, return an empty array for it.
- Text in [square brackets] in Texas or New York bill text is deleted old law: never extract from it.`;

/* ------------------------------------------------------------------ */
/* Chunking                                                            */
/* ------------------------------------------------------------------ */

function splitLong(paragraph: string, max: number): string[] {
  if (paragraph.length <= max) return [paragraph];
  const sentences = paragraph.match(/[^.;:]+[.;:]+["”’)]*\s*|[^.;:]+$/g) ?? [paragraph];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && cur.length + s.length > max) {
      out.push(cur.trim());
      cur = "";
    }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Split on paragraph boundaries; each chunk repeats the last short paragraph of the previous one for context. */
export function chunkText(text: string, max = CHUNK_CHARS): string[] {
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => splitLong(p, max));
  const chunks: string[] = [];
  let cur: string[] = [];
  let len = 0;
  for (const p of paras) {
    if (cur.length && len + p.length + 2 > max) {
      chunks.push(cur.join("\n\n"));
      const last = cur[cur.length - 1];
      cur = last.length <= 1200 ? [last] : [];
      len = cur.reduce((n, x) => n + x.length + 2, 0);
    }
    cur.push(p);
    len += p.length + 2;
  }
  if (cur.length) chunks.push(cur.join("\n\n"));
  return chunks;
}

/* ------------------------------------------------------------------ */
/* Extraction                                                          */
/* ------------------------------------------------------------------ */

function cachePath(lawId: string, label: string, chunk: string) {
  const hash = createHash("sha256")
    .update([MODEL, PROMPT_VERSION, SYSTEM_PROMPT, chunk].join("\u0000"))
    .digest("hex")
    .slice(0, 16);
  return path.join(CACHE_DIR, `${lawId}-${label}-${hash}.json`);
}

type ChunkResult = { data: ChunkExtraction; cached: boolean; tokens: number; model: string };

/**
 * Extract one chunk. If the model runs out of output tokens (dense text
 * makes the reasoning long), split the chunk in half and extract each
 * half, down to MIN_SPLIT_CHARS.
 */
const MIN_SPLIT_CHARS = 1500;

async function extractChunk(
  source: SourceEntry,
  chunk: string,
  index: number,
  total: number,
  useCache: boolean,
  label = String(index + 1).padStart(2, "0"),
): Promise<ChunkResult> {
  const halves = chunkText(chunk, Math.ceil(chunk.length / 2) + 200);
  // A previous run already had to split this chunk: reuse those cached parts.
  const splitCached =
    useCache &&
    halves.length >= 2 &&
    !existsSync(cachePath(source.id, label, chunk)) &&
    existsSync(cachePath(source.id, `${label}a`, halves[0]));
  try {
    if (splitCached) throw new GroqError("truncated", "split parts cached");
    return await extractOnce(source, chunk, index, total, useCache, label);
  } catch (err) {
    if (!(err instanceof GroqError && err.kind === "truncated") || chunk.length < MIN_SPLIT_CHARS * 2) throw err;
    if (halves.length < 2) throw err;
    if (!splitCached) console.log(`      … reply too long for one request; splitting into ${halves.length} smaller parts`);
    const merged: ChunkResult = {
      data: Object.fromEntries(RULE_FIELDS.map((f) => [f, []])) as unknown as ChunkExtraction,
      cached: true,
      tokens: 0,
      model: MODEL,
    };
    for (let h = 0; h < halves.length; h++) {
      const r = await extractChunk(source, halves[h], index, total, useCache, `${label}${String.fromCharCode(97 + h)}`);
      for (const f of RULE_FIELDS) (merged.data[f] as unknown[]).push(...r.data[f]);
      merged.cached &&= r.cached;
      merged.tokens += r.tokens;
      merged.model = r.model;
    }
    return merged;
  }
}

async function extractOnce(
  source: SourceEntry,
  chunk: string,
  index: number,
  total: number,
  useCache: boolean,
  label: string,
): Promise<ChunkResult> {
  const file = cachePath(source.id, label, chunk);
  if (useCache && existsSync(file)) {
    const cached = JSON.parse(readFileSync(file, "utf8")) as { model: string; data: unknown };
    const parsed = ChunkExtraction.safeParse(cached.data);
    if (parsed.success) return { data: parsed.data, cached: true, tokens: 0, model: cached.model };
  }

  const user = `Law: ${source.title}
This is part ${index + 1} of ${total} of the law text.

<<<LAW TEXT
${chunk}
LAW TEXT>>>`;

  const result = await groqStructured({
    schema: ChunkExtraction,
    schemaName: "rule_card_chunk",
    system: SYSTEM_PROMPT,
    user,
    model: MODEL,
    maxCompletionTokens: MAX_COMPLETION_TOKENS,
    reasoningEffort: "medium",
    onWait: (m) => console.log(`      … ${m}`),
  });

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify({ model: result.model, data: result.data }, null, 2));
  return { data: result.data, cached: false, tokens: result.usage.totalTokens, model: result.model };
}

/* ------------------------------------------------------------------ */
/* Merge + verify                                                      */
/* ------------------------------------------------------------------ */

function mergeAndVerify(
  perChunk: ChunkExtraction[],
  normalizedLaw: string,
): Pick<RuleCard, RuleField> {
  const out = Object.fromEntries(RULE_FIELDS.map((f) => [f, []])) as unknown as Pick<RuleCard, RuleField>;

  for (const field of RULE_FIELDS) {
    const list = out[field] as RuleItem[];
    const byKey = new Map<string, RuleItem>();
    perChunk.forEach((chunk, ci) => {
      for (const raw of chunk[field]) {
        const quote = raw.quote.trim();
        const text = raw.text.trim();
        // Same quote in the same field = same item (chunks overlap by one paragraph).
        const key = normalizeForMatch(quote);
        const existing = byKey.get(key);
        if (existing) {
          if (!existing.chunks.includes(ci + 1)) existing.chunks.push(ci + 1);
          continue;
        }
        const check = verifyQuote(quote, normalizedLaw);
        const item: RuleItem = {
          text,
          quote,
          verified: check.verified,
          ...(check.reason ? { failReason: check.reason } : {}),
          chunks: [ci + 1],
        };
        if (field === "obligations") {
          const o = raw as ChunkExtraction["obligations"][number];
          (item as RuleObligation).who = o.who.trim();
          (item as RuleObligation).timing = o.timing?.trim() || null;
        }
        byKey.set(key, item);
        list.push(item);
      }
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function loadExisting(): RuleCardsFile {
  if (existsSync(OUT_FILE)) {
    try {
      return JSON.parse(readFileSync(OUT_FILE, "utf8")) as RuleCardsFile;
    } catch {
      /* rewrite below */
    }
  }
  return { generatedAt: null, model: null, note: "", cards: {}, skipped: {} };
}

async function main() {
  loadEnvConfig(ROOT); // loads .env.local the same way Next.js does; values are never printed

  const args = process.argv.slice(2);
  const useCache = !args.includes("--no-cache");
  const only = args.filter((a) => !a.startsWith("--"));

  const sources = JSON.parse(readFileSync(path.join(LAWS_DIR, "sources.json"), "utf8")) as SourceEntry[];
  const selected = only.length ? sources.filter((s) => only.includes(s.id)) : sources;
  if (only.length && selected.length !== only.length) {
    const known = new Set(sources.map((s) => s.id));
    console.error(`Unknown law id(s): ${only.filter((o) => !known.has(o)).join(", ")}`);
    process.exit(1);
  }

  const output = loadExisting();
  output.note =
    "Generated by scripts/extract-laws.ts. AI-extracted from the official law text in data/laws/. Only items with verified: true had their quote found in that text. Not legal advice.";
  let hadErrors = false;
  let tokensUsed = 0;
  let modelUsed: string = MODEL;
  const failures: { law: string; field: string; text: string; quote: string; reason: string }[] = [];

  console.log(`Law reader · model ${MODEL} · chunk size ${CHUNK_CHARS} chars${useCache ? "" : " · cache off"}\n`);

  for (const source of selected) {
    const file = path.join(LAWS_DIR, `${source.id}.txt`);
    if (!existsSync(file)) {
      const reason = "No official text saved in data/laws/ (not fetched).";
      console.log(`✗ ${source.id}: skipped. ${reason}`);
      output.skipped[source.id] = reason;
      delete output.cards[source.id];
      continue;
    }

    const body = lawBody(readFileSync(file, "utf8"));
    const normalizedLaw = normalizeForMatch(body);
    const chunks = chunkText(body);
    console.log(`▸ ${source.id} (${body.length.toLocaleString()} chars, ${chunks.length} chunk${chunks.length === 1 ? "" : "s"})`);

    const perChunk: ChunkExtraction[] = [];
    try {
      for (let i = 0; i < chunks.length; i++) {
        const r = await extractChunk(source, chunks[i], i, chunks.length, useCache);
        tokensUsed += r.tokens;
        modelUsed = r.model;
        const n = RULE_FIELDS.reduce((sum, f) => sum + r.data[f].length, 0);
        console.log(`    chunk ${i + 1}/${chunks.length}: ${n} items${r.cached ? " (cached)" : ` (${r.tokens} tokens)`}`);
        perChunk.push(r.data);
      }
    } catch (err) {
      hadErrors = true;
      const msg = err instanceof GroqError ? `[${err.kind}] ${err.message}` : String(err);
      console.error(`  ✗ ${source.id}: extraction failed: ${msg}`);
      console.error(`    Previous card for this law (if any) was kept. Re-run to resume from cache.`);
      continue;
    }

    const merged = mergeAndVerify(perChunk, normalizedLaw);
    const all = RULE_FIELDS.flatMap((f) => (merged[f] as RuleItem[]).map((item) => ({ f, item })));
    const verified = all.filter((x) => x.item.verified).length;
    for (const { f, item } of all) {
      if (!item.verified) {
        failures.push({ law: source.id, field: f, text: item.text, quote: item.quote, reason: item.failReason ?? "" });
      }
    }

    const card: RuleCard = {
      lawId: source.id,
      title: source.title,
      sourceUrl: source.url,
      fetched: source.fetched ?? "",
      model: modelUsed,
      extractedAt: new Date().toISOString(),
      chunkCount: chunks.length,
      ...merged,
      stats: { items: all.length, verified, failed: all.length - verified },
    };
    output.cards[source.id] = card;
    delete output.skipped[source.id];
    console.log(`  ✓ ${all.length} items · ${verified} verified · ${all.length - verified} failed`);
  }

  output.generatedAt = new Date().toISOString();
  output.model = [...new Set(Object.values(output.cards).map((c) => c.model))].join(", ") || MODEL;
  mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2) + "\n");

  /* ---------- summary ---------- */
  console.log(`\nSummary (model ${MODEL}${tokensUsed ? `, ${tokensUsed.toLocaleString()} tokens this run` : ""})`);
  console.log("law".padEnd(14) + "items".padStart(7) + "verified".padStart(10) + "failed".padStart(8));
  for (const s of sources) {
    const c = output.cards[s.id];
    if (c) {
      console.log(
        s.id.padEnd(14) +
          String(c.stats.items).padStart(7) +
          String(c.stats.verified).padStart(10) +
          String(c.stats.failed).padStart(8) +
          `   ${c.model}`,
      );
    } else {
      console.log(s.id.padEnd(14) + "  —  " + (output.skipped[s.id] ?? "not extracted"));
    }
  }

  if (failures.length) {
    console.log(`\nUnverified items (${failures.length}) — kept in the JSON with verified: false:`);
    for (const f of failures) {
      const q = f.quote.length > 140 ? f.quote.slice(0, 137) + "..." : f.quote;
      console.log(`  ✗ ${f.law} · ${f.field} · ${f.reason}\n      item:  ${f.text}\n      quote: "${q}"`);
    }
  } else {
    console.log("\nAll extracted quotes were found in the law text.");
  }
  console.log(`\nWrote ${path.relative(ROOT, OUT_FILE)}`);
  if (hadErrors) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof GroqError ? `[${err.kind}] ${err.message}` : err);
  process.exit(1);
});
